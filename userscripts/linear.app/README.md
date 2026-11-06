# Linear: open in desktop app

Opens Linear workspace links in the Linear desktop app instead of the browser, skipping marketing, docs, and login pages, with a per-page opt-out.

## What it does

- runs at document start on `linear.app`
- redirects to `linear://<host><path><query><hash>` for workspace URLs
- only redirects paths with at least two segments, so single-segment marketing pages stay in the browser
- skips marketing, docs, and auth paths (for example `/pricing`, `/docs`, `/login`, `/signup`, `/invite`, `/desktop`)
- opt out per page with `?web=1` or `#web`
- redirects each URL once per tab session, so going back to a page does not loop

### Limitations

- the redirect only works if the Linear desktop app is installed and registers the `linear://` scheme
- the skip list is a fixed set of first path segments and must be updated when Linear adds new marketing paths
