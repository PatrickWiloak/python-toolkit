'use client';

import { useState, useEffect, useRef } from 'react';

type DownloadFormat = 'video' | 'audio';
type Platform = 'YouTube' | 'Instagram' | 'TikTok' | 'Twitter' | 'LinkedIn' | 'Unknown';
type DownloadStep = 'idle' | 'preparing' | 'fetching' | 'downloading' | 'processing' | 'completed' | 'error';

interface DownloadProgress {
  status: string;
  progress: number;
  details: string;
  videoIndex?: number;
  videoTotal?: number;
}

const DEFAULT_OUTPUT_DIR = '/home/patwiloak/Downloads';

export default function MediaDownloader() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<DownloadFormat>('video');
  const [quality, setQuality] = useState('Best');
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [platform, setPlatform] = useState<Platform>('Unknown');
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [currentStep, setCurrentStep] = useState<DownloadStep>('idle');
  const [outputDir, setOutputDir] = useState(DEFAULT_OUTPUT_DIR);
  const [showSettings, setShowSettings] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load saved output directory from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mediaDownloader_outputDir');
    if (saved) setOutputDir(saved);
  }, []);

  // Save output directory to localStorage
  useEffect(() => {
    if (outputDir !== DEFAULT_OUTPUT_DIR) {
      localStorage.setItem('mediaDownloader_outputDir', outputDir);
    }
  }, [outputDir]);

  useEffect(() => {
    if (!url) {
      setPlatform('Unknown');
      setIsPlaylist(false);
      return;
    }

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      setPlatform('YouTube');
      setIsPlaylist(url.includes('list=') || url.includes('playlist'));
    } else if (url.includes('instagram.com')) {
      setPlatform('Instagram');
    } else if (url.includes('tiktok.com')) {
      setPlatform('TikTok');
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      setPlatform('Twitter');
    } else if (url.includes('linkedin.com')) {
      setPlatform('LinkedIn');
    } else {
      setPlatform('Unknown');
    }
  }, [url]);


  // Determine current step based on progress
  useEffect(() => {
    if (!progress) return;

    const status = progress.status.toLowerCase();
    if (status.includes('completed')) {
      setCurrentStep('completed');
    } else if (status.includes('error') || status.includes('failed')) {
      setCurrentStep('error');
    } else if (status.includes('processing') || status.includes('merging') || status.includes('extracting')) {
      setCurrentStep('processing');
    } else if (status.includes('downloading') || progress.progress > 0) {
      setCurrentStep('downloading');
    } else if (status.includes('found') || status.includes('fetching') || status.includes('preparing')) {
      setCurrentStep('fetching');
    } else {
      setCurrentStep('preparing');
    }
  }, [progress]);

  const handleDownload = async () => {
    if (!url) return;

    setDownloading(true);
    setCurrentStep('preparing');
    setProgress({ status: 'Starting...', progress: 0, details: '' });

    const eventSource = new EventSource(
      `/downloads?${new URLSearchParams({
        url,
        format,
        quality,
        audioFormat,
        outputDir,
      })}`
    );

    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);

      if (data.status === 'completed' || data.status === 'error') {
        eventSource.close();
        eventSourceRef.current = null;
        // Don't auto-reset - let user control when to start another download
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      setDownloading(false);
      setCurrentStep('error');
      setProgress({ status: 'Connection error occurred', progress: 0, details: '' });
    };
  };

  const handleCancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setDownloading(false);
    setCurrentStep('idle');
    setProgress(null);
  };

  const handleReset = () => {
    setUrl('');
    setDownloading(false);
    setCurrentStep('idle');
    setProgress(null);
  };


  const steps = [
    { id: 'preparing', label: 'Preparing', icon: '⚙️' },
    { id: 'fetching', label: 'Fetching', icon: '🔍' },
    { id: 'downloading', label: 'Downloading', icon: '📥' },
    { id: 'processing', label: 'Processing', icon: '⚡' },
    { id: 'completed', label: 'Complete', icon: '✅' },
  ];

  const getStepStatus = (stepId: string) => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === currentStep);

    if (currentStep === 'error') return 'error';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="bg-black rounded-xl border border-white/10 overflow-hidden">

        {/* URL Input Section */}
        <div className="p-8 border-b border-white/10">
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !downloading && url && handleDownload()}
              placeholder="Paste your media URL here..."
              className="w-full px-6 py-4 text-lg bg-white/5 backdrop-blur border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-all"
              disabled={downloading}
            />
            {url && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-md">
                  <span className="text-xs font-medium text-white">{platform}</span>
                  {isPlaylist && <span className="text-xs text-gray-400">• Playlist</span>}
                </div>
              </div>
            )}
          </div>

          {/* Settings Toggle */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
              <svg className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className="text-xs text-gray-600 truncate max-w-[300px]" title={outputDir}>
              Saving to: {outputDir}
            </span>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg">
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                Download Directory
              </label>
              <input
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="/path/to/downloads"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-all text-sm"
                disabled={downloading}
              />
            </div>
          )}
        </div>

        <div className="p-8">
          {/* Format Tabs */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setFormat('video')}
              disabled={downloading}
              className={`p-6 rounded-lg border transition-all ${
                format === 'video'
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center justify-center gap-3 text-lg font-medium">
                <span>🎬</span>
                <span>Video</span>
              </div>
            </button>

            <button
              onClick={() => setFormat('audio')}
              disabled={downloading}
              className={`p-6 rounded-lg border transition-all ${
                format === 'audio'
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center justify-center gap-3 text-lg font-medium">
                <span>🎵</span>
                <span>Audio Only</span>
              </div>
            </button>
          </div>

          {/* Options Grid */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
              {format === 'video' ? 'Quality' : 'Format'}
            </label>
            <select
              value={format === 'video' ? quality : audioFormat}
              onChange={(e) => format === 'video' ? setQuality(e.target.value) : setAudioFormat(e.target.value)}
              disabled={downloading}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 transition-all"
            >
              {format === 'video' ? (
                <>
                  <option>Best</option>
                  <option>1080p</option>
                  <option>720p</option>
                  <option>480p</option>
                  <option>360p</option>
                </>
              ) : (
                <>
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                  <option value="flac">FLAC</option>
                  <option value="m4a">M4A</option>
                </>
              )}
            </select>
          </div>

          {/* Download Button or Progress */}
          {!downloading ? (
            <button
              onClick={handleDownload}
              disabled={!url}
              className={`w-full py-5 rounded-lg font-medium text-lg transition-all ${
                url
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center justify-center gap-3">
                <span>🚀</span>
                {isPlaylist ? 'Download Playlist' : `Download ${format === 'video' ? 'Video' : 'Audio'}`}
              </span>
            </button>
          ) : (
            <div className="space-y-6">
              {/* Step Progress Indicator */}
              <div className="flex items-center justify-between">
                {steps.slice(0, -1).map((step, index) => {
                  const status = getStepStatus(step.id);
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all ${
                            status === 'completed'
                              ? 'bg-white text-black'
                              : status === 'active'
                              ? 'bg-white/20 text-white border border-white'
                              : status === 'error'
                              ? 'bg-white text-black'
                              : 'bg-white/5 text-gray-600'
                          }`}
                        >
                          {status === 'completed' ? '✓' : status === 'error' ? '✗' : step.icon}
                        </div>
                        <span className={`mt-2 text-xs font-medium ${
                          status === 'active' ? 'text-white' : 'text-gray-600'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      {index < steps.length - 2 && (
                        <div className={`flex-1 h-px mx-2 transition-all ${
                          getStepStatus(steps[index + 1].id) === 'completed' || getStepStatus(steps[index + 1].id) === 'active'
                            ? 'bg-white'
                            : 'bg-white/10'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{progress?.status}</span>
                  <span className="text-sm font-medium text-white">
                    {progress?.progress?.toFixed(1)}%
                  </span>
                </div>

                <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-white transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progress?.progress || 0}%` }}
                  />
                </div>
              </div>

              {/* Details Panel */}
              {progress?.details && (
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-sm font-mono text-gray-400">{progress.details}</p>
                </div>
              )}

              {/* Playlist Progress */}
              {progress?.videoIndex && progress?.videoTotal && (
                <div className="flex items-center justify-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-xl">📹</span>
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Playlist Progress</div>
                    <div className="text-lg font-medium text-white">
                      {progress.videoIndex} / {progress.videoTotal}
                    </div>
                  </div>
                </div>
              )}

              {/* Cancel Button - show during active download */}
              {currentStep !== 'completed' && currentStep !== 'error' && (
                <button
                  onClick={handleCancel}
                  className="w-full py-3 rounded-lg font-medium text-sm bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                >
                  Cancel Download
                </button>
              )}

              {/* Completion Message */}
              {currentStep === 'completed' && (
                <div className="p-6 bg-white/5 border border-white/10 rounded-lg text-center">
                  <div className="text-3xl mb-2">✓</div>
                  <div className="text-lg font-medium text-white mb-1">Download Complete</div>
                  <div className="text-sm text-gray-400 mb-4">Your files are ready in {outputDir}</div>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-lg font-medium text-sm transition-all"
                  >
                    Download Another
                  </button>
                </div>
              )}

              {/* Error Message */}
              {currentStep === 'error' && (
                <div className="p-6 bg-white/5 border border-white/10 rounded-lg text-center">
                  <div className="text-3xl mb-2">✗</div>
                  <div className="text-lg font-medium text-white mb-1">Download Failed</div>
                  <div className="text-sm text-gray-400 mb-4">{progress?.details || 'Please try again'}</div>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-lg font-medium text-sm transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
