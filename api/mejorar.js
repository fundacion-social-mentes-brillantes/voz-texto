import { readJson, sendJson, verifyUser, mejorar } from "../lib/core.mjs";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "método no permitido" });
  try { await verifyUser(req); } catch { return sendJson(res, 401, { error: "Inicia sesión con la cuenta autorizada." }); }
  try {
    const { texto, estilo } = await readJson(req);
    if (!texto || !texto.trim()) return sendJson(res, 400, { error: "Escribe un texto." });
    const mejorado = await mejorar(texto.trim(), estilo || "expresivo y natural");
    if (!mejorado) return sendJson(res, 500, { error: "La IA no devolvió texto. Intenta de nuevo." });
    sendJson(res, 200, { ok: true, texto: mejorado });
  } catch (e) {
    const m = String(e.message || e);
    sendJson(res, 500, { error: m === "SIN_DEEPSEEK" ? "El mejorador (DeepSeek) no está configurado." : m });
  }
}
