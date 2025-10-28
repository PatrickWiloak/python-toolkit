'use client';

export default function Navbar() {
  return (
    <nav className="bg-black border-b border-white/10 sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <a href="/" className="text-xl font-light tracking-tight text-white hover:text-gray-300 transition-colors">
              Media Toolkit
            </a>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <a
              href="/"
              className="text-gray-400 hover:text-white transition-colors duration-200 text-xs font-medium tracking-widest uppercase"
            >
              Downloader
            </a>
            <a
              href="/clipper"
              className="text-gray-400 hover:text-white transition-colors duration-200 text-xs font-medium tracking-widest uppercase"
            >
              Clipper
            </a>
            <a
              href="/thumbnails"
              className="text-gray-400 hover:text-white transition-colors duration-200 text-xs font-medium tracking-widest uppercase"
            >
              Thumbnails
            </a>
            <a
              href="/analyzer"
              className="text-gray-400 hover:text-white transition-colors duration-200 text-xs font-medium tracking-widest uppercase"
            >
              Analyzer
            </a>
            <a
              href="/podcasts"
              className="text-gray-400 hover:text-white transition-colors duration-200 text-xs font-medium tracking-widest uppercase"
            >
              Podcasts
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
