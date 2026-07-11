import { readJson, sendJson, getPassword } from "../lib/core.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "método no permitido" });
  const { clave } = await readJson(req);
  const pass = getPassword();
  if (!pass) return sendJson(res, 200, { ok: false, noConfig: true });
  return sendJson(res, 200, { ok: String(clave || "") === pass });
}
