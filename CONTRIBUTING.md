# Contributing to Python Media Toolkit

Thanks for your interest in contributing! This is an educational project, and contributions are welcome.

## How to Contribute

### Adding New Features

1. **Fork the repository** and create a new branch
2. **Make your changes** - Keep code clean and well-commented
3. **Test thoroughly** - Make sure everything works
4. **Submit a pull request** with a clear description

### Adding New Platform Support

The Media Downloader can be extended to support more platforms. Here's how:

1. **Update platform detection** in `toolkit.py` around line 643:
```python
def detect_platform(url):
    """Detect the platform from a given URL"""
    if "newplatform.com" in url:
        return "🆕 New Platform"
    # ... existing platforms
```

2. **Test with yt-dlp** - Make sure yt-dlp supports the platform:
```bash
yt-dlp --list-formats <url>
```

3. **Add platform-specific options** if needed (around line 1481)

### Code Style

- Use clear variable names
- Add comments for complex logic
- Follow existing code patterns
- Keep functions focused and modular

### Testing Checklist

- [ ] Code runs without errors
- [ ] UI updates correctly
- [ ] Progress tracking works
- [ ] Files are organized properly
- [ ] Error handling is graceful

## Project Structure

```
toolkit-python/
├── toolkit.py          # Main application
├── requirements.txt    # Python dependencies
├── start              # Launch script
├── README.md          # Documentation
└── venv/              # Virtual environment (not in git)
```

## Key Functions to Understand

- `detect_platform()` - Identifies URL platform (line 643)
- `detect_playlist()` - Checks if URL is playlist (line 661)
- `parse_yt_dlp_progress()` - Parses download progress (line 109)
- `show_media_downloader()` - Main UI (line 893)
- `execute_download()` - Download logic (line 1355)

## Ideas for Contributions

- [ ] Add download history/database
- [ ] Implement batch download from text file
- [ ] Create CLI version
- [ ] Add more error handling
- [ ] Improve progress parsing
- [ ] Add download speed limiting
- [ ] Implement retry logic for failed downloads
- [ ] Add proxy support
- [ ] Create automated tests

## Questions?

Open an issue on GitHub and we'll help you get started!

## Code of Conduct

- Be respectful and constructive
- Help others learn
- Follow best practices
- Remember this is an educational project
