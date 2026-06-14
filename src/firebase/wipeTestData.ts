/* ─── wipeTestData — Cloud Function callable wrapper ──────────────
   One-time start-fresh utility — ลบข้อมูลพนักงาน + transactional data
   ก่อนเริ่มใช้จริง · admin only · confirm token = "ล้างข้อมูล"           */

import { httpsCallable } from "firebase/functions";
import { functions } from "./config";

export interface WipeResult {
  ok: boolean;
  stats: Record<string, number>;
  totalDeleted: number;
}

export async function wipeTestData(): Promise<WipeResult> {
  const callable = httpsCallable<{ confirm: string }, WipeResult>(
    functions,
    "wipeTestData",
  );
  const res = await callable({ confirm: "ล้างข้อมูล" });
  return res.data;
}
