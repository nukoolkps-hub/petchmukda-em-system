/* ─── เก็บ/ตรวจ state ของ LINE Login ฝั่ง client ─────────────────────
   **ตัวตัดสินจริงอยู่ฝั่ง server** — `lineAuth` consume `loginStates/{state}`
   ใน Firestore transaction (single-use + TTL 10 นาที) · ฝั่ง client เป็นแค่
   defense-in-depth ชั้นที่สอง

   ทำไมต้องมีไฟล์นี้ (บั๊กที่เจอจริง): พนักงานกดพิมพ์ใบรับรองในมือถือ →
   LINE webview พิมพ์ไม่ได้ ระบบเลยเด้งไปเปิดในเบราว์เซอร์จริง → ที่นั่นยังไม่ได้
   login → กด LINE Login → **กลับมาคนละ tab/บริบท** → `sessionStorage` ว่าง →
   เทียบ state ไม่ผ่าน ขึ้น "State mismatch" ทั้งที่ไม่มีใครปลอมแปลง พิมพ์ไม่ได้เลย

   แก้ 2 อย่าง:
   1. เก็บใน `localStorage` (ข้าม tab ได้ ต่างจาก sessionStorage) + หมดอายุเอง
   2. "ไม่เจอ state ที่เก็บไว้" ≠ "state ไม่ตรง" — อย่างแรกคือบริบทหาย (ปล่อยให้
      server ตัดสิน) · อย่างหลังคือสัญญาณโจมตีจริง (บล็อก)                    */

const KEY = "line_login_state";
/** ให้ตรงกับ TTL ฝั่ง server (prepareLineLogin) — เก่ากว่านี้ถือว่าใช้ไม่ได้ */
export const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;

export type StateCheck =
  | { ok: true; reason: "matched" | "no-saved-state" }
  | { ok: false; reason: "mismatch" };

interface Stored {
  state: string;
  savedAt: number;
}

function parse(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (typeof parsed?.state !== "string" || !parsed.state) return null;
    if (typeof parsed?.savedAt !== "number") return null;
    return { state: parsed.state, savedAt: parsed.savedAt };
  } catch {
    // ค่าเก่าก่อนเปลี่ยน format (string ดิบ) — ยังอ่านได้ ไม่ทำให้ login พัง
    return { state: raw, savedAt: Date.now() };
  }
}

/** อ่าน state ที่เก็บไว้ · หมดอายุแล้ว/ไม่มี → null */
export function readSavedState(
  raw: string | null,
  now: number = Date.now(),
): string | null {
  const stored = parse(raw);
  if (!stored) return null;
  if (now - stored.savedAt > LOGIN_STATE_TTL_MS) return null;
  return stored.state;
}

/** ค่าที่จะเขียนลง storage */
export function serializeState(
  state: string,
  now: number = Date.now(),
): string {
  return JSON.stringify({ state, savedAt: now } satisfies Stored);
}

/** state ที่ LINE ส่งกลับมา ผ่านการตรวจฝั่ง client ไหม
 *
 *  - เจอที่เก็บไว้และตรง → ผ่าน
 *  - **ไม่เจอเลย** → ผ่าน (บริบทหาย เช่น เด้งข้ามเบราว์เซอร์) แล้วให้ server
 *    เป็นคนตัดสิน · การบล็อกตรงนี้ = ผู้ใช้ที่สุจริตใช้งานไม่ได้ ทั้งที่
 *    server ยังกัน CSRF ได้เต็มที่อยู่แล้ว
 *  - เจอแต่ไม่ตรง → บล็อก (อันนี้คือสัญญาณผิดปกติจริง)                     */
export function checkReturnedState(
  returned: string | null,
  saved: string | null,
): StateCheck {
  if (!saved) return { ok: true, reason: "no-saved-state" };
  if (returned && returned === saved) return { ok: true, reason: "matched" };
  return { ok: false, reason: "mismatch" };
}

/* ─── ตัวห่อ storage — กัน Safari private mode ที่ throw ตอนเขียน ── */

export function saveLoginState(state: string): void {
  try {
    localStorage.setItem(KEY, serializeState(state));
  } catch {
    /* เขียนไม่ได้ → ข้ามไป · server ยังตรวจให้อยู่ */
  }
}

export function takeLoginState(): string | null {
  try {
    const saved = readSavedState(localStorage.getItem(KEY));
    localStorage.removeItem(KEY);
    // ล้างของเก่าที่เคยเก็บใน sessionStorage (ก่อนย้ายมา localStorage)
    sessionStorage.removeItem(KEY);
    return saved;
  } catch {
    return null;
  }
}
