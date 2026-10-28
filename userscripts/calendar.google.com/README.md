# Zoom link upgrader

This userscript rewrites Zoom meeting links in Google Calendar so they open the Zoom app directly.

## What it does

- finds anchors whose `href` contains `zoom.us/j/`
- replaces each with `zoommtg://zoom.us/join?action=join&confno=<meeting number>`
- runs on page load and again after DOM changes, debounced by 300 ms, so calendar navigation is covered
- skips links that were already upgraded

### Limitations

- only the meeting number is kept, so passcodes or other query parameters in the original link are dropped
- the `zoommtg://` scheme requires the Zoom desktop app
