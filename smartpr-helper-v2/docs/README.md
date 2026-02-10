# Smart.pr Helper v2

Modern AI-powered assistant for Smart.pr that helps you write better subject lines and content.

## Features

### Floating Assistant Icon
- **Always Accessible**: Beautiful floating icon in the bottom-right corner (Merlin-style)
- **Smart UI**: Icon changes appearance when sidebar is open
- **One-Click Access**: Click anytime to open the helper, even without context

### Subject Line Helper
- **Smart Detection**: Automatically detects when you're working on a subject line
- **Contextual Nudges**: Offers help based on whether the field is empty or filled
- **AI Suggestions**: Generate 3-5 compelling subject line alternatives
- **Feedback**: Get constructive feedback on your current subject line
- **One-Click Copy**: Easily copy any suggestion to clipboard
- **Sidebar Panel**: Clean, modern sidebar that slides in from the right

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `smartpr-helper-v2` folder
5. Click the extension icon and go to Settings
6. Enter your Smart.pr team email address
7. Visit any Smart.pr page to start using the helper

## Usage

### Setting Up Your Email
1. Click the extension icon in Chrome
2. Click "Open Settings"
3. Enter your Smart.pr team email address
4. Click "Save Settings"

Your email is used for authentication and usage tracking. No API key needed!

### Using the Helper

**Two ways to access:**

1. **Floating Icon** (always available)
   - Look for the ✨ icon in the bottom-right corner
   - Click it anytime to open the helper sidebar
   - Icon changes color when sidebar is open

2. **Contextual Nudges** (automatic)
   - Focus on the subject line field
   - A nudge will appear near the field
   - Click the nudge to get help

**Creating subject lines:**
1. **Starting fresh**: Describe your press release in the text area (e.g., "We're launching a new eco-friendly product line")
2. **Improving existing**: Get feedback or generate alternatives for your current subject
3. Review AI-powered suggestions
4. Click "Copy" on any suggestion you like
5. Paste into your subject field

**Pro tip**: Use Cmd/Ctrl+Enter in the description field to quickly generate suggestions!

## Technical Details

- **AI Model**: OpenAI GPT-4o-mini (via secure proxy API)
- **UI Pattern**: Sidebar panel with contextual nudges
- **Data Storage**: Chrome sync storage for user email
- **Architecture**: Chrome extension → Proxy API → OpenAI
- **Permissions**: Storage, ActiveTab, Replit API access

## Privacy

- Your email is stored locally in Chrome's sync storage
- Press release content is sent to our secure proxy API for AI processing
- We track usage per user for rate limiting and monitoring
- No data is shared with third parties
- No tracking or analytics beyond usage metrics

## Development

Built with vanilla JavaScript, no dependencies required.

### File Structure
```
smartpr-helper-v2/
├── manifest.json       # Extension configuration
├── content.js          # Main content script
├── styles.css          # UI styles
├── options.html        # Settings page
├── options.js          # Settings logic
├── popup.html          # Extension popup
├── popup.js            # Popup logic
├── icon.png            # Extension icon
└── README.md           # This file
```

## Future Features

Coming soon:
- Additional content helpers
- More AI-powered suggestions
- Customizable prompts
- Usage analytics
