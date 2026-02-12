# Smart.pr Assistant

AI-powered writing tools built directly into the Smart.pr mailing editor. Helps you write better subject lines, improve paragraph text, summarize mailings, and get answers about the Smart.pr platform — all without leaving the editor.

**Current version:** 2.1.0

## Features

| Feature | What It Does |
|---|---|
| **Subject Line Coach** | Get feedback on your subject line, generate compelling alternatives from scratch or based on existing text |
| **Paragraph Coach** | Fix spelling & grammar, rephrase in different tones, find synonyms, translate, or shorten any text block |
| **Smart Summary** | Summarize your entire mailing as a one-liner, short pitch, executive summary, or bullet points |
| **Knowledge Base** | Ask questions about the Smart.pr platform and get AI-powered answers |
| **Feedback** | Send feedback to the development team from the sidebar or popup |

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `smartpr-helper-v2` folder
5. Click the extension icon in the toolbar
6. Enter your Smart.pr team email address
7. Visit any Smart.pr mailing to start using the assistant

## How It Works

A **floating icon** appears on any Smart.pr mailing page. Click it to open the sidebar. What opens depends on context:

- **On the subject line screen** — Subject Line Coach
- **In the editor with text selected** — Paragraph Coach with your selection
- **In the editor without selection** — Paragraph Coach + Summarize Mailing option
- **Outside the editor** — Knowledge Base (ask anything)

The extension can be toggled on/off from the popup in the browser toolbar.

## Supported Editors

- **Classic editor** — TipTap/ProseMirror editors inside the mailing dialog
- **Pro editor (BeePlugin)** — TinyMCE editors in the drag-and-drop BeePlugin editor

## Tech Stack

- **Manifest V3** Chrome extension
- **AI Backend**: Secure proxy API
- **Storage**: Chrome sync storage for user settings
- **Languages**: Vanilla JavaScript, CSS
- **i18n**: Multi-language support (Dutch, English, and more)
- **No external dependencies**

## File Structure

```
smartpr-helper-v2/
├── manifest.json          # Extension configuration (Manifest V3)
├── content.js             # Main content script (sidebar, coaches, KB)
├── api-client.js          # API communication layer
├── i18n.js                # Internationalization
├── styles.css             # UI styles
├── popup.html / popup.js  # Browser toolbar popup
├── fonts/                 # Custom fonts (Gelica, Source Sans Pro)
├── docs/                  # Design docs, feature proposals, testing guides
└── knowledge-base-doc.md  # Full user-facing help guide
```

## Privacy

- Your email is stored locally in Chrome's sync storage
- Mailing content is sent to a secure proxy API for AI processing
- Usage is tracked per user for rate limiting only
- No data is shared with third parties
