import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for processing

interface Clip {
  startTime: string;  // HH:MM:SS
  endTime: string;    // HH:MM:SS
  name: string;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const videoFile = formData.get('video') as File | null;
  const clipsJson = formData.get('clips') as string | null;

  if (!videoFile || !clipsJson) {
    return new Response('Video file and clips are required', { status: 400 });
  }

  let clips: Clip[];
  try {
    clips = JSON.parse(clipsJson);
  } catch {
    return new Response('Invalid clips JSON', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (data: object) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            isClosed = true;
          }
        }
      };

      // Create temp directory
      const tempDir = path.join(os.tmpdir(), `clip-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      // Create output directory in user's Downloads
      const outputDir = path.join(os.homedir(), 'Downloads', 'Clips');
      fs.mkdirSync(outputDir, { recursive: true });

      sendEvent({ status: 'Uploading video...', progress: 10 });

      try {
        // Save uploaded video to temp file
        const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
        const inputPath = path.join(tempDir, 'input' + path.extname(videoFile.name || '.mp4'));
        fs.writeFileSync(inputPath, videoBuffer);

        sendEvent({ status: 'Processing clips...', progress: 20 });

        const outputPaths: string[] = [];
        const totalClips = clips.length;

        // Process each clip sequentially
        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          const progress = 20 + Math.floor(((i + 0.5) / totalClips) * 70);
          sendEvent({
            status: `Extracting clip ${i + 1}/${totalClips}: ${clip.name}`,
            progress,
          });

          const safeName = clip.name.replace(/[^a-z0-9]/gi, '_');
          const outputPath = path.join(outputDir, `${safeName}_${Date.now()}.mp4`);

          // Use ffmpeg to extract clip
          await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
              '-i', inputPath,
              '-ss', clip.startTime,
              '-to', clip.endTime,
              '-c', 'copy',
              '-y',
              outputPath
            ]);

            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
              stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
              if (code === 0) {
                outputPaths.push(outputPath);
                resolve();
              } else {
                reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
              }
            });

            ffmpeg.on('error', (err) => {
              reject(new Error(`ffmpeg error: ${err.message}`));
            });
          });

          const progressAfter = 20 + Math.floor(((i + 1) / totalClips) * 70);
          sendEvent({
            status: `Completed clip ${i + 1}/${totalClips}: ${clip.name}`,
            progress: progressAfter,
          });
        }

        sendEvent({
          status: 'completed',
          progress: 100,
          details: `${outputPaths.length} clip(s) saved to: ${outputDir}`,
        });

        // Cleanup temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sendEvent({
          status: 'error',
          progress: 0,
          details: `Error processing clips: ${errorMessage}`,
        });

        // Cleanup temp directory on error
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      isClosed = true;
      try { controller.close(); } catch { /* Already closed */ }
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
