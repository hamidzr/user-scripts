# Kiwi Saved Searches

This userscript adds a small saved-searches panel to Kiwi.com so you can keep and reload one-way flight searches.

## What it does

- adds a floating "Kiwi searches" button in the bottom-right corner of `kiwi.com` pages
- opens a panel showing the current one-way search (origin, destinations, date, and active filters) with a Save button
- asks for a name when you save, and stores the origin, destinations, date, and search options
- lists saved searches with per-row actions: Load, Upd (overwrite with the current search), Ren (rename), URL (copy the search link), and Del (delete after confirmation)
- highlights the saved row that matches the search you are currently viewing
- remembers whether the panel was left open or closed

## Storage

Saved searches live in this browser profile's `localStorage` on kiwi.com under `lb:kiwi:saved-searches:v1`. The panel open state is kept under `lb:kiwi:saved-searches:open:v1`. Nothing is sent anywhere.

## Limitations

- one-way searches only
- no sync between browsers or profiles
