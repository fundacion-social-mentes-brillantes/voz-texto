// Servidor LOCAL de desarrollo (solo tu computador). Sirve /public y las mismas
// funciones de /api que en Vercel. Carga las llaves y la contraseña desde
// archivos locales (que NUNCA se suben al repo) y las pasa como variables de entorno.

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4321;
const leer = (f) => (fs.existsSync(path.join(__dirname, f)) ? fs.readFileSync(path.join(__dirname, f), "utf8") : "");

// Cargar secretos locales → variables de entorno (para desarrollo)
if (!process.env.GEMINI_KEYS) {
  const k = leer("claves.txt").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).join(",");
  if (k) process.env.GEMINI_KEYS = k;
}
if (!process.env.DEEPSEEK_KEY) process.env.DEEPSEEK_KEY = leer("deepseek-key.txt");

const rutas = {
  "/api/estado": (await import("./api/estado.js")).default,
  "/api/generar": (await import("./api/generar.js")).default,
  "/api/mejorar": (await import("./api/mejorar.js")).default,
};

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".json": "application/json",
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (rutas[u.pathname]) return rutas[u.pathname](req, res);
  const ESTATICOS = new Set(["/index.html", "/icono.svg", "/manifest.webmanifest", "/sw.js", "/portada.jpg"]);
  const f = u.pathname === "/" ? "/index.html" : u.pathname;
  if (ESTATICOS.has(f)) {
    const fp = path.join(__dirname, f.slice(1));
    if (fs.existsSync(fp)) {
      res.setHeader("Content-Type", MIME[path.extname(fp)] || "application/octet-stream");
      return fs.createReadStream(fp).pipe(res);
    }
  }
  res.statusCode = 404;
  res.end("No encontrado");
});

server.listen(PORT, () => {
  console.log("\n  ✨ VOZ-TEXTO (local) en  http://localhost:" + PORT);
  console.log("  Ingresa con Google (cuenta de la fundación).");
  console.log("  Deja esta ventana abierta mientras lo usas.\n");
  if (process.platform === "win32") exec(`start "" http://localhost:${PORT}`);
});
