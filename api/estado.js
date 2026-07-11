import { sendJson, checkAuth, getGeminiKeys, getDeepseek } from "../lib/core.mjs";

export default async function handler(req, res) {
  if (!checkAuth(req)) return sendJson(res, 401, { error: "clave incorrecta" });
  sendJson(res, 200, { claves: getGeminiKeys().length, deepseek: !!getDeepseek() });
}
