import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface VideoData {
  title: string;
  view_count: number;
  upload_date: string;
  duration: number;
  id: string;
}

interface ChannelStats {
  channelName: string;
  channelUrl: string;
  subscriberCount: string;
  totalViews: string;
  videoCount: number;
  joinedDate: string;
  averageViews: number;
  topVideos: Array<{
    title: string;
    views: string;
    uploadDate: string;
    duration: string;
  }>;
  uploadFrequency: string;
  recentActivity: Array<{
    date: string;
    videosUploaded: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'Channel URL is required' }, { status: 400 });
    }

    const projectRoot = path.resolve(process.cwd());
    const ytdlpCmd = path.join(projectRoot, 'venv', 'bin', 'yt-dlp');

    if (!fs.existsSync(ytdlpCmd)) {
      return NextResponse.json({
        error: 'yt-dlp not found. Please run: python3 -m venv venv && source venv/bin/activate && pip install yt-dlp'
      }, { status: 500 });
    }

    // Normalize channel URL to ensure we're hitting the videos tab
    let channelVideosUrl = url.trim();
    if (!channelVideosUrl.endsWith('/videos')) {
      channelVideosUrl = channelVideosUrl.replace(/\/$/, '') + '/videos';
    }

    // Fetch video list (limit to 50 for performance)
    let result: string;
    try {
      result = execSync(
        `"${ytdlpCmd}" --flat-playlist --print-json -I 1:50 "${channelVideosUrl}"`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 90000 }
      );
    } catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      return NextResponse.json({ error: `Failed to fetch channel data: ${errorMessage}` }, { status: 500 });
    }

    // Parse JSON lines (one per video)
    const videos: VideoData[] = result
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((v): v is VideoData => v !== null);

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No videos found for this channel' }, { status: 404 });
    }

    // Get channel info from first video
    let channelInfo: {
      channel?: string;
      uploader?: string;
      channel_follower_count?: number;
    } = {};

    try {
      const channelInfoResult = execSync(
        `"${ytdlpCmd}" --dump-json --playlist-items 1 "${channelVideosUrl}"`,
        { encoding: 'utf-8', timeout: 30000 }
      );
      channelInfo = JSON.parse(channelInfoResult);
    } catch {
      // Use basic info if detailed fetch fails
      channelInfo = { channel: 'Unknown Channel' };
    }

    // Calculate statistics
    const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
    const averageViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

    // Sort by views for top videos
    const sortedByViews = [...videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    const topVideos = sortedByViews.slice(0, 10).map(v => ({
      title: v.title || 'Untitled',
      views: formatNumber(v.view_count || 0),
      uploadDate: formatDate(v.upload_date),
      duration: formatDuration(v.duration || 0),
    }));

    // Calculate upload frequency
    const uploadFrequency = calculateUploadFrequency(videos);

    // Recent activity (last 30 days)
    const recentActivity = calculateRecentActivity(videos);

    const stats: ChannelStats = {
      channelName: channelInfo.channel || channelInfo.uploader || 'Unknown',
      channelUrl: url,
      subscriberCount: channelInfo.channel_follower_count
        ? formatNumber(channelInfo.channel_follower_count)
        : 'N/A',
      totalViews: formatNumber(totalViews),
      videoCount: videos.length,
      joinedDate: 'N/A', // Not available via yt-dlp
      averageViews,
      topVideos,
      uploadFrequency,
      recentActivity,
    };

    return NextResponse.json(stats);
  } catch (error: unknown) {
    console.error('Channel analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Helper functions
function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return 'Unknown';
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  return `${year}-${month}-${day}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function calculateUploadFrequency(videos: VideoData[]): string {
  if (videos.length < 2) return 'Insufficient data';

  const dates = videos
    .map(v => v.upload_date)
    .filter(d => d && d.length === 8)
    .map(d => new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (dates.length < 2) return 'Insufficient data';

  const daysDiff = (dates[0].getTime() - dates[dates.length - 1].getTime()) / (1000 * 60 * 60 * 24);
  const avgDaysBetween = daysDiff / (dates.length - 1);

  if (avgDaysBetween < 1) return 'Multiple per day';
  if (avgDaysBetween < 3) return 'Every 1-2 days';
  if (avgDaysBetween < 8) return 'Weekly';
  if (avgDaysBetween < 15) return 'Bi-weekly';
  if (avgDaysBetween < 35) return 'Monthly';
  return 'Less than monthly';
}

function calculateRecentActivity(videos: VideoData[]): Array<{ date: string; videosUploaded: number }> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const activityMap = new Map<string, number>();

  videos.forEach(v => {
    if (!v.upload_date || v.upload_date.length !== 8) return;

    const dateStr = `${v.upload_date.slice(0, 4)}-${v.upload_date.slice(4, 6)}-${v.upload_date.slice(6, 8)}`;
    const uploadDate = new Date(dateStr);

    if (!isNaN(uploadDate.getTime()) && uploadDate >= thirtyDaysAgo) {
      activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
    }
  });

  return Array.from(activityMap.entries())
    .map(([date, videosUploaded]) => ({ date, videosUploaded }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
}
