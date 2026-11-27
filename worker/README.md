# Ritual backup

The small server behind "Continue to Ko-fi". It keeps a copy of each finished
transmission, hands the buyer a short code, and matches Ko-fi orders to rituals.

| Route              | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `POST /ritual`     | stores a ritual, answers `{"code":"AB3D"}`                 |
| `POST /kofi`       | Ko-fi webhook; matches the order to a ritual               |
| `GET /public`      | shared rituals for the wall (answers and palette only)     |
| `GET /admin?key=`  | every ritual and order, behind `ADMIN_KEY`                 |

Every table creates itself on the first request, so there is no SQL to run.
Removing a ritual means deleting its row in the D1 console, for example
`DELETE FROM rituals WHERE code = 'AB3D';`

## How it is deployed

The root `wrangler.toml` is the only config. Cloudflare Workers Builds reads it
and deploys a single Worker that publishes this repository as the site *and*
runs `worker/src/index.js` on the same address, so `/ritual` and `/public` live
beside `index.html`.

## The two keys

`ADMIN_KEY` guards `/admin`, and `KOFI_TOKEN` is what proves a webhook really
came from Ko-fi. Neither belongs in the repository. They can be set either way:

**In the database** (works from the D1 console, no deploy needed):

```sql
INSERT INTO settings (k, v) VALUES ('admin_key', 'a phrase of your own');
INSERT INTO settings (k, v) VALUES ('kofi_token', 'the token Ko-fi shows');
```

The `settings` table is created with the other tables. A changed value is picked
up within a minute.

**In the environment** (Worker → Settings → Variables and Secrets, type secret),
which takes precedence when both exist.

## The Ko-fi webhook

On Ko-fi: Settings → Webhooks → add `https://<your-worker>/kofi` with type
**Shop Order**, then copy the verification token it generates and store it as
`kofi_token`. Until that token matches, `/kofi` answers `401` and Ko-fi reports
failed deliveries; after it, orders arrive and are matched.

Matching prefers the code the buyer was given, then an exact name, then the
nearest unmatched ritual from the last 24 hours — that last one is recorded as
`match_kind: time` because it is a guess.

`functions/[[path]].js` exists only for the case of hosting this on Cloudflare
Pages instead; it imports the same handler.
