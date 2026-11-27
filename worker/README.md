# Ritual backup

The small server behind "Continue to Ko-fi". It keeps a copy of each finished
transmission, hands the buyer a short code, and matches Ko-fi orders to rituals.

| Route              | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `POST /ritual`     | stores a ritual, answers `{"code":"AB3D"}`                 |
| `POST /kofi`       | Ko-fi webhook; matches the order to a ritual               |
| `GET /public`      | shared rituals for the wall (answers and palette only)     |
| `GET /admin?key=`  | every ritual and order, behind `ADMIN_KEY`                 |
| `GET /`            | `Ghost Angel Archive worker is awake.`                     |

The tables create themselves on the first request, so there is no SQL to run.

## Setup

1. **Create the Worker.** Cloudflare dashboard → Workers & Pages → Create →
   Worker, connect this repository, and set the root directory to `worker`.
   (Without GitHub, `npx wrangler deploy` from this folder does the same thing.)
2. **Create the database.** Workers & Pages → D1 → Create database, name it
   `ghost-angel-archive`, then copy the ID it shows into `database_id` in
   `wrangler.toml` and deploy again.
3. **Two secrets.** On the Worker: Settings → Variables and Secrets →
   `ADMIN_KEY` (any long random phrase, this is the admin page's key) and
   `KOFI_TOKEN` (the verification token on Ko-fi's webhooks page).
4. **The webhook.** Ko-fi → Settings → Webhooks → add
   `https://<your-worker>/kofi`, type **Shop Order**.
5. **Tell the site.** Put the Worker's URL into `ritualApi` in `collection.js`.

Until step 5 the site never calls any of this: the share checkbox and the code
line stay hidden, and the wall of spirits stays invisible.

`wrangler.toml` also holds `SHOP_ITEM_CODE`, the code at the end of the Ko-fi
shop link. Orders for other items are stored but never matched.

## Already on Cloudflare Pages?

`functions/[[path]].js` imports this same handler, so a Pages project serves the
same routes and no Worker is needed. Bindings live in the Pages project instead
of `wrangler.toml`:

- Settings → Variables and Secrets → add `ADMIN_KEY` and `KOFI_TOKEN`.
- Settings → Bindings (or Functions → D1 database bindings) → add a D1 binding
  named `DB` pointing at the database.
- The project's `*.pages.dev` address is the one that goes into `ritualApi` and
  into Ko-fi's webhook field.
