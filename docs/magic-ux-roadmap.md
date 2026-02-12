# Magic UX Roadmap

20 ideas to make the extension feel like magic. Ordered by priority (effort vs impact).

---

## 1. Staggered Cascade Animations
**Effort:** Low | **Impact:** High | CSS only

When result cards appear (synonyms, rephrase options, subject suggestions), they cascade in one after another (50-80ms delay each) with a subtle translateY + opacity entrance instead of appearing all at once.

### Tasks
- [ ] Add `@keyframes cardCascadeIn` (opacity 0 + translateY(12px) to final state)
- [ ] In `showSynonymResult()` / `showRephraseResult()` — add `style="animation-delay: ${i * 60}ms"` to each `.sph-synonym-option`
- [ ] Same for subject line suggestion items in sidebar
- [ ] Same pattern in popup.js renderers
- [ ] Add the animation class to `.sph-synonym-option` in styles.css

---

## 2. Skeleton Loading States
**Effort:** Low-Med | **Impact:** High | CSS + JS

Replace the spinner with pulsing placeholder "ghost" shapes of the expected result. Makes loading feel faster.

### Tasks
- [ ] Create `.sph-skeleton` CSS class with pulsing gray gradient animation
- [ ] Create `.sph-skeleton-card` (card-shaped), `.sph-skeleton-text` (text-line-shaped) variants
- [ ] In `showLoadingState()` — render 3 skeleton cards for multi-option actions (synonyms, rephrase) or a skeleton text block for single-result actions (grammar, translate, shorter)
- [ ] Same skeleton patterns in popup `showPopupLoading()`
- [ ] When results arrive, content replaces skeletons via normal innerHTML (instant swap is fine with cascade animation on the new content)

---

## 3. Animated Background Gradient
**Effort:** Low | **Impact:** Med | CSS only

Slowly rotate the sidebar background gradient angle (0 to 360 over ~20s, infinite loop). Barely noticeable but gives the panel a living, breathing quality.

### Tasks
- [ ] Add `@keyframes gradientRotate` that shifts `background-position` or uses a rotating `::before` pseudo-element
- [ ] Apply to `#smartpr-helper-sidebar` background
- [ ] Use `background-size: 200% 200%` with position animation for smooth loop
- [ ] Ensure animation is GPU-accelerated (`will-change: background-position` or use transform on pseudo-element)

---

## 4. Sparkle Burst on Success
**Effort:** Low-Med | **Impact:** Med | CSS + small JS

Brief particle/sparkle animation from the clicked button on success (Replace, Inject, Send feedback). 5-8 small dots burst outward and fade over 300ms.

### Tasks
- [ ] Create `@keyframes sparkle` — particles fly outward in random directions and fade
- [ ] Create `triggerSparkle(element)` JS function that appends temporary particle elements around the target button
- [ ] Call `triggerSparkle()` in `replaceTextInEditor()`, feedback send handler, and copy/inject handlers on success
- [ ] Auto-remove particle elements after animation completes
- [ ] CSS for `.sph-sparkle-particle` — absolute positioned, small circles with gradient colors

---

## 5. Smart Contextual Greetings
**Effort:** Low | **Impact:** Med | JS only

Time-aware and usage-aware nudge messages instead of the same message every time.

### Tasks
- [ ] Create `getNudgeMessage(hasSubject, isReturningUser)` helper function
- [ ] Morning (5-12): "Good morning! ..."
- [ ] Afternoon (12-17): "Need a hand with ..."
- [ ] Evening (17+): "Still working? Let me help ..."
- [ ] If returning user (check `chrome.storage` for a `lastUsed` timestamp): "Welcome back! ..."
- [ ] Update `showNudge()` in content.js to use the helper
- [ ] Store `lastUsed` timestamp on each sidebar open

---

## 6. Text Diff Highlighting for Grammar
**Effort:** Med | **Impact:** High | JS + CSS

Highlight changed words/phrases in the corrected text with a warm background glow so users instantly see what was fixed.

### Tasks
- [ ] Update server-side grammar prompt to return `changes` with position info, OR implement client-side diff
- [ ] Add a simple word-level diff function: `diffWords(original, corrected)` that returns an array of segments marked as changed/unchanged
- [ ] In `showGrammarResult()` — render corrected text with `<span class="sph-diff-changed">` around changed segments instead of plain `escapeHTML()`
- [ ] CSS: `.sph-diff-changed` — subtle warm orange background + slightly bold
- [ ] Mirror in popup `renderGrammarResult()`
- [ ] Ensure escapeHTML is still called on each segment to prevent XSS

---

## 7. Undo After Replace
**Effort:** Med | **Impact:** High | JS

Show an Undo option after injecting text. Store original text temporarily.

### Tasks
- [ ] Add module-level `lastReplacedText` and `lastReplacedEditor` variables in content.js
- [ ] Before replacing in `replaceTextInEditor()`, save `selectedText` and `selectedEditor` references
- [ ] After successful replace, don't close sidebar immediately — show "Undo" button for 5 seconds
- [ ] `undoReplace()` function: restore `lastReplacedText` into `lastReplacedEditor` using same `execCommand('insertText')` approach
- [ ] After undo or timeout, clear saved state and close sidebar
- [ ] Show toast on undo: "Reverted to original"

---

## 8. Progressive Loading Messages
**Effort:** Low | **Impact:** Med | JS only

Cycle through context-appropriate messages during loading instead of showing one static message.

### Tasks
- [ ] Create message sequences per action type:
  - Synonyms: "Finding synonyms..." → "Exploring alternatives..." → "Almost there..."
  - Rephrase: "Rephrasing..." → "Crafting variations..." → "Polishing options..."
  - Grammar: "Checking grammar..." → "Analyzing sentence structure..." → "Finalizing corrections..."
  - Subject lines: "Generating..." → "Testing different angles..." → "Selecting the best ones..."
- [ ] In `showLoadingState()` — start a 2-second interval that cycles through the message array
- [ ] Clear the interval when results arrive (in `handleParagraphAction` after API resolves)
- [ ] Store interval ID in a module-level variable so it can be cleared
- [ ] Same pattern in popup `showPopupLoading()`

---

## 9. Keyboard Shortcut to Open
**Effort:** Low | **Impact:** Med | manifest.json + JS

Add a keyboard shortcut (Cmd+Shift+S) to toggle the sidebar.

### Tasks
- [ ] Add `commands` section to `manifest.json` with `_execute_action` or custom command
- [ ] Add `chrome.commands.onCommand` listener in `background.js` (or content.js if using content script approach)
- [ ] Send message to content script to toggle sidebar
- [ ] In content.js, handle the toggle: if sidebar open → close, if closed → open in last-used mode
- [ ] Show the shortcut hint somewhere in the UI (tooltip on icon, or in popup footer)

---

## 10. Animated Icon Breathing
**Effort:** Low | **Impact:** Low-Med | CSS only

Subtle scale breathing animation on the floating icon (1.0 to 1.03 over 3s). Stops on hover.

### Tasks
- [ ] Add `@keyframes iconBreathe` (scale 1 → 1.03 → 1, ease-in-out, 3s infinite)
- [ ] Apply to `#smartpr-helper-icon`
- [ ] On `:hover`, override with `animation: none` and apply existing scale-up transform
- [ ] Ensure the breathing stops when sidebar is open (`.sidebar-open` class already changes icon style)

---

## 11. Typewriter/Streaming Effect for Results
**Effort:** Med | **Impact:** High | JS + CSS

Render text results word-by-word (~20ms per word) for grammar, translate, and shorter tools.

### Tasks
- [ ] Create `typewriterEffect(element, text, speed)` utility function
  - Splits text into words
  - Appends words one at a time with `requestAnimationFrame` or `setTimeout`
  - Returns a Promise that resolves when complete
- [ ] In `showGrammarResult()`, `showShorterResult()`, and translate's `showParagraphResult()` — use typewriter for the `.sph-result-text` content
- [ ] For card-based results (synonyms, rephrase) — skip typewriter, use cascade animation instead
- [ ] Add a subtle blinking cursor CSS class during typing, remove when complete
- [ ] Ensure the Replace/Copy buttons only activate after typing completes
- [ ] Mirror in popup renderers

---

## 12. Animated View Transitions
**Effort:** Low | **Impact:** Med | CSS + small JS

Crossfade between views instead of instant innerHTML replacement.

### Tasks
- [ ] Add `.sph-view-enter` keyframe (opacity 0 + translateY(8px) → opacity 1 + translateY(0), 200ms)
- [ ] Create a wrapper function `transitionContent(newHTML)` that:
  - Adds `.sph-view-exit` class to current `#sph-content` children (opacity fade out, 100ms)
  - After 100ms, sets new innerHTML
  - New content has `.sph-view-enter` animation applied
- [ ] Replace direct `content.innerHTML = ...` calls with `transitionContent(...)` in all display functions
- [ ] Same pattern in popup.js with `mainContent`

---

## 13. Floating Quick-Action Toolbar on Text Selection
**Effort:** Med-High | **Impact:** Very High | JS + CSS

Tiny floating toolbar at the selection point (like Medium/Notion) with mini icons for the 5 paragraph actions.

### Tasks
- [ ] Create `.sph-quick-toolbar` element — small horizontal bar with 5 mini icon buttons
- [ ] On `mouseup` / `selectionchange` event in editors — check if text is selected
- [ ] Position toolbar above the selection using `getSelection().getRangeAt(0).getBoundingClientRect()`
- [ ] Show toolbar with entrance animation (scale + opacity)
- [ ] Each button click triggers the action directly (opens sidebar + fires action immediately)
- [ ] Hide toolbar on click outside, scroll, or selection cleared
- [ ] Handle positioning near edges (flip below if near top)
- [ ] CSS: compact, glassmorphism style, gradient accents per tool (ties into #15 color-coding)
- [ ] Handle iframe editors (TipTap in iframes)

---

## 14. Smooth Number Counter for Word Count
**Effort:** Low | **Impact:** Low-Med | JS only

Animate the word count badge counting down (152 → 89) in the "shorter" results.

### Tasks
- [ ] Create `animateCounter(element, from, to, duration)` utility function
  - Uses `requestAnimationFrame` to smoothly interpolate between values
  - Easing: ease-out for satisfying deceleration
- [ ] In `showShorterResult()` — render badge with starting number, then call `animateCounter`
- [ ] Duration: ~600ms
- [ ] Mirror in popup `renderShorterResult()`

---

## 15. Color-Coded Tool Identity
**Effort:** Low | **Impact:** Med | CSS only

Each paragraph tool gets a subtle signature color accent.

### Tasks
- [ ] Define CSS variables for each tool:
  - `--tool-grammar: #60A5FA` (blue)
  - `--tool-rephrase: #C084FC` (purple)
  - `--tool-synonyms: #FBBF24` (amber)
  - `--tool-translate: #34D399` (green)
  - `--tool-shorter: #FB923C` (orange)
- [ ] Add data attribute to action buttons: `data-tool="grammar"` etc.
- [ ] CSS: `.sph-action-btn[data-tool="grammar"]:hover { border-color: var(--tool-grammar) }`
- [ ] Apply tool color accent to result section border when showing results
- [ ] Apply tool color tint to loading spinner
- [ ] Mirror in popup

---

## 16. Ripple Effect on Button Click
**Effort:** Low | **Impact:** Med | CSS + small JS

Material Design-style radial ripple from the click point on buttons.

### Tasks
- [ ] Create `addRipple(event)` JS function:
  - Gets click position relative to button
  - Appends a `.sph-ripple` span at that position
  - Span expands via CSS animation and fades out
  - Self-removes after animation completes
- [ ] CSS: `.sph-ripple` — absolute position, border-radius: 50%, `@keyframes rippleExpand` (scale 0 → 4, opacity 0.4 → 0)
- [ ] Attach to `.sph-button`, `.sph-action-btn` click events
- [ ] Buttons need `position: relative; overflow: hidden` for ripple containment

---

## 17. Session Counter
**Effort:** Low | **Impact:** Low-Med | JS + storage

Track daily actions and occasionally show progress messages.

### Tasks
- [ ] On each successful action, increment counter in `chrome.storage.local` (keyed by date)
- [ ] After every 3rd/5th action, show a toast with count: "5 texts improved today!"
- [ ] Reset counter daily (check date key)
- [ ] Optional: show count in sidebar footer next to "Feedback" link
- [ ] Keep it subtle — only show milestones (3, 5, 10, 25), not every action

---

## 18. Hover Preview Before Inject
**Effort:** Med | **Impact:** Med | JS + CSS

Hovering the Inject button highlights the original text in the editor.

### Tasks
- [ ] On Inject button `mouseenter` — add a highlight class/style to the `selectedEditor` element or `currentSelection` range
- [ ] CSS highlight: subtle pulsing background (warm color, 0.2 opacity)
- [ ] On `mouseleave` — remove the highlight
- [ ] Handle both TipTap editors and heading inputs
- [ ] Handle iframe editors (need to inject highlight style into iframe document)
- [ ] Fallback: if editor reference is lost, skip preview silently

---

## 19. Proactive Smart Suggestions
**Effort:** High | **Impact:** Very High | JS + API

The block icon pulses with a specific color when the AI detects something it can help with, without the user asking.

### Tasks
- [ ] Add typing pause detection (debounce ~3 seconds after last keystroke in editor)
- [ ] On pause, send a lightweight "analyze" request to the API (new endpoint)
- [ ] API returns suggestion type: `{ suggestion: "grammar" | "shorter" | null }`
- [ ] If suggestion found, pulse the block icon with the tool's signature color
- [ ] On click, open sidebar with pre-loaded results (skip the action selection step)
- [ ] Rate limit: max 1 proactive check per paragraph per minute
- [ ] Cache results to avoid redundant API calls
- [ ] Add server-side `/analyze-text` endpoint (lightweight, fast, low token usage)
- [ ] Add toggle in settings to enable/disable proactive suggestions

---

## 20. Easter Egg
**Effort:** Low | **Impact:** Low (but memorable) | JS + CSS

Hidden sparkle/confetti animation triggered by typing "magic" somewhere.

### Tasks
- [ ] Add keypress listener on subject input and feedback textarea
- [ ] Track last N characters typed, check if they spell "magic"
- [ ] On match, trigger a full-sidebar confetti/sparkle animation (reuse sparkle system from #4)
- [ ] Animation: 20-30 particles in brand gradient colors, burst from center, float outward with gravity
- [ ] Duration: ~1.5 seconds, then clean up
- [ ] Only trigger once per session (don't spam on repeated typing)
