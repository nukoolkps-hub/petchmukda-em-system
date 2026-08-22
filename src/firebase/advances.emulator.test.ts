/* ─── E2E: โควต้าเบิกล่วงหน้า บน Firestore emulator จริง ──────────────
   เทสต์ชุดอื่นเป็น pure logic — ชุดนี้ยิงโค้ด production ทั้งเส้น:
   `submitAdvance()` → query จริง → firestore.rules จริง → addDoc จริง
   เพื่อพิสูจน์สิ่งที่เทสต์ pure ตอบไม่ได้:
   1. query ที่ใช้เช็คโควต้าอ่านได้จริงภายใต้ rules (ไม่ permission-denied)
   2. ยื่นเกินโควต้า/เกินวงเงินถูกบล็อกจริง แม้ client ไม่มี state ในมือเลย
   3. rules ยอม/ไม่ยอมให้ใครเขียนอะไร (auto-carry ของ admin · พนักงานสวมรอย)
   ⚠️ ไม่ครอบเรื่อง composite index — emulator ไม่บังคับ index เหมือน
      production · เพิ่ม orderBy ในภายหลังจะผ่านที่นี่แต่ FAILED_PRECONDITION
      ของจริง → ถ้าแตะ query ต้องเช็ค firestore.indexes.json ด้วยตาเอง

   ต้องมี emulator รันอยู่ (`npm run emulators`) — ไม่มีก็ skip ทั้ง describe
   (CI ไม่ได้รัน emulator · deploy job จึงไม่พัง)                              */

import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithCustomToken,
} from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDocs,
  initializeFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BUSINESS_RULES } from "../constants";

const PROJECT_ID = "demo-petchmukda-bot";
const DB_ID = "petchmukda-bot";
const FIRESTORE_HOST = "127.0.0.1";
const FIRESTORE_PORT = 8080;
const AUTH_PORT = 9099;
const EMP_ID = "emp-quota-test";
const LINE_UID = "Ueeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const YM = "2026-08";

/** ต้องมีทั้ง Firestore + Auth (beforeAll sign-in ด้วย custom token) —
 *  เช็คทั้ง 2 พอร์ต ไม่งั้นรัน `--only firestore` จะพังแทนที่จะ skip */
async function emulatorUp(): Promise<boolean> {
  const ping = async (port: number) => {
    try {
      return (await fetch(`http://${FIRESTORE_HOST}:${port}/`)).ok;
    } catch {
      return false;
    }
  };
  const [fs, auth] = await Promise.all([ping(FIRESTORE_PORT), ping(AUTH_PORT)]);
  return fs && auth;
}
const RUNNING = await emulatorUp();

/** REST ของ Auth emulator — ออก custom token ไม่ได้ ใช้ signUp แบบ idToken ไม่ตรง
 *  uid ที่ต้องการ · emulator ยอมรับ custom token ที่ "ไม่ได้เซ็น" (alg=none
 *  แบบ unsigned) ตามสเปกของ Firebase Auth emulator                          */
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

describe.skipIf(!RUNNING)("E2E โควต้าเบิกล่วงหน้า (Firestore emulator)", () => {
  let advancesAPI: typeof import("./advances");
  let db: ReturnType<typeof initializeFirestore>;
  let adminDb: ReturnType<typeof initializeFirestore>;
  let adminApp: ReturnType<typeof initializeApp>;

  beforeAll(async () => {
    process.env.FIRESTORE_EMULATOR_HOST = `${FIRESTORE_HOST}:${FIRESTORE_PORT}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `${FIRESTORE_HOST}:${AUTH_PORT}`;

    // แอป "แอดมิน" (มี custom claim admin) — ใช้ seed/ล้างข้อมูลตาม rules
    adminApp = initializeApp(
      { projectId: PROJECT_ID, apiKey: "fake-api-key" },
      "seed",
    );
    adminDb = initializeFirestore(adminApp, {}, DB_ID);
    connectFirestoreEmulator(adminDb, FIRESTORE_HOST, FIRESTORE_PORT);
    const seedAuth = getAuth(adminApp);
    connectAuthEmulator(seedAuth, `http://${FIRESTORE_HOST}:${AUTH_PORT}`, {
      disableWarnings: true,
    });
    await signInWithCustomToken(
      seedAuth,
      fakeCustomToken("admin-uid-test", { admin: true }),
    );

    // แอปของ "พนักงาน" = ตัว config จริงของโปรเจกต์ (src/firebase/config.ts
    // ต่อ emulator ให้เองตอน DEV) → advancesAPI ที่ import มาคือของจริง
    advancesAPI = await import("./advances");
    const cfg = await import("./config");
    db = cfg.db;
    await signInWithCustomToken(cfg.auth, fakeCustomToken(LINE_UID));

    // employee doc ต้องมีจริง — rules ใช้ lineUserId เทียบ auth.uid
    await setDoc(doc(adminDb, "employees", EMP_ID), {
      name: "พนักงานทดสอบ",
      lineUserId: LINE_UID,
      roleId: "r1",
      baseSalary: 15000,
    });
  }, 30_000);

  afterAll(async () => {
    await deleteDoc(doc(adminDb, "employees", EMP_ID)).catch(() => {});
    await deleteApp(adminApp).catch(() => {});
  });

  async function clearAdvances() {
    const snap = await getDocs(
      query(
        collection(adminDb, "advances"),
        where("employeeId", "==", EMP_ID),
        where("month", "==", YM),
      ),
    );
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  /** รูปทรง auto-carry ที่ `createAutoCarryAdvance()` เขียนจริง */
  const autoCarryDoc = (month = YM) => {
    const now = new Date().toISOString();
    return {
      employeeId: EMP_ID,
      employeeName: "พนักงานทดสอบ",
      amount: 2000,
      reason: "ยกจากเงินสุทธิติดลบเดือน 2026-07",
      month,
      status: "approved",
      submittedAt: now,
      approvedAt: now,
      autoCarryFromMonth: "2026-07",
    };
  };

  const newRequest = (amount: number) => ({
    employeeId: EMP_ID,
    employeeName: "พนักงานทดสอบ",
    amount,
    reason: "ทดสอบ",
    month: YM,
  });

  beforeEach(clearAdvances);

  it(`ยื่นได้ครบ ${BUSINESS_RULES.ADVANCE_MAX_PER_MONTH} ครั้ง แล้วครั้งถัดไปถูกบล็อก`, async () => {
    const limit = BUSINESS_RULES.ADVANCE_MAX_PER_MONTH;
    for (let i = 1; i <= limit; i++) {
      const id = await advancesAPI.submitAdvance(newRequest(500 * i));
      expect(id).toBeTruthy();
    }
    await expect(advancesAPI.submitAdvance(newRequest(100))).rejects.toThrow(
      `เบิกได้เดือนละ ${limit} ครั้ง — เดือนนี้ยื่นครบแล้ว (${limit}/${limit})`,
    );
    // ต้องไม่มี doc เกินโควต้าหลุดลง Firestore
    const all = await advancesAPI.getAdvancesByEmployeeAndMonth(EMP_ID, YM);
    expect(all).toHaveLength(limit);
  }, 30_000);

  it("อนุมัติแล้วก็ยังนับโควต้า (เคสที่หลุดจริงตอนกฎเป็น 1 ครั้ง/เดือน)", async () => {
    const limit = BUSINESS_RULES.ADVANCE_MAX_PER_MONTH;
    const ids: string[] = [];
    for (let i = 0; i < limit; i++) {
      ids.push(await advancesAPI.submitAdvance(newRequest(1000)));
    }
    // admin อนุมัติทุกใบ (เลียนแบบเคสจริง: อนุมัติ+โอนแล้ว)
    await Promise.all(
      ids.map((id) =>
        updateDoc(doc(adminDb, "advances", id), {
          status: "approved",
          approvedAt: new Date().toISOString(),
        }),
      ),
    );
    await expect(advancesAPI.submitAdvance(newRequest(500))).rejects.toThrow(
      /ยื่นครบแล้ว/,
    );
  }, 30_000);

  it("ADMIN ปฏิเสธ 1 ใบ → คืนสิทธิ์ให้ยื่นใหม่ได้ในเดือนเดียวกัน", async () => {
    const limit = BUSINESS_RULES.ADVANCE_MAX_PER_MONTH;
    const ids: string[] = [];
    for (let i = 0; i < limit; i++) {
      ids.push(await advancesAPI.submitAdvance(newRequest(1000)));
    }
    await expect(advancesAPI.submitAdvance(newRequest(500))).rejects.toThrow();

    await updateDoc(doc(adminDb, "advances", ids[0]), {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      rejectionReason: "ทดสอบ",
    });
    // ปฏิเสธแล้วไม่นับโควต้า → ยื่นใหม่ผ่าน
    await expect(
      advancesAPI.submitAdvance(newRequest(500)),
    ).resolves.toBeTruthy();
  }, 30_000);

  it("ยอดยกมาอัตโนมัติ (auto-carry) ไม่กินโควต้าครั้ง", async () => {
    const limit = BUSINESS_RULES.ADVANCE_MAX_PER_MONTH;
    // ระบบสร้าง auto-carry ให้ (ADMIN เขียนตอนยืนยันยอด) — ไม่ใช่พนักงานยื่นเอง
    await addDoc(collection(adminDb, "advances"), autoCarryDoc());
    for (let i = 0; i < limit; i++) {
      await expect(
        advancesAPI.submitAdvance(newRequest(500)),
      ).resolves.toBeTruthy();
    }
    await expect(advancesAPI.submitAdvance(newRequest(500))).rejects.toThrow(
      /ยื่นครบแล้ว/,
    );
    // auto-carry ยังอยู่ในลิสต์ (กินวงเงินยอดรวมตามจริง)
    const all = await advancesAPI.getAdvancesByEmployeeAndMonth(EMP_ID, YM);
    expect(all).toHaveLength(limit + 1);
  }, 30_000);

  it("เดือนอื่นไม่ปนกัน — เดือนถัดไปยื่นได้เต็มโควต้า", async () => {
    const limit = BUSINESS_RULES.ADVANCE_MAX_PER_MONTH;
    for (let i = 0; i < limit; i++) {
      await advancesAPI.submitAdvance(newRequest(500));
    }
    const nextMonth = { ...newRequest(500), month: "2026-09" };
    const id = await advancesAPI.submitAdvance(nextMonth);
    expect(id).toBeTruthy();
    await deleteDoc(doc(adminDb, "advances", id));
  }, 30_000);

  it("query ที่ใช้เช็คโควต้าอ่านผ่าน rules ได้ (ไม่ permission-denied/ไม่ต้องมี index)", async () => {
    await expect(
      advancesAPI.getAdvancesByEmployeeAndMonth(EMP_ID, YM),
    ).resolves.toEqual([]);
    expect(db).toBeTruthy();
  }, 30_000);

  /* ─── firestore.rules — ด่านสุดท้ายฝั่ง server ─────────────────────── */

  it("ADMIN สร้าง auto-carry advance ได้ (เงินสุทธิติดลบ → ยกยอดเดือนถัดไป)", async () => {
    // เคยถูก rules ปฏิเสธ: allow create ยอมเฉพาะ isEmployeeOwner + status
    // ต้องเป็น "pending" → ปุ่ม "ยืนยันยอด" พังตอนมีคนเงินสุทธิติดลบ
    const ref = await addDoc(collection(adminDb, "advances"), autoCarryDoc());
    expect(ref.id).toBeTruthy();
    await deleteDoc(doc(adminDb, "advances", ref.id));
  }, 30_000);

  it("พนักงานสร้างคำขอที่ 'อนุมัติแล้ว' เองไม่ได้ (rules บล็อก)", async () => {
    const advances = collection(db, "advances");
    // สวมรอยเป็น auto-carry เพื่อข้ามคิวอนุมัติ → ต้องโดนปฏิเสธ
    await expect(addDoc(advances, autoCarryDoc())).rejects.toThrow(
      /permission|PERMISSION/i,
    );
  }, 30_000);

  it("พนักงานยื่นแทนคนอื่นไม่ได้ (rules ผูก employeeId กับ auth.uid)", async () => {
    await expect(
      advancesAPI.submitAdvance({ ...newRequest(500), employeeId: "someone" }),
    ).rejects.toThrow();
  }, 30_000);

  it("ADMIN แก้ยอด auto-carry ได้ (deficit เปลี่ยนตอน re-confirm เดือน grace)", async () => {
    // เคยถูก rules ปฏิเสธ: validAdvanceUpdate ล็อก amount ไว้ →
    // updateAutoCarryAdvanceAmount() พัง → re-settle เดือน grace หลุดกลางคัน
    const ref = await addDoc(collection(adminDb, "advances"), autoCarryDoc());
    await expect(
      updateDoc(doc(adminDb, "advances", ref.id), { amount: 2500 }),
    ).resolves.toBeUndefined();
    // แก้ได้เฉพาะ amount — ฟิลด์อื่นยังล็อกอยู่
    await expect(
      updateDoc(doc(adminDb, "advances", ref.id), { employeeId: "someone" }),
    ).rejects.toThrow(/permission|PERMISSION/i);
    await deleteDoc(doc(adminDb, "advances", ref.id));
  }, 30_000);

  it("เกินเพดาน % ของเดือน → ถูกบล็อกตอนเขียนจริง (ไม่ใช่แค่ในฟอร์ม)", async () => {
    // เพดาน = baseSalary 15,000 × 50% (อายุงาน < 3 ปี) = 7,500
    await expect(
      advancesAPI.submitAdvance(newRequest(7_000)),
    ).resolves.toBeTruthy();
    await expect(advancesAPI.submitAdvance(newRequest(1_000))).rejects.toThrow(
      /เกินวงเงินคงเหลือ/,
    );
    // ยอดที่พอดีวงเงินที่เหลือ (500) ต้องผ่าน
    await expect(
      advancesAPI.submitAdvance(newRequest(500)),
    ).resolves.toBeTruthy();
  }, 30_000);
});
