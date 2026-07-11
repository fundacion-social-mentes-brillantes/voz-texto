// Motor compartido de Voz-Texto. Lo usan las funciones de /api tanto en Vercel
// como en el servidor local (servidor.mjs). NUNCA contiene claves: las lee de
// variables de entorno (en Vercel) o el servidor local las carga desde archivos.

import lamejs from "@breezystack/lamejs";

const GEMINI_MODEL = "gemini-2.5-flash-preview-tts";
const DEEPSEEK_MODELOS = ["deepseek-v4-pro", "deepseek-chat"];

// Config PÚBLICA de Firebase (no es secreta) — sirve para verificar el token del usuario.
const FIREBASE_API_KEY = "AIzaSyC7aAZoAewhGN1YyH93_c1_eAfIRjoFbfc";
// Cuentas de Google autorizadas a usar la app (por ahora, solo la fundación).
const CORREOS_PERMITIDOS = ["fundacionsocial@gimnasioemocionalmb.com"];

export function getGeminiKeys() {
  const set = new Set();
  const add = (s) => { s = (s || "").trim(); if (s.length > 20 && !s.includes(" ")) set.add(s); };
  // Opción A: una sola variable GEMINI_KEYS con las llaves separadas por coma o salto de línea.
  (process.env.GEMINI_KEYS || "").split(/[,\n]+/).forEach(add);
  // Opción B (más fácil en Vercel): una variable por llave — GEMINI_KEY_1, GEMINI_KEY_2, …
  for (const [k, v] of Object.entries(process.env)) {
    if (/^GEMINI_KEY(_?\d+)?$/i.test(k)) add(v);
  }
  return [...set];
}

export function getDeepseek() {
  const m = /sk-[A-Za-z0-9_-]+/.exec(process.env.DEEPSEEK_KEY || "");
  return m ? m[0] : null;
}

/** Verifica el token de Google (Firebase) del usuario y que sea una cuenta
 *  AUTORIZADA. Sin token válido de una cuenta permitida, lanza error (bloquea).
 *  Así nadie puede usar las llaves sin iniciar sesión con la cuenta correcta. */
export async function verifyUser(req) {
  const auth = req.headers["authorization"] || req.headers["Authorization"] || "";
  const token = String(auth).replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("no-auth");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!res.ok) throw new Error("no-auth");
  const data = await res.json();
  const u = data.users && data.users[0];
  const email = String(u?.email || "").toLowerCase();
  const verificado = u?.emailVerified === true || u?.emailVerified === "true";
  if (!u || !verificado || !CORREOS_PERMITIDOS.includes(email)) throw new Error("no-autorizado");
  return { uid: u.localId, email };
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

export function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

/** Sintetiza UN trozo de texto. Prueba las llaves (orden aleatorio) hasta que una responda. */
export async function sintetizarChunk(texto, voz, instrucciones) {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error("No hay llaves de Gemini configuradas.");
  const orden = [...keys].sort(() => Math.random() - 0.5);
  let sinCupo = 0, ultimo = "";
  for (const key of orden) {
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${instrucciones}\n\nTexto a narrar:\n${texto}` }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } },
            },
          }),
        },
      );
    } catch (e) { ultimo = "red"; continue; }
    if (res.status === 429) { sinCupo++; ultimo = "429"; continue; }
    if (!res.ok) { ultimo = `Gemini ${res.status}`; continue; }
    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) { ultimo = "sin audio"; continue; }
    const pcm = Buffer.from(part.inlineData.data, "base64");
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1] ?? 24000);
    return { pcm, rate };
  }
  if (sinCupo >= keys.length) {
    throw new Error("LIMITE: las llaves llegaron a su límite gratuito de hoy. Prueba más tarde o mañana 🌙");
  }
  throw new Error("No se pudo generar el audio (" + ultimo + "). Intenta de nuevo.");
}

/** PCM (L16) → MP3 (mono). */
export function pcmAmp3(pcmBuf, rate, kbps = 80) {
  const pcm = new Int16Array(pcmBuf.buffer, pcmBuf.byteOffset, Math.floor(pcmBuf.length / 2));
  const enc = new lamejs.Mp3Encoder(1, rate, kbps);
  const out = [];
  const block = 1152;
  for (let i = 0; i < pcm.length; i += block) {
    const b = enc.encodeBuffer(pcm.subarray(i, i + block));
    if (b.length) out.push(Buffer.from(b));
  }
  const end = enc.flush();
  if (end.length) out.push(Buffer.from(end));
  return Buffer.concat(out);
}

const DS_SYS =
  "Eres un director de doblaje experto en narración con voces de IA. Recibes un TEXTO y un " +
  "SENTIMIENTO. Devuelve EXACTAMENTE el mismo texto —las mismas palabras, en el mismo orden, sin " +
  "cambiar, quitar ni añadir palabras— pero insertando ACOTACIONES entre corchetes para que una voz " +
  "lo lea de forma muy humana y expresiva acorde al sentimiento pedido. Acotaciones posibles: " +
  "[pausa corta], [pausa larga], [susurrando], [con ternura], [con alegría], [emocionado], " +
  "[voz quebrada], [suspiro], [risa suave], [con calma], [enfático], [subiendo la voz], " +
  "[bajando la voz], [respira]. Colócalas justo ANTES del fragmento al que afectan. REGLAS: " +
  "1) No cambies NINGUNA palabra del original; solo agregas acotaciones entre corchetes. " +
  "2) Con equilibrio y buen gusto (ni pocas ni exageradas). " +
  "3) Responde SOLO con el texto anotado, sin títulos ni explicaciones. Mismo idioma (español).";

export async function mejorar(texto, estilo) {
  const key = getDeepseek();
  if (!key) throw new Error("SIN_DEEPSEEK");
  let lastErr = "";
  for (const model of DEEPSEEK_MODELOS) {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        messages: [
          { role: "system", content: DS_SYS },
          { role: "user", content: `SENTIMIENTO deseado: ${estilo}\n\nTEXTO:\n${texto}` },
        ],
      }),
    });
    if (res.ok) {
      const d = await res.json();
      return (d.choices?.[0]?.message?.content || "").trim();
    }
    const t = await res.text();
    lastErr = `DeepSeek ${res.status}: ${t.slice(0, 150)}`;
    if (!/model/i.test(t)) break;
  }
  throw new Error(lastErr);
}
