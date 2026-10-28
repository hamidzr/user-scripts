# Gemini Auto-focus

This userscript keeps the Gemini prompt box focused, selects a Pro model on new chats, and adds Ctrl+N and Ctrl+F shortcuts.

## What it does

- focuses the editor on page load and when the window regains focus
- on new chat pages (`/app`, `/app/`, `/`), opens the model picker and selects the first option matching the model pattern
- default pattern is `Pro`, matched case-insensitively as a regex
- re-checks after SPA navigation, with a 300 ms debounce
- restores the editor text and focus if the model switch clears them
- Ctrl+N clicks the "New chat" link
- Ctrl+F clicks the "Search" button

## Settings

Available from the userscript manager menu:

- `Auto-switch model: ON/OFF` toggles model switching (stored as `autoSwitchEnabled`)
- `Set model pattern (regex)...` changes the pattern (stored as `modelPattern`)

### Limitations

- uses `GM_getValue`, `GM_setValue`, and `GM_registerMenuCommand`, so it needs a userscript manager that supports them
- relies on Gemini's current `data-test-id` and `aria-label` attributes
