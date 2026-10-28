# Backblaze B2 Multiselect

This userscript adds range selection, modifier-click toggling, and size sorting to the Backblaze B2 file browser.

## What it does

- click a checkbox to set the anchor row
- Shift+click selects the range from the anchor to the clicked row, in display order
- Ctrl, Cmd, or Alt+click toggles the clicked row
- version groups are handled through Backblaze's own checkbox handlers, so totals and bulk actions stay correct
- adds a "Size (sort)" button to the Size column header
- the first click sorts loaded files and folders largest first, and each later click reverses the order
- folders keep their version rows, and rows with unknown sizes sort last

### Limitations

- sorting and range selection only cover rows already loaded in the page
- depends on Backblaze's current `b2-browse-*` class names and image file names
