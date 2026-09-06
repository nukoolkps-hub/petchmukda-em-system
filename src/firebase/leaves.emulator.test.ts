/* ─── E2E: เส้นตาย "ยกเลิกใบลาเอง" บน firestore.rules จริง ────────────
   `canCancelLeave` ใน utils เป็น pure logic — เทสต์ตรงนั้นพิสูจน์ได้แค่ว่า
   "ปุ่มจะโชว์ไหม" · ชุดนี้ยิง rules จริงบน emulator เพื่อพิสูจน์ว่า **server
   ปฏิเสธจริง** แม้ client จะข้าม UI มา (แก้นาฬิกาเครื่อง · ยิง SDK ตรงๆ):
   1. `canSelfCancelLeave()` ใน rules compile ผ่าน — `bangkokTime().hours()`
      ใช้ได้จริง (ถ้าพังทั้งไฟล์ rules จะ deny ทุกอย่าง เทสต์ข้อ 1 จะแดง)
   2. ใบลาที่เริ่มไปแล้ว เจ้าของลบเองไม่ได้ · admin ยังลบให้ได้
   3. ใบลาของ "วันนี้" ตัดสินด้วยเวลาไทยฝั่ง server ตามชั่วโมงจริงตอนรัน
   4. ช่วงผ่อนผัน 10 นาที ผูกกับ `createdAtServer` (serverTimestamp) จริง และ
      **ปลอมไม่ได้** — client ที่ยัด timestamp อนาคตต้องถูกปฏิเสธตั้งแต่ตอนสร้าง
      (ถ้าปลอมได้ = ได้สิทธิ์ลบใบลาย้อนหลังไม่จำกัด เงินเดือนเพี้ยนได้)

   ต้องมี emulator รันอยู่ (`npm run emulators`) — ไม่มีก็ skip ทั้ง describe
   (CI ไม่ได้รัน emulator · deploy job จึงไม่พัง)                              */

import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithCustomToken,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  initializeFirestore,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_RULES } from "../constants";
import { addDaysYmd } from "../utils/dateUtils";

const PROJECT_ID = "demo-petchmukda-bot";
const DB_ID = "petchmukda-bot";
const HOST = "127.0.0.1";
const FIRESTORE_PORT = 8080;
const AUTH_PORT = 9099;
const EMP_ID = "emp-leave-cancel-test";
const LINE_UID = "Ucccccccccccccccccccccccccccccccc";
const EMP_NAME = "พนักงานทดสอบยกเลิกลา";

async function emulatorUp(): Promise<boolean> {
  const ping = async (port: number) => {
    try {
      return (await fetch(`http://${HOST}:${port}/`)).ok;
    } catch {
      return false;
    }
  };
  const [fs, auth] = await Promise.all([ping(FIRESTORE_PORT), ping(AUTH_PORT)]);
  return fs && auth;
}
const RUNNING = await emulatorUp();

/** custom token แบบ unsigned ที่ Auth emulator ยอมรับ (ดู advances.emulator.test.ts) */
function fakeCustomToken(
  uid: string,
  claims: Record<string, unknown> = {},
): string {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  return `${enc({ alg: "none", typ: "JWT" })}.${enc({
    iss: `firebase-auth-emulator@${PROJECT_ID}.iam.gserviceaccount.com`,
    sub: `firebase-auth-emulator@${PROJECT_ID}.iam.gserviceaccount.com`,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  })}.`;
}

/** "วันนี้" ตามเวลาไทย — ต้องตรงกับ bangkokToday() ใน rules (ไม่ใช่เวลาเครื่อง) */
function bangkokNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}
function bangkokTodayYmd(): string {
  const d = bangkokNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

describe.skipIf(!RUNNING)("E2E เส้นตายยกเลิกใบลา (firestore.rules)", () => {
  let empDb: ReturnType<typeof initializeFirestore>;
  let adminDb: ReturnType<typeof initializeFirestore>;
  let adminApp: ReturnType<typeof initializeApp>;

  beforeAll(async () => {
    process.env.FIRESTORE_EMULATOR_HOST = `${HOST}:${FIRESTORE_PORT}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `${HOST}:${AUTH_PORT}`;

    adminApp = initializeApp(
      { projectId: PROJECT_ID, apiKey: "fake-api-key" },
      "seed-leaves",
    );
    adminDb = initializeFirestore(adminApp, {}, DB_ID);
    connectFirestoreEmulator(adminDb, HOST, FIRESTORE_PORT);
    const seedAuth = getAuth(adminApp);
    connectAuthEmulator(seedAuth, `http://${HOST}:${AUTH_PORT}`, {
      disableWarnings: true,
    });
    await signInWithCustomToken(
      seedAuth,
      fakeCustomToken("admin-uid-leave-test", { admin: true }),
    );

    const cfg = await import("./config");
    empDb = cfg.db;
    await signInWithCustomToken(cfg.auth, fakeCustomToken(LINE_UID));

    await setDoc(doc(adminDb, "employees", EMP_ID), {
      name: EMP_NAME,
      lineUserId: LINE_UID,
      roleId: "r1",
      baseSalary: 15000,
    });
  }, 30_000);

  afterAll(async () => {
    await deleteDoc(doc(adminDb, "employees", EMP_ID)).catch(() => {});
    await deleteApp(adminApp).catch(() => {});
  });

  /** seed ใบลาด้วยสิทธิ์ admin แล้วคืน id (ผ่าน validLeaveCreate ของจริง) */
  async function seedLeave(id: string, start: string): Promise<string> {
    await setDoc(doc(adminDb, "leaves", id), {
      employeeId: EMP_ID,
      employeeName: EMP_NAME,
      type: "personal",
      start,
      end: start,
      days: 1,
      submitted: start,
      createdAt: Date.now(),
      createdByAdmin: true,
    });
    return id;
  }

  const deleteAsEmployee = (id: string) => deleteDoc(doc(empDb, "leaves", id));
  const deleteAsAdmin = (id: string) => deleteDoc(doc(adminDb, "leaves", id));

  it("ใบลาวันข้างหน้า — เจ้าของลบเองได้ (และพิสูจน์ว่า rules compile ผ่าน)", async () => {
    const id = await seedLeave("lv-future", addDaysYmd(bangkokTodayYmd(), 3));
    await expect(deleteAsEmployee(id)).resolves.toBeUndefined();
  });

  it("ใบลาที่เริ่มไปแล้ว — เจ้าของลบเองไม่ได้", async () => {
    const id = await seedLeave("lv-past", addDaysYmd(bangkokTodayYmd(), -1));
    await expect(deleteAsEmployee(id)).rejects.toThrow(
      /permission|insufficient/i,
    );
    // admin ไม่ติดเส้นตาย — ลบให้ได้ (เก็บกวาดด้วยในตัว)
    await expect(deleteAsAdmin(id)).resolves.toBeUndefined();
  });

  it("ช่วงผ่อนผัน — ใบที่เพิ่งยื่นเอง (createdAtServer สดๆ) ลบได้แม้เลยเส้นตาย", async () => {
    // ยิงผ่าน addLeave ของจริง → createdAtServer = serverTimestamp()
    const { addLeave } = await import("./leaves");
    const id = await addLeave({
      employeeId: EMP_ID,
      employeeName: EMP_NAME,
      type: "personal",
      start: bangkokTodayYmd(),
      end: bangkokTodayYmd(),
      days: 1,
    });
    // ลบทันที — ต้องผ่านไม่ว่าตอนนี้จะเลย 09:00 หรือยัง
    await expect(deleteAsEmployee(id)).resolves.toBeUndefined();
  });

  it("ปลอม createdAtServer เป็นอนาคตไม่ได้ — rules ปฏิเสธตั้งแต่ตอนสร้าง", async () => {
    // ถ้าปลอมได้ = เปิดช่วงผ่อนผันไว้ล่วงหน้า แล้วลบใบลาย้อนหลังทีหลัง
    const forged = setDoc(doc(empDb, "leaves", "lv-forged"), {
      employeeId: EMP_ID,
      employeeName: EMP_NAME,
      type: "personal",
      start: addDaysYmd(bangkokTodayYmd(), 5),
      end: addDaysYmd(bangkokTodayYmd(), 5),
      days: 1,
      createdAt: Date.now(),
      createdAtServer: Timestamp.fromMillis(Date.now() + 86_400_000),
    });
    await expect(forged).rejects.toThrow(/permission|insufficient/i);
  });

  it(`ใบลาของวันนี้ — ตัดที่ ${BUSINESS_RULES.LEAVE_CANCEL_CUTOFF_HOUR}:00 เวลาไทย (server เป็นคนตัดสิน)`, async () => {
    const id = await seedLeave("lv-today", bangkokTodayYmd());
    // ชั่วโมงไทย "ตอนรันเทสต์" คือตัวกำหนดผลลัพธ์ที่ rules ต้องให้
    const bkkHour = bangkokNow().getUTCHours();
    const shouldAllow = bkkHour < BUSINESS_RULES.LEAVE_CANCEL_CUTOFF_HOUR;
    if (shouldAllow) {
      await expect(deleteAsEmployee(id)).resolves.toBeUndefined();
    } else {
      await expect(deleteAsEmployee(id)).rejects.toThrow(
        /permission|insufficient/i,
      );
      await deleteAsAdmin(id);
    }
  });
});
