# Ritual backup

The small server behind "Continue to Ko-fi". It keeps a copy of each finished
transmission, hands the buyer a short code, matches Ko-fi orders to rituals, and
emails the artist when either arrives.

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

## The keys

`ADMIN_KEY` guards `/admin`, `KOFI_TOKEN` is what proves a webhook really came
from Ko-fi, and `EMAIL_API_KEY` plus `NOTIFY_TO` turn on the arrival emails.
None of them belong in the repository. They can be set either way:

**In the database** (works from the D1 console, no deploy needed):

```sql
INSERT INTO settings (k, v) VALUES ('admin_key', 'a phrase of your own');
INSERT INTO settings (k, v) VALUES ('kofi_token', 'the token Ko-fi shows');
INSERT INTO settings (k, v) VALUES ('email_api_key', 're_...');
INSERT INTO settings (k, v) VALUES ('notify_to', 'you@example.com');
```

The `settings` table is created with the other tables. A changed value is picked
up within a minute.

**In the environment** (Worker → Settings → Variables and Secrets, type secret),
which takes precedence when both exist.

## The arrival emails

`POST https://api.resend.com/emails` is called after a ritual is stored and after
an order is stored, from `onboarding@resend.dev` unless `notify_from` is set.
Resend's free plan sends to the address the account was opened with, so no
domain is needed while the notifications go to the artist's own address. A
missing key, a refused send or a network problem is swallowed: the ritual is
already saved and the buyer still gets their code.

## The Ko-fi webhook

On Ko-fi: Settings → Webhooks → add `https://<your-worker>/kofi`, then copy the
verification token it generates and store it as `kofi_token`. Until that token
matches, `/kofi` answers `401` and Ko-fi reports failed deliveries; after it,
orders arrive and are matched.

Matching prefers the code the buyer was given, then an exact name, then the
nearest unmatched ritual from the last 24 hours — that last one is recorded as
`match_kind: time` because it is a guess.

`functions/[[path]].js` exists only for the case of hosting this on Cloudflare
Pages instead; it imports the same handler.
