/* ─── Migration Script ─────────────────────────────────────────
   อัพโหลด seed data → Firestore (ใช้ครั้งเดียว)

   วิธีใช้:
   1. ตั้งค่า .env.local ให้เรียบร้อย
   2. ใน browser console (หลัง app load) รัน:
      import('./firebase/seed.js').then(m => m.runSeed())

   หรือสร้างปุ่ม "Seed" ชั่วคราวใน Admin panel
                                                                  */
import { writeBatch, doc, collection } from "firebase/firestore";
import { db, COLLECTIONS } from "./config";
import {
  ALL_LEAVES_INIT,
  EMP_DIR_INIT,
  SALARY_INIT,
  ROLES_INIT,
  ADVANCE_REQUESTS_INIT,
} from "../seedData";

export async function runSeed(){
  console.log("🌱 Seeding Firestore...");
  const batch = writeBatch(db);
  let count = 0;

  // 1. Roles
  ROLES_INIT.forEach(role => {
    batch.set(doc(db, COLLECTIONS.ROLES, role.id), {
      name: role.name,
      poolGroup: role.poolGroup,
      icon: role.icon,
      createdAt: Date.now(),
    });
    count++;
  });

  // 2. Employees
  EMP_DIR_INIT.forEach(emp => {
    const { id, ...data } = emp;
    batch.set(doc(db, COLLECTIONS.EMPLOYEES, id), {
      ...data,
      createdAt: Date.now(),
    });
    count++;
  });

  // 3. Leaves (auto-id)
  ALL_LEAVES_INIT.forEach(leave => {
    const ref = doc(collection(db, COLLECTIONS.LEAVES));
    batch.set(ref, {
      ...leave,
      createdAt: Date.now(),
    });
    count++;
  });

  // 4. Salaries (nested: /salaries/{empId}/months/{ym})
  Object.entries(SALARY_INIT).forEach(([empId, months]) => {
    Object.entries(months as Record<string, Record<string, unknown>>).forEach(([ym, data]) => {
      batch.set(
        doc(db, COLLECTIONS.SALARIES, empId, "months", ym),
        { ...data, createdAt: Date.now() }
      );
      count++;
    });
  });

  // 5. Advance requests (auto-id)
  ADVANCE_REQUESTS_INIT.forEach(adv => {
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

/* ─── Reset (DANGER!) ───────────────────────────────────────────
   ลบ documents ทุกอย่างใน collection ที่ระบุ — ใช้ระวัง            */
export async function clearCollection(collectionName){
  if(!confirm(`⚠️ จะลบ documents ทั้งหมดใน "${collectionName}" — แน่ใจไหม?`)){
    return;
  }
  const { getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, collectionName));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`🗑 Cleared ${snap.size} documents from ${collectionName}`);
}
