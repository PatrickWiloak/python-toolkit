# Adding New Tools to the Toolkit

## Quick Start

1. **Create your tool** in the `tools/` directory
2. **Update the toolkit.py** to add your tool to the menu
3. **Test your tool** through the launcher

## Tool Structure

```
tools/
├── your-tool-name/
│   ├── main_script.py
│   ├── requirements.txt (optional)
│   └── README.md (optional)
```

## Adding to the Launcher

Edit `toolkit.py` and add your tool to the `self.tools` dictionary:

```python
"3": {
    "name": "Your Tool Name",
    "description": "Brief description of what your tool does",
    "script": "your-tool-name/main_script.py",
    "type": "gui"  # or "cli"
}
```

## Tool Types

- **gui**: Graphical interface tools (like YouTube Downloader)
- **cli**: Command-line interface tools
- **placeholder**: Coming soon placeholders

## Example Tool Template

Save this as `tools/example-tool/example_tool.py`:

```python
#!/usr/bin/env python3
"""
Example Tool Template
Replace this with your tool's functionality
"""

import tkinter as tk
from tkinter import messagebox

def main():
    # For GUI tools
    root = tk.Tk()
    root.title("Example Tool")
    root.geometry("400x300")
    
    label = tk.Label(root, text="Hello from Example Tool!", font=("Arial", 16))
    label.pack(pady=50)
    
    def close_app():
        root.destroy()
    
    button = tk.Button(root, text="Close", command=close_app, font=("Arial", 12))
    button.pack(pady=20)
    
    root.mainloop()

if __name__ == "__main__":
    main()
```

## Testing

1. Run `python3 toolkit.py`
2. Select your tool from the menu
3. Verify it launches correctly

## Tips

- Keep tools self-contained in their own directories
- Add error handling for missing dependencies
- Include clear descriptions in the launcher menu
- Test on a fresh environment if possible