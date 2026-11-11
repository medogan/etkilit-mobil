// Yayın klasörünü (dist/) hazırlar: uygulama dosyaları + jsQR + önbellek sürümü
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const FILES = ["index.html", "app.js", "crypto.js", "style.css", "manifest.webmanifest", "sw.js"];
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/vendor", { recursive: true });
for (const f of FILES) cpSync(f, `dist/${f}`);
cpSync("icons", "dist/icons", { recursive: true });
cpSync("node_modules/jsqr/dist/jsQR.js", "dist/vendor/jsQR.js");

const build = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 12);
writeFileSync("dist/sw.js", readFileSync("dist/sw.js", "utf8").replace("__BUILD__", build));
writeFileSync("dist/app.js", readFileSync("dist/app.js", "utf8").replace('"web-1.0"', `"web-1.0 (${build.slice(0, 7)})"`));
console.log("dist/ hazır, sürüm", build);
