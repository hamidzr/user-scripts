# T3 Code: close tab after opening desktop app

Closes the leftover app.t3.codes browser tab once a T3 Code thread or prompt link has opened in the T3 Code desktop app.

## What it does

- runs on `app.t3.codes` pages that hand a link off to the desktop app
- with "Open in desktop app" and "Remember my choice" saved, closes the tab after the app opens on its own
- closes the tab after you click "Open in desktop app" and the app opens
- treats the browser window losing focus within a few seconds of the handoff as the app opening
- leaves the tab alone when you pick "Continue here" or the app never takes focus

## Limitations

- needs the T3 Code desktop app installed and allowed to open `t3code://` links without a browser prompt; if the browser still asks, tick its "always allow" option first
- switching to another window within a few seconds of the handoff also closes the tab
- uses the userscript manager's `window.close` grant, so it works in Violentmonkey and Tampermonkey
