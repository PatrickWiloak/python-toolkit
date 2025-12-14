'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface TranscriptSegment {
  timestamp: number;
  time: string;
  text: string;
}

interface Topic {
  title: string;
  timestamp: number;
  description: string;
  summary?: string;
  keyPoints?: string[];
}

interface SummaryProgress {
  status: string;
  progress: number;
  summary?: string;
  transcript?: string;
  timestampedTranscript?: TranscriptSegment[];
  videoId?: string;
  topics?: Topic[];
  details?: string;
}

export default function PodcastSummarizer() {
  const [url, setUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<SummaryProgress | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedPanel, setSelectedPanel] = useState<'summary' | 'transcript' | 'chapters'>('summary');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedState, setCopiedState] = useState<'summary' | 'transcript' | null>(null);
  const playerRef = useRef<any>(null);
  const transcriptRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Load YouTube IFrame API
  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      console.log('YouTube IFrame API ready');
    };
  }, []);

  // Initialize YouTube player
  useEffect(() => {
    if (progress?.videoId && (window as any).YT) {
      const playerId = 'youtube-player';

      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new (window as any).YT.Player(playerId, {
        videoId: progress.videoId,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1 },
        events: {
          onReady: () => {
            setInterval(() => {
              if (playerRef.current && playerRef.current.getCurrentTime) {
                setCurrentTime(Math.floor(playerRef.current.getCurrentTime()));
              }
            }, 1000);
          },
        },
      });
    }
  }, [progress?.videoId]);

  const handleSummarize = async () => {
    if (!url) return;
    setProcessing(true);
    setProgress({ status: 'Starting...', progress: 0 });

    const eventSource = new EventSource(`/summarize?${new URLSearchParams({ url })}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);

      if (data.status === 'completed' || data.status === 'error') {
        eventSource.close();
        setProcessing(false);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setProcessing(false);
      setProgress({ status: 'error', progress: 0, details: 'Connection error occurred' });
    };
  };

  const seekToTime = (timestamp: number) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(timestamp, true);
      playerRef.current.playVideo();
    }
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCurrentTopic = (): Topic | null => {
    if (!progress?.topics) return null;

    // Find the topic that matches current time
    for (let i = progress.topics.length - 1; i >= 0; i--) {
      if (currentTime >= progress.topics[i].timestamp) {
        return progress.topics[i];
      }
    }
    return progress.topics[0] || null;
  };

  const copyToClipboard = async (text: string, type: 'summary' | 'transcript') => {
    await navigator.clipboard.writeText(text);
    setCopiedState(type);
    setTimeout(() => setCopiedState(null), 2000);
  };

  const downloadAsMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPlainTranscript = (): string => {
    if (!progress?.timestampedTranscript) return '';
    return progress.timestampedTranscript
      .map(seg => `[${seg.time}] ${seg.text}`)
      .join('\n');
  };

  // Filter transcript segments based on search query
  const filteredTranscript = progress?.timestampedTranscript?.filter((segment, idx, arr) => {
    // First deduplicate
    const isUnique = idx === arr.findIndex(s => s.timestamp === segment.timestamp && s.text === segment.text);
    if (!isUnique) return false;
    // Then filter by search
    if (!searchQuery) return true;
    return segment.text.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const searchMatchCount = searchQuery ? filteredTranscript.length : 0;

  // Get current chapter index
  const getCurrentChapterIndex = (): number => {
    if (!progress?.topics) return 0;
    for (let i = progress.topics.length - 1; i >= 0; i--) {
      if (currentTime >= progress.topics[i].timestamp) {
        return i;
      }
    }
    return 0;
  };

  const currentChapterIndex = getCurrentChapterIndex();
  const totalChapters = progress?.topics?.length || 0;

  // Navigate to previous/next chapter
  const goToPreviousChapter = () => {
    if (!progress?.topics || currentChapterIndex <= 0) return;
    seekToTime(progress.topics[currentChapterIndex - 1].timestamp);
  };

  const goToNextChapter = () => {
    if (!progress?.topics || currentChapterIndex >= progress.topics.length - 1) return;
    seekToTime(progress.topics[currentChapterIndex + 1].timestamp);
  };

  // Keyboard navigation for chapters
  useEffect(() => {
    if (!progress?.summary) return; // Only active when viewing results

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' || e.key === '[') {
        e.preventDefault();
        goToPreviousChapter();
      } else if (e.key === 'ArrowRight' || e.key === ']') {
        e.preventDefault();
        goToNextChapter();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [progress?.summary, currentChapterIndex, progress?.topics]);

  // Auto-scroll to current transcript segment
  useEffect(() => {
    if (!autoScroll || selectedPanel !== 'transcript' || !progress?.timestampedTranscript) return;

    // Find the current segment
    const currentSegment = progress.timestampedTranscript.find((segment, idx, arr) => {
      const nextSegment = arr[idx + 1];
      return currentTime >= segment.timestamp && (!nextSegment || currentTime < nextSegment.timestamp);
    });

    if (currentSegment && transcriptRefs.current[currentSegment.timestamp]) {
      transcriptRefs.current[currentSegment.timestamp]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime, autoScroll, selectedPanel, progress?.timestampedTranscript]);

  // Input view
  if (!progress?.summary) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-black rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Hero Section */}
          <div className="p-16 text-center border-b border-white/10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h2 className="text-3xl font-light text-white mb-3">
              Transform podcasts into insights
            </h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
              Get AI-powered summaries, key takeaways, and navigable chapters from any YouTube podcast
            </p>
          </div>

          {/* Input Section */}
          <div className="p-10">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                disabled={processing}
                className="w-full pl-14 pr-6 py-5 text-base bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 font-light focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && !processing && handleSummarize()}
              />
            </div>

            {!processing && (
              <button
                onClick={handleSummarize}
                disabled={!url || processing}
                className="w-full mt-5 py-5 bg-white text-black hover:bg-gray-100 disabled:bg-white/5 disabled:text-gray-600 disabled:border disabled:border-white/10 text-sm font-semibold tracking-wide rounded-xl disabled:cursor-not-allowed transition-all shadow-lg disabled:shadow-none"
              >
                Summarize Podcast
              </button>
            )}
          </div>

          {/* Progress Section */}
          {processing && (
            <div className="px-10 pb-10">
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-sm text-gray-300 font-medium">{progress?.status}</span>
                  </div>
                  <span className="text-sm text-white font-semibold">{progress?.progress}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-500 rounded-full"
                    style={{ width: `${progress?.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Section */}
          {progress?.status === 'error' && (
            <div className="px-10 pb-10">
              <div className="bg-white/5 border border-white/20 rounded-xl p-6 mb-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-2">Something went wrong</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">{progress.details}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setProgress(null); setUrl(''); }}
                className="w-full py-4 bg-white/10 text-white hover:bg-white/20 border border-white/20 text-sm font-semibold tracking-wide rounded-xl transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Features Section */}
          {!processing && !progress?.status && (
            <div className="px-10 pb-10 pt-2">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-xs font-semibold text-white mb-1">Smart Summaries</h4>
                  <p className="text-[10px] text-gray-500 leading-relaxed">Get concise AI-generated summaries</p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h4 className="text-xs font-semibold text-white mb-1">Chapter Bookmarks</h4>
                  <p className="text-[10px] text-gray-500 leading-relaxed">Navigate by topic timestamps</p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-xs font-semibold text-white mb-1">Full Transcript</h4>
                  <p className="text-[10px] text-gray-500 leading-relaxed">Read and search complete text</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentTopic = getCurrentTopic();

  // Results view with topic bookmarks
  return (
    <div className="w-full min-h-screen">
      {/* Two-column layout: Video | Summary/Transcript/Chapters */}
      <div className="grid grid-cols-[640px_1fr] gap-6 pb-6 items-center max-w-7xl mx-auto">

        {/* Left - Video Player */}
        <div className="flex flex-col gap-4 self-center">
          <div className="bg-black overflow-hidden border border-white/10 rounded-2xl shadow-2xl">
            <div id="youtube-player" className="w-full aspect-video" />
          </div>

          {/* Current Topic Info Card */}
          {currentTopic && (
            <div className="bg-black border border-white/10 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-xs font-mono text-gray-500 font-semibold">
                    NOW PLAYING
                  </span>
                </div>
                <div className="text-xs font-mono text-gray-400 font-semibold">
                  {formatTime(currentTime)} / {formatTime(currentTopic.timestamp)}
                </div>
              </div>
              <h3 className="text-base font-semibold text-white mb-2 leading-tight">{currentTopic.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{currentTopic.description}</p>
            </div>
          )}
        </div>

        {/* Right - Summary/Transcript Panel */}
        <div className="flex flex-col sticky top-20">
          <div className="bg-black border border-white/10 rounded-2xl overflow-hidden shadow-2xl">

            {/* Tab Navigation */}
            <div className="flex items-center justify-between border-b border-white/10">
              <div className="flex">
                <button
                  onClick={() => setSelectedPanel('summary')}
                  className={`px-6 py-4 text-sm font-semibold tracking-wide transition-all relative ${
                    selectedPanel === 'summary'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Summary
                  </div>
                  {selectedPanel === 'summary' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </button>
                <button
                  onClick={() => setSelectedPanel('transcript')}
                  className={`px-6 py-4 text-sm font-semibold tracking-wide transition-all relative ${
                    selectedPanel === 'transcript'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Transcript
                  </div>
                  {selectedPanel === 'transcript' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </button>
                <button
                  onClick={() => setSelectedPanel('chapters')}
                  className={`px-6 py-4 text-sm font-semibold tracking-wide transition-all relative ${
                    selectedPanel === 'chapters'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Chapters
                    <span className="text-xs text-gray-500 font-mono">({currentChapterIndex + 1}/{totalChapters})</span>
                  </div>
                  {selectedPanel === 'chapters' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 mr-4">
                {/* Export buttons */}
                {selectedPanel === 'summary' && progress?.summary && (
                  <>
                    <button
                      onClick={() => copyToClipboard(progress.summary!, 'summary')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition-all flex items-center gap-1.5"
                    >
                      {copiedState === 'summary' ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => downloadAsMarkdown(progress.summary!, 'podcast-summary.md')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  </>
                )}
                {selectedPanel === 'transcript' && (
                  <>
                    <button
                      onClick={() => copyToClipboard(getPlainTranscript(), 'transcript')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition-all flex items-center gap-1.5"
                    >
                      {copiedState === 'transcript' ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setAutoScroll(!autoScroll)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        autoScroll
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {autoScroll ? 'Auto-scroll' : 'Manual'}
                    </button>
                  </>
                )}
                {selectedPanel === 'chapters' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToPreviousChapter}
                      disabled={currentChapterIndex <= 0}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Prev
                    </button>
                    <button
                      onClick={goToNextChapter}
                      disabled={currentChapterIndex >= totalChapters - 1}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                    >
                      Next
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6 max-h-[calc(100vh-250px)] overflow-y-auto">

              {/* Summary Tab */}
              <div className={selectedPanel === 'summary' ? 'block' : 'hidden'}>
                <div className="prose prose-sm max-w-none
                  prose-headings:font-semibold prose-headings:tracking-tight prose-headings:!text-white
                  prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-6 prose-h1:!text-white
                  prose-h2:text-lg prose-h2:mb-3 prose-h2:mt-5 prose-h2:!text-white prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2
                  prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4 prose-h3:!text-white
                  prose-p:!text-gray-300 prose-p:leading-relaxed prose-p:text-sm prose-p:mb-4
                  prose-ul:my-4 prose-li:!text-gray-300 prose-li:text-sm prose-li:leading-relaxed prose-li:mb-2
                  prose-strong:!text-white prose-strong:font-semibold
                  prose-code:!text-white prose-code:bg-white/10 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm">
                  <ReactMarkdown>{progress.summary}</ReactMarkdown>
                </div>
              </div>

              {/* Transcript Tab */}
              <div className={selectedPanel === 'transcript' ? 'block' : 'hidden'}>
                {/* Search Input */}
                <div className="mb-4">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search transcript..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/30 transition-all"
                    />
                    {searchQuery && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-xs text-gray-500">{searchMatchCount} matches</span>
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-gray-500 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-0">
                  {filteredTranscript.map((segment, idx) => {
                    const isActive = Math.abs(currentTime - segment.timestamp) < 3;

                    // Highlight search matches
                    const highlightText = (text: string) => {
                      if (!searchQuery) return text;
                      const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
                      return parts.map((part, i) =>
                        part.toLowerCase() === searchQuery.toLowerCase()
                          ? <mark key={i} className="bg-yellow-500/30 text-white rounded px-0.5">{part}</mark>
                          : part
                      );
                    };

                    return (
                      <div
                        key={`${segment.timestamp}-${idx}`}
                        ref={(el) => { transcriptRefs.current[segment.timestamp] = el; }}
                        onClick={() => seekToTime(segment.timestamp)}
                        className={`px-4 py-4 cursor-pointer transition-all rounded-lg mb-1 ${
                          isActive
                            ? 'bg-white/20 border-l-4 border-white'
                            : 'bg-transparent hover:bg-white/5 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <span className={`text-xs font-mono min-w-[65px] flex-shrink-0 transition-colors ${isActive ? 'text-white font-bold' : 'text-gray-600 font-medium'}`}>
                            {segment.time}
                          </span>
                          <p className={`text-sm leading-relaxed flex-1 transition-colors ${isActive ? 'text-white font-medium' : 'text-gray-400'}`}>
                            {highlightText(segment.text)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {searchQuery && filteredTranscript.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No matches found for "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>

              {/* Chapters Tab */}
              <div className={selectedPanel === 'chapters' ? 'block' : 'hidden'}>
                <p className="text-[10px] text-gray-600 mb-4 text-center">Use [ ] or arrow keys to navigate chapters</p>
                <div className="space-y-4">
                  {progress.topics?.map((topic, idx) => {
                    const isActive = currentTopic?.timestamp === topic.timestamp;
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl transition-all ${
                          isActive
                            ? 'bg-white/10 border border-white/20'
                            : 'bg-white/5 border border-transparent'
                        }`}
                      >
                        {/* Clickable header */}
                        <button
                          onClick={() => seekToTime(topic.timestamp)}
                          className="w-full text-left px-5 py-4 hover:bg-white/5 rounded-t-xl transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <span className={`text-xs font-mono min-w-[65px] ${isActive ? 'text-white font-semibold' : 'text-gray-500'}`}>
                              {formatTime(topic.timestamp)}
                            </span>
                            <div className={`text-base font-semibold ${isActive ? 'text-white' : 'text-gray-200'}`}>
                              {topic.title}
                            </div>
                            <svg className="w-4 h-4 text-gray-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </button>

                        {/* Summary content */}
                        <div className="px-5 pb-4">
                          <p className="text-sm text-gray-300 leading-relaxed mb-3">
                            {topic.summary || topic.description}
                          </p>

                          {/* Key points */}
                          {topic.keyPoints && topic.keyPoints.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Key Points</h4>
                              <ul className="space-y-1.5">
                                {topic.keyPoints.map((point, pointIdx) => (
                                  <li key={pointIdx} className="flex items-start gap-2 text-sm text-gray-400">
                                    <span className="text-white/50 mt-1">•</span>
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summarize Another Button */}
      <div className="flex justify-center py-12">
        <button
          onClick={() => {
            setProgress(null);
            setUrl('');
            setCurrentTime(0);
            if (playerRef.current) {
              playerRef.current.destroy();
              playerRef.current = null;
            }
          }}
          className="px-10 py-4 bg-white text-black hover:bg-gray-100 text-sm font-semibold tracking-wide transition-all rounded-xl shadow-lg"
        >
          Summarize Another Podcast
        </button>
      </div>
    </div>
  );
}
