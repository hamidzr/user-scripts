# Notion: open in desktop app

This userscript sends Notion page URLs to the Notion desktop app through the `notion://` scheme.

## What it does

- runs at document start on `www.notion.so` and `notion.so`
- redirects to `notion://<host><path><query><hash>` for workspace page URLs
- skips the root URL, marketing and auth pages (for example `/login`, `/pricing`, `/signup`, `/templates`, `/mcp`), and URLs with OAuth parameters (`client_id`, `redirect_uri`, `response_type`, `code_challenge`)
- opt out per page with `?web=1` or `#web`
- redirects each URL once per tab session, so going back to a page does not loop

### Limitations

- the redirect only works if the Notion desktop app is installed and registers the `notion://` scheme
- the skip list is a fixed set of first path segments and must be updated when Notion adds new marketing paths
