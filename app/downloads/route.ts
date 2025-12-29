import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const format = searchParams.get('format') || 'video';
  const quality = searchParams.get('quality') || 'Best';
  const audioFormat = searchParams.get('audioFormat') || 'mp3';
  const outputDir = searchParams.get('outputDir') || path.join(os.homedir(), 'Downloads');

  if (!url) {
    return new Response('URL is required', { status: 400 });
  }

  // Create a Server-Sent Events stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const sendEvent = (data: any) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (err) {
            isClosed = true;
          }
        }
      };

      // Detect playlist
      const isPlaylist = url.includes('list=') || url.includes('playlist');

      // Build yt-dlp command - use dynamic path resolution
      const projectRoot = path.resolve(process.cwd());
      const cmd = path.join(projectRoot, 'venv', 'bin', 'yt-dlp');

      // Verify yt-dlp exists
      if (!fs.existsSync(cmd)) {
        sendEvent({
          status: 'error',
          progress: 0,
          details: 'yt-dlp not found. Please run: python3 -m venv venv && source venv/bin/activate && pip install yt-dlp',
        });
        isClosed = true;
        try { controller.close(); } catch (err) {}
        return;
      }
      const args: string[] = [];

      // Output path
      let organizedDir = outputDir;
      if (isPlaylist) {
        organizedDir = path.join(outputDir, 'Playlists', format === 'audio' ? 'Audio' : 'Video');
      } else {
        organizedDir = path.join(outputDir, format === 'audio' ? 'Audio' : 'Video');
      }

      if (format === 'audio') {
        const outputPath = isPlaylist
          ? path.join(organizedDir, `%(playlist)s/%(playlist_index)s - %(title)s.${audioFormat}`)
          : path.join(organizedDir, `%(title)s_%(id)s.${audioFormat}`);

        args.push('-x', '--audio-format', audioFormat, '--audio-quality', '0', '-o', outputPath);
        if (isPlaylist) args.push('--yes-playlist');
      } else {
        const outputPath = isPlaylist
          ? path.join(organizedDir, '%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s')
          : path.join(organizedDir, '%(title)s_%(id)s.%(ext)s');

        args.push('-f', 'best[ext=mp4]/best', '-o', outputPath);
        if (isPlaylist) args.push('--yes-playlist');

        if (quality !== 'Best') {
          const height = quality.replace('p', '');
          args[args.indexOf('-f') + 1] = `best[height<=${height}]`;
        }
      }

      args.push('--no-overwrites', '--newline', url);

      sendEvent({ status: 'Starting download...', progress: 0, details: 'Initializing...' });

      // Spawn yt-dlp process
      const ytdlpProcess = spawn(cmd, args);

      let currentPercentage = 0;
      let playlistIndex = 0;
      let playlistTotal = 0;
      let currentTitle = '';

      ytdlpProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          // Debug: Log all output to help identify patterns
          console.log('[yt-dlp]:', line);

          // Playlist detection - multiple patterns
          if (line.includes('[download] Downloading video') || line.includes('Downloading item')) {
            const match = line.match(/(?:Downloading video|Downloading item)\s+(\d+)\s+of\s+(\d+)/);
            if (match) {
              playlistIndex = parseInt(match[1]);
              playlistTotal = parseInt(match[2]);
              console.log(`Playlist detected: ${playlistIndex}/${playlistTotal}`);
              sendEvent({
                status: `Playlist: Video ${playlistIndex}/${playlistTotal}`,
                progress: currentPercentage,
                details: `Processing video ${playlistIndex} of ${playlistTotal}`,
                videoIndex: playlistIndex,
                videoTotal: playlistTotal,
              });
            }
          }

          // Get filename
          if (line.includes('[download] Destination:')) {
            const filename = line.split('Destination:')[1].trim();
            currentTitle = path.basename(filename);
            console.log(`File destination: ${currentTitle}`);
            sendEvent({
              status: playlistTotal > 0 ? `Video ${playlistIndex}/${playlistTotal}` : 'Downloading',
              progress: currentPercentage,
              details: `📹 ${currentTitle}`,
              videoIndex: playlistTotal > 0 ? playlistIndex : undefined,
              videoTotal: playlistTotal > 0 ? playlistTotal : undefined,
            });
          }

          // Progress percentage
          if (line.includes('[download]') && line.includes('%')) {
            const match = line.match(/([\d.]+)%/);
            if (match) {
              currentPercentage = parseFloat(match[1]);

              // Extract speed and ETA
              const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/);
              const etaMatch = line.match(/ETA\s+([\d:]+)/);
              const sizeMatch = line.match(/of\s+([\d.]+\w+)/);

              const details = [
                currentTitle ? `📹 ${currentTitle}` : null,
                sizeMatch ? `📦 ${sizeMatch[1]}` : null,
                speedMatch ? `⚡ ${speedMatch[1]}` : null,
                etaMatch ? `⏱️ ETA: ${etaMatch[1]}` : null,
              ]
                .filter(Boolean)
                .join(' | ');

              sendEvent({
                status: playlistTotal > 0
                  ? `Video ${playlistIndex}/${playlistTotal}: ${currentPercentage.toFixed(1)}%`
                  : `Downloading: ${currentPercentage.toFixed(1)}%`,
                progress: currentPercentage,
                details,
                videoIndex: playlistTotal > 0 ? playlistIndex : undefined,
                videoTotal: playlistTotal > 0 ? playlistTotal : undefined,
              });
            }
          }

          // Processing
          if (line.includes('Merging formats') || line.includes('[ffmpeg]')) {
            sendEvent({
              status: playlistTotal > 0 ? `Processing video ${playlistIndex}/${playlistTotal}` : 'Processing video',
              progress: 95,
              details: 'Merging audio and video streams',
              videoIndex: playlistTotal > 0 ? playlistIndex : undefined,
              videoTotal: playlistTotal > 0 ? playlistTotal : undefined,
            });
          }
        }
      });

      ytdlpProcess.stderr.on('data', (data) => {
        console.error('yt-dlp error:', data.toString());
      });

      ytdlpProcess.on('close', (code) => {
        if (code === 0) {
          sendEvent({
            status: 'completed',
            progress: 100,
            details: `Files saved to: ${organizedDir}`,
          });
        } else {
          sendEvent({
            status: 'error',
            progress: 0,
            details: `Download failed with exit code: ${code}`,
          });
        }
        isClosed = true;
        try {
          controller.close();
        } catch (err) {
          // Already closed
        }
      });

      ytdlpProcess.on('error', (error) => {
        sendEvent({
          status: 'error',
          progress: 0,
          details: `Error: ${error.message}`,
        });
        isClosed = true;
        try {
          controller.close();
        } catch (err) {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
