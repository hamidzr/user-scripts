# Gemini Auto-focus

This userscript keeps the Gemini prompt box focused, selects the 4 Neon model with Medium thinking each time a chat loads, and adds Ctrl+N and Ctrl+F shortcuts.

## What it does

- focuses the editor on page load and when the window regains focus
- once per page load and once per chat you open (new or existing), opens the model picker and
  selects the first option matching the model pattern
- default pattern is `Neon`, matched case-insensitively as a regex
- sets the thinking level to Medium, since Gemini starts every page load on Low; this applies
  to whichever model is selected, even with auto-switch off
- a model or thinking level you pick by hand sticks until you open another chat or reload; sending
  the first message of a new chat does not count as opening another chat
- waits up to 3 minutes for the picker, which can render late (especially in background tabs)
- re-applies after SPA navigation to another chat, with a 300 ms debounce
- restores the editor text and focus if the switch clears them
- Ctrl+N clicks the "New chat" link
- Ctrl+F clicks the "Search" button

## Settings

Available from the userscript manager menu:

- `Auto-switch model: ON/OFF` toggles model switching (stored as `autoSwitchEnabled`)
- `Set model pattern (regex)...` changes the pattern (stored as `modelPatternV2`). A saved pattern
  wins over the `Neon` default; an empty entry is ignored, so there is no reset. Patterns saved
  before 1.7.0 (key `modelPattern`) are ignored, since the Argon model they pointed at is gone

### Limitations

- uses `GM_getValue`, `GM_setValue`, and `GM_registerMenuCommand`, so it needs a userscript manager that supports them
- relies on Gemini's current `data-test-id` and `aria-label` attributes
- the option label carries its sub-line too (`Deeper analysis 4 Neon`), so keep the pattern to the
  model name; a pattern matching the sub-line picks whichever model shares that word
