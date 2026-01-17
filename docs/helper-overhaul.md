# Smart.pr Labs Helper Overhaul

## Goal
Turn the extension into a modern, fluent, floating helper that appears on any `*.smart.pr` page, stays quiet until it can help, and offers assistance without directly injecting UI into the page's own controls. The helper should read page context, ask ChatGPT for suggestions, and let users copy results.

## Product behavior (target)
- A single floating helper icon is always visible on `*.smart.pr`.
- The helper stays silent until a rule is triggered.
- Example rule: when the Subject field has content, show a small bubble above the icon ("Need help improving the subject line?").
- Clicking the helper opens a compact panel with suggestions from ChatGPT.
- The helper does not insert buttons into Smart.pr forms and does not auto-fill any field. It only reads inputs and offers copy actions.

## Current code inventory (what we can reuse)
- `content.js`:
  - OpenAI request helper and prompts for angle generation, PR feedback, paragraph writer, and subject generator.
  - Storage helpers for API key, feature flags, and usage tracking.
  - Subject field detection (`getSubjectField`) and HTML extraction for mailings.
  - Existing UI injection (modals, panels, buttons) that will be retired.
- `page-bridge.js` + `bee-frame.js`:
  - Robust ways to read mailing HTML and editor state in the Bee editor.
  - Useful for context gathering without editing content.
- `options.html` + `options.js`:
  - API key management, feature toggles, and usage counters.
- `popup.html` + `popup.js`:
  - Extension status surface and on/off toggles.

## Key changes vs today
- Replace page-embedded buttons/modals with one floating helper UI.
- Stop writing into page fields or editor content (no subject auto-fill, no paragraph insertion).
- Convert existing features into "assistance cards" shown inside the helper panel.

## Proposed helper UX
- Helper icon floats bottom-right (or user-configurable corner). It should not block page UI.
- States:
  - Idle: icon only.
  - Nudge: icon + bubble prompt (triggered by rules).
  - Active: panel open with suggestions, copy buttons, and optional user input fields.
- Nudge should be dismissible and respect a cooldown per page/field to avoid nagging.

## Detection rules (initial)
1. Subject improvement
   - Trigger when subject field exists and has non-empty value.
   - Bubble text: "Need help improving the subject line?"
   - Panel content: 3 to 5 improved subject suggestions and a "copy" button per item.
2. Angle suggestions
   - Trigger when subject field has content and mailing HTML is available.
   - Panel content: 1 to 5 angles derived from subject + mailing HTML.
3. PR feedback
   - Trigger when mailing HTML is available and user opens the helper.
4. Paragraph writer (optional)
   - Trigger when editor cursor is in an empty paragraph (from `bee-frame.js` status).
   - Only provide a suggestion with "copy" (no insertion).

## Data flow
- Content script watches DOM for relevant fields and uses `MutationObserver` to track changes.
- The helper reads:
  - Subject line value from the input field.
  - Mailing HTML using `page-bridge.js` (Bee API and fallbacks).
  - Editor status via `bee-frame.js` when needed.
- Requests are sent to ChatGPT using the existing OpenAI helper.
- Responses are displayed in the helper panel with copy actions.

## Plan of action (based on current code)
1. Create a new helper UI shell
   - Implement a lightweight floating container in `content.js` and new styles in `styles.css`.
   - Define helper states (idle, nudge, active) and transitions.
2. Extract reusable logic from `content.js`
   - Move OpenAI request helper and prompts into a small shared section.
   - Keep storage/usage tracking intact.
   - Keep `getSubjectField` and HTML extraction utilities.
3. Build a rule engine
   - Centralize "rules" in one place (subject-filled, mailing-html-ready, empty-paragraph).
   - Debounce and cooldown rules to prevent repeated nudges.
4. Implement the Subject Improvement flow
   - Use the existing subject generator prompt as a base, but return multiple alternatives.
   - Display results in the helper panel with copy buttons.
5. Port additional assistance cards
   - Angle assistant (read-only suggestions, copy only).
   - PR feedback (summary with copy).
   - Paragraph writer (copy only).
6. Retire old injected UI
   - Remove or disable the existing injected buttons/modals/panels in `content.js`.
   - Keep `page-bridge.js` and `bee-frame.js` running for data collection only.
7. Update settings surfaces
   - Adjust feature toggles in `options.html` and `popup.html` to map to the new assistance cards.
   - Keep API key flow and usage stats.
8. QA checklist
   - Verify helper loads on all `*.smart.pr` pages.
   - Ensure no page form fields are modified by the extension.
   - Confirm prompts work without Bee editor present (fallbacks only).
   - Test cooldown and dismiss behavior so nudges do not spam users.

## Open questions
- Should the helper support multiple nudges at once or queue them?
- Do we want a minimized "sleep" state per page session?
- Should the helper panel remember last suggestions per page to avoid repeated API calls?
- Are there brand/voice guidelines for helper copy and bubble text?

## Notes
- We will continue using the ChatGPT API; no backend changes are required for v1.
- The existing `manifest.json` already matches `*.smart.pr` and can stay, but we may remove unused permissions after refactor.

## Progress checklist
- [x] Implement floating helper shell (icon, bubble, panel)
- [x] Wire subject-filled nudge + subject suggestions
- [x] Add assistance cards (angles, PR feedback, paragraph writer)
- [x] Remove old injected UI behaviors (buttons, modals, overlays)
- [x] Update styles for helper UI
- [ ] Smoke test on `*.smart.pr` pages
