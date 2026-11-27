# Ritual backup

The small server behind "Continue to Ko-fi". It keeps a copy of each finished
transmission, hands the buyer a short code, and matches Ko-fi orders to rituals.

| Route              | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `POST /ritual`     | stores a ritual, answers `{"code":"AB3D"}`                 |
| `POST /kofi`       | Ko-fi webhook; matches the order to a ritual               |
| `GET /public`      | shared rituals for the wall (answers and palette only)     |
| `GET /admin?key=`  | every ritual and order, behind `ADMIN_KEY`                 |
| `DELETE /ritual`   | `?code=AB3D&key=…` removes one ritual and its order match  |

The tables create themselves on the first request, so there is no SQL to run.

## How it is deployed

The root `wrangler.toml` is the only config. Cloudflare Workers Builds reads it
and deploys a single Worker that publishes this repository as the site *and*
runs this handler on the same address, so `/ritual` and `/public` live beside
`index.html`.

That file holds the database binding (`DB`, named after nothing but itself), the
`SHOP_ITEM_CODE` variable, and the Worker name. Two secrets are set in the
dashboard instead, because they must never be in the repository:

- `ADMIN_KEY` — any long phrase of your own; the admin page is `/admin?key=…`.
- `KOFI_TOKEN` — the verification token Ko-fi shows for the webhook.

Worker → Settings → Variables and Secrets → add each as type **secret**, on the
Worker named `mote-ghost-angel-archive` (not a second one with a similar name).

## The Ko-fi webhook

On Ko-fi: Settings → Webhooks → add `https://<your-worker>/kofi` with type
**Shop Order**, then copy the verification token it generates and save it in
Cloudflare as `KOFI_TOKEN`. Until that token matches, `/kofi` answers `401` and
Ko-fi reports failed deliveries; after it, orders arrive and are matched.

Matching prefers the code the buyer was given, then an exact name, then the
nearest unmatched ritual from the last 24 hours — that last one is recorded as
`match_kind: time` because it is a guess.

`functions/[[path]].js` exists only for the case of hosting this on Cloudflare
Pages instead; it imports the same handler.
