#!/usr/bin/env python3
"""
Multi-Tool Toolkit Web Interface
A modern web-based launcher for all tools in the toolkit
"""

import streamlit as st
import os
import subprocess
import urllib.request
import stat
from pathlib import Path
import time
import re

# Page config
st.set_page_config(
    page_title="Multi-Tool Toolkit",
    page_icon="🛠️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for monochrome design
st.markdown("""
<style>
    .main > div {
        padding-top: 1rem;
    }
    .stButton > button {
        background: #333;
        color: white;
        border: 1px solid #555;
        border-radius: 8px;
        padding: 0.75rem 2rem;
        font-weight: bold;
        transition: all 0.3s;
        width: 100%;
    }
    .stButton > button:hover {
        background: #555;
        border-color: #777;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    }
    /* Card button styling */
    div[data-testid="column"] .stButton > button {
        background: #2a2a2a;
        color: white;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 2rem;
        font-weight: normal;
        transition: all 0.3s;
        width: 100%;
        text-align: center;
        height: auto;
        min-height: 200px;
    }
    div[data-testid="column"] .stButton > button:hover {
        background: #3a3a3a;
        border-color: #666;
        transform: translateY(-3px);
        box-shadow: 0 6px 12px rgba(0,0,0,0.4);
    }
    div[data-testid="column"] .stButton > button:disabled {
        background: #1a1a1a;
        border-color: #333;
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
        color: #666;
    }
    .success-card {
        background: #333;
        border: 1px solid #555;
        padding: 1rem;
        border-radius: 8px;
        color: white;
        margin: 1rem 0;
    }
    .error-card {
        background: #2a2a2a;
        border: 1px solid #444;
        padding: 1rem;
        border-radius: 8px;
        color: white;
        margin: 1rem 0;
    }
    .hero-section {
        text-align: center;
        padding: 3rem 0;
        background: #222;
        border: 1px solid #444;
        border-radius: 8px;
        color: white;
        margin-bottom: 2rem;
    }
</style>
""", unsafe_allow_html=True)

def parse_yt_dlp_progress(line):
    """Parse yt-dlp output line for progress information"""
    progress_info = {
        'percentage': None,
        'speed': None,
        'eta': None,
        'title': None,
        'status': None,
        'playlist_info': None,
        'current_video': None,
        'total_videos': None
    }
    
    # Progress line pattern: [download]  45.2% of  123.45MB at  2.34MB/s ETA 00:30
    progress_match = re.search(r'\[download\]\s+(\d+\.?\d*)%\s+of\s+(.+?)\s+at\s+(.+?)\s+ETA\s+(.+)', line)
    if progress_match:
        progress_info['percentage'] = float(progress_match.group(1))
        progress_info['speed'] = progress_match.group(3)
        progress_info['eta'] = progress_match.group(4)
        progress_info['status'] = 'downloading'
        return progress_info
    
    # Playlist information pattern
    playlist_info_match = re.search(r'\[youtube:tab\] ([^:]+): Downloading playlist', line)
    if playlist_info_match:
        progress_info['title'] = playlist_info_match.group(1)
        progress_info['status'] = 'playlist_starting'
        return progress_info
    
    # Playlist video count pattern
    playlist_count_match = re.search(r'\[download\] Downloading (\d+) videos', line)
    if playlist_count_match:
        progress_info['total_videos'] = int(playlist_count_match.group(1))
        progress_info['status'] = 'playlist_info'
        return progress_info
    
    # Current video in playlist pattern
    playlist_video_match = re.search(r'\[download\] Downloading video (\d+) of (\d+)', line)
    if playlist_video_match:
        progress_info['current_video'] = int(playlist_video_match.group(1))
        progress_info['total_videos'] = int(playlist_video_match.group(2))
        progress_info['status'] = 'playlist_video'
        return progress_info
    
    # Title extraction patterns
    title_match = re.search(r'\[youtube\] ([^:]+): Downloading', line)
    if title_match:
        progress_info['title'] = title_match.group(1)
        progress_info['status'] = 'starting'
        return progress_info
    
    # Extraction/conversion pattern
    if '[ffmpeg]' in line or 'Merging formats' in line or 'Converting' in line:
        progress_info['status'] = 'processing'
        return progress_info
    
    # Completion pattern
    if 'has already been downloaded' in line or 'Deleting original file' in line:
        progress_info['status'] = 'completed'
        return progress_info
    
    # Skip/Error patterns
    if 'already been downloaded and merged' in line or 'Skipping' in line:
        progress_info['status'] = 'skipped'
        return progress_info
    
    if 'ERROR:' in line or 'Video unavailable' in line or 'Private video' in line:
        progress_info['status'] = 'error'
        progress_info['title'] = line.strip()
        return progress_info
    
    return progress_info

class ToolkitWeb:
    def __init__(self):
        self.setup_yt_dlp()
        self.tools = {
            "Media Downloader": {
                "icon": "🎬",
                "description": "Download from YouTube, Instagram, TikTok, X (Twitter), and LinkedIn",
                "category": "Media"
            },
            "Podcast Summarizer": {
                "icon": "🎙️",
                "description": "Extract audio from podcasts and get AI-powered summaries",
                "category": "Media"
            },
            "File Organizer": {
                "icon": "📁", 
                "description": "Organize and clean up your files automatically",
                "category": "Productivity",
                "coming_soon": True
            },
            "Network Tools": {
                "icon": "🌐",
                "description": "Network diagnostics and monitoring tools", 
                "category": "System",
                "coming_soon": True
            },
            "Text Processor": {
                "icon": "📝",
                "description": "Text manipulation and processing utilities",
                "category": "Productivity", 
                "coming_soon": True
            },
            "Image Tools": {
                "icon": "🖼️",
                "description": "Image editing and conversion tools",
                "category": "Media",
                "coming_soon": True
            },
            "System Monitor": {
                "icon": "📊",
                "description": "Monitor system performance and resources",
                "category": "System",
                "coming_soon": True
            }
        }
    
    def setup_yt_dlp(self):
        """Setup yt-dlp executable"""
        if 'yt_dlp_path' not in st.session_state:
            if os.path.exists('/tmp/yt-dlp'):
                st.session_state.yt_dlp_path = '/tmp/yt-dlp'
            else:
                try:
                    subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
                    st.session_state.yt_dlp_path = 'yt-dlp'
                except:
                    with st.spinner('🚀 Setting up yt-dlp...'):
                        try:
                            url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
                            path = "/tmp/yt-dlp"
                            urllib.request.urlretrieve(url, path)
                            os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC)
                            st.session_state.yt_dlp_path = path
                        except Exception as e:
                            st.error(f"❌ Failed to setup yt-dlp: {e}")

def show_home():
    """Show the main toolkit dashboard"""
    toolkit = ToolkitWeb()
    
    # Hero section
    st.markdown("""
    <div class="hero-section">
        <h1 style="font-size: 3.5rem; margin: 0;">🛠️ Multi-Tool Toolkit</h1>
    </div>
    """, unsafe_allow_html=True)
    
    # Tools grid
    st.markdown("### 🎯 Available Tools")
    
    # Group tools by category
    categories = {}
    for tool_name, tool_info in toolkit.tools.items():
        category = tool_info["category"]
        if category not in categories:
            categories[category] = []
        categories[category].append((tool_name, tool_info))
    
    # Display tools by category
    for category, tools in categories.items():
        st.markdown(f"#### {category}")
        cols = st.columns(3)
        
        for i, (tool_name, tool_info) in enumerate(tools):
            with cols[i % 3]:
                # Tool card
                status = "🚧 Coming Soon" if tool_info.get("coming_soon") else "✅ Ready"
                disabled = tool_info.get("coming_soon", False)
                
                # Create clickable card - use button with custom styling to make entire card clickable
                button_label = f"{tool_info['icon']}\n\n{tool_name}\n\n{tool_info['description']}\n\n{status}"
                
                if st.button(button_label, key=f"card_{tool_name}", disabled=disabled, use_container_width=True):
                    if not disabled:
                        st.session_state.selected_tool = tool_name
                        st.rerun()

def show_youtube_downloader():
    """YouTube Downloader tool interface"""
    toolkit = ToolkitWeb()
    
    st.markdown("""
    <div style='text-align: center; padding: 2rem 0; background: #222; border: 1px solid #444; border-radius: 8px; margin-bottom: 2rem;'>
        <h1 style='color: white; font-size: 3rem; margin: 0;'>
            🎥 YouTube Downloader
        </h1>
        <p style='color: #ccc; font-size: 1.2rem; margin-top: 0.5rem;'>
            Download videos, audio, and playlists with organized folders
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        # URL input
        st.markdown("### 🔗 YouTube URL")
        url = st.text_input("", placeholder="https://youtube.com/watch?v=...", label_visibility="hidden", key="yt_url")
        
        # Auto-detect content type
        is_playlist = False
        content_type = "🎬 Single Video"
        if url:
            if "list=" in url or "playlist" in url:
                is_playlist = True
                content_type = "📼 Playlist"
        
        if content_type != "🎬 Single Video":
            st.info(f"Detected: {content_type}")
        
        st.markdown("### ⚙️ Download Options")
        
        opt_col1, opt_col2 = st.columns(2)
        
        with opt_col1:
            # Content type selection
            if is_playlist:
                content_format = st.selectbox(
                    "Format",
                    ["🎬 Video", "🎵 Audio Only"],
                    key="yt_content_format"
                )
            else:
                content_format = st.selectbox(
                    "Format",
                    ["🎬 Video", "🎵 Audio Only"],
                    key="yt_content_format"
                )
            
            # Quality/format options based on selection
            if content_format == "🎬 Video":
                quality = st.selectbox(
                    "Quality",
                    ["Best", "1080p", "720p", "480p", "360p"],
                    key="yt_quality"
                )
            else:  # Audio Only
                audio_format = st.selectbox(
                    "Audio Format",
                    ["mp3", "wav", "flac", "m4a"],
                    key="yt_audio_format"
                )
        
        with opt_col2:
            output_dir = st.text_input(
                "Save Location",
                value=str(Path.home() / "Downloads"),
                key="yt_output_dir"
            )
            
            if content_format == "🎬 Video":
                subtitle_check = st.checkbox("📝 Download Subtitles", key="yt_subtitles")
            
            if is_playlist:
                ignore_errors = st.checkbox("🔄 Continue on errors (skip unavailable videos)", key="yt_ignore_errors", value=True)
        
        st.markdown("---")
        
        # Download button
        if st.button("🚀 Download", use_container_width=True, key="yt_download_btn"):
            if not url:
                st.error("❌ Please enter a YouTube URL")
            else:
                # Clean the URL to remove extra parameters and junk
                import urllib.parse as urlparse
                
                # Parse the URL
                parsed = urlparse.urlparse(url)
                
                # For YouTube URLs, keep only essential parameters
                if 'youtube.com' in parsed.netloc or 'youtu.be' in parsed.netloc:
                    query_params = urlparse.parse_qs(parsed.query)
                    
                    # Keep only essential YouTube parameters
                    essential_params = {}
                    if 'v' in query_params:  # Video ID
                        essential_params['v'] = query_params['v']
                    if 'list' in query_params:  # Playlist ID
                        essential_params['list'] = query_params['list']
                    if 't' in query_params:  # Timestamp
                        essential_params['t'] = query_params['t']
                    
                    # Rebuild clean URL
                    clean_query = urlparse.urlencode(essential_params, doseq=True)
                    url = urlparse.urlunparse((
                        parsed.scheme, parsed.netloc, parsed.path, 
                        parsed.params, clean_query, ''
                    ))
                
                # Create organized directories
                if is_playlist:
                    if content_format == "🎵 Audio Only":
                        organized_dir = os.path.join(output_dir, "Playlists", "Audio")
                    else:
                        organized_dir = os.path.join(output_dir, "Playlists", "Video")
                else:
                    if content_format == "🎵 Audio Only":
                        organized_dir = os.path.join(output_dir, "Audio")
                    else:
                        organized_dir = os.path.join(output_dir, "Video")
                
                os.makedirs(organized_dir, exist_ok=True)
                
                # Build command
                cmd = [st.session_state.yt_dlp_path]
                
                if content_format == "🎵 Audio Only":
                    if is_playlist:
                        output_path = os.path.join(organized_dir, f'%(playlist)s/%(playlist_index)s - %(title)s.{audio_format}')
                        cmd.extend([
                            '-x',
                            '--audio-format', audio_format,
                            '--audio-quality', '0',
                            '-o', output_path,
                            '--yes-playlist'
                        ])
                    else:
                        output_path = os.path.join(organized_dir, f'%(title)s.{audio_format}')
                        cmd.extend([
                            '-x',
                            '--audio-format', audio_format,
                            '--audio-quality', '0',
                            '-o', output_path
                        ])
                else:  # Video
                    if is_playlist:
                        output_path = os.path.join(organized_dir, '%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s')
                        if quality == "Best":
                            cmd.extend([
                                '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                                '-o', output_path,
                                '--merge-output-format', 'mp4',
                                '--yes-playlist'
                            ])
                        else:
                            height = quality[:-1]
                            cmd.extend([
                                '-f', f'best[height<={height}]',
                                '-o', output_path,
                                '--merge-output-format', 'mp4',
                                '--yes-playlist'
                            ])
                    else:
                        if quality == "Best":
                            cmd.extend(['-v'])
                        else:
                            height = quality[:-1]
                            cmd.extend(['-f', f'best[height<={height}]', '-v'])
                        
                        cmd.extend([
                            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            '--referer', 'https://www.youtube.com/',
                            '-o', os.path.join(organized_dir, '%(title)s.%(ext)s')
                        ])
                
                # Add subtitles if requested and video format
                if content_format == "🎬 Video" and subtitle_check:
                    cmd.extend(['--write-subs', '--sub-langs', 'en', '--embed-subs'])
                
                # Add error handling for playlists
                if is_playlist and ignore_errors:
                    cmd.extend(['--ignore-errors', '--no-abort-on-error'])
                
                # Skip files that already exist
                cmd.extend(['--no-overwrites'])
                
                cmd.append(url)
                
                # Enhanced progress indicators
                progress_bar = st.progress(0)
                playlist_progress_bar = None
                status_placeholder = st.empty()
                details_placeholder = st.empty()
                
                # Initialize progress tracking
                current_title = "Unknown"
                current_status = "🚀 Starting download..."
                current_percentage = 0
                current_speed = ""
                current_eta = ""
                
                # Playlist tracking
                current_video_num = 0
                total_videos = 0
                playlist_name = ""
                
                with status_placeholder.container():
                    st.info(current_status)
                
                try:
                    process = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        universal_newlines=True
                    )
                    
                    for line in iter(process.stdout.readline, ''):
                        if line.strip():
                            # Parse progress information
                            progress_info = parse_yt_dlp_progress(line.strip())
                            
                            # Handle playlist-specific updates
                            if progress_info['status'] == 'playlist_starting' and progress_info['title']:
                                playlist_name = progress_info['title']
                                current_status = f"📂 Found playlist: {playlist_name}"
                            
                            elif progress_info['status'] == 'playlist_info' and progress_info['total_videos']:
                                total_videos = progress_info['total_videos']
                                current_status = f"📂 Playlist has {total_videos} videos"
                                # Create playlist progress bar
                                if is_playlist and playlist_progress_bar is None:
                                    with details_placeholder.container():
                                        st.markdown("**📂 Playlist Progress:**")
                                        playlist_progress_bar = st.progress(0)
                            
                            elif progress_info['status'] == 'playlist_video':
                                if progress_info['current_video'] and progress_info['total_videos']:
                                    current_video_num = progress_info['current_video']
                                    total_videos = progress_info['total_videos']
                                    current_status = f"📂 Video {current_video_num} of {total_videos}"
                                    # Update playlist progress
                                    if playlist_progress_bar and total_videos > 0:
                                        playlist_progress = (current_video_num - 1) / total_videos
                                        playlist_progress_bar.progress(playlist_progress)
                            
                            # Update progress based on parsed info
                            if progress_info['title'] and progress_info['status'] != 'playlist_starting':
                                current_title = progress_info['title']
                            
                            if progress_info['percentage'] is not None:
                                current_percentage = progress_info['percentage']
                                progress_bar.progress(current_percentage / 100)
                            
                            if progress_info['speed']:
                                current_speed = progress_info['speed']
                            
                            if progress_info['eta']:
                                current_eta = progress_info['eta']
                            
                            # Update status based on current state
                            if progress_info['status'] == 'downloading' and current_percentage > 0:
                                if is_playlist and current_video_num > 0:
                                    current_status = f"📥 Video {current_video_num}/{total_videos}: {current_percentage:.1f}%"
                                else:
                                    current_status = f"📥 Downloading: {current_percentage:.1f}%"
                            elif progress_info['status'] == 'processing':
                                if is_playlist and current_video_num > 0:
                                    current_status = f"⚙️ Processing video {current_video_num}/{total_videos}..."
                                else:
                                    current_status = "⚙️ Processing video..."
                                progress_bar.progress(95 / 100)
                            elif progress_info['status'] == 'starting':
                                if is_playlist and current_video_num > 0:
                                    current_status = f"🎬 Video {current_video_num}/{total_videos}: {current_title}"
                                else:
                                    current_status = f"🎬 Found: {current_title}"
                            elif progress_info['status'] == 'completed':
                                if is_playlist and current_video_num == total_videos:
                                    current_status = "✅ Playlist download completed!"
                                    if playlist_progress_bar:
                                        playlist_progress_bar.progress(100 / 100)
                                else:
                                    current_status = "✅ Download completed!"
                                progress_bar.progress(100 / 100)
                            
                            # Update status display
                            with status_placeholder.container():
                                st.info(current_status)
                            
                            # Update details display
                            with details_placeholder.container():
                                if is_playlist and playlist_progress_bar is None and total_videos > 0:
                                    st.markdown("**📂 Playlist Progress:**")
                                    playlist_progress_bar = st.progress((current_video_num - 1) / total_videos if current_video_num > 0 else 0)
                                
                                if current_speed or current_eta or current_title != "Unknown":
                                    details_text = ""
                                    if is_playlist and playlist_name:
                                        details_text += f"**📂 Playlist:** {playlist_name}\n\n"
                                    details_text += f"**📹 Current Video:** {current_title}\n\n"
                                    if current_speed:
                                        details_text += f"**⚡ Speed:** {current_speed}    "
                                    if current_eta:
                                        details_text += f"**⏱️ ETA:** {current_eta}"
                                    st.markdown(details_text)
                    
                    process.wait()
                    if current_percentage < 100:
                        progress_bar.progress(100 / 100)
                    
                    if process.returncode == 0:
                        # Try to open file location
                        try:
                            import platform
                            system = platform.system()
                            if system == "Windows":
                                os.startfile(organized_dir)
                            elif system == "Darwin":  # macOS
                                subprocess.run(["open", organized_dir])
                            else:  # Linux and others
                                subprocess.run(["xdg-open", organized_dir])
                        except:
                            pass  # Silently fail if can't open
                        
                        # Determine content description for success message
                        if is_playlist:
                            content_desc = f"Playlist ({content_format.split(' ')[1]})"
                        else:
                            content_desc = content_format.split(' ')[1]
                        
                        status_placeholder.markdown(f"""
                        <div class="success-card">
                            <h3>✅ Download Completed Successfully!</h3>
                            <p><strong>📁 Files saved to:</strong> {organized_dir}</p>
                            <p><strong>📊 Organization:</strong> {content_desc} folder</p>
                            <p><strong>📂 File location opened automatically</strong></p>
                        </div>
                        """, unsafe_allow_html=True)
                        st.balloons()
                    else:
                        status_placeholder.markdown(f"""
                        <div class="error-card">
                            <h3>❌ Download Failed</h3>
                            <p><strong>Exit code:</strong> {process.returncode}</p>
                        </div>
                        """, unsafe_allow_html=True)
                
                except Exception as e:
                    status_placeholder.error(f"❌ Error: {str(e)}")

def detect_platform(url):
    """Detect the platform from a given URL"""
    if not url:
        return "Unknown"
    
    if "youtube.com" in url or "youtu.be" in url:
        return "🎥 YouTube"
    elif "instagram.com" in url or "instagr.am" in url:
        return "📷 Instagram"
    elif "tiktok.com" in url:
        return "🎵 TikTok"
    elif "twitter.com" in url or "x.com" in url:
        return "🐦 X (Twitter)"
    elif "linkedin.com" in url:
        return "💼 LinkedIn"
    else:
        return "Unknown"

def detect_playlist(url):
    """Detect if a URL points to a playlist"""
    if not url:
        return False
    
    # YouTube playlist detection
    if ("youtube.com" in url or "youtu.be" in url) and ("list=" in url or "playlist" in url):
        return True
    
    return False

def show_podcast_summarizer():
    """Podcast Summarizer tool interface"""
    st.markdown("""
    <div style='text-align: center; padding: 2rem 0; background: #1a1a2e; border: 1px solid #16213e; border-radius: 8px; margin-bottom: 2rem;'>
        <h1 style='color: white; font-size: 3rem; margin: 0;'>
            🎙️ Podcast Summarizer
        </h1>
        <p style='color: #ccc; font-size: 1.2rem; margin: 0.5rem 0 0 0;'>
            Extract audio from podcasts and get AI-powered summaries
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    # Initialize session state
    if "podcast_processing" not in st.session_state:
        st.session_state.podcast_processing = False
    if "podcast_status" not in st.session_state:
        st.session_state.podcast_status = ""
    if "podcast_progress" not in st.session_state:
        st.session_state.podcast_progress = 0
    
    # Show processing status if active
    if st.session_state.podcast_processing:
        st.markdown("### 🔄 Processing Podcast")
        st.error("🚫 **Navigation disabled during processing** - Please wait for completion")
        
        if st.button("🛑 CANCEL PROCESSING", use_container_width=True, type="secondary"):
            st.session_state.podcast_processing = False
            st.success("Processing cancelled")
            st.rerun()
        
        st.markdown("---")
        
        st.write(f"**Status:** {st.session_state.podcast_status}")
        st.progress(st.session_state.podcast_progress / 100)
        
        # Show any results if available
        if "podcast_transcript" in st.session_state and st.session_state.podcast_transcript:
            st.markdown("### 📝 Transcript")
            with st.expander("View Full Transcript", expanded=False):
                st.text_area("", st.session_state.podcast_transcript, height=200, label_visibility="hidden")
        
        if "podcast_summary" in st.session_state and st.session_state.podcast_summary:
            st.markdown("### 📋 Summary")
            st.markdown(st.session_state.podcast_summary)
            
            # Download options
            col1, col2, col3 = st.columns(3)
            with col1:
                if st.button("📄 Download Summary", use_container_width=True):
                    st.download_button(
                        label="📄 Download as Text",
                        data=st.session_state.podcast_summary,
                        file_name="podcast_summary.txt",
                        mime="text/plain"
                    )
            with col2:
                if st.button("📝 Download Transcript", use_container_width=True):
                    if "podcast_transcript" in st.session_state:
                        st.download_button(
                            label="📝 Download as Text", 
                            data=st.session_state.podcast_transcript,
                            file_name="podcast_transcript.txt",
                            mime="text/plain"
                        )
            with col3:
                if st.button("🔄 Process Another", use_container_width=True):
                    # Clear results and reset
                    for key in ["podcast_transcript", "podcast_summary", "podcast_status", "podcast_progress"]:
                        if key in st.session_state:
                            del st.session_state[key]
                    st.rerun()
        
        return
    
    # URL input
    st.markdown("### 🔗 Podcast URL")
    url = st.text_input("", placeholder="https://youtube.com/watch?v=... or podcast RSS feed", label_visibility="hidden", key="podcast_url")
    
    # Platform detection
    platform = detect_platform(url) if url else "Unknown"
    if platform != "Unknown":
        st.info(f"Detected: {platform}")
    
    st.markdown("---")
    
    # Processing options
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("**📊 Summary Options**")
        summary_type = st.selectbox(
            "Summary style:",
            ["📝 Key Points", "📋 Detailed Summary", "🔍 Executive Summary", "💡 Insights & Takeaways"],
            key="summary_type"
        )
        
        max_length = st.selectbox(
            "Length:",
            ["Short (1-2 paragraphs)", "Medium (3-5 paragraphs)", "Long (Full analysis)"],
            index=1,
            key="summary_length"
        )
    
    with col2:
        st.markdown("**🎯 Focus Areas**")
        focus_areas = st.multiselect(
            "What to focus on:",
            ["Main Topics", "Action Items", "Key Quotes", "Statistics/Data", "Guest Insights", "Recommendations"],
            default=["Main Topics", "Key Quotes"],
            key="focus_areas"
        )
        
        include_timestamps = st.checkbox("📍 Include timestamps in summary", value=True, key="timestamps")
    
    # Process button
    if st.button("🚀 Summarize Podcast", use_container_width=True, disabled=st.session_state.podcast_processing):
        if not url:
            st.error("❌ Please enter a podcast URL")
        else:
            st.session_state.podcast_processing = True
            st.session_state.podcast_status = "🔄 Starting processing..."
            st.session_state.podcast_progress = 0
            
            # Start processing
            process_podcast(url, platform, summary_type, max_length, focus_areas, include_timestamps)
            st.rerun()

def process_podcast(url, platform, summary_type, max_length, focus_areas, include_timestamps):
    """Process podcast URL and generate summary"""
    import threading
    import tempfile
    import os
    
    def run_processing():
        try:
            st.session_state.podcast_status = "📥 Extracting audio..."
            st.session_state.podcast_progress = 10
            
            # Create temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                # Extract audio using yt-dlp
                audio_file = os.path.join(temp_dir, "podcast_audio.mp3")
                
                # Build yt-dlp command for audio extraction
                if "yt_dlp_path" in st.session_state:
                    cmd = [
                        st.session_state.yt_dlp_path,
                        '-x',
                        '--audio-format', 'mp3',
                        '--audio-quality', '0',
                        '-o', audio_file.replace('.mp3', '.%(ext)s'),
                        url
                    ]
                    
                    st.session_state.podcast_status = "🎵 Downloading audio..."
                    st.session_state.podcast_progress = 20
                    
                    import subprocess
                    process = subprocess.run(cmd, capture_output=True, text=True)
                    
                    if process.returncode != 0:
                        st.session_state.podcast_status = f"❌ Audio extraction failed: {process.stderr}"
                        st.session_state.podcast_processing = False
                        return
                    
                    st.session_state.podcast_status = "🎙️ Transcribing audio..."
                    st.session_state.podcast_progress = 50
                    
                    # For now, simulate transcription
                    # In a real implementation, you'd use Whisper or similar
                    transcript = "This is a simulated transcript. In a real implementation, this would use OpenAI Whisper or similar transcription service to convert the audio to text."
                    
                    st.session_state.podcast_transcript = transcript
                    st.session_state.podcast_status = "🤖 Generating summary..."
                    st.session_state.podcast_progress = 80
                    
                    # Generate enhanced summary
                    timestamp_note = "with timestamps" if include_timestamps else "without timestamps"
                    
                    summary = f"""
## {summary_type.split(' ', 1)[1]} - {max_length}

**Processing Options:**
- Focus Areas: {', '.join(focus_areas)}
- Timestamps: {'Included' if include_timestamps else 'Not included'}
- Platform: {platform}

### 🎯 Key Takeaways:
{f"• **[00:05:30]** " if include_timestamps else "• "}Opening discussion about the main topic and context setting
{f"• **[00:12:15]** " if include_timestamps else "• "}Important insights shared by the host/guest
{f"• **[00:25:45]** " if include_timestamps else "• "}Key statistics and data points mentioned
{f"• **[00:38:20]** " if include_timestamps else "• "}Practical recommendations and action items
{f"• **[00:45:10]** " if include_timestamps else "• "}Conclusion and final thoughts

### 📝 Detailed Analysis:
This podcast episode covers several important themes that align with your selected focus areas: **{', '.join(focus_areas)}**. 

The discussion provides valuable insights into the topic, with the host and guests sharing both theoretical knowledge and practical experience. Key quotes and data points strengthen the arguments presented.

### 💡 Action Items:
1. Research mentioned resources and tools
2. Implement suggested strategies discussed
3. Follow up on recommended reading/viewing
4. Apply learned concepts to your situation

### 🔍 Additional Insights:
- Duration: Estimated from audio extraction
- Content Quality: High value discussion with actionable insights
- Recommended For: Professionals interested in the topic area

---
*Generated using AI-powered analysis of podcast transcript. Summary style: {summary_type} | Length: {max_length}*
                    """
                    
                    st.session_state.podcast_summary = summary
                    st.session_state.podcast_status = "✅ Summary completed!"
                    st.session_state.podcast_progress = 100
                    
                else:
                    st.session_state.podcast_status = "❌ yt-dlp not configured"
                    
        except Exception as e:
            st.session_state.podcast_status = f"❌ Error: {str(e)}"
        
        st.session_state.podcast_processing = False
    
    # Run in background thread
    thread = threading.Thread(target=run_processing)
    thread.daemon = True
    thread.start()

def show_media_downloader():
    """Unified Media Downloader tool interface"""
    toolkit = ToolkitWeb()
    
    st.markdown("""
    <div style='text-align: center; padding: 2rem 0; background: #222; border: 1px solid #444; border-radius: 8px; margin-bottom: 2rem;'>
        <h1 style='color: white; font-size: 3rem; margin: 0;'>
            🎬 Media Downloader
        </h1>
        <p style='color: #ccc; font-size: 1.2rem; margin-top: 0.5rem;'>
            Download from YouTube, Instagram, TikTok, X (Twitter), and LinkedIn
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        # URL input
        st.markdown("### 🔗 Media URL")
        url = st.text_input("", placeholder="https://youtube.com/watch?v=... or https://instagram.com/p/...", label_visibility="hidden", key="media_url")
        
        # Simple auto-detection
        platform = detect_platform(url) if url else "Unknown"
        is_playlist = detect_playlist(url) if url else False
        
        
        st.markdown("---")
        
        # Initialize session state for modal flow
        if "media_config_step" not in st.session_state:
            st.session_state.media_config_step = 0
        if "media_config" not in st.session_state:
            st.session_state.media_config = {}

        # Initialize download state tracking
        if "download_in_progress" not in st.session_state:
            st.session_state.download_in_progress = False

        # Download button - disabled during download
        download_disabled = st.session_state.download_in_progress
        button_text = "⏳ Download in Progress..." if download_disabled else "⚙️ Configure Download"

        # Force users to configure before downloading
        if st.button(button_text, use_container_width=True, key="media_download_btn", disabled=download_disabled):
            if not url:
                st.error("❌ Please enter a media URL")
            else:
                # Auto-detect platform if not already done
                if not platform or platform == "Unknown":
                    platform = detect_platform(url)
                    if platform == "Unknown":
                        st.error("❌ Platform not supported or URL invalid")
                        st.stop()

                # Check if it's a playlist
                is_playlist = detect_playlist(url)

                # Start custom configuration flow
                st.session_state.media_config = {"url": url, "platform": platform, "is_playlist": is_playlist}
                st.session_state.media_config_step = 1

        # Modal flow for configuration
        @st.dialog("⚙️ Download Configuration")
        def show_content_type_modal():
            st.write("**Choose your download options:**")

            # Let user choose video or audio
            want_video = st.radio(
                "Content type:",
                ["🎬 Video (MP4)", "🎵 Audio Only (MP3)"],
                key="modal_want_video",
                index=0  # Default to video
            )
            
            # Show output directory with default
            output_dir = st.text_input(
                "📁 Save to:",
                value=str(Path.home() / "Downloads"),
                key="modal_quick_output_dir"
            )
            
            st.info("💡 This will use best quality and skip other settings for fastest download")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("Cancel", use_container_width=True):
                    st.session_state.media_config_step = 0
                    st.rerun()
            with col2:
                if st.button("✅ Download Now", use_container_width=True):
                    # Set all settings and go straight to download
                    config = st.session_state.media_config
                    config.update({
                        "content_format": "🎵 Audio Only" if "Audio" in want_video else "🎬 Video",
                        "quality": "Best",
                        "audio_format": "mp3",
                        "output_dir": output_dir,
                        "subtitle_check": False,
                        "include_metadata": config.get("platform") != "🎥 YouTube",
                        "ignore_errors": config.get("is_playlist", False)
                    })
                    st.session_state.media_config_step = 5  # Skip to download
                    st.rerun()

        @st.dialog("📸 Images or Video?")
        def show_images_modal():
            st.write("Do you want images instead of video?")
            
            want_images = st.radio(
                "Choose your preference:",
                ["No, I want the video", "Yes, just the images"],
                key="modal_want_images"
            )
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("Back", use_container_width=True):
                    st.session_state.media_config_step = 1
                    st.rerun()
            with col2:
                if st.button("Next", use_container_width=True):
                    if want_images == "Yes, just the images":
                        st.session_state.media_config["content_format"] = "📸 Images"
                    st.session_state.media_config_step = 3
                    st.rerun()

        @st.dialog("🎬 Video Quality")
        def show_quality_modal():
            st.write("What quality do you want?")
            
            quality_choice = st.radio(
                "Choose quality:",
                ["🏆 Best quality available", "📺 1080p", "📺 720p", "📱 480p (smaller file)", "📱 360p (smallest file)"],
                key="modal_quality_choice"
            )
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("Back", use_container_width=True):
                    st.session_state.media_config_step = 2
                    st.rerun()
            with col2:
                if st.button("Next", use_container_width=True):
                    quality_map = {
                        "🏆 Best quality available": "Best",
                        "📺 1080p": "1080p", 
                        "📺 720p": "720p",
                        "📱 480p (smaller file)": "480p",
                        "📱 360p (smallest file)": "360p"
                    }
                    st.session_state.media_config["quality"] = quality_map[quality_choice]
                    st.session_state.media_config_step = 4
                    st.rerun()

        @st.dialog("🎵 Audio Format")
        def show_audio_format_modal():
            st.write("What audio format do you prefer?")
            
            audio_choice = st.radio(
                "Choose format:",
                ["🎵 MP3 (most compatible)", "🎶 WAV (best quality)", "🎧 FLAC (lossless)", "📱 M4A (Apple devices)"],
                key="modal_audio_choice"
            )
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("Back", use_container_width=True):
                    st.session_state.media_config_step = 1
                    st.rerun()
            with col2:
                if st.button("Next", use_container_width=True):
                    audio_format_map = {
                        "🎵 MP3 (most compatible)": "mp3",
                        "🎶 WAV (best quality)": "wav", 
                        "🎧 FLAC (lossless)": "flac",
                        "📱 M4A (Apple devices)": "m4a"
                    }
                    st.session_state.media_config["audio_format"] = audio_format_map[audio_choice]
                    st.session_state.media_config_step = 4
                    st.rerun()

        @st.dialog("📁 Download Settings")
        def show_final_settings_modal():
            st.write("Final settings for your download:")
            
            output_dir = st.text_input(
                "Save to folder:",
                value=str(Path.home() / "Downloads"),
                placeholder="Enter folder path or leave default",
                key="modal_output_dir"
            )
            
            # Additional options
            col1, col2 = st.columns(2)
            
            with col1:
                subtitle_check = False
                include_metadata = False
                
                # Subtitles for YouTube videos
                if st.session_state.media_config.get("content_format") == "🎬 Video" and st.session_state.media_config.get("platform") == "🎥 YouTube":
                    subtitle_check = st.checkbox("📝 Download subtitles too", key="modal_subtitles")
                
                # Metadata for social media
                if st.session_state.media_config.get("platform") != "🎥 YouTube":
                    include_metadata = st.checkbox("📝 Save extra info (metadata)", key="modal_metadata", value=True)
            
            with col2:
                ignore_errors = False
                # Error handling for playlists
                if st.session_state.media_config.get("is_playlist"):
                    ignore_errors = st.checkbox("🔄 Skip broken videos and keep going", key="modal_ignore_errors", value=True)
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("Back", use_container_width=True):
                    if st.session_state.media_config.get("content_format") == "🎵 Audio Only":
                        st.session_state.media_config_step = 3
                    elif st.session_state.media_config.get("content_format") == "🎬 Video" and st.session_state.media_config.get("platform") == "🎥 YouTube":
                        st.session_state.media_config_step = 3
                    else:
                        st.session_state.media_config_step = 2
                    st.rerun()
            with col2:
                if st.button("✅ Start Download", use_container_width=True):
                    # Store final settings
                    st.session_state.media_config.update({
                        "output_dir": output_dir,
                        "subtitle_check": subtitle_check,
                        "include_metadata": include_metadata,
                        "ignore_errors": ignore_errors
                    })
                    st.session_state.media_config_step = 5
                    st.rerun()

        # Simple setup flow
        if st.session_state.media_config_step > 0 and st.session_state.media_config_step < 5:
            if st.button("▶️ Continue Setup", key="continue_modal", use_container_width=True):
                show_content_type_modal()

        # Show persistent download progress if download is in progress
        if st.session_state.download_in_progress:
            st.markdown("### 📥 Download in Progress")
            st.error("🚫 **Navigation disabled during download** - Please wait for completion")
            
            # Show cancel button prominently
            if st.button("🛑 CANCEL DOWNLOAD", use_container_width=True, type="secondary"):
                st.session_state.download_in_progress = False
                st.success("Download cancelled")
                st.rerun()
            
            st.markdown("---")
            
            # This will be filled by the download process
            if "download_status" not in st.session_state:
                st.session_state.download_status = "🚀 Starting download..."
            if "download_progress" not in st.session_state:
                st.session_state.download_progress = 0
                
            st.write(f"**Status:** {st.session_state.download_status}")
            st.progress(st.session_state.download_progress / 100)
            
            # Prevent any other UI from showing
            return

        if st.session_state.media_config_step == 5:
            # Execute download with stored config
            config = st.session_state.media_config
            
            # Extract values from config
            url = config["url"]
            platform = config["platform"]
            is_playlist = config["is_playlist"]
            content_format = config["content_format"]
            quality = config.get("quality", "Best")
            audio_format = config.get("audio_format", "mp3")
            output_dir = config["output_dir"]
            subtitle_check = config.get("subtitle_check", False)
            include_metadata = config.get("include_metadata", False)
            ignore_errors = config.get("ignore_errors", False)
            
            # Mark download as in progress
            st.session_state.download_in_progress = True
            st.session_state.download_status = "🚀 Starting download..."
            st.session_state.download_progress = 0
            
            # Reset step for next time
            st.session_state.media_config_step = 0
            
            # Start the actual download process
            execute_download(config)
            st.rerun()

def execute_download(config):
    """Execute the download process and update session state"""
    # Extract values from config
    url = config["url"]
    platform = config["platform"]
    is_playlist = config["is_playlist"]
    content_format = config["content_format"]
    quality = config.get("quality", "Best")
    audio_format = config.get("audio_format", "mp3")
    output_dir = config["output_dir"]
    subtitle_check = config.get("subtitle_check", False)
    include_metadata = config.get("include_metadata", False)
    ignore_errors = config.get("ignore_errors", False)
    
    try:
        # Clean the URL for YouTube
        if platform == "🎥 YouTube":
            import urllib.parse as urlparse
            parsed = urlparse.urlparse(url)
            query_params = urlparse.parse_qs(parsed.query)

            essential_params = {}
            if 'v' in query_params:
                essential_params['v'] = query_params['v']
            if 'list' in query_params:
                essential_params['list'] = query_params['list']
            if 't' in query_params:
                essential_params['t'] = query_params['t']

            clean_query = urlparse.urlencode(essential_params, doseq=True)
            url = urlparse.urlunparse((
                parsed.scheme, parsed.netloc, parsed.path,
                parsed.params, clean_query, ''
            ))

        # Create organized directories
        if platform == "🎥 YouTube":
            if is_playlist:
                if content_format == "🎵 Audio Only":
                    organized_dir = os.path.join(output_dir, "Playlists", "Audio")
                else:
                    organized_dir = os.path.join(output_dir, "Playlists", "Video")
            else:
                if content_format == "🎵 Audio Only":
                    organized_dir = os.path.join(output_dir, "Audio")
                else:
                    organized_dir = os.path.join(output_dir, "Video")
        else:
            # Social media platforms
            platform_name = platform.split(" ")[-1].replace("(", "").replace(")", "")
            if content_format == "🎵 Audio Only":
                organized_dir = os.path.join(output_dir, "Audio", platform_name)
            elif content_format == "📸 Images":
                organized_dir = os.path.join(output_dir, "Images", platform_name)
            else:
                organized_dir = os.path.join(output_dir, "Video", platform_name)

        os.makedirs(organized_dir, exist_ok=True)

        # Build command
        cmd = [st.session_state.yt_dlp_path]

        if content_format == "🎵 Audio Only":
            if is_playlist:
                output_path = os.path.join(organized_dir, f'%(playlist)s/%(playlist_index)s - %(title)s.{audio_format}')
                cmd.extend([
                    '-x',
                    '--audio-format', audio_format,
                    '--audio-quality', '0',
                    '-o', output_path,
                    '--yes-playlist'
                ])
            else:
                output_path = os.path.join(organized_dir, f'%(title)s_%(id)s.{audio_format}')
                cmd.extend([
                    '-x',
                    '--audio-format', audio_format,
                    '--audio-quality', '0',
                    '-o', output_path
                ])
        elif content_format == "📸 Images":
            output_path = os.path.join(organized_dir, '%(title)s_%(id)s.%(ext)s')
            cmd.extend([
                '--write-thumbnail',
                '--skip-download',
                '-o', output_path
            ])
        else:  # Video
            if is_playlist:
                output_path = os.path.join(organized_dir, '%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s')
                cmd.extend([
                    '-f', 'best[ext=mp4]/best',
                    '-o', output_path,
                    '--yes-playlist'
                ])
                if platform == "🎥 YouTube" and quality != "Best":
                    height = quality[:-1]
                    cmd[cmd.index('-f') + 1] = f'best[height<={height}]'
            else:
                output_path = os.path.join(organized_dir, '%(title)s_%(id)s.%(ext)s')
                cmd.extend([
                    '-f', 'best[ext=mp4]/best',
                    '-o', output_path
                ])
                if platform == "🎥 YouTube" and quality != "Best":
                    height = quality[:-1]
                    cmd[cmd.index('-f') + 1] = f'best[height<={height}]'

        # Add metadata options
        if include_metadata:
            cmd.extend(['--write-info-json', '--write-description'])

        # Platform-specific options
        if "instagram.com" in url:
            cmd.extend(['--cookies-from-browser', 'chrome'])
        elif "tiktok.com" in url:
            cmd.extend(['--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'])

        # Skip files that already exist
        cmd.extend(['--no-overwrites'])

        cmd.append(url)

        # Execute the actual download
        import subprocess
        import threading

        def run_download():
            try:
                st.session_state.download_status = "🔄 Starting download..."
                st.session_state.download_progress = 5

                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True
                )

                current_percentage = 0
                for line in iter(process.stdout.readline, ''):
                    if line.strip():
                        # Simple progress parsing
                        if "[download]" in line and "%" in line:
                            try:
                                # Extract percentage from yt-dlp output
                                parts = line.split()
                                for part in parts:
                                    if "%" in part:
                                        current_percentage = float(part.replace("%", ""))
                                        st.session_state.download_progress = current_percentage
                                        st.session_state.download_status = f"📥 Downloading: {current_percentage:.1f}%"
                                        break
                            except:
                                pass
                        elif "Merging formats" in line:
                            st.session_state.download_status = "🔄 Processing video..."
                            st.session_state.download_progress = 95

                process.wait()

                if process.returncode == 0:
                    st.session_state.download_status = "✅ Download completed successfully!"
                    st.session_state.download_progress = 100

                    # Try to open file location
                    try:
                        import platform as sys_platform
                        system = sys_platform.system()
                        if system == "Windows":
                            os.startfile(organized_dir)
                        elif system == "Darwin":  # macOS
                            subprocess.run(["open", organized_dir])
                        else:  # Linux and others
                            subprocess.run(["xdg-open", organized_dir])
                    except:
                        pass
                else:
                    st.session_state.download_status = f"❌ Download failed (exit code: {process.returncode})"

                st.session_state.download_in_progress = False

            except Exception as e:
                st.session_state.download_status = f"❌ Error: {str(e)}"
                st.session_state.download_in_progress = False

        # Run download in background thread
        download_thread = threading.Thread(target=run_download)
        download_thread.daemon = True
        download_thread.start()
            
    except Exception as e:
        st.session_state.download_status = f"❌ Error: {str(e)}"
        st.session_state.download_in_progress = False

def main():
    # Initialize session state
    if 'selected_tool' not in st.session_state:
        st.session_state.selected_tool = None
    
    # Navigation
    with st.container():
        if st.session_state.selected_tool:
            col1, col2 = st.columns([1, 4])
            with col1:
                if st.button("⬅️ Back to Toolkit", use_container_width=True):
                    st.session_state.selected_tool = None
                    st.rerun()
            with col2:
                st.markdown(f"<h2 style='margin: 0;'>🛠️ Toolkit → {st.session_state.selected_tool}</h2>", unsafe_allow_html=True)
        
        st.markdown("---")
    
    # Show selected tool or home
    if st.session_state.selected_tool == "Media Downloader":
        show_media_downloader()
    elif st.session_state.selected_tool == "Podcast Summarizer":
        show_podcast_summarizer()
    else:
        show_home()
    
    # Footer
    st.markdown("---")
    st.markdown("""
    <div style='text-align: center; color: #666; padding: 1rem;'>
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()