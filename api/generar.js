import { readJson, sendJson, verifyUser, sintetizarChunk, sintetizarChunkAzure } from "../lib/core.mjs";

export const config = { maxDuration: 60 };

// Devuelve el AUDIO ORIGINAL (PCM) de cada trozo. El navegador arma con él la
// versión WAV (alta calidad, para descargar) y la MP3 (ligera, para guardar).
export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "método no permitido" });
  try { await verifyUser(req); } catch { return sendJson(res, 401, { error: "Inicia sesión con la cuenta autorizada." }); }
  try {
    const { texto, voz, instrucciones, motor } = await readJson(req);
    if (!texto || !texto.trim()) return sendJson(res, 400, { error: "Escribe un texto." });
    if (!voz) return sendJson(res, 400, { error: "Elige una voz." });
    const { pcm, rate } = motor === "azure"
      ? await sintetizarChunkAzure(texto.trim(), voz)
      : await sintetizarChunk(
          texto.trim(),
          voz,
          instrucciones || "Lee con voz natural y expresiva, en español latino.",
        );
    const segundos = Math.round(pcm.length / 2 / rate);
    sendJson(res, 200, { ok: true, pcm: pcm.toString("base64"), rate, segundos });
  } catch (e) {
    sendJson(res, 500, { error: String(e.message || e) });
  }
}
