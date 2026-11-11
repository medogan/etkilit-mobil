// ETKilit Mobil (web) — öğretmen anahtarı hesapları.
// Rust: etkilit-core/src/mobilekey.rs · Uygulama: etkilit-mobile/src/crypto/mobileKey.ts (aynı test vektörleri)
//
// 30 sn kodu  = HMAC-SHA256(tohum, "ETKILIT-MOBIL-V1:{öğretmen}:{adım}")            → ilk 4 bayt % 1 000 000
// Karekod kodu = HMAC-SHA256(tohum, "ETKILIT-MOBIL-QR-V1:{öğretmen}:{tahta}:{karekod}")
// Ayar kodu   = "ETK1-" + base64url(JSON {v, s, k, t, n, x})

export const STEP_SECS = 30;
export const SETUP_PREFIX = "ETK1-";

const enc = new TextEncoder();

async function hmac6(key, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const d = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
  const n = ((d[0] << 24) >>> 0) + (d[1] << 16) + (d[2] << 8) + d[3];
  return String(n % 1000000).padStart(6, "0");
}

export function codeForStep(seed, teacherId, step) {
  return hmac6(seed.trim().toUpperCase(), `ETKILIT-MOBIL-V1:${teacherId.trim()}:${step}`);
}

export async function currentCode(p, nowMs = Date.now()) {
  const secs = Math.floor(nowMs / 1000);
  return {
    code: await codeForStep(p.seed, p.teacherId, Math.floor(secs / STEP_SECS)),
    secondsLeft: STEP_SECS - (secs % STEP_SECS),
  };
}

export function qrCode(seed, teacherId, boardId, challenge) {
  return hmac6(seed.trim().toUpperCase(), `ETKILIT-MOBIL-QR-V1:${teacherId.trim()}:${boardId.trim()}:${challenge.trim()}`);
}

/** Tahtanın kilit ekranındaki karekod; ETKilit tahta karekodu değilse null */
export function parseBoardQr(raw) {
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j.board_id !== "string" || typeof j.challenge !== "string" || !j.challenge.trim()) return null;
    return {
      boardId: j.board_id.trim(),
      boardName: String(j.board_name ?? "").trim(),
      schoolName: String(j.school_name ?? "").trim(),
      challenge: j.challenge.trim(),
    };
  } catch {
    return null;
  }
}

export function pickProfileForBoard(profiles, qr, fallback) {
  const norm = (s) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
  const i = profiles.findIndex((p) => p.schoolName && norm(p.schoolName) === norm(qr.schoolName));
  return i >= 0 ? i : Math.min(Math.max(fallback, 0), profiles.length - 1);
}

function base64UrlToBytes(input) {
  const s = input.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  let bin;
  try {
    bin = atob(padded);
  } catch {
    throw new Error("Ayar kodu bozuk (geçersiz karakter)");
  }
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Yöneticinin verdiği ayar kodunu çözer (WhatsApp'ın eklediği boşluk/satır sonları yok sayılır). */
export function decodeSetupCode(raw) {
  const text = String(raw).trim();
  const start = text.indexOf(SETUP_PREFIX);
  if (start < 0) throw new Error("Ayar kodu ETK1- ile başlamalı");
  const body = text.slice(start + SETUP_PREFIX.length).replace(/\s+/g, "");
  let p;
  try {
    p = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)));
  } catch {
    throw new Error("Ayar kodu bozuk veya eksik kopyalanmış");
  }
  if (!p || typeof p.x !== "string" || !/^[0-9A-Fa-f]{64}$/.test(p.x) || !String(p.t ?? "").trim()) {
    throw new Error("Ayar kodu eksik");
  }
  return {
    schoolName: String(p.s ?? ""),
    schoolCode: String(p.k ?? ""),
    teacherId: String(p.t).trim(),
    teacherName: String(p.n ?? ""),
    seed: p.x.toUpperCase(),
    addedAt: Date.now(),
  };
}
