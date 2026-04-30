/* ─── Employees CRUD ────────────────────────────────────────── */
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "./config";

const ref = collection(db, COLLECTIONS.EMPLOYEES);

/* ─── Read All (real-time) ───────────────────────────────────
   ใช้ onSnapshot — อัพเดต UI ทันทีเมื่อข้อมูลเปลี่ยน             */
export function subscribeEmployees(onChange, onError){
  return onSnapshot(
    query(ref, orderBy("name")),
    (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onChange(list);
    },
    (err) => {
      console.error("[Employees] subscribe error:", err);
      onError?.(err);
    }
  );
}

/* ─── Read All (one-time) ───────────────────────────────────── */
export async function getAllEmployees(){
  const snap = await getDocs(query(ref, orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ─── Read by ID ─────────────────────────────────────────────── */
export async function getEmployee(id){
  const snap = await getDoc(doc(ref, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* ─── Find by LINE User ID (for LINE Login) ───────────────────── */
export async function getEmployeeByLineId(lineUserId){
  const snap = await getDocs(query(ref, where("lineUserId", "==", lineUserId)));
  if(snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/* ─── Create / Update ─────────────────────────────────────────
   id = firebase auto ID (สำหรับใหม่) หรือ existing emp.id           */
export async function upsertEmployee(id, data){
  const cleanId = id || doc(ref).id; // gen ใหม่ถ้าไม่มี
  await setDoc(doc(ref, cleanId), {
    ...data,
    updatedAt: Date.now(),
  }, { merge: true });
  return cleanId;
}

/* ─── Update (partial) ──────────────────────────────────────── */
export async function updateEmployee(id, fields){
  await updateDoc(doc(ref, id), {
    ...fields,
    updatedAt: Date.now(),
  });
}

/* ─── Delete ─────────────────────────────────────────────────── */
export async function deleteEmployee(id){
  await deleteDoc(doc(ref, id));
}
