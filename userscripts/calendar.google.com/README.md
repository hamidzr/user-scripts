# Zoom link upgrader

Rewrites Zoom meeting links in Google Calendar so clicking one opens the Zoom desktop app directly instead of a browser tab that then launches Zoom.

## What it does

- finds anchors whose `href` contains `zoom.us/j/`
- replaces each with `zoommtg://zoom.us/join?action=join&confno=<meeting number>`
- runs on page load and again after DOM changes, debounced by 300 ms, so calendar navigation is covered
- skips links that were already upgraded

### Limitations

- only the meeting number is kept, so passcodes or other query parameters in the original link are dropped
- the `zoommtg://` scheme requires the Zoom desktop app
