'use client';

import { useState } from 'react';

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

export default function ChannelAnalyzer() {
  const [channelUrl, setChannelUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!channelUrl) return;

    setAnalyzing(true);
    setError('');
    setStats(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: channelUrl }),
      });

      if (!response.ok) throw new Error('Failed to analyze channel');

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError('Failed to analyze channel. Please check the URL and try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Input Section */}
      <div className="bg-black rounded-xl border border-white/10 overflow-hidden mb-8">
        <div className="p-8 border-b border-white/10">
          <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
            YouTube Channel URL
          </label>
          <input
            type="text"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            placeholder="https://youtube.com/@channelname or https://youtube.com/c/channelname"
            disabled={analyzing}
            className="w-full px-6 py-4 text-lg bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
        </div>

        <div className="p-8">
          <button
            onClick={handleAnalyze}
            disabled={!channelUrl || analyzing}
            className={`w-full py-5 rounded-lg font-medium text-lg transition-all ${
              channelUrl && !analyzing
                ? 'bg-white text-black hover:bg-gray-200'
                : 'bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed'
            }`}
          >
            <span className="flex items-center justify-center gap-3">
              <span>📊</span>
              {analyzing ? 'Analyzing...' : 'Analyze Channel'}
            </span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-8">
          <p className="text-white text-center">{error}</p>
        </div>
      )}

      {/* Stats Display */}
      {stats && (
        <div className="space-y-6">
          {/* Channel Overview */}
          <div className="bg-black rounded-xl border border-white/10 overflow-hidden p-8">
            <h2 className="text-3xl font-light text-white mb-6">{stats.channelName}</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-white mb-2">{stats.subscriberCount}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wide">Subscribers</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-white mb-2">{stats.totalViews}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wide">Total Views</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-white mb-2">{stats.videoCount}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wide">Videos</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-white mb-2">{stats.averageViews.toLocaleString()}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wide">Avg Views</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <span>📅</span>
                <span>Joined: {stats.joinedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span>📈</span>
                <span>Upload Frequency: {stats.uploadFrequency}</span>
              </div>
            </div>
          </div>

          {/* Top Videos */}
          <div className="bg-black rounded-xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-medium text-white">Top Performing Videos</h3>
            </div>
            <div className="divide-y divide-white/10">
              {stats.topVideos.map((video, index) => (
                <div key={index} className="p-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-2">{video.title}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>👁️ {video.views} views</span>
                        <span>⏱️ {video.duration}</span>
                        <span>📅 {video.uploadDate}</span>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white/20">#{index + 1}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-black rounded-xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-medium text-white">Recent Upload Activity</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                    <span className="text-gray-400">{activity.date}</span>
                    <span className="text-white font-medium">{activity.videosUploaded} video{activity.videosUploaded > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div className="bg-black rounded-xl border border-white/10 overflow-hidden p-6">
            <button
              onClick={() => {
                const dataStr = JSON.stringify(stats, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${stats.channelName.replace(/[^a-z0-9]/gi, '_')}_stats.json`;
                link.click();
              }}
              className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white font-medium transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                <span>💾</span>
                Export Analysis as JSON
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
