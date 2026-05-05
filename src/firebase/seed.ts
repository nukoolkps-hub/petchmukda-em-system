/* ─── Migration Script ─────────────────────────────────────────
   อัพโหลด seed data → Firestore

   วิธีใช้:
   1. ตั้งค่า .env.local ให้เรียบร้อย
   2. ใน browser console (หลัง app load) รัน:
      import('./firebase/seed.js').then(m => m.runSeed())

   Dev emulator:
      import('./firebase/seed.js').then(m => m.runDevSeed())
                                                                  */
import { collection, doc, writeBatch } from "firebase/firestore";
import {
  ADVANCE_REQUESTS_INIT,
  ALL_LEAVES_INIT,
  EMP_DIR_INIT,
  ROLES_INIT,
  SALARY_INIT,
} from "../seedData";
import { COLLECTIONS, db } from "./config";

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const USE_EMULATORS =
  import.meta.env.VITE_USE_EMULATORS === "true" ||
  (import.meta.env.VITE_USE_EMULATORS !== "false" && import.meta.env.DEV);
const DEV_EMPLOYEE_UID = "dev_employee";
const DEV_ADMIN_UID = "dev_admin";
const DEV_EMPLOYEE_ID = "e3";
const DEV_ADMIN_EMPLOYEE_ID = "me";

function emulatorBaseUrl() {
  const host =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
      ? window.location.hostname
      : "localhost";
  return `http://${host}:8080`;
}

function docName(path: string) {
  return `projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

function firestoreValue(value: unknown): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: firestoreFields(value as Record<string, unknown>),
      },
    };
  }
  return { nullValue: null };
}

function firestoreFields(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, firestoreValue(value)]),
  );
}

function updateWrite(path: string, data: Record<string, unknown>) {
  return {
    update: {
      name: docName(path),
      fields: firestoreFields(data),
    },
  };
}

function employeeWithDevLogin(emp: any) {
  if (emp.id === DEV_EMPLOYEE_ID) {
    return { ...emp, lineUserId: DEV_EMPLOYEE_UID };
  }
  if (emp.id === DEV_ADMIN_EMPLOYEE_ID) {
    return { ...emp, lineUserId: DEV_ADMIN_UID };
  }
  return emp;
}

async function commitEmulatorWrites(writes: Record<string, unknown>[]) {
  const res = await fetch(
    `${emulatorBaseUrl()}/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ writes }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Seed failed (${res.status}): ${text}`);
  }
}

export async function runSeed() {
  console.log("🌱 Seeding Firestore...");
  const batch = writeBatch(db);
  let count = 0;

  // 1. Roles
  ROLES_INIT.forEach((role) => {
    batch.set(doc(db, COLLECTIONS.ROLES, role.id), {
      name: role.name,
      poolGroup: role.poolGroup,
      icon: role.icon,
      createdAt: Date.now(),
    });
    count++;
  });

  // 2. Employees
  EMP_DIR_INIT.forEach((emp) => {
    const { id, ...data } = emp;
    batch.set(doc(db, COLLECTIONS.EMPLOYEES, id), {
      ...data,
      createdAt: Date.now(),
    });
    count++;
  });

  // 3. Leaves (auto-id)
  ALL_LEAVES_INIT.forEach((leave) => {
    const ref = doc(collection(db, COLLECTIONS.LEAVES));
    batch.set(ref, {
      ...leave,
      createdAt: Date.now(),
    });
    count++;
  });

  // 4. Salaries (nested: /salaries/{empId}/months/{ym})
  Object.entries(SALARY_INIT).forEach(([empId, months]) => {
    Object.entries(months as Record<string, Record<string, unknown>>).forEach(
      ([ym, data]) => {
        batch.set(doc(db, COLLECTIONS.SALARIES, empId, "months", ym), {
          ...data,
          createdAt: Date.now(),
        });
        count++;
      },
    );
  });

  // 5. Advance requests (auto-id)
  ADVANCE_REQUESTS_INIT.forEach((adv) => {
    const ref = doc(collection(db, COLLECTIONS.ADVANCES));
    const { id, ...data } = adv;
    batch.set(ref, {
      ...data,
      createdAt: Date.now(),
    });
    count++;
  });

  await batch.commit();
  console.log(`✅ Seeded ${count} documents to Firestore`);
  return count;
}

/* ─── Dev-only seed through Firestore emulator REST API ─────────
   ใช้ Bearer owner เฉพาะ emulator เพื่อ bypass rules ตอนยังไม่ได้ login
   leaves/advances ใช้ deterministic IDs เพื่อกดซ้ำแล้วไม่ duplicate */
export async function runDevSeed() {
  if (!USE_EMULATORS) {
    throw new Error("Seed demo data ใช้ได้เฉพาะ emulator/dev mode");
  }
  if (!PROJECT_ID) {
    throw new Error("Missing VITE_FIREBASE_PROJECT_ID");
  }

  const now = Date.now();
  const writes: Record<string, unknown>[] = [];

  ROLES_INIT.forEach((role) => {
    writes.push(
      updateWrite(`${COLLECTIONS.ROLES}/${role.id}`, {
        name: role.name,
        poolGroup: role.poolGroup,
        icon: role.icon,
        createdAt: now,
      }),
    );
  });

  EMP_DIR_INIT.map(employeeWithDevLogin).forEach((emp) => {
    const { id, ...data } = emp;
    writes.push(
      updateWrite(`${COLLECTIONS.EMPLOYEES}/${id}`, {
        ...data,
        createdAt: now,
      }),
    );
  });

  ALL_LEAVES_INIT.forEach((leave) => {
    writes.push(
      updateWrite(`${COLLECTIONS.LEAVES}/seed_${leave.id}`, {
        ...leave,
        createdAt: now,
      }),
    );
  });

  Object.entries(SALARY_INIT).forEach(([empId, months]) => {
    Object.entries(months as Record<string, Record<string, unknown>>).forEach(
      ([ym, data]) => {
        writes.push(
          updateWrite(`${COLLECTIONS.SALARIES}/${empId}/months/${ym}`, {
            ...data,
            createdAt: now,
          }),
        );
      },
    );
  });

  ADVANCE_REQUESTS_INIT.forEach((adv) => {
    const { id, ...data } = adv;
    writes.push(
      updateWrite(`${COLLECTIONS.ADVANCES}/seed_${id}`, {
        ...data,
        createdAt: now,
      }),
    );
  });

  await commitEmulatorWrites(writes);
  console.log(
    `✅ Seeded ${writes.length} documents to Firestore emulator. Dev employee UID: ${DEV_EMPLOYEE_UID}; dev admin UID: ${DEV_ADMIN_UID}`,
  );
  return writes.length;
}

/* ─── Reset (DANGER!) ───────────────────────────────────────────
   ลบ documents ทุกอย่างใน collection ที่ระบุ — ใช้ระวัง            */
export async function clearCollection(collectionName) {
  if (!confirm(`⚠️ จะลบ documents ทั้งหมดใน "${collectionName}" — แน่ใจไหม?`)) {
    return;
  }
  const { getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, collectionName));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();
  console.log(`🗑 Cleared ${snap.size} documents from ${collectionName}`);
}
