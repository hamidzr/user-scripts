# Datadog Log Title

Adds the main query facets to Datadog Log Explorer tab titles so several open log tabs are easy to tell apart.

## What it does

- prefixes the tab title with a label built from the current query, for example `checkout · prod · error · <original title>`
- builds the label from facets in this order: `service`, `env`, `status`, `host`, `source`, `index`
- joins multiple values for one facet with commas, for example `checkout,payments`
- shortens service names by dropping a `.app` suffix and a trailing `-api`, `-service`, `-worker`, `-consumer`, or `-producer`, so `checkout-api` shows as `checkout`
- adds the sub-route name for pages such as `/logs/analytics`
- adds the first free-text keyword of 30 characters or fewer, in quotes
- uses the saved view's name as the label when the URL has a `saved-view-id`; until Datadog renders the name, it shows the facet label and retries for about 5 seconds
- ignores negative terms (`-"foo"`, `-tag:x`) and the time range
- matches `app.datadoghq.com`, `app.datadoghq.eu`, `app.us3.datadoghq.com`, `app.us5.datadoghq.com`, and `app.ap1.datadoghq.com`
- runs on Log Explorer pages (`/logs`) only

## Limitations

- Only Log Explorer is supported. Monitors, dashboards, APM, and other Datadog pages are not changed.
- Titles are not length-capped, so long service names can crowd narrow tabs.
- Saved-view names depend on Datadog's current saved-view title markup. If that changes, saved views fall back to the facet label.
