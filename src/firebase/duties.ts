/* ─── Duties CRUD ──────────────────────────────────────────────
   ตารางเวรพนักงาน — admin สร้าง/แก้/ลบ ผ่าน UI                          */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import type { Duty } from "../types";
import { db } from "./config";

const ref = collection(db, "duties");

export function subscribeDuties(
  onChange: (list: Duty[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    ref,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Duty)
        // เรียงตาม createdAt — เก่าที่สุดอยู่บน
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      onChange(list);
    },
    (err) => {
      console.error("[Duties] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function upsertDuty(
  id: string | null,
  data: Omit<Duty, "id" | "createdAt" | "updatedAt"> & {
    createdAt?: number;
  },
): Promise<string> {
  const cleanId = id || doc(ref).id;
  const existing = await import("firebase/firestore").then((m) =>
    m.getDoc(doc(ref, cleanId)),
  );
  const now = Date.now();
  await setDoc(
    doc(ref, cleanId),
    {
      ...data,
      createdAt: existing.exists()
        ? existing.data()?.createdAt || now
        : data.createdAt || now,
      updatedAt: now,
    },
    { merge: true },
  );
  return cleanId;
}

export async function deleteDuty(id: string): Promise<void> {
  await deleteDoc(doc(ref, id));
}
