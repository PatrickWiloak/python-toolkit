import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for long podcasts

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

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

      const tempDir = path.join(os.tmpdir(), `podcast-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      sendEvent({ status: 'Fetching podcast information...', progress: 10 });

      // Step 1: Download subtitles using yt-dlp
      // Use absolute path to venv yt-dlp (more reliable than system PATH in Next.js context)
      const projectRoot = path.resolve(process.cwd());
      const ytdlpCmd = path.join(projectRoot, 'venv', 'bin', 'yt-dlp');

      // Verify yt-dlp exists
      if (!fs.existsSync(ytdlpCmd)) {
        sendEvent({
          status: 'error',
          progress: 0,
          details: 'yt-dlp not found. Please run: python3 -m venv venv && source venv/bin/activate && pip install yt-dlp',
        });
        isClosed = true;
        try { controller.close(); } catch (err) {}
        fs.rmSync(tempDir, { recursive: true, force: true });
        return;
      }

      const subtitlePath = path.join(tempDir, 'subtitles.%(ext)s');

      const ytdlpArgs = [
        '--write-auto-sub',
        '--sub-lang', 'en',
        '--skip-download',
        '--sub-format', 'vtt',
        '-o', subtitlePath,
        url
      ];

      sendEvent({ status: 'Downloading transcript...', progress: 30 });

      const ytdlpProcess = spawn(ytdlpCmd, ytdlpArgs);

      let ytdlpError = '';
      ytdlpProcess.stderr.on('data', (data) => {
        ytdlpError += data.toString();
        console.error('yt-dlp stderr:', data.toString());
      });

      ytdlpProcess.on('close', async (code) => {
        if (code !== 0) {
          sendEvent({
            status: 'error',
            progress: 0,
            details: 'Failed to download transcript. The video may not have captions available.',
          });
          isClosed = true;
          try { controller.close(); } catch (err) {}
          fs.rmSync(tempDir, { recursive: true, force: true });
          return;
        }

        // Step 2: Find and read the subtitle file
        sendEvent({ status: 'Processing transcript...', progress: 50 });

        const files = fs.readdirSync(tempDir);
        const subtitleFile = files.find(f => f.endsWith('.vtt') || f.endsWith('.srt'));

        if (!subtitleFile) {
          sendEvent({
            status: 'error',
            progress: 0,
            details: 'No subtitle file found. The video may not have captions.',
          });
          isClosed = true;
          try { controller.close(); } catch (err) {}
          fs.rmSync(tempDir, { recursive: true, force: true });
          return;
        }

        const subtitleContent = fs.readFileSync(path.join(tempDir, subtitleFile), 'utf-8');

        // Parse VTT/SRT to plain text and with timestamps
        const transcript = parseSubtitles(subtitleContent);
        const timestampedTranscript = parseSubtitlesWithTimestamps(subtitleContent);

        if (!transcript || transcript.length < 100) {
          sendEvent({
            status: 'error',
            progress: 0,
            details: 'Transcript is too short or empty.',
          });
          isClosed = true;
          try { controller.close(); } catch (err) {}
          fs.rmSync(tempDir, { recursive: true, force: true });
          return;
        }

        // Extract video ID from URL for embedding
        const videoId = extractVideoId(url);

        sendEvent({ status: 'Sending to Vertex AI for summarization...', progress: 70 });

        // Step 3: Call Vertex AI for summarization
        try {
          const { summary, topics } = await summarizeWithVertexAI(transcript, timestampedTranscript);

          sendEvent({
            status: 'completed',
            progress: 100,
            summary,
            transcript,
            timestampedTranscript,
            videoId,
            topics,
          });

          // Cleanup
          fs.rmSync(tempDir, { recursive: true, force: true });

          isClosed = true;
          try { controller.close(); } catch (err) {}
        } catch (error: any) {
          sendEvent({
            status: 'error',
            progress: 0,
            details: `Summarization failed: ${error.message}`,
          });
          fs.rmSync(tempDir, { recursive: true, force: true });
          isClosed = true;
          try { controller.close(); } catch (err) {}
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

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[a-z]+;|&#\d+;/gi, (match) => entities[match] || match);
}

// Parse VTT/SRT subtitles to plain text
function parseSubtitles(content: string): string {
  const lines = content.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip timestamps, sequence numbers, and WEBVTT headers
    if (
      !trimmed ||
      trimmed === 'WEBVTT' ||
      trimmed.match(/^\d+$/) ||
      trimmed.match(/\d{2}:\d{2}:\d{2}/) ||
      trimmed.includes('-->') ||
      trimmed.startsWith('NOTE')
    ) {
      continue;
    }

    // Remove HTML tags and decode HTML entities from subtitles
    const cleanedLine = decodeHtmlEntities(trimmed.replace(/<[^>]+>/g, ''));
    if (cleanedLine) {
      textLines.push(cleanedLine);
    }
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

// Parse VTT/SRT subtitles with timestamps
function parseSubtitlesWithTimestamps(content: string): Array<{ timestamp: number; text: string; time: string }> {
  const lines = content.split('\n');
  const segments: Array<{ timestamp: number; text: string; time: string }> = [];
  let currentTime = '';
  let currentTimestamp = 0;
  let lastText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match timestamp lines (e.g., "00:00:15.000 --> 00:00:18.000")
    const timestampMatch = line.match(/(\d{2}):(\d{2}):(\d{2})(?:\.\d{3})?\s*-->/);
    if (timestampMatch) {
      const hours = parseInt(timestampMatch[1]);
      const minutes = parseInt(timestampMatch[2]);
      const seconds = parseInt(timestampMatch[3]);
      currentTimestamp = hours * 3600 + minutes * 60 + seconds;
      currentTime = `${timestampMatch[1]}:${timestampMatch[2]}:${timestampMatch[3]}`;
      continue;
    }

    // Skip empty lines, WEBVTT headers, and sequence numbers
    if (!line || line === 'WEBVTT' || line.match(/^\d+$/) || line.startsWith('NOTE')) {
      continue;
    }

    // This is subtitle text
    const cleanedText = decodeHtmlEntities(line.replace(/<[^>]+>/g, '')).trim();
    if (cleanedText && currentTime) {
      // Only add if this text is different from the last one (removes consecutive duplicates)
      if (cleanedText !== lastText) {
        segments.push({
          timestamp: currentTimestamp,
          time: currentTime,
          text: cleanedText
        });
        lastText = cleanedText;
      }
    }
  }

  return segments;
}

// Extract video ID from YouTube URL
function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
}

// Get service account credentials from Secret Manager
async function getServiceAccountFromSecretManager(): Promise<any> {
  const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

  const projectId = process.env.GCP_PROJECT_ID;
  const secretName = process.env.GCP_SECRET_NAME || 'vertex-ai-service-account';

  if (!projectId) {
    throw new Error('GCP_PROJECT_ID environment variable is not set');
  }

  // For local development, use application default credentials
  // For production, use the service account with Secret Manager access
  const client = new SecretManagerServiceClient();

  const secretPath = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name: secretPath });
    const payload = version.payload?.data?.toString();

    if (!payload) {
      throw new Error('Secret payload is empty');
    }

    return JSON.parse(payload);
  } catch (error: any) {
    console.error('Error accessing secret:', error.message);
    throw new Error(`Failed to access service account from Secret Manager: ${error.message}`);
  }
}

// Summarize transcript using Vertex AI
async function summarizeWithVertexAI(
  transcript: string,
  timestampedTranscript: Array<{ timestamp: number; text: string; time: string }>
): Promise<{ summary: string; topics: Array<{ title: string; timestamp: number; description: string }> }> {
  const { VertexAI } = require('@google-cloud/vertexai');

  // Initialize Vertex AI
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || 'us-central1';

  if (!projectId) {
    throw new Error('GCP_PROJECT_ID environment variable is not set');
  }

  // Get credentials from Secret Manager
  const credentials = await getServiceAccountFromSecretManager();

  const vertexAI = new VertexAI({
    project: projectId,
    location,
    googleAuthOptions: {
      credentials
    }
  });

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });

  // Determine summary depth based on transcript length
  const transcriptLength = transcript.length;
  const estimatedMinutes = Math.round(transcriptLength / 1000);

  let summaryDepth;
  if (transcriptLength < 10000) {
    summaryDepth = { paragraphs: '1-2 paragraphs', topics: '3-5', takeaways: '3-4', quotes: '2-3', chapters: '3-4' };
  } else if (transcriptLength < 30000) {
    summaryDepth = { paragraphs: '2-3 paragraphs', topics: '5-8', takeaways: '4-6', quotes: '3-5', chapters: '5-7' };
  } else {
    summaryDepth = { paragraphs: '3-4 paragraphs', topics: '8-12', takeaways: '6-10', quotes: '5-8', chapters: '8-12' };
  }

  const prompt = `You are a podcast summarization expert. Analyze this ${estimatedMinutes}-minute podcast transcript and provide:

1. **Main Summary** (${summaryDepth.paragraphs}): Detailed overview of the episode.

2. **Key Topics** (${summaryDepth.topics} bullet points): Main themes with 1-2 sentences each.

3. **Key Takeaways** (${summaryDepth.takeaways} bullet points): Actionable insights with context.

4. **Notable Quotes** (${summaryDepth.quotes} quotes): Memorable quotes with context.

5. **Chapter Bookmarks** (${summaryDepth.chapters} chapters): Break the podcast into major topic segments. For each chapter, provide:
   - A catchy, descriptive title (3-6 words)
   - Approximate timestamp (HH:MM:SS format, estimate based on content flow)
   - 1-sentence description

Format chapters as:
## Chapter Bookmarks
- **[00:05:30] Introduction & Background** - Overview of today's topic and guest introduction
- **[00:15:45] Deep Dive into AI** - Discussion about artificial intelligence impacts

Format your response in clean markdown.

Transcript:
${transcript.slice(0, 100000)} ${transcript.length > 100000 ? '\n\n[Transcript truncated]' : ''}`;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary generated';

  // Extract chapter bookmarks from the summary
  const topics = extractTopicsFromSummary(summaryText, timestampedTranscript);

  return { summary: summaryText, topics };
}

// Extract topic bookmarks from AI summary and match to timestamps
function extractTopicsFromSummary(
  summary: string,
  timestampedTranscript: Array<{ timestamp: number; text: string; time: string }>
): Array<{ title: string; timestamp: number; description: string }> {
  const topics: Array<{ title: string; timestamp: number; description: string }> = [];

  // Match chapter bookmark format: - **[HH:MM:SS] Title** - Description
  const chapterRegex = /[-*]\s*\*\*\[(\d{2}:\d{2}:\d{2})\]\s*([^\*]+)\*\*\s*[-–]\s*(.+?)(?=\n|$)/g;

  let match;
  while ((match = chapterRegex.exec(summary)) !== null) {
    const timeStr = match[1];
    const title = match[2].trim();
    const description = match[3].trim();

    // Convert time string to seconds
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const timestamp = hours * 3600 + minutes * 60 + seconds;

    topics.push({ title, timestamp, description });
  }

  // If no chapters found in summary, create basic sections based on transcript length
  if (topics.length === 0) {
    const duration = timestampedTranscript[timestampedTranscript.length - 1]?.timestamp || 0;
    const numSections = Math.min(Math.max(3, Math.floor(duration / 600)), 10); // 1 section per 10 min, max 10

    for (let i = 0; i < numSections; i++) {
      const timestamp = Math.floor((duration / numSections) * i);
      topics.push({
        title: `Section ${i + 1}`,
        timestamp,
        description: 'Topic section'
      });
    }
  }

  return topics;
}
