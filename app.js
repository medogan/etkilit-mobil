// ETKilit Mobil — web sürümü (iPhone ve tarayıcılar için; Android'de APK önerilir)
// Anahtarlar yalnızca bu telefonda (tarayıcı depolaması) tutulur; hiçbir sunucuya gönderilmez.
import {
  STEP_SECS,
  currentCode,
  decodeSetupCode,
  parseBoardQr,
  pickProfileForBoard,
  qrCode,
} from "./crypto.js";

const VERSION = "web-1.0";
const KEY = "etkilit.mobil.profiller";
const app = document.getElementById("app");
const titleEl = document.getElementById("title");
const backBtn = document.getElementById("back");
const settingsBtn = document.getElementById("toSettings");
const barLogo = document.getElementById("barLogo");
const noticeEl = document.getElementById("notice");

let profiles = load();
let active = 0;
let screen = "home";
let boardQr = null;
let timer = null;
let stopScanner = null;

// ---------------------------------------------------------------- depolama
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(profiles));
}
// Tarayıcıdan verilerin silinmemesini iste (Ana Ekrana eklenince iOS zaten korur)
navigator.storage?.persist?.().catch(() => {});

// ---------------------------------------------------------------- yardımcılar
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (c) => `${c.slice(0, 3)} ${c.slice(3)}`;

function flash(ok, text) {
  noticeEl.textContent = text;
  noticeEl.className = "notice " + (ok ? "ok" : "err");
  noticeEl.hidden = false;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => (noticeEl.hidden = true), 4000);
}

function go(next) {
  if (stopScanner) {
    stopScanner();
    stopScanner = null;
  }
  clearInterval(timer);
  timer = null;
  screen = next;
  render();
}

function addFromCode(raw) {
  try {
    const p = decodeSetupCode(raw);
    profiles = profiles.filter((x) => !(x.teacherId === p.teacherId && x.schoolCode === p.schoolCode && x.schoolName === p.schoolName));
    profiles.push(p);
    save();
    active = profiles.length - 1;
    flash(true, `${p.teacherName} (${p.schoolName || "okul"}) tanımlandı.`);
    go("home");
    return true;
  } catch (e) {
    flash(false, e?.message ?? "Ayar kodu okunamadı");
    return false;
  }
}

// ---------------------------------------------------------------- ekranlar
const TITLES = { home: "ETKilit Mobil", add: "Ayar Kodu", scan: "Ayar Karekodu", boardscan: "Tahta Karekodu", qrcode: "Kilit Açma Kodu", settings: "Ayarlar" };

function render() {
  titleEl.textContent = TITLES[screen];
  backBtn.hidden = screen === "home";
  settingsBtn.hidden = screen !== "home";
  barLogo.hidden = screen !== "home";
  ({ home, add, scan: () => scanner("setup"), boardscan: () => scanner("board"), qrcode: qrScreen, settings })[screen]();
}

function home() {
  if (profiles.length === 0) {
    app.innerHTML = `
      <section class="welcome">
        <img src="icons/icon-512.png" alt="" class="welcome-logo" />
        <h1>ETKilit Mobil</h1>
        <p>Akıllı tahtanın kilidini telefonunuzla açın</p>
      </section>
      <section class="card">
        <h2>Nasıl kullanılır?</h2>
        <ol class="steps">
          <li>Okulunuzun BT sorumlusundan <b>Ayar Kodu</b> isteyin ve aşağıdan ekleyin (bir kez).</li>
          <li>Tahtada <b>Kilidi Aç</b>'a dokunun.</li>
          <li>Tahtadaki karekodu bu uygulamayla okutun, çıkan 6 haneli kodu tahtaya yazın.</li>
        </ol>
        <p class="muted">İnternet ya da okul ağı gerekmez.</p>
        <button class="primary" data-go="add">Ayar Kodu Yapıştır</button>
        <button class="secondary" data-go="scan">Ayar Karekodunu Okut</button>
      </section>`;
    return;
  }
  active = Math.min(active, profiles.length - 1);
  const p = profiles[active];
  const chips =
    profiles.length > 1
      ? `<div class="chips">${profiles
          .map((x, i) => `<button class="chip${i === active ? " on" : ""}" data-chip="${i}">${esc(x.schoolName || x.schoolCode || "Okul")}</button>`)
          .join("")}</div>`
      : "";
  app.innerHTML = `
    ${chips}
    <button class="primary big" data-go="boardscan">
      <span class="big-t">Tahtadaki Karekodu Okut</span>
      <span class="big-s">Kilidi Aç'a dokunun, çıkan karekodu okutun</span>
    </button>
    <p class="section">veya 30 saniyelik kodu yazın</p>
    <section class="code-card">
      <div class="school">${esc(p.schoolName || "Okul")}</div>
      <div class="teacher">${esc(p.teacherName)} · kod ${esc(p.teacherId)}</div>
      <div class="code" id="code">— — —</div>
      <div class="track"><div class="fill" id="fill"></div></div>
      <div class="muted" id="left"></div>
    </section>
    <section class="card">
      <p>Karekod kodu yalnızca o tahtada ve bir kez geçer; 30 saniyelik kod her tahtada çalışır. İkisi de internet gerektirmez.</p>
      <p class="muted">Kod kabul edilmezse telefonun saatinin "otomatik" ayarlı olduğundan emin olun.</p>
    </section>`;
  const tick = async () => {
    const { code, secondsLeft } = await currentCode(p);
    const codeEl = document.getElementById("code");
    if (!codeEl) return;
    codeEl.textContent = fmt(code);
    codeEl.setAttribute("aria-label", "Kilit açma kodu " + code.split("").join(" "));
    const fill = document.getElementById("fill");
    fill.style.width = `${(secondsLeft / STEP_SECS) * 100}%`;
    fill.classList.toggle("warn", secondsLeft <= 5);
    document.getElementById("left").textContent = `${secondsLeft} sn sonra yenilenir`;
  };
  tick();
  timer = setInterval(tick, 500);
}

function add() {
  app.innerHTML = `
    <section class="card">
      <p>Size gönderilen ayar kodunu (<b>ETK1-</b>… ile başlar) aşağıya yapıştırın.</p>
      <textarea id="code" placeholder="ETK1-…" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
      <button class="secondary" id="paste">Panodan Yapıştır</button>
      <button class="primary" id="save">Kaydet</button>
      <button class="link" data-go="scan">veya karekod okut</button>
    </section>`;
  const ta = document.getElementById("code");
  document.getElementById("paste").onclick = async () => {
    try {
      ta.value = await navigator.clipboard.readText();
    } catch {
      flash(false, "Pano okunamadı; kodu kutuya uzun basıp yapıştırın.");
    }
  };
  document.getElementById("save").onclick = () => ta.value.trim() && addFromCode(ta.value);
}

function scanner(mode) {
  app.innerHTML = `
    <div class="scan">
      <video id="video" playsinline muted autoplay></video>
      <div class="frame"></div>
      <div class="scan-hint" id="hint">${
        mode === "board" ? "Tahtada Kilidi Aç'a dokunun ve çıkan karekodu çerçeveye alın" : "Yönetici ekranındaki ayar karekodunu çerçeveye alın"
      }</div>
    </div>`;
  const video = document.getElementById("video");
  const hint = document.getElementById("hint");
  let stream = null;
  let stopped = false;
  stopScanner = () => {
    stopped = true;
    stream?.getTracks().forEach((t) => t.stop());
  };
  const onData = (data) => {
    const qr = parseBoardQr(data);
    if (qr) {
      if (!profiles.length) {
        hint.textContent = "Önce Ayar Kodunuzu ekleyin";
        return false;
      }
      active = pickProfileForBoard(profiles, qr, active);
      boardQr = qr;
      go("qrcode");
      return true;
    }
    if (data.includes("ETK1-")) return addFromCode(data);
    hint.textContent = "Bu bir ETKilit karekodu değil";
    return false;
  };
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch {
      hint.textContent = "Kameraya erişilemedi. Ayarlar → Safari (veya tarayıcı) → Kamera iznini açın.";
      return;
    }
    if (stopped) return stopScanner();
    video.srcObject = stream;
    await video.play().catch(() => {});
    const decode = await makeDecoder();
    if (!decode) {
      hint.textContent = "Karekod okuyucu yüklenemedi; sayfayı internet varken bir kez açın.";
      return;
    }
    const loop = async () => {
      if (stopped) return;
      if (video.readyState >= 2) {
        const data = await decode(video);
        if (data && onData(data)) return;
      }
      setTimeout(loop, 200);
    };
    loop();
  })();
}

/** Tarayıcının karekod okuyucusu (Android Chrome) yoksa jsQR (iPhone) */
async function makeDecoder() {
  if ("BarcodeDetector" in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) {
        const det = new window.BarcodeDetector({ formats: ["qr_code"] });
        return async (video) => (await det.detect(video).catch(() => []))[0]?.rawValue ?? null;
      }
    } catch {
      /* jsQR'a düş */
    }
  }
  if (!window.jsQR) {
    await new Promise((res) => {
      const s = document.createElement("script");
      s.src = "vendor/jsQR.js";
      s.onload = res;
      s.onerror = res;
      document.head.appendChild(s);
    });
  }
  if (!window.jsQR) return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 720 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

async function qrScreen() {
  const p = profiles[Math.min(active, profiles.length - 1)];
  const code = await qrCode(p.seed, p.teacherId, boardQr.boardId, boardQr.challenge);
  app.innerHTML = `
    <section class="code-card">
      <div class="school">${esc(boardQr.boardName || boardQr.boardId)}</div>
      <div class="teacher">${esc(p.teacherName)} · ${esc(boardQr.schoolName || p.schoolName)}</div>
      <div class="code" aria-label="Kilit açma kodu ${code.split("").join(" ")}">${fmt(code)}</div>
      <div class="muted">Bu kodu tahtanın tuş takımına yazın</div>
    </section>
    <section class="card">
      <p>Kod yalnızca <b>bu tahtada</b> ve şu an ekrandaki karekod için geçerlidir; kullanıldıktan sonra tahta yeni karekod gösterir.
      Tahtada "Yenile"ye basıldıysa karekodu yeniden okutun.</p>
    </section>
    <button class="secondary" data-go="boardscan">Yeniden Okut</button>
    <button class="link" data-go="home">Tamam</button>`;
}

function settings() {
  const rows = profiles
    .map(
      (p, i) => `
      <div class="row">
        <div class="grow"><b>${esc(p.teacherName)}</b> <span class="muted">(kod ${esc(p.teacherId)})</span>
          <div class="muted">${esc(p.schoolName)}${p.schoolCode ? " · " + esc(p.schoolCode) : ""}</div></div>
        <button class="danger" data-del="${i}">Sil</button>
      </div>`
    )
    .join("");
  app.innerHTML = `
    <section class="card">
      <h2>Anahtarlarım</h2>
      ${rows || '<p class="muted">Henüz anahtar yok.</p>'}
      <button class="secondary" data-go="add">+ Ayar Kodu Ekle</button>
    </section>
    <section class="card">
      <p class="muted">Anahtarınız yalnızca bu telefonda saklanır. Ana ekrandaki simgeyi silerseniz veya tarayıcı verilerini temizlerseniz
      Ayar Kodunu yeniden eklemeniz gerekir.</p>
      <p class="muted">Telefonunuzu kaybederseniz okulunuzun BT sorumlusuna bildirin; anahtarınız karalisteye alınır.</p>
    </section>
    <div class="about"><img src="icons/icon-192.png" alt="" /><span class="muted">ETKilit Mobil · ${VERSION}</span></div>`;
}

// ---------------------------------------------------------------- olaylar
app.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-chip],[data-del]");
  if (!t) return;
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.chip) {
    active = Number(t.dataset.chip);
    return go("home");
  }
  if (t.dataset.del) {
    const i = Number(t.dataset.del);
    const p = profiles[i];
    if (confirm(`${p.teacherName} — ${p.schoolName} bu telefondan silinsin mi?`)) {
      profiles.splice(i, 1);
      save();
      active = 0;
      go("settings");
    }
  }
});
backBtn.onclick = () => go("home");
settingsBtn.onclick = () => go("settings");

// iPhone'da Ana Ekrana ekleme ipucu (eklenmezse Safari verileri silebilir)
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (isIOS && !standalone) {
  const el = document.getElementById("installHint");
  el.innerHTML = "📲 Kalıcı kullanım için: Safari'de <b>Paylaş</b> → <b>Ana Ekrana Ekle</b>. Böylece anahtarınız silinmez ve uygulama gibi açılır.";
  el.hidden = false;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
