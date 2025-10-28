'use client';

import { useState } from 'react';

interface Clip {
  startTime: string;
  endTime: string;
  name: string;
}

export default function VideoClipper() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [clips, setClips] = useState<Clip[]>([{ startTime: '00:00:00', endTime: '00:00:10', name: 'Clip 1' }]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const addClip = () => {
    setClips([...clips, {
      startTime: '00:00:00',
      endTime: '00:00:10',
      name: `Clip ${clips.length + 1}`
    }]);
  };

  const removeClip = (index: number) => {
    setClips(clips.filter((_, i) => i !== index));
  };

  const updateClip = (index: number, field: keyof Clip, value: string) => {
    const newClips = [...clips];
    newClips[index][field] = value;
    setClips(newClips);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };

  const handleProcess = async () => {
    if (!videoFile) return;

    setProcessing(true);
    setProgress(0);
    setStatus('Uploading video...');

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('clips', JSON.stringify(clips));

    try {
      const response = await fetch('/api/clip', {
        method: 'POST',
        body: formData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            setProgress(data.progress);
            setStatus(data.status);
          }
        }
      }

      setProcessing(false);
    } catch (error) {
      setStatus('Error processing video');
      setProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="bg-black rounded-xl border border-white/10 overflow-hidden">

        {/* File Upload Section */}
        <div className="p-8 border-b border-white/10">
          <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
            Video File
          </label>
          <div className="relative">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              id="video-upload"
              disabled={processing}
            />
            <label
              htmlFor="video-upload"
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
                  <p className="text-sm text-gray-400 mt-1">
                    {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="text-gray-400">
                  <span className="text-3xl">📁</span>
                  <p className="mt-2">Click to upload video</p>
                  <p className="text-sm mt-1">MP4, MOV, AVI, MKV supported</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Clips Configuration */}
        <div className="p-8 border-b border-white/10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Clips to Extract
            </h3>
            <button
              onClick={addClip}
              disabled={processing}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white text-sm transition-all"
            >
              + Add Clip
            </button>
          </div>

          <div className="space-y-4">
            {clips.map((clip, index) => (
              <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                  <input
                    type="text"
                    value={clip.name}
                    onChange={(e) => updateClip(index, 'name', e.target.value)}
                    placeholder="Clip name"
                    disabled={processing}
                    className="px-4 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                  <input
                    type="text"
                    value={clip.startTime}
                    onChange={(e) => updateClip(index, 'startTime', e.target.value)}
                    placeholder="00:00:00"
                    disabled={processing}
                    className="w-32 px-4 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30 font-mono text-sm"
                  />
                  <span className="text-gray-600">→</span>
                  <input
                    type="text"
                    value={clip.endTime}
                    onChange={(e) => updateClip(index, 'endTime', e.target.value)}
                    placeholder="00:00:10"
                    disabled={processing}
                    className="w-32 px-4 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30 font-mono text-sm"
                  />
                  {clips.length > 1 && (
                    <button
                      onClick={() => removeClip(index)}
                      disabled={processing}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Process Button */}
        <div className="p-8">
          {!processing ? (
            <button
              onClick={handleProcess}
              disabled={!videoFile || processing}
              className={`w-full py-5 rounded-lg font-medium text-lg transition-all ${
                videoFile
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center justify-center gap-3">
                <span>✂️</span>
                Extract {clips.length} Clip{clips.length > 1 ? 's' : ''}
              </span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-medium">{status}</span>
                <span className="text-white font-medium">{progress}%</span>
              </div>
              <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-white transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-lg">
        <h4 className="text-white font-medium mb-3">Time Format</h4>
        <p className="text-gray-400 text-sm mb-2">Use format: HH:MM:SS (hours:minutes:seconds)</p>
        <div className="space-y-1 text-sm text-gray-400">
          <p>• 00:00:30 = 30 seconds</p>
          <p>• 00:02:15 = 2 minutes 15 seconds</p>
          <p>• 01:30:00 = 1 hour 30 minutes</p>
        </div>
      </div>
    </div>
  );
}
