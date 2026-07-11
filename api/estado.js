import { sendJson, verifyUser, getGeminiKeys, getDeepseek } from "../lib/core.mjs";

export default async function handler(req, res) {
  try { await verifyUser(req); } catch { return sendJson(res, 401, { error: "no autorizado" }); }
  sendJson(res, 200, { claves: getGeminiKeys().length, deepseek: !!getDeepseek() });
}
