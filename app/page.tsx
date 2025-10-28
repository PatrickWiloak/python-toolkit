'use client';

import Navbar from '@/components/Navbar';
import MediaDownloader from '@/components/MediaDownloader';

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-black">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-light tracking-tight text-white">
              Media Downloader
            </h1>
          </div>

          {/* Main Content */}
          <MediaDownloader />
        </div>
      </main>
    </>
  );
}
