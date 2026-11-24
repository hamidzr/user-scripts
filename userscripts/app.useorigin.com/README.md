# Origin Userscripts

Download your Origin accounts and holdings as one file that the Investments app imports, so you can see your portfolio's sector mix and plan rebalancing.

## What it does

- adds a **Download holdings for Investments** button to `app.useorigin.com`
- asks Origin for today's accounts and holdings with your signed-in session
- leaves performance history and your session token out of the file
- saves `origin-holdings-YYYY-MM-DD.json`, which you import on the [Investments](https://investments.lbyte.app) Import page
- is built and served by Investments itself, so it updates with each Investments release

## Limitations

- depends on Origin's internal API, which can change without notice
