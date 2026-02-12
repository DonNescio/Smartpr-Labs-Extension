# Smart.pr Helper Extension - Feature Proposals

## Current Capabilities (for reference)

The extension currently offers three core tools:
1. **Subject Line Coach** - Generate, improve, and get feedback on email subject lines
2. **Paragraph Coach** - Fix grammar, rephrase, find synonyms, translate, and shorten text
3. **Knowledge Base** - Ask questions about the Smart.pr platform

All tools operate within the mailing editor (classic TipTap and pro BeePlugin editors).

---

## Proposed New Features

### 1. Full Mailing Review

**What it does:** Analyzes the entire mailing (subject + all body content) as a whole and provides a structured quality report.

**Why it matters:** PR professionals currently get paragraph-level help, but nobody reviews the complete picture. A mailing is more than the sum of its paragraphs - tone consistency, logical flow, and overall persuasiveness matter. This is something users would otherwise paste into ChatGPT as one big block.

**How it works:**
- New sidebar mode: "Review Mailing" button on the main view or floating icon menu
- Extracts subject line + all editor content (headings, paragraphs) in reading order
- Sends to API for holistic analysis
- Returns a structured report with sections:
  - **Overall impression** (1-2 sentences)
  - **Tone & consistency** - Is the voice consistent throughout?
  - **Structure & flow** - Does it build logically? Is the lede strong?
  - **Clarity & readability** - Jargon, sentence complexity, accessibility
  - **Call to action** - Is there one? Is it clear?
  - **PR-specific checks** - News value present? Who/what/when/where/why covered? Quotes properly attributed?
  - **Score** (e.g., 7/10) with brief justification
- Each section is collapsible, with specific actionable suggestions
- "Jump to paragraph" links that highlight the relevant section in the editor

**API endpoint:** `POST /review-mailing` with `{ email, subject, body, context }`

---

### 2. Audience Adapter

**What it does:** Rewrites or adjusts the entire mailing (or selected text) for a specific target audience or publication type.

**Why it matters:** A press release sent to a tech journalist should read differently than one sent to a lifestyle magazine editor. PR pros often manually adjust tone and angle per audience segment. This is tedious and exactly the kind of task AI handles well.

**How it works:**
- Available as a paragraph coach action and as a full-mailing action
- User selects a target audience from presets or types a custom one:
  - **Trade press** (industry-specific, technical depth okay)
  - **National news** (broad appeal, strong news hook needed)
  - **Local/regional media** (local angle emphasis)
  - **Lifestyle/consumer** (human interest, accessible language)
  - **Tech press** (technical detail, product specs welcome)
  - **Custom** (free text: "sustainability bloggers", "financial journalists", etc.)
- Returns adapted version with a brief note on what was changed and why
- Diff view showing modifications

**API endpoint:** `POST /adapt-audience` with `{ email, text, audience, isFullMailing }`

---

### 3. Headline & Quote Generator

**What it does:** Generates suggested headlines and pull quotes from the mailing content, ready for journalists to use.

**Why it matters:** Journalists are busy. Press releases that include ready-to-use headlines and quotable snippets get more coverage. This helps PR professionals think like editors and package their content for maximum pickup. Currently there is no tool in the extension that generates net-new content from existing text.

**How it works:**
- New sidebar view accessible from main menu or after a mailing review
- Extracts full mailing content
- Generates:
  - **3-5 headline suggestions** in different styles (news, feature, question, how-to)
  - **2-3 pull quotes** extracted or synthesized from the content
  - **Social media snippets** (LinkedIn post, tweet-length summary)
- Each result has "Copy" button
- Headlines include a brief note on which publication style they suit

**API endpoint:** `POST /generate-headlines` with `{ email, subject, body }`

---

### 4. Smart Summary / TL;DR Generator

**What it does:** Creates a concise summary of the mailing in various formats and lengths.

**Why it matters:** PR professionals frequently need their press release content repurposed: an executive summary for internal stakeholders, an email pitch for journalists (shorter than the full release), or a brief for social media. They currently do this manually or in a separate AI chat.

**How it works:**
- Sidebar action: "Summarize Mailing"
- Extracts full content
- User picks a format:
  - **One-liner** (single sentence, ~20 words)
  - **Short pitch** (2-3 sentences, email-friendly)
  - **Executive summary** (one paragraph, ~100 words)
  - **Bullet points** (key facts, 4-6 bullets)
- All results get "Copy" button
- Option to generate all four at once for comparison

**API endpoint:** `POST /summarize` with `{ email, subject, body, format }`

---

### 5. SEO & Discoverability Coach

**What it does:** Analyzes the mailing for search engine discoverability and suggests improvements, specifically for when the mailing will be published as a "story" on a newsroom.

**Why it matters:** Smart.pr mailings can be posted as stories on newsrooms (public-facing pages). These stories get indexed by search engines and news aggregators. Most PR professionals are not SEO specialists, but small changes to headlines, subheadings, and opening paragraphs can significantly improve discoverability.

**How it works:**
- New sidebar action: "SEO Check" (contextual - appears when content is present)
- Analyzes:
  - **Headline optimization** - Keywords, length, clarity for search
  - **Meta description candidate** - Suggests one based on content
  - **Keyword density** - Identifies natural keywords already present, suggests related ones
  - **Readability score** - Flesch-Kincaid or similar, with specific suggestions
  - **Structure** - Are subheadings used effectively? Are paragraphs scannable?
  - **Link suggestions** - Where adding links would improve SEO value
- Traffic-light indicators (green/yellow/red) for each category
- Inline suggestions with "Apply" buttons where possible

**API endpoint:** `POST /seo-check` with `{ email, subject, body }`

---

### 6. Boilerplate & Template Snippets

**What it does:** Stores and inserts reusable text blocks - company boilerplates, standard "about" sections, contact information blocks, disclaimers - directly into the editor.

**Why it matters:** Every press release ends with the same boilerplate paragraph. Contact info blocks are retyped constantly. Legal disclaimers, "notes to editors" sections, and standard sign-offs are copy-pasted from old mailings. This is the most basic workflow pain that has nothing to do with AI and everything to do with convenience.

**How it works:**
- New sidebar section: "Snippets" accessible from main menu
- **Pre-built templates:**
  - "About [Company]" boilerplate
  - "Contact information" block
  - "Note to editors"
  - "Embargo notice"
- **Custom snippets:**
  - User can save any selected text as a named snippet
  - Snippets stored in Chrome sync storage (available across devices)
  - Edit and delete functionality
- "Insert" button places snippet at cursor position in editor
- AI-assist: "Generate boilerplate" from company name/description

**Storage:** Chrome sync storage for custom snippets. No API call needed for insert, only for AI generation.

---

### 7. Tone Meter (Passive / Always-On Analysis)

**What it does:** A subtle, always-visible indicator in the sidebar that shows the overall tone of the current content as the user writes.

**Why it matters:** Tone drift is real. You start formal and end casual. You think you sound confident but readers perceive aggression. A live tone indicator catches this before the mailing goes out, without the user needing to explicitly ask for feedback.

**How it works:**
- Small indicator bar at the top or bottom of the sidebar (always visible, unobtrusive)
- Displays 2-3 tone dimensions as labeled spectrum bars:
  - **Formal** ←→ **Casual**
  - **Neutral** ←→ **Persuasive**
  - **Technical** ←→ **Accessible**
- Updates periodically (debounced - e.g., 3 seconds after user stops typing, with a minimum interval)
- Clicking the meter expands to show:
  - Tone breakdown by paragraph
  - Inconsistency warnings ("Your intro is formal but paragraph 3 shifts to casual")
  - Suggestions for alignment
- Lightweight API call with just the text, returns numerical scores

**API endpoint:** `POST /analyze-tone` with `{ email, text }` (lightweight, fast response)

---

### 8. Competitor / Similar Release Comparison

**What it does:** Given a topic, industry, or company, finds and summarizes recent press releases on the same subject, highlighting what angles have already been covered.

**Why it matters:** PR professionals need to differentiate their mailing from what's already in the news cycle. They currently Google around or check PR aggregators manually. Knowing what competitors said about a similar topic helps them find a unique angle.

**How it works:**
- Sidebar action: "Research Similar Releases"
- User provides:
  - Topic/keywords (auto-suggested from mailing content)
  - Optional: competitor names, industry
- Returns:
  - **3-5 recent relevant releases** with title, source, date, brief summary
  - **Common angles** already taken
  - **Suggested differentiators** - angles not yet covered
  - **Key quotes** from competing releases
- "Use as context" button that feeds findings into other tools (e.g., audience adapter, mailing review) for more targeted suggestions

**API endpoint:** `POST /research-similar` with `{ email, topic, keywords, competitors }`

---

### 9. Contact Pitch Personalizer

**What it does:** Given a journalist name or outlet, generates a personalized intro line or pitch angle tailored to that contact's beat and recent coverage.

**Why it matters:** Mass-blasting the same press release to 500 contacts is the #1 complaint journalists have about PR. Smart.pr already has a contacts database. If the extension could help personalize even just the opening line per contact or segment, it would dramatically improve open and response rates.

**How it works:**
- Sidebar action: "Personalize Pitch"
- User inputs a journalist name, outlet, or beat
- AI generates:
  - **Personalized opening line** referencing the journalist's area of interest
  - **Suggested angle** for this specific contact
  - **Subject line variant** tailored to this recipient
- "Use" button inserts the personalized line at cursor
- Could integrate with Smart.pr's contact database in the future for automatic suggestions

**API endpoint:** `POST /personalize-pitch` with `{ email, mailingContent, journalist, outlet, beat }`

---

### 10. Readability Simplifier

**What it does:** Rewrites overly complex, jargon-heavy, or corporate-speak text into clear, plain language.

**Why it matters:** PR writing is notorious for bloated, buzzword-laden language ("synergize", "leverage", "innovative solution"). Journalists delete these emails. This is different from "Make Shorter" (which reduces length) and "Rephrase" (which offers alternatives) - this specifically targets clarity and removes corporate fluff.

**How it works:**
- New paragraph coach action: "Simplify"
- Identifies and flags:
  - Jargon and buzzwords
  - Passive voice
  - Unnecessarily complex sentence structures
  - Vague claims without specifics (e.g., "industry-leading" → suggests adding actual data)
- Returns simplified version with annotations explaining each change
- Diff view showing what was cut or rewritten
- Severity indicator: how much corporate-speak was detected

**API endpoint:** Uses existing `POST /process-paragraph` with new action `'simplify'`

---

## Implementation Priority Suggestion

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **High** | Full Mailing Review | High-value, unique, differentiating feature |
| **High** | Smart Summary / TL;DR | Frequent need, straightforward to build |
| **High** | Readability Simplifier | Low effort (extends paragraph coach), high daily utility |
| **Medium** | Audience Adapter | Strong PR-specific value, moderate complexity |
| **Medium** | Headline & Quote Generator | Creative tool that saves real time |
| **Medium** | Boilerplate Snippets | Non-AI quality-of-life feature, reduces daily friction |
| **Medium** | Tone Meter | Distinctive UX, but requires careful performance tuning |
| **Lower** | SEO Coach | Valuable but niche (only for newsroom stories) |
| **Lower** | Competitor Comparison | Requires external data sourcing, more complex backend |
| **Lower** | Contact Pitch Personalizer | Most impactful long-term, but needs contact DB integration |

---

## Notes

- All features should follow the existing UX patterns: skeleton loading, cascade animations, typewriter effects, sparkle bursts on success
- Language detection (Dutch/English) should apply to all new features
- All new features should work in both classic and pro editors where applicable
- Full-mailing features require a content extraction utility that collects all editor blocks in reading order (this is a shared dependency worth building first)
