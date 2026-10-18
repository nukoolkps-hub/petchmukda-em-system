/* ─── Progress ของหน้า loading ตอน boot — logic ล้วน ────────────────────
   ไม่มี progress จริง (Firebase ไม่บอกว่าไปถึงไหน) → เป็นเส้นโค้งที่ค่อยๆ
   เข้าใกล้ 99% · **คิดจาก "เวลาที่ผ่านไป" ไม่ใช่สะสมทีละ tick** เพราะ

   1. **ต่อเนื่องข้ามจอ** — boot มี `BootLoadingScreen` 2 ตัวต่อกัน
      (AuthGate "กำลังเข้าสู่ระบบ..." → App "เชื่อมต่อ Firebase...") แต่ละตัว
      เป็น instance ใหม่ ถ้าเก็บ % ไว้ใน state ของตัวเอง bar จะวิ่งไป ~70%
      แล้ว**เด้งกลับ 5%** เริ่มใหม่ — ตัวนี้คืออาการ "กระตุก" หลัก
   2. **ไม่ขึ้นกับ main thread** — ตอน boot JS ทำงานหนัก (parse chunk หลัก +
      init Firebase) timer ถูกเลื่อน · สะสมทีละ tick = bar หยุดแล้วกระโดด ·
      ฝั่ง UI จึงให้ CSS animation (compositor thread) วาด bar ตามเส้นโค้งนี้
      แล้วใช้ `animation-delay` ติดลบเพื่อเริ่มจากจุดที่ทำไว้แล้ว           */

/** % ตอนเริ่ม — กัน flash ที่ 0% และให้เห็นทันทีว่า "เริ่มแล้ว" */
export const BOOT_PROGRESS_START = 5;

/** phase 1: 5% → 95% เร็ว (time constant ≈ 1.3 วิ · เท่าของเดิมที่ +6%/80ms) */
const FAST_TAU_MS = 1290;
/** phase 2: คลานจาก 94% → 99% ช้าๆ (กัน "ค้างที่ 95%") */
const SLOW_TAU_MS = 7960;
/** จุดต่อของ 2 phase = เวลาที่ phase 1 ถึง 94% (เส้นโค้งต่อกันสนิท) */
const PHASE_SWITCH_MS = FAST_TAU_MS * Math.log(90);

/** ความยาว animation ของ bar — หลังจากนี้ค้างไว้ที่ ~99% */
export const BOOT_ANIMATION_MS = 60_000;

/** % ณ เวลาที่ผ่านไป (ms) · เพิ่มขึ้นเสมอ · ไม่เกิน 99 */
export function bootProgressAt(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  if (t <= PHASE_SWITCH_MS) {
    return 95 - (95 - BOOT_PROGRESS_START) * Math.exp(-t / FAST_TAU_MS);
  }
  return 99 - 5 * Math.exp(-(t - PHASE_SWITCH_MS) / SLOW_TAU_MS);
}

/** keyframes ของ bar (scaleX) สร้างจาก `bootProgressAt` ตัวเดียวกับตัวเลข %
 *  → ตัวเลขกับ bar ไม่มีทางวิ่งคนละจังหวะ · ช่วงแรกที่โค้งชันวางจุดถี่ */
export function bootKeyframesCss(name: string): string {
  const times: number[] = [];
  for (let t = 0; t < 6000; t += 200) times.push(t);
  for (let t = 6000; t < 20_000; t += 1000) times.push(t);
  for (let t = 20_000; t <= BOOT_ANIMATION_MS; t += 5000) times.push(t);
  const stops = times.map((t) => {
    const at = ((t / BOOT_ANIMATION_MS) * 100).toFixed(3);
    const scale = (bootProgressAt(t) / 100).toFixed(4);
    return `${at}%{transform:scaleX(${scale})}`;
  });
  return `@keyframes ${name}{${stops.join("")}}`;
}

/** นาฬิกากลางของ boot — จอ loading ทุกตัวอ่านเวลาเริ่มจากที่เดียวกัน */
export interface BootClock {
  startedAt: number | null;
  /** จำนวนจอ loading ที่ mount อยู่ */
  active: number;
  /** เวลาที่จอ loading ตัวสุดท้าย unmount */
  lastEndedAt: number | null;
}

export function createBootClock(): BootClock {
  return { startedAt: null, active: 0, lastEndedAt: null };
}

/** จอ loading ตัวใหม่ที่ขึ้นภายในเวลานี้หลังตัวก่อนหายไป = "ต่อจากเดิม"
 *  (AuthGate → App สลับกันใน commit เดียว ห่างกัน ~0ms) · ห่างกว่านี้ =
 *  การโหลดรอบใหม่จริง (เช่น ออกจากระบบแล้วเข้าใหม่) ต้องเริ่มที่ 5% */
export const BOOT_HANDOFF_MS = 1000;

/** เวลาเริ่มที่จอ loading ตัวที่กำลังจะขึ้นควรใช้ — **ไม่แก้ clock**
 *  (เรียกตอน render ได้ · ตอน render จอตัวเก่ายังไม่ unmount จึงนับว่าต่อกัน) */
export function peekBootStart(clock: BootClock, now: number): number {
  const continuing =
    clock.startedAt !== null &&
    (clock.active > 0 ||
      (clock.lastEndedAt !== null &&
        now - clock.lastEndedAt <= BOOT_HANDOFF_MS));
  return continuing ? (clock.startedAt as number) : now;
}

/** จอ loading mount → คืนเวลาเริ่มที่ใช้ (ต่อจากเดิม หรือเริ่มใหม่) */
export function claimBootClock(clock: BootClock, now: number): number {
  clock.startedAt = peekBootStart(clock, now);
  clock.active += 1;
  return clock.startedAt;
}

/** จอ loading unmount */
export function releaseBootClock(clock: BootClock, now: number): void {
  clock.active = Math.max(0, clock.active - 1);
  if (clock.active === 0) clock.lastEndedAt = now;
}
