# Smart.pr Assistant — Browser Extension Help Guide

The Smart.pr Assistant is a browser extension that adds AI-powered writing tools directly into the Smart.pr mailing editor. It helps you write better subject lines, improve paragraph text, summarize mailings, and get answers about the Smart.pr platform — all without leaving the editor.

---

## Getting Started

### How do I install the Smart.pr Assistant?

The Smart.pr Assistant is a Chrome browser extension. Once installed, it appears as a small icon in your browser toolbar. It activates automatically whenever you visit the Smart.pr mailing editor at smart.pr.

### How do I set up my email address?

You need to register your Smart.pr email address before using the assistant.

1. Click the Smart.pr Assistant icon in your browser toolbar to open the popup.
2. Under "Your Email", click **Set up**.
3. Enter your Smart.pr email address and click **Save**.
4. A green flash confirms the email was saved successfully.

You can change your email at any time by clicking **Edit** next to the displayed email.

### How do I turn the extension on or off?

1. Click the Smart.pr Assistant icon in your browser toolbar.
2. In the footer of the popup, you will see a toggle switch labeled "Extension is on" or "Extension is off".
3. Flip the toggle to enable or disable the extension.

When disabled, the floating icon and sidebar will not appear in the Smart.pr editor.

---

## The Floating Icon

### What is the floating icon?

When you open a mailing in Smart.pr, a small round Smart.pr Assistant icon appears on the page. This icon is your entry point to all writing tools.

### How do I open the sidebar?

Click the floating icon to open the assistant sidebar. The sidebar slides in from the right side of the screen.

What you see depends on where you are in the editor:

- **On the subject line screen:** The Subject Line Coach opens.
- **In the mailing editor with text selected:** The Paragraph Coach opens with your selected text ready for improvement.
- **In the mailing editor without text selected:** The Paragraph Coach opens with instructions on how to select text, plus a "Summarize Mailing" option.
- **Outside the editor:** The Knowledge Base ("Ask me anything") opens.

### How do I close the sidebar?

Click the **X** button in the top-right corner of the sidebar, or click the floating icon again.

---

## Subject Line Coach

The Subject Line Coach helps you write compelling subject lines for your press releases and mailings.

### How does the Subject Line Coach activate?

When you click on (focus) the subject line input field in the mailing editor, a small nudge notification appears below the field. The nudge shows a time-aware greeting like "Good morning! Need help writing a subject line?" or "Hey there! Want feedback on your subject line?". Click the nudge to open the Subject Line Coach sidebar.

You can also open it by clicking the floating icon while the subject line field is visible.

### How do I generate subject line suggestions from scratch?

If your subject line field is empty:

1. The sidebar shows a text area labeled "Describe Your Press Release".
2. Write a brief description of what your press release or mailing is about. For example: "We're launching a new AI-powered analytics platform that helps companies reduce costs by 40%."
3. Click **Generate Subject Lines**.
4. The assistant generates 3 to 5 compelling subject line alternatives.

Tip: The more details you provide, the better the suggestions.

### How do I get feedback on my existing subject line?

If your subject line field already has text:

1. Open the Subject Line Coach (click the nudge or the floating icon).
2. Your current subject line is displayed at the top.
3. Click **Get Feedback** to receive an AI analysis of your subject line.

The feedback includes:
- **What works** — positive aspects of your subject line.
- **Improvements** — actionable suggestions to make it better.
- **Alternatives** — ready-to-use alternative subject lines.

### How do I generate alternative subject lines?

1. Open the Subject Line Coach while your subject line has text.
2. Click **Generate Alternatives**.
3. The assistant generates 3 to 5 improved alternatives based on your current subject and mailing content.

### How do I use a suggested subject line?

Each suggestion has two buttons:

- **Use** — Inserts the suggestion directly into the subject line field, replacing the current text.
- **Copy** — Copies the suggestion to your clipboard so you can paste it wherever you want.

### Can I generate more suggestions?

Yes. After receiving suggestions, click **Generate More** at the bottom to get a fresh batch of alternatives.

### Does the subject line coach detect my language?

Yes. The assistant detects the language of your existing subject line or description and generates suggestions in that same language. It supports Dutch, English, and other languages.

### Does the sidebar update when I edit the subject line?

Yes. The sidebar tracks changes to the subject line field in real time. If you type a new subject while the sidebar is open, it updates the displayed text and adjusts the feedback and generation actions accordingly.

---

## Paragraph Coach

The Paragraph Coach helps you improve any text block in the mailing editor — paragraphs, headings, and subheadings.

### How do I activate the Paragraph Coach?

1. Open a mailing in the Smart.pr editor.
2. In any text block (paragraph, heading, or subheading), **select some text** by highlighting it.
3. A small Smart.pr icon appears in the top-right corner of that block.
4. Click the icon to open the Paragraph Coach sidebar with your selected text.

Alternatively, if you click the icon without selecting text, it will use the entire content of that block.

### What text actions are available?

When the Paragraph Coach opens, you see five action buttons:

1. **Fix Spelling & Grammar** — Checks your text for typos, spelling mistakes, and grammatical errors. Shows corrected text with changes highlighted using color-coded diff marking, and lists each change made.

2. **Rephrase Paragraph** — Rewrites your text in a different way while preserving the meaning. You can rephrase freely or pick a specific tone:
   - **Formal** — More professional and business-appropriate.
   - **Friendly** — Warmer and more conversational.
   - **Persuasive** — More compelling and action-oriented.
   - **Concise** — Tighter and more to the point.

3. **Suggest Synonyms** — Provides alternative words and phrases for your selected text. Each synonym can be copied or injected directly into the editor.

4. **Translate** — Translates your text to another language. Quick buttons are available for:
   - **EN** (English)
   - **NL** (Dutch)
   - **DE** (German)
   - **FR** (French)
   - You can also type any other language (e.g., Spanish, Italian) in the text field and click **Translate**.

5. **Make Shorter** — Condenses your text while keeping the key meaning. Shows a word count comparison (e.g., "42 → 28 words") so you can see how much shorter the result is.

### How do I apply a result to the editor?

After any action completes, you have two options:

- **Replace in Editor** — Directly replaces the original text in the editor with the improved version. The sidebar closes automatically after replacement.
- **Copy to Clipboard** — Copies the result so you can paste it manually.

### Can I undo a replacement?

Yes. After clicking "Replace in Editor", a toast notification appears at the bottom of the screen with an **Undo** button. Click it within 5 seconds to revert the text to its original version.

### How do I switch between text blocks?

While the Paragraph Coach sidebar is open, you can select text in a different block. The sidebar automatically updates to show the newly selected text and adjusts the block type label (Heading, Subheading, or Text).

### Does it work with both the classic and pro editor?

Yes. The extension works with both editor types:

- **Classic editor** — TipTap/ProseMirror editors inside the mailing dialog. Supports paragraph blocks, heading blocks, and subheading blocks.
- **Pro editor (BeePlugin)** — TinyMCE editors used in the drag-and-drop BeePlugin editor. The extension communicates across frames to provide the same Paragraph Coach functionality.

---

## Smart Summary

The Smart Summary feature creates a concise summary of your entire mailing content.

### How do I summarize my mailing?

1. Open the Paragraph Coach sidebar (click the floating icon while in the editor, or click a block icon).
2. Click the **Summarize Mailing** button.
3. Choose a summary format:
   - **One-liner** — A single sentence, approximately 20 words.
   - **Short Pitch** — 2 to 3 sentences, email-friendly and good for quick sharing.
   - **Executive Summary** — One paragraph, approximately 100 words.
   - **Bullet Points** — Key facts distilled into 4 to 6 bullet points.
4. The assistant reads your entire mailing content and generates the summary.

### How do I use the summary?

- Click **Copy to Clipboard** to copy the summary.
- Click **Try Another Format** to go back and pick a different format.

### Where does the mailing content come from?

The extension extracts text from all blocks in the editor — paragraphs, headings, and subheadings. It also reads the subject line for additional context. In the pro editor, it communicates with the BeePlugin iframe to gather all text content.

---

## Knowledge Base ("Ask me anything")

The Knowledge Base is an AI-powered Q&A feature that answers questions about the Smart.pr platform.

### How do I open the Knowledge Base?

- Click the floating icon when you are outside the mailing editor (e.g., on the mailing overview page).
- Or click the **back arrow** in the sidebar header from any other tool (Subject Line Coach or Paragraph Coach) to return to the Knowledge Base.

### How do I ask a question?

1. Type your question in the input field at the bottom of the sidebar.
2. Press **Enter** or click **Ask**.
3. The assistant searches the Smart.pr knowledge base and returns an answer.

### Are there suggested questions?

Yes. When you first open the Knowledge Base, you see three suggestion buttons:

- "How do I schedule a mailing?"
- "What makes a good PR subject line?"
- "How do I import contacts?"

Click any suggestion to ask that question instantly.

### Can I ask follow-up questions?

Yes. The Knowledge Base maintains a conversation. After receiving an answer, type a follow-up question in the input field. The assistant remembers the context of your previous questions and answers within the same session.

### How do I start a new conversation?

Click the **New conversation** button below the input field to reset the conversation and start fresh.

---

## Sending Feedback

### How do I send feedback about the extension?

There are two ways:

**From the sidebar:**
1. Click the **Feedback** link in the footer of the sidebar.
2. A text area appears where you can type your feedback.
3. Click **Send** to submit, or **Cancel** to close the form.

**From the popup:**
1. Click the Smart.pr Assistant icon in your browser toolbar.
2. Click the **Feedback** link in the footer.
3. Type your feedback and click **Send**.

---

## Troubleshooting

### Why do I see "Please enter your Smart.pr email address"?

You need to set your email address before using the assistant. Click the extension icon in your browser toolbar and enter your Smart.pr email address.

### Why do I see "You've reached your usage limit"?

The extension has usage limits. If you've reached the limit, wait and try again later.

### Why is the floating icon not appearing?

Make sure:
- You are on the Smart.pr website (smart.pr).
- The extension is turned on (check the toggle in the popup).
- The page has fully loaded. Try refreshing the page.

### Why is the paragraph icon not showing on a text block?

The paragraph icon only appears when you select (highlight) text inside a paragraph or heading block. It does not appear for empty blocks or blocks without text.

### The "Replace in Editor" button is not working. What should I do?

If the replacement fails, use **Copy to Clipboard** instead and paste the text manually. This can happen if the editor's internal state has changed since the text was selected.

### I updated the extension and things stopped working. What should I do?

After an extension update, you may need to refresh the Smart.pr page. If you see a message about the extension context being invalidated, simply reload the page.

---

## Summary of Features

| Feature | How to Access | What It Does |
|---|---|---|
| Subject Line Coach | Click the subject line field, or click the floating icon on the subject screen | Get feedback, generate alternatives for your subject line |
| Paragraph Coach | Select text in any editor block and click the block icon | Fix grammar, rephrase, find synonyms, translate, shorten |
| Smart Summary | Click "Summarize Mailing" in the Paragraph Coach | Summarize your entire mailing in various formats |
| Knowledge Base | Click the floating icon outside the editor | Ask questions about the Smart.pr platform |
| Feedback | Click "Feedback" in the sidebar or popup footer | Send feedback to the development team |
| Enable/Disable | Toggle switch in the popup | Turn the extension on or off |
