'use client';

import { useState } from 'react';

interface ThumbnailOptions {
  timestamp: string;
  width: number;
  height: number;
}

export default function ThumbnailGenerator() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [inputMethod, setInputMethod] = useState<'url' | 'file'>('url');
  const [options, setOptions] = useState<ThumbnailOptions>({
    timestamp: '00:00:05',
    width: 1280,
    height: 720,
  });
  const [generating, setGenerating] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [frameCount, setFrameCount] = useState(10);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setThumbnails([]);

    const formData = new FormData();
    if (inputMethod === 'file' && videoFile) {
      formData.append('video', videoFile);
    } else {
      formData.append('url', videoUrl);
    }
    formData.append('options', JSON.stringify({ ...options, autoMode, frameCount }));

    try {
      const response = await fetch('/api/thumbnails', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setThumbnails(data.thumbnails);
    } catch (error) {
      console.error('Error generating thumbnails:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="bg-black rounded-xl border border-white/10 overflow-hidden">

        {/* Input Method Toggle */}
        <div className="p-8 border-b border-white/10">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setInputMethod('url')}
              className={`p-4 rounded-lg border transition-all ${
                inputMethod === 'url'
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white border-white/10 hover:border-white/30'
              }`}
            >
              <span className="text-lg font-medium">🔗 From URL</span>
            </button>
            <button
              onClick={() => setInputMethod('file')}
              className={`p-4 rounded-lg border transition-all ${
                inputMethod === 'file'
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white border-white/10 hover:border-white/30'
              }`}
            >
              <span className="text-lg font-medium">📁 From File</span>
            </button>
          </div>
        </div>

        {/* Input Section */}
        <div className="p-8 border-b border-white/10">
          {inputMethod === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                Video URL
              </label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                disabled={generating}
                className="w-full px-6 py-4 text-lg bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                Video File
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="thumbnail-video-upload"
                disabled={generating}
              />
              <label
                htmlFor="thumbnail-video-upload"
                className={`block w-full px-6 py-4 text-center border-2 border-dashed rounded-lg transition-all cursor-pointer ${
                  videoFile
                    ? 'border-white/30 bg-white/5'
                    : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                }`}
              >
                {videoFile ? (
                  <div className="text-white">
                    <span className="text-lg">📹</span>
                    <p className="mt-2">{videoFile.name}</p>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <span className="text-3xl">📁</span>
                    <p className="mt-2">Click to upload video</p>
                  </div>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Options Section */}
        <div className="p-8 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-6 uppercase tracking-wide">
            Generation Options
          </h3>

          {/* Mode Toggle */}
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setAutoMode(false)}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  !autoMode
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-gray-400 border-white/10'
                }`}
              >
                Single Frame
              </button>
              <button
                onClick={() => setAutoMode(true)}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  autoMode
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-gray-400 border-white/10'
                }`}
              >
                Multiple Frames
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {!autoMode ? (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Timestamp
                </label>
                <input
                  type="text"
                  value={options.timestamp}
                  onChange={(e) => setOptions({ ...options, timestamp: e.target.value })}
                  placeholder="00:00:05"
                  disabled={generating}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30 font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Number of Frames
                </label>
                <input
                  type="number"
                  value={frameCount}
                  onChange={(e) => setFrameCount(parseInt(e.target.value))}
                  min="2"
                  max="50"
                  disabled={generating}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                Resolution
              </label>
              <select
                value={`${options.width}x${options.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  setOptions({ ...options, width, height });
                }}
                disabled={generating}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
              >
                <option value="1920x1080">1920x1080 (Full HD)</option>
                <option value="1280x720">1280x720 (HD)</option>
                <option value="854x480">854x480 (SD)</option>
                <option value="640x360">640x360 (Small)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-8">
          <button
            onClick={handleGenerate}
            disabled={(!videoUrl && !videoFile) || generating}
            className={`w-full py-5 rounded-lg font-medium text-lg transition-all ${
              (videoUrl || videoFile) && !generating
                ? 'bg-white text-black hover:bg-gray-200'
                : 'bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed'
            }`}
          >
            <span className="flex items-center justify-center gap-3">
              <span>🖼️</span>
              {generating ? 'Generating...' : `Generate Thumbnail${autoMode ? 's' : ''}`}
            </span>
          </button>
        </div>
      </div>

      {/* Results Section */}
      {thumbnails.length > 0 && (
        <div className="mt-8 bg-black rounded-xl border border-white/10 overflow-hidden p-8">
          <h3 className="text-white font-medium mb-6 text-lg">Generated Thumbnails</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {thumbnails.map((thumb, index) => (
              <div key={index} className="relative group">
                <img
                  src={thumb}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full rounded-lg border border-white/10"
                />
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = thumb;
                    link.download = `thumbnail-${index + 1}.jpg`;
                    link.click();
                  }}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                >
                  <span className="text-white font-medium">⬇️ Download</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
