# 🛠️ Media Toolkit

A modern web application built with Next.js and Tailwind CSS for media processing and podcast summarization.

---

## ⚠️ IMPORTANT DISCLAIMER

**This tool is for educational purposes only.**

- Only download media you have the legal right to download
- Respect copyright laws and content creators' rights
- Do not use this tool to download copyrighted content without permission
- The developers are not responsible for any misuse of this software

By using this tool, you agree to comply with all applicable laws and platform terms of service.

---

## 🚀 Features

### 🎬 Media Downloader
- Download videos and audio from YouTube, Instagram, TikTok, X (Twitter), and LinkedIn
- Clean, modern UI with Tailwind CSS
- Auto-detection of playlists vs single items
- Quality and format selection
- Real-time download progress

### 🎙️ Podcast Summarizer
- AI-powered podcast transcription and summarization
- Powered by Google Cloud Vertex AI
- Customizable summary styles and focus areas
- Support for timestamps and action items
- Download summaries and transcripts

---

## 📋 Requirements

- Node.js 18+
- npm or yarn
- Google Cloud account (for Podcast Summarizer with Vertex AI)

---

## 🔧 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/toolkit-python.git
cd toolkit-python
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your configuration:

```env
# Google Cloud Configuration (for Podcast Summarizer)
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1

# Optional: Use Secret Manager
USE_SECRET_MANAGER=false
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎯 Usage

### Media Downloader

1. Navigate to the Media Downloader page
2. Paste any supported media URL
3. Select your preferred format and quality
4. Click download and wait for completion

### Podcast Summarizer

1. Navigate to the Podcast Summarizer page
2. Paste a podcast URL (YouTube or RSS feed)
3. Configure summary options (style, length, focus areas)
4. Click "Summarize" to process
5. View or download the transcript and summary

---

## 📂 Project Structure

```
toolkit-python/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── podcasts/          # Podcast summarizer
│   └── summarize/         # API route for summarization
├── components/             # React components
│   ├── Navbar.tsx         # Navigation bar
│   ├── MediaDownloader.tsx
│   └── PodcastSummarizer.tsx
├── public/                # Static assets
├── .env.example           # Environment template
├── package.json           # Dependencies
└── tailwind.config.js     # Tailwind configuration
```

---

## 🔮 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **AI**: Google Cloud Vertex AI (Gemini)
- **Media Processing**: yt-dlp

---

## 🤝 Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - Feel free to use this code for learning and projects.

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Google Cloud Vertex AI](https://cloud.google.com/vertex-ai)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)

---

**Remember**: Always respect copyright and only download content you have permission to access.
