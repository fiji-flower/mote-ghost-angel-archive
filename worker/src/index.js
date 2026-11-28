/* Ghost Angel Archive — ritual backup and Ko-fi order matching.
   One Worker, one D1 database. Routes:

     POST /ritual   store a finished ritual, answer with a short code
     POST /kofi     Ko-fi payment webhook; matches orders to rituals
     GET  /public   rituals people chose to share, for the site's wall
     GET  /admin    every ritual and order, behind ?key=

   The keys, ADMIN_KEY, KOFI_TOKEN, EMAIL_API_KEY and NOTIFY_TO, may be set as Worker secrets
   or stored in the database's settings table (see withStoredKeys). The environment wins.
   Variables (wrangler.toml): SHOP_ITEM_CODE */

const CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";
const MAX_BODY = 32 * 1024;
const HOUR = 60 * 60 * 1000;
const RITUAL_LIMIT = 6; // per address, per hour
const MATCH_WINDOW = 24 * HOUR; // how far back a guess may reach
const PUBLIC_LIMIT = 12;
const ADMIN_LIMIT = 200;

/* The tables make themselves on the first request, so setting this up never needs SQL pasted
   by hand. schema.sql holds the same statements for anyone who prefers the CLI. */
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS rituals (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, " +
    "name TEXT NOT NULL DEFAULT '', spirit TEXT NOT NULL DEFAULT '', answers TEXT NOT NULL DEFAULT '[]', " +
    "palette TEXT NOT NULL DEFAULT '[]', gift INTEGER NOT NULL DEFAULT 0, gift_for TEXT NOT NULL DEFAULT '', " +
    "gift_about TEXT NOT NULL DEFAULT '', whisper TEXT NOT NULL DEFAULT '', avoid TEXT NOT NULL DEFAULT '', " +
    "is_public INTEGER NOT NULL DEFAULT 0, ip_hash TEXT NOT NULL DEFAULT '', order_id TEXT)",
  "CREATE INDEX IF NOT EXISTS rituals_created ON rituals (created_at DESC)",
  "CREATE INDEX IF NOT EXISTS rituals_public ON rituals (is_public, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS rituals_open ON rituals (order_id, created_at DESC)",
  "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, kofi_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, " +
    "amount TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT '', from_name TEXT NOT NULL DEFAULT '', " +
    "email TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', item_code TEXT NOT NULL DEFAULT '', " +
    "ritual_id TEXT, match_kind TEXT)",
  "CREATE INDEX IF NOT EXISTS orders_created ON orders (created_at DESC)",
  "CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)"
];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400"
};

const text = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain;charset=utf-8", "cache-control": "no-store", ...CORS }
  });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store", ...CORS }
  });

/* Short single-line fields collapse their whitespace; paragraphs keep their line breaks. */
const str = (value, max) =>
  (typeof value === "string" ? value : value == null ? "" : String(value)).replace(/\s+/g, " ").trim().slice(0, max);

const para = (value, max) =>
  (typeof value === "string" ? value : "").replace(/\r\n?/g, "\n").trim().slice(0, max);

const esc = (value) =>
  String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function safeArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* Once per isolate; a failure clears the flag so the next request tries again. */
let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const statement of SCHEMA) await env.DB.prepare(statement).run();
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

/* The keys may live in the database instead of the dashboard, whose Variables and
   Secrets panel does not always reach a Worker built from Git. The D1 console can
   always write them:

     INSERT INTO settings (k, v) VALUES ('admin_key', 'a phrase of your own');

   A value in the environment wins, so setting a real secret later needs no change. */
const SETTING_NAMES = { admin_key: "ADMIN_KEY", kofi_token: "KOFI_TOKEN", email_api_key: "EMAIL_API_KEY", notify_to: "NOTIFY_TO", notify_from: "NOTIFY_FROM" };
const SETTINGS_TTL = 60 * 1000;
let settingsCache = { at: 0, values: {} };

async function withStoredKeys(env) {
  if (!env.DB) return env;
  if (Date.now() - settingsCache.at >= SETTINGS_TTL) {
    try {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)").run();
      const { results } = await env.DB.prepare("SELECT k, v FROM settings").all();
      const values = {};
      for (const row of results || []) {
        const name = SETTING_NAMES[String(row.k || "").trim().toLowerCase()];
        if (name && row.v) values[name] = String(row.v);
      }
      settingsCache = { at: Date.now(), values };
    } catch {
      // No table yet: carry on with the environment alone.
    }
  }
  const values = settingsCache.values;
  if (!Object.keys(values).length) return env;
  return new Proxy(env, {
    get(target, prop) {
      if (typeof prop === "string" && values[prop] && !target[prop]) return values[prop];
      return target[prop];
    }
  });
}

/* A short email to the artist when something arrives, so the admin page does not have to be
   watched. Resend's free plan sends to the address the account was opened with, which is all
   a notification needs; nothing waits for it, and a refused email never affects the answer. */
async function notify(env, ctx, subject, body) {
  if (!env.EMAIL_API_KEY || !env.NOTIFY_TO) return;
  const sending = fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env.EMAIL_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.NOTIFY_FROM || "Ghost Angel Archive <onboarding@resend.dev>",
      to: [env.NOTIFY_TO],
      subject,
      text: body
    })
  }).catch(() => null);
  if (ctx && ctx.waitUntil) ctx.waitUntil(sending);
  else await sending;
}

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/* The address is only ever kept as a short salted hash, for the hourly limit. */
async function hashIp(ip) {
  if (!ip) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ghost-angel:" + ip));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readJson(request) {
  const raw = await request.text();
  if (!raw || raw.length > MAX_BODY) return null;
  try {
    const body = JSON.parse(raw);
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

async function handleRitual(request, env, ctx) {
  const body = await readJson(request);
  if (!body) return json({ error: "unreadable" }, 400);

  const answers = (Array.isArray(body.answers) ? body.answers : [])
    .slice(0, 8)
    .map((answer) => ({ label: str(answer && answer.label, 48), value: str(answer && answer.value, 180) }))
    .filter((answer) => answer.label && answer.value);
  if (answers.length < 3) return json({ error: "incomplete" }, 400);

  const palette = (Array.isArray(body.palette) ? body.palette : [])
    .filter((colour) => typeof colour === "string" && /^#[0-9a-f]{6}$/i.test(colour))
    .slice(0, 4);

  const ipHash = await hashIp(request.headers.get("cf-connecting-ip") || "");
  if (ipHash) {
    const since = new Date(Date.now() - HOUR).toISOString();
    const seen = await env.DB.prepare("SELECT COUNT(*) AS n FROM rituals WHERE ip_hash = ? AND created_at > ?")
      .bind(ipHash, since)
      .first();
    if (seen && Number(seen.n) >= RITUAL_LIMIT) return json({ error: "too many" }, 429);
  }

  const gift = Boolean(body.gift);
  const values = [
    crypto.randomUUID(),
    "",
    new Date().toISOString(),
    str(body.name, 80),
    str(body.spirit, 60),
    JSON.stringify(answers),
    JSON.stringify(palette),
    gift ? 1 : 0,
    gift ? para(body.giftFor, 120) : "",
    gift ? para(body.giftAbout, 600) : "",
    para(body.whisper, 1000),
    para(body.avoid, 300),
    body.isPublic ? 1 : 0,
    ipHash
  ];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    values[1] = makeCode();
    try {
      await env.DB.prepare(
        "INSERT INTO rituals (id, code, created_at, name, spirit, answers, palette, gift, gift_for, gift_about, whisper, avoid, is_public, ip_hash, order_id) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)"
      )
        .bind(...values)
        .run();
      const lines = values[3] ? ["Name: " + values[3]] : [];
      for (const answer of safeArray(values[5])) lines.push(answer.label + ": " + answer.value);
      if (values[10]) lines.push("Whisper: " + values[10]);
      if (values[11]) lines.push("Avoid: " + values[11]);
      if (values[7]) lines.push("A gift" + (values[8] ? " for " + values[8] : "") + (values[9] ? "\nAbout them: " + values[9] : ""));
      lines.push("", values[12] ? "Shared on the wall." : "Kept private.");
      notify(env, ctx, "New ritual " + values[1], lines.join("\n"));
      return json({ code: values[1] });
    } catch {
      // Almost always a code collision; a fresh code is drawn and tried again.
    }
  }
  return json({ error: "unavailable" }, 503);
}

function parseKofi(raw) {
  try {
    const data = new URLSearchParams(raw).get("data");
    if (data) return JSON.parse(data);
    if (raw.trim().startsWith("{")) return JSON.parse(raw);
  } catch {
    // fall through to null
  }
  return null;
}

/* Code in the message wins, then an exact name, then the nearest ritual in time.
   The time guess is recorded as such so it can be checked by hand. */
async function matchRitual(env, order) {
  const since = new Date(Date.now() - 30 * 24 * HOUR).toISOString();
  const { results } = await env.DB.prepare(
    "SELECT id, code, created_at, name, gift_for FROM rituals WHERE order_id IS NULL AND created_at > ? ORDER BY created_at DESC LIMIT 200"
  )
    .bind(since)
    .all();
  const open = results || [];
  if (!open.length) return null;

  const message = order.message.toUpperCase();
  if (message) {
    for (const ritual of open) {
      const code = String(ritual.code || "").toUpperCase();
      if (!code) continue;
      if (new RegExp("(^|[^A-Z0-9])" + code + "([^A-Z0-9]|$)").test(message)) {
        return { id: ritual.id, kind: "code" };
      }
    }
  }

  const name = order.fromName.toLowerCase();
  if (name) {
    for (const ritual of open) {
      const candidate = String(ritual.name || ritual.gift_for || "").trim().toLowerCase();
      if (candidate && candidate === name) return { id: ritual.id, kind: "name" };
    }
  }

  const recent = open.find((ritual) => Date.now() - Date.parse(ritual.created_at) < MATCH_WINDOW);
  return recent ? { id: recent.id, kind: "time" } : null;
}

async function handleKofi(request, env, ctx) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return text("too large", 413);
  const payload = parseKofi(raw);
  if (!payload) return text("bad payload", 400);
  if (!env.KOFI_TOKEN || payload.verification_token !== env.KOFI_TOKEN) return text("forbidden", 401);

  const kofiId = str(payload.kofi_transaction_id, 80) || str(payload.message_id, 80);
  if (!kofiId) return text("ok", 200);
  const seen = await env.DB.prepare("SELECT id FROM orders WHERE kofi_id = ?").bind(kofiId).first();
  if (seen) return text("ok", 200);

  const type = str(payload.type, 40);
  const items = Array.isArray(payload.shop_items) ? payload.shop_items : [];
  const itemCodes = items.map((item) => str(item && item.direct_link_code, 40)).filter(Boolean);
  const wanted = str(env.SHOP_ITEM_CODE, 40);
  const isOurItem = type === "Shop Order" && (!wanted || itemCodes.includes(wanted));

  const order = {
    id: crypto.randomUUID(),
    kofiId,
    createdAt: new Date().toISOString(),
    amount: str(payload.amount, 24),
    currency: str(payload.currency, 8),
    fromName: str(payload.from_name, 120),
    email: str(payload.email, 160),
    message: para(payload.message, 4000),
    itemCode: itemCodes.join(",")
  };

  const match = isOurItem ? await matchRitual(env, order) : null;
  await env.DB.prepare(
    "INSERT INTO orders (id, kofi_id, created_at, amount, currency, from_name, email, message, item_code, ritual_id, match_kind) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      order.id,
      order.kofiId,
      order.createdAt,
      order.amount,
      order.currency,
      order.fromName,
      order.email,
      order.message,
      order.itemCode,
      match ? match.id : null,
      match ? match.kind : null
    )
    .run();

  if (match) {
    await env.DB.prepare("UPDATE rituals SET order_id = ? WHERE id = ?").bind(order.id, match.id).run();
  }
  notify(
    env,
    ctx,
    "Ko-fi order: " + order.amount + " " + order.currency,
    [
      order.fromName || "Someone",
      order.email,
      order.message,
      match ? "Matched a ritual by " + match.kind + "." : "No ritual matched yet — open the admin page."
    ]
      .filter(Boolean)
      .join("\n")
  );
  return text("ok", 200);
}

async function handlePublic(env) {
  const { results } = await env.DB.prepare(
    "SELECT answers, palette, created_at FROM rituals WHERE is_public = 1 ORDER BY created_at DESC LIMIT ?"
  )
    .bind(PUBLIC_LIMIT)
    .all();
  const items = (results || []).map((row) => ({
    answers: safeArray(row.answers),
    palette: safeArray(row.palette),
    createdAt: row.created_at
  }));
  return json({ items });
}

function shortDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }) + " UTC";
}

function adminPage(rituals, orders) {
  const byRitual = new Map();
  for (const order of orders) if (order.ritual_id) byRitual.set(order.ritual_id, order);
  const unmatched = orders.filter((order) => !order.ritual_id);

  const orderLine = (order) => {
    const who = order.from_name || order.email || "someone";
    return esc(order.amount + " " + order.currency) + " · " + esc(who);
  };

  const ritualCard = (ritual) => {
    const answers = safeArray(ritual.answers);
    const order = byRitual.get(ritual.id);
    const who = ritual.name ? `<div><dt>Name</dt><dd>${esc(ritual.name)}</dd></div>` : "";
    const facts = who + answers.map((answer) => `<div><dt>${esc(answer.label)}</dt><dd>${esc(answer.value)}</dd></div>`).join("");
    const extra = [
      ritual.gift ? `<div><dt>Gift for</dt><dd>${esc(ritual.gift_for || "—")}</dd></div>` : "",
      ritual.gift_about ? `<div><dt>About them</dt><dd>${esc(ritual.gift_about)}</dd></div>` : "",
      ritual.whisper ? `<div><dt>Whisper</dt><dd>${esc(ritual.whisper)}</dd></div>` : "",
      ritual.avoid ? `<div><dt>Avoid</dt><dd>${esc(ritual.avoid)}</dd></div>` : ""
    ].join("");
    return (
      `<article class="card${order ? " done" : ""}">` +
      `<header><b>${esc(ritual.code)}</b><span>${esc(shortDate(ritual.created_at))}</span>` +
      (ritual.is_public ? `<em>public</em>` : "") +
      `</header>` +
      `<dl>${facts}${extra}</dl>` +
      `<footer>${order ? orderLine(order) + ` · matched by ${esc(order.match_kind || "hand")}` : "No order yet"}</footer>` +
      `</article>`
    );
  };

  const orderCard = (order) =>
    `<article class="card warn"><header><b>${orderLine(order)}</b><span>${esc(shortDate(order.created_at))}</span></header>` +
    (order.message ? `<pre>${esc(order.message)}</pre>` : `<p class="muted">No message from the buyer.</p>`) +
    `<footer>${esc(order.email || "")}${order.item_code ? " · item " + esc(order.item_code) : ""}</footer></article>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Rituals · Ghost Angel Archive</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;padding:26px 18px 60px;background:#15121a;color:#f2e9f7;font:15px/1.55 system-ui,sans-serif}
  main{max-width:880px;margin:0 auto}
  h1{font-size:1.35rem;letter-spacing:-.02em;margin:0 0 4px}
  h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.14em;color:#c0aecf;margin:30px 0 10px;font-weight:500}
  .sub{color:#b9a8c6;font-size:.82rem;margin:0 0 6px}
  .card{border:1px solid rgba(224,205,246,.2);border-radius:10px;padding:13px 14px;margin-bottom:10px;background:rgba(72,54,81,.34)}
  .card.done{border-color:rgba(180,232,200,.35)}
  .card.warn{border-color:rgba(245,196,150,.4);background:rgba(96,68,50,.28)}
  .card header{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;margin-bottom:8px}
  .card header b{font-family:ui-monospace,monospace;letter-spacing:.12em;font-size:1rem;color:#fff}
  .card header span{color:#a897b6;font-size:.74rem}
  .card header em{font-style:normal;font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:#bde8cc;border:1px solid rgba(189,232,204,.4);border-radius:99px;padding:1px 7px}
  dl{margin:0;display:grid;gap:3px}
  dl div{display:grid;grid-template-columns:112px 1fr;gap:10px}
  dt{color:#a897b6;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;padding-top:2px}
  dd{margin:0;font-size:.9rem;color:#e6daee}
  .card footer{margin-top:9px;padding-top:8px;border-top:1px solid rgba(224,205,246,.12);font-size:.76rem;color:#bfaecd}
  pre{white-space:pre-wrap;word-break:break-word;margin:0;font:inherit;font-size:.88rem;color:#e9dff1;background:rgba(0,0,0,.2);padding:9px 10px;border-radius:7px}
  .muted{color:#a897b6;font-size:.84rem;margin:0}
  .empty{color:#a897b6;font-size:.86rem;border:1px dashed rgba(224,205,246,.24);border-radius:10px;padding:14px;text-align:center}
  @media(max-width:520px){dl div{grid-template-columns:1fr;gap:0}}
</style></head><body><main>
<h1>Spirit transmissions</h1>
<p class="sub">${rituals.length} ritual${rituals.length === 1 ? "" : "s"} kept · ${orders.length} order${orders.length === 1 ? "" : "s"} received</p>
<h2>Orders without a ritual</h2>
${unmatched.length ? unmatched.map(orderCard).join("") : `<p class="empty">Nothing waiting.</p>`}
<h2>Rituals</h2>
${rituals.length ? rituals.map(ritualCard).join("") : `<p class="empty">No rituals yet.</p>`}
</main></body></html>`;
}

async function handleAdmin(url, env) {
  if (!env.ADMIN_KEY) return text("Set the key first: wrangler secret put ADMIN_KEY", 503);
  if (url.searchParams.get("key") !== env.ADMIN_KEY) return text("forbidden", 401);
  const [rituals, orders] = await Promise.all([
    env.DB.prepare("SELECT * FROM rituals ORDER BY created_at DESC LIMIT ?").bind(ADMIN_LIMIT).all(),
    env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?").bind(ADMIN_LIMIT).all()
  ]);
  return new Response(adminPage(rituals.results || [], orders.results || []), {
    headers: {
      "content-type": "text/html;charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "referrer-policy": "no-referrer"
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    env = await withStoredKeys(env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/") return text("Ghost Angel Archive worker is awake.");
      if (path !== "/ritual" && path !== "/kofi" && path !== "/public" && path !== "/admin") return text("not found", 404);
      await ensureSchema(env);
      if (path === "/ritual" && request.method === "POST") return await handleRitual(request, env, ctx);
      if (path === "/kofi" && request.method === "POST") return await handleKofi(request, env, ctx);
      if (path === "/public" && request.method === "GET") return await handlePublic(env);
      if (path === "/admin" && request.method === "GET") return await handleAdmin(url, env);
      return text("not found", 404);
    } catch (error) {
      return text("error: " + (error && error.message ? error.message : "unknown"), 500);
    }
  }
};
