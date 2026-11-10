# Kiwi Saved Searches

Adds a saved-searches panel to Kiwi.com so you can save, name, reload, and copy links to one-way flight searches. Searches stay in your browser.

## What it does

- adds a floating "Saved searches" button with a count in the bottom-right corner of `kiwi.com` pages
- opens a panel showing the current one-way search with a Save button and an optional name field
- shows each search as a route, readable dates (`10-20 Dec`), and options such as bags, stops, and sort order
- click a saved search to open it; it is a normal link, so it also opens in a new tab
- hover a row (or tab into it) for its actions: replace it with the current search, rename in place, copy the link, and delete
- delete shows an Undo bar for a few seconds instead of asking for confirmation
- marks the saved row that matches the search you are viewing, and searches whose dates have passed
- drag the panel header (or the collapsed button) to move it, and drag the top-left corner to resize; double-click that corner to reset
- starts new searches with your dates: the Kiwi home page opens with the departure dates of the search you saved most recently, instead of the ones Kiwi remembered
- remembers whether the panel was left open or closed, closes with Escape, and stays in sync across Kiwi tabs

## Storage

Saved searches live in this browser profile's `localStorage` on kiwi.com under `lb:kiwi:saved-searches:v1`. The panel open state is kept under `lb:kiwi:saved-searches:open:v1`. Its position and size are kept under `lb:kiwi:saved-searches:layout:v1`. Nothing is sent anywhere.

## Limitations

- the home page date default reloads the page once, forces a one-way search, and is skipped when the saved dates have passed or Kiwi restored a return trip
- one-way searches only
- no sync between browsers or profiles

## Related

Planning a multi-stop trip? [Roamline](https://roamline.lbyte.app) compares routes and plans dates with the people you travel with.
