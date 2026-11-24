# Monarch Money

Shift-click to select and export many Monarch transactions, export holdings to CSV, and download holdings or accounts for the Investments app.

## Monarch Bulk Select

Adds shift-click range selection and CSV export to the transactions list.

- Shift-click a transaction checkbox to select or clear everything between it and the previous click.
  The range takes the state of the box you shift-click.
- While transactions are selected, a **Download CSV** button appears in the bulk-action header.
- The export scrolls the virtualized list to collect every selected row, then restores your scroll position.
- CSV columns: date, merchant, category, account, amount, and list_index (the row position in the list).
- File name: `monarch-selected-transactions-YYYY-MM-DD.csv`.
- If fewer rows are found than the selected count, an alert reports how many were exported.

![Multiselect Demo](./demo/multi-select.gif)

[Youtube Link](https://www.youtube.com/shorts/zCZKhdNT33o)

## Monarch Holdings Export

Adds an **Export CSV** button next to Accounts on the investment holdings page (`/investments/holdings`).

- One row per holding, with a Group column taken from the section headers on the table.
- Columns are Group, Symbol, and Name, followed by the table's value columns under Monarch's own headers.
- Currency amounts are written as plain numbers (no `$` or thousands separators). Other text is kept as shown.
- Holdings without a ticker put the name in Name and leave Symbol blank.
- File name: `monarch-holdings-YYYY-MM-DD.csv`, UTF-8 with a BOM so Excel opens it cleanly.
- If the table has no rows yet, an alert asks you to wait for it to load.

## Investments: Monarch holdings

Downloads your Monarch holdings as a file the [Investments](https://investments.lbyte.app) app imports.

- adds a **Download holdings for Investments** button, which turns on once you open the Holdings page
- keeps only the two holdings responses the page already loads, saved as a small HAR file with no headers or cookies
- file name: `monarch-holdings-YYYY-MM-DD.json`; import it on the Investments Import page
- is built and served by Investments itself, so it updates with each Investments release

## Investments: Monarch accounts

Downloads your Monarch account list, with the institution of each account, for the [Investments](https://investments.lbyte.app) app.

- adds a **Download accounts for Investments** button
- asks Monarch for the accounts it shows you, using the page's signed-in session
- file name: `monarch-accounts-YYYY-MM-DD.json`, with no credentials in it
- is built and served by Investments itself, so it updates with each Investments release
