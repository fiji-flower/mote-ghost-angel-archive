/* Entry point. It hands every request to the real handler, but first lets two
   values come from the database instead of the dashboard:

     INSERT INTO settings (k, v) VALUES ('admin_key', 'a phrase of your own');
     INSERT INTO settings (k, v) VALUES ('kofi_token', 'the token Ko-fi shows');

   The dashboard's Variables and Secrets panel does not always reach a Worker
   built from Git, and the D1 console always works. A value set in the
   environment still wins, so adding a real secret later needs no change here.
   Only these two names are read; nothing else in the table is used. */
import worker from "./index.js";

const CREATE = "CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)";
const NAMES = { admin_key: "ADMIN_KEY", kofi_token: "KOFI_TOKEN" };
const TTL = 60 * 1000; // how long a fetched value is reused by this instance

let cache = { at: 0, values: {} };

async function stored(env) {
  if (Date.now() - cache.at < TTL) return cache.values;
  try {
    await env.DB.prepare(CREATE).run();
    const { results } = await env.DB.prepare("SELECT k, v FROM settings").all();
    const values = {};
    for (const row of results || []) {
      const name = NAMES[String(row.k || "").trim().toLowerCase()];
      if (name && row.v) values[name] = String(row.v);
    }
    cache = { at: Date.now(), values };
    return values;
  } catch {
    // No database yet, or no table: fall back to whatever the environment has.
    return cache.values;
  }
}

export default {
  async fetch(request, env) {
    if (!env.DB) return worker.fetch(request, env);
    const values = await stored(env);
    const withKeys = new Proxy(env, {
      get(target, prop) {
        if (typeof prop === "string" && values[prop] && !target[prop]) return values[prop];
        return target[prop];
      }
    });
    return worker.fetch(request, withKeys);
  }
};
