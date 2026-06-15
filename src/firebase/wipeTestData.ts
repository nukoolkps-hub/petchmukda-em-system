/* ─── wipeTestData + wipeEmployeeData — Cloud Function wrappers ─────
   Start-fresh utility · admin only · confirm token = "ล้างข้อมูล"          */

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

export interface PerEmployeeWipeStats {
  employeeId: string;
  months: number;
  leaves: number;
  advances: number;
  loans: number;
  poolSnapshotMonthsTouched: number;
  employeeDoc: number;
}

export interface WipeEmployeeResult {
  ok: boolean;
  totalDeleted: number;
  stats: PerEmployeeWipeStats[];
}

export async function wipeEmployeeData(
  employeeIds: string[],
): Promise<WipeEmployeeResult> {
  const callable = httpsCallable<
    { employeeIds: string[]; confirm: string },
    WipeEmployeeResult
  >(functions, "wipeEmployeeData");
  const res = await callable({ employeeIds, confirm: "ล้างข้อมูล" });
  return res.data;
}
