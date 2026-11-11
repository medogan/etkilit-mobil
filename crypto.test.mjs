// Çalıştırma: node crypto.test.mjs  (Rust ve mobil uygulamayla aynı vektörler)
import { codeForStep, currentCode, decodeSetupCode, parseBoardQr, pickProfileForBoard, qrCode } from "./crypto.js";

let failures = 0;
const check = (name, cond) => {
  if (!cond) { failures++; console.error("FAIL", name); } else console.log("ok  ", name);
};

const seed = "00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF";
check("vektör 101", (await codeForStep(seed, "101", 59_000_000)) === "645531");
check("vektör 904", (await codeForStep(seed.toLowerCase(), " 904 ", 59_999_999)) === "341022");
const c = await currentCode({ seed, teacherId: "101" }, 59_000_000 * 30 * 1000 + 5000);
check("currentCode", c.code === "645531" && c.secondsLeft === 25);
check("karekod vektörü", (await qrCode(seed, "101", "ETAP-10A", "EE2E832A")) === "284726");

const code = "ETK1-eyJ2IjoxLCJzIjoiRHIuIEF5xZ9lIEjDvG1leXJhIMOWS1RFTiBLQcSwSEwiLCJrIjoiNzY3NjExIiwidCI6IjkwNCIsIm4iOiLDlsSfcmV0bWVuIMOHYcSfcsSxIiwieCI6IjAwMTEyMjMzNDQ1NTY2Nzc4ODk5QUFCQkNDRERFRUZGMDAxMTIyMzM0NDU1NjY3Nzg4OTlBQUJCQ0NEREVFRkYifQ";
const p = decodeSetupCode(code);
check("ayar kodu", p.schoolName === "Dr. Ayşe Hümeyra ÖKTEN KAİHL" && p.teacherName === "Öğretmen Çağrı" && p.teacherId === "904" && p.seed === seed);
check("bölünmüş ayar kodu", decodeSetupCode("Kodunuz:\n" + code.slice(0, 50) + "\n" + code.slice(50)).seed === seed);
let threw = false;
try { decodeSetupCode("ETK1-abc"); } catch { threw = true; }
check("bozuk kod reddedilir", threw);

const qr = parseBoardQr(JSON.stringify({ v: 1, board_id: "ETAP-10A", board_name: "Dil Sınıfı", school_name: "Okul", challenge: "EE2E832A" }));
check("tahta karekodu", qr && qr.boardId === "ETAP-10A");
check("başka karekod", parseBoardQr("https://eba.gov.tr") === null && parseBoardQr(code) === null);
check("profil seçimi", pickProfileForBoard([{ schoolName: "A" }, { schoolName: "okul" }], qr, 0) === 1);

if (failures) { console.error(`${failures} hata`); process.exit(1); }
console.log("Tüm web anahtar testleri geçti.");
