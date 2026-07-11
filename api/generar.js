import { readJson, sendJson, verifyUser, sintetizarChunk, pcmAmp3 } from "../lib/core.mjs";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "método no permitido" });
  try { await verifyUser(req); } catch { return sendJson(res, 401, { error: "Inicia sesión con la cuenta autorizada." }); }
  try {
    const { texto, voz, instrucciones } = await readJson(req);
    if (!texto || !texto.trim()) return sendJson(res, 400, { error: "Escribe un texto." });
    if (!voz) return sendJson(res, 400, { error: "Elige una voz." });
    const { pcm, rate } = await sintetizarChunk(
      texto.trim(),
      voz,
      instrucciones || "Lee con voz natural y expresiva, en español latino.",
    );
    const mp3 = pcmAmp3(pcm, rate);
    const segundos = Math.round(pcm.length / 2 / rate);
    sendJson(res, 200, { ok: true, mp3: mp3.toString("base64"), segundos });
  } catch (e) {
    sendJson(res, 500, { error: String(e.message || e) });
  }
}
