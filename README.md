# My User Scripts

Browser userscripts for everyday web annoyances, shortcuts, and small UI fixes.

What is a browser userscript? See the [Wikipedia article](https://en.wikipedia.org/wiki/Userscript).

> These built `.user.js` files are generated from TypeScript source in a separate
> repository. Treat this repo as the published output, not the editing source.

## Installing scripts

These scripts are standard userscripts. Start with
[Violentmonkey](https://violentmonkey.github.io/get-it/), since some scripts may
work better there than in Tampermonkey.

To install a script:

1. Install a userscript manager such as
   [Violentmonkey](https://violentmonkey.github.io/get-it/).
2. Open any file in `userscripts/` that ends in `.user.js`.
3. Open the file's raw GitHub URL, then allow the userscript manager to install
   it.

## Featured userscripts

These are the currently published scripts under [`userscripts/`](./userscripts/) set that directory for the full list and possibly screenshots or screen recordings.


| Script                                                                                           | Site                 | Description                                                                     | Features                                                                                                       |
| ------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`amazon-score.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/amazon.com/amazon-score.user.js)                          | Amazon               | Score products with review-aware borders instead of trusting star rating alone. | Wilson lower-bound scoring, page-relative ranking, color-coded product borders                                 |
| [`monarch-bulk-select.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-bulk-select.user.js)       | Monarch Money        | Make bulk transaction selection behave like desktop mail apps.                  | Shift-click range selection, virtualized list support, checkbox target detection                               |
| [`zoom-links.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/calendar.google.com/zoom-links.user.js)                     | Google Calendar      | Open Zoom meetings in the native app instead of the browser.                    | Rewrites `zoom.us/j/...` links to `zoommtg://` join links                                                      |
| [`chatgpt.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/chatgpt.com/chatgpt.user.js)                                   | ChatGPT              | Add keyboard shortcuts for common navigation actions.                           | `Ctrl+N` for new chat, `Ctrl+F` for chat search                                                                |
| [`ebay-search.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/ebay.com/ebay-search.user.js)                              | eBay                 | Preserve search context and make keywords easier to scan.                       | Keeps filters on follow-up searches, adds reset button, highlights positive and negative keywords              |
| [`ebay-sponsored.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/ebay.com/ebay-sponsored.user.js)                        | eBay                 | Make sponsored listings obvious at a glance.                                    | Styles native Sponsored labels in red                                                                          |
| [`gemini.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/gemini.google.com/gemini.user.js)                               | Gemini               | Reduce friction when jumping back into Gemini.                                  | Auto-focus editor on window focus, `Ctrl+N` for new chat, `Ctrl+F` for search                                  |
| [`github-plus.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/github.com/github-plus.user.js)                            | GitHub pull requests | Show more signal directly in PR lists.                                          | Fetches and displays additions and deletions next to PR links                                                  |
| [`github.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/github.com/github.user.js)                                      | GitHub pull requests | Surface failing checks first on PR pages.                                       | Reorders status checks so failures and in-progress items appear before passes                                  |
| [`google-feeling-lucky.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/google.com/google-feeling-lucky.user.js)          | Google Search        | Turn lucky-style redirects into direct navigation.                              | Redirects search pages or `/url` links to the first real destination                                           |
| [`google-meet-auto-leave.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/meet.google.com/google-meet-auto-leave.user.js) | Google Meet          | Avoid lingering in empty calls.                                                 | Watches participant count, prompts before leaving, countdown-based auto-leave                                  |
| [`google-meet-auto-mute.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/meet.google.com/google-meet-auto-mute.user.js)   | Google Meet          | Join quieter by default.                                                        | Automatically turns off mic and camera on the join flow                                                        |
| [`super-com.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/super.com/super-com.user.js)                                 | Super.com travel     | Make pricing more legible on hotel search pages.                                | Shows totals on map pins, emphasizes total price in cards, adds detail-page enhancements                       |
| [`teams.user.js`](https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/teams.microsoft.com/teams.user.js)                               | Microsoft Teams      | Remove repetitive join-flow work during meetings.                               | Auto-click browser join, join muted, open device settings, hide side UI, capture transcript lines for download |

## Screenshots

TODO
