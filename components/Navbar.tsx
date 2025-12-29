'use client';

import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Downloader' },
    { href: '/podcasts', label: 'Podcasts' },
    { href: '/clipper', label: 'Clipper' },
    { href: '/thumbnails', label: 'Thumbnails' },
    { href: '/analyzer', label: 'Analyzer' },
  ];

  return (
    <nav className="bg-black border-b border-white/10 sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <a href="/" className="text-xl font-light tracking-tight text-white hover:text-gray-300 transition-colors">
              Pat's Media Toolkit
            </a>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`transition-colors duration-200 text-xs font-medium tracking-widest uppercase ${
                    isActive
                      ? 'text-white border-b-2 border-white pb-0.5'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
