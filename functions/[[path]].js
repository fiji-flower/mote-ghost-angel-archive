/* Cloudflare Pages entry point for the ritual backup.

   Pages routes every request in this folder, so /ritual, /kofi, /public and /admin
   behave exactly as worker/README.md describes. The code is the same file the Worker
   uses; nothing is duplicated. The D1 binding must be named DB. */
import worker from "../worker/src/index.js";

export const onRequest = (context) => worker.fetch(context.request, context.env);
