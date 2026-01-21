# Smart.pr Helper - Feature Overview

## UI Components

### 1. Floating Icon (Bottom-Right) ✨
**Location**: Fixed position, bottom-right corner (24px from edges)
**Size**: 56×56px circular button
**States**:
- Default: Blue gradient (`#3b82f6` → `#2563eb`)
- Hover: Scales to 1.05x with enhanced shadow
- Active/Open: Gray gradient (`#6b7280` → `#4b5563`)
- Icon rotates 180° when sidebar is open

**Features**:
- Always visible on any Smart.pr page
- Click to toggle sidebar open/close
- Smooth animations and transitions
- Optional notification badge (red dot) for alerts

### 2. Contextual Nudges
**Trigger**: User focuses on subject line input field
**Position**: Appears below the subject field
**Messages**:
- Empty field: "Need help writing a subject line?"
- Filled field: "Want feedback on your subject line?"

**Behavior**:
- Auto-dismisses after 8 seconds
- Dismissible via X button
- Clicking opens sidebar with appropriate context
- Won't reappear while sidebar is open

### 3. Sidebar Panel
**Position**: Slides in from right edge
**Size**: 380px wide, full height
**Sections**:
- Header with title and close button
- Scrollable content area
- Dynamic content based on context

**Content States**:
1. **Empty Subject** - Input field to describe press release
2. **Filled Subject** - Get feedback or alternatives
3. **Loading** - Spinner with message
4. **Suggestions** - List of 3-5 alternatives with copy buttons
5. **Feedback** - Analysis of current subject line
6. **Error** - User-friendly error messages

## Subject Line Helper Features

### Generate Suggestions from Description
**When**: Subject field is empty
**Input**: Multi-line textarea for press release description
**User Experience**:
- User describes their press release in their own words
- Can be as detailed or brief as they want
- Placeholder provides example format
- Cmd/Ctrl+Enter shortcut to generate

**Example Inputs**:
- "We're launching a new AI-powered analytics platform that helps companies reduce costs by 40%"
- "Local bakery wins national award for sustainable practices"
- "Tech startup raises $5M Series A to expand into European markets"

**Output**: 3-5 compelling subject line alternatives tailored to the description

### Generate Alternatives
**When**: Subject field has existing content
**Input**: Current subject line text
**Output**: 3-5 improved alternatives
**Format**: JSON response from OpenAI
**Features**:
- Language detection (Dutch/English)
- 70-character limit enforcement
- Multiple angles and approaches
- Avoids spam indicators

**Prompt Engineering**:
- Award-winning PR strategist persona
- Focus on news hooks and benefits
- Professional tone, no clickbait
- Factual to content

### Get Feedback
**Input**: Current subject line
**Output**: Constructive analysis
**Focus Areas**:
- Clarity and impact
- Length optimization (40-60 chars ideal)
- News hook presence
- Language effectiveness
- Actionable improvements

**Format**: Plain text with bullet points

### Copy to Clipboard
**Trigger**: Click "Copy" button on any suggestion
**Feedback**: Toast notification "✓ Copied to clipboard"
**Fallback**: Uses `document.execCommand` if Clipboard API unavailable

## User Experience Flow

### Scenario 1: First-Time User
1. Extension loads, floating icon appears
2. User clicks icon (curious)
3. Sidebar opens showing helper interface
4. If no API key: Error message + "Open Settings" button
5. User configures API key
6. Returns to page, ready to use

### Scenario 2: Subject Line Improvement
1. User clicks on subject field
2. Nudge appears: "Want feedback on your subject line?"
3. User clicks nudge
4. Sidebar opens with current subject displayed
5. User clicks "Generate Alternatives"
6. Loading spinner appears
7. 3-5 suggestions displayed
8. User clicks "Copy" on preferred option
9. Pastes into subject field

### Scenario 3: Starting from Scratch
1. User clicks on empty subject field
2. Nudge appears: "Need help writing a subject line?"
3. User clicks nudge
4. Sidebar opens with empty state
5. User clicks "Generate Subject Lines"
6. AI generates suggestions based on best practices
7. User copies preferred suggestion

## Technical Architecture

### Content Script Responsibilities
- Subject field detection and monitoring
- Nudge lifecycle management
- Sidebar creation and state management
- OpenAI API integration
- Clipboard operations
- Toast notifications

### Storage
- API key: `chrome.storage.sync` (key: `smartpr_api_key`)
- Synced across devices
- Secure, encrypted by Chrome

### API Integration
- Endpoint: OpenAI Chat Completions API
- Model: `gpt-4o-mini`
- Temperature: 0.8 (suggestions), 0.7 (feedback)
- Error handling for auth, quota, rate limits

### Selectors for Subject Field
Priority order:
1. `input[placeholder="Please type your subject"]`
2. `input[name="subject"]`
3. `input[aria-label="Subject"]`
4. `input[placeholder*="subject" i]`
5. `input[placeholder*="onderwerp" i]` (Dutch)

## Design Principles

1. **Non-Intrusive**: Helper stays out of the way until needed
2. **Contextual**: Offers help at the right moment
3. **Beautiful**: Modern, clean design with smooth animations
4. **Fast**: Minimal loading states, instant feedback
5. **Forgiving**: Clear error messages with recovery paths
6. **Accessible**: Always available via floating icon
7. **Progressive**: Works with or without subject field

## Inspiration

Designed with inspiration from the [Merlin AI Chrome Extension](https://www.getmerlin.in/) - particularly the floating icon pattern and clean sidebar design that makes AI assistance feel natural and unobtrusive.

## Future Enhancements

Potential additions:
- Additional content helpers (PR feedback, paragraph writer)
- Custom prompt templates
- History of generated suggestions
- A/B testing subject lines
- Integration with Smart.pr analytics
- Keyboard shortcuts (e.g., Ctrl+M to toggle)
- Multi-language support beyond Dutch/English
