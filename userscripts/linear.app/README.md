# Linear: open in desktop app

This userscript sends Linear workspace URLs to the Linear desktop app through the `linear://` scheme.

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
