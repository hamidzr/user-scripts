# Gemini Auto-focus

This userscript keeps the Gemini prompt box focused, selects the 4 Argon model with Medium thinking on new chats, and adds Ctrl+N and Ctrl+F shortcuts.

## What it does

- focuses the editor on page load and when the window regains focus
- on new chat pages (`/app`, `/app/`, `/`), opens the model picker and selects the first option matching the model pattern
- default pattern is `Argon`, matched case-insensitively as a regex
- sets the thinking level to Medium, since Gemini starts every page load on Low; this applies
  to whichever model is selected, even with auto-switch off
- waits up to 3 minutes for the picker, which can render late (especially in background tabs)
- re-checks after SPA navigation, with a 300 ms debounce
- restores the editor text and focus if the switch clears them
- Ctrl+N clicks the "New chat" link
- Ctrl+F clicks the "Search" button

## Settings

Available from the userscript manager menu:

- `Auto-switch model: ON/OFF` toggles model switching (stored as `autoSwitchEnabled`)
- `Set model pattern (regex)...` changes the pattern (stored as `modelPattern`). A previously saved
  pattern wins over the `Argon` default. If auto-switching still lands on Pro, enter `Argon`
  here; an empty entry is ignored, so there is no reset

### Limitations

- uses `GM_getValue`, `GM_setValue`, and `GM_registerMenuCommand`, so it needs a userscript manager that supports them
- relies on Gemini's current `data-test-id` and `aria-label` attributes
- the option label carries its sub-line too (`4 Argon Complex tasks`), so keep the pattern to the
  model name; a pattern matching the sub-line picks whichever model shares that word
