import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface ThumbnailOptions {
  timestamp: string;
  width: number;
  height: number;
  autoMode: boolean;
  frameCount: number;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const videoFile = formData.get('video') as File | null;
  const videoUrl = formData.get('url') as string | null;
  const optionsJson = formData.get('options') as string;

  if (!videoFile && !videoUrl) {
    return NextResponse.json({ error: 'Video file or URL is required' }, { status: 400 });
  }

  let options: ThumbnailOptions;
  try {
    options = JSON.parse(optionsJson);
  } catch {
    return NextResponse.json({ error: 'Invalid options JSON' }, { status: 400 });
  }

  const tempDir = path.join(os.tmpdir(), `thumbnail-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    let inputPath: string;

    if (videoFile) {
      // Save uploaded video
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      inputPath = path.join(tempDir, 'input' + path.extname(videoFile.name || '.mp4'));
      fs.writeFileSync(inputPath, videoBuffer);
    } else if (videoUrl) {
      // Download video from URL using yt-dlp
      const projectRoot = path.resolve(process.cwd());
      const ytdlpCmd = path.join(projectRoot, 'venv', 'bin', 'yt-dlp');

      if (!fs.existsSync(ytdlpCmd)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        return NextResponse.json({
          error: 'yt-dlp not found. Please run: python3 -m venv venv && source venv/bin/activate && pip install yt-dlp'
        }, { status: 500 });
      }

      inputPath = path.join(tempDir, 'input.mp4');

      try {
        execSync(`"${ytdlpCmd}" -f "best[height<=720]" -o "${inputPath}" "${videoUrl}"`, {
          timeout: 120000,
          stdio: 'pipe',
        });
      } catch (downloadError: unknown) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        const errorMessage = downloadError instanceof Error ? downloadError.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to download video: ${errorMessage}` }, { status: 500 });
      }
    } else {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return NextResponse.json({ error: 'No video source provided' }, { status: 400 });
    }

    const thumbnails: string[] = [];

    if (options.autoMode) {
      // Extract multiple frames evenly distributed
      // First, get video duration
      let duration: number;
      try {
        const durationResult = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`,
          { encoding: 'utf-8', timeout: 30000 }
        );
        duration = parseFloat(durationResult.trim());
      } catch {
        fs.rmSync(tempDir, { recursive: true, force: true });
        return NextResponse.json({ error: 'Failed to get video duration' }, { status: 500 });
      }

      const frameCount = Math.min(options.frameCount || 10, 50);
      const interval = duration / (frameCount + 1);

      for (let i = 1; i <= frameCount; i++) {
        const timestamp = interval * i;
        const outputPath = path.join(tempDir, `thumb_${i}.jpg`);

        try {
          execSync(
            `ffmpeg -ss ${timestamp} -i "${inputPath}" -vframes 1 -vf "scale=${options.width}:${options.height}" -y "${outputPath}"`,
            { timeout: 30000, stdio: 'pipe' }
          );

          if (fs.existsSync(outputPath)) {
            const imageBuffer = fs.readFileSync(outputPath);
            const base64 = imageBuffer.toString('base64');
            thumbnails.push(`data:image/jpeg;base64,${base64}`);
          }
        } catch {
          // Skip failed frames, continue with others
          console.error(`Failed to extract frame at ${timestamp}s`);
        }
      }
    } else {
      // Single frame at specified timestamp
      const outputPath = path.join(tempDir, 'thumb.jpg');

      try {
        execSync(
          `ffmpeg -ss ${options.timestamp} -i "${inputPath}" -vframes 1 -vf "scale=${options.width}:${options.height}" -y "${outputPath}"`,
          { timeout: 30000, stdio: 'pipe' }
        );

        if (fs.existsSync(outputPath)) {
          const imageBuffer = fs.readFileSync(outputPath);
          const base64 = imageBuffer.toString('base64');
          thumbnails.push(`data:image/jpeg;base64,${base64}`);
        }
      } catch (ffmpegError: unknown) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        const errorMessage = ffmpegError instanceof Error ? ffmpegError.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to extract thumbnail: ${errorMessage}` }, { status: 500 });
      }
    }

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });

    if (thumbnails.length === 0) {
      return NextResponse.json({ error: 'No thumbnails could be generated' }, { status: 500 });
    }

    return NextResponse.json({ thumbnails });
  } catch (error: unknown) {
    // Cleanup on error
    fs.rmSync(tempDir, { recursive: true, force: true });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
