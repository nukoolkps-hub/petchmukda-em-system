/* ─── useLineNotifications — LINE Bot integration via Cloud Functions ── */

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";
import type { AdvanceRequest, Employee } from "../types";

interface UseLineNotificationsOptions {
  profileName: string;
  currentEmployee?: Employee | null;
  employeeDirectory: Employee[];
  advanceRequests: AdvanceRequest[];
  submitAdvanceAction: (request: any) => string | number | Promise<string>;
  approveAdvanceAction: (
    id: string | number,
    slipImageUrl?: string | null | undefined,
  ) => void | Promise<void>;
  rejectAdvanceAction: (
    id: string | number,
    reason?: string,
  ) => void | Promise<void>;
  showToast?: (message: string) => void;
}

export default function useLineNotifications({
  profileName,
  currentEmployee,
  employeeDirectory,
  advanceRequests,
  submitAdvanceAction,
  approveAdvanceAction,
  rejectAdvanceAction,
  showToast,
}: UseLineNotificationsOptions) {
  // === Cloud Function callables ===
  const notifyAdvanceRequestFn = httpsCallable(
    functions,
    "notifyAdvanceRequest",
  );

  async function sendAdvanceRequestToLine(payload: Record<string, unknown>) {
    try {
      const result = await notifyAdvanceRequestFn(payload);
      return result.data;
    } catch (e) {
      console.warn("LINE notify failed:", e);
      return null;
    }
  }

  /* ─── Submit advance request (employee side) ───────────────── */
  async function submitAdvanceRequest({
    amount,
    reason,
    month,
  }: {
    amount: number;
    reason: string;
    month: string;
  }) {
    // lookup ผ่าน currentEmployee (passed in) เท่านั้น — ไม่ fallback ชื่อ
    // เพราะ profile.name อาจไม่ตรง employee.name หลังโดน rename
    const employee = currentEmployee || null;
    const employeeId = employee?.id || "";
    const reqData = {
      employeeId,
      employeeName: employee?.name || profileName || "-",
      amount,
      reason,
      month,
    };
    const id = await submitAdvanceAction(reqData);

    // ส่ง LINE notification — await เพื่อรู้ผล (เดิม fire-and-forget → ถ้า LINE
    // ล้มจะเงียบ ไม่มีใครรู้ว่าแอดมินไม่ได้รับ) · null = ส่งไม่สำเร็จจริง ·
    // {skipped}/{ok} = admin ปิด toggle/ไม่มี config (ตั้งใจ — ไม่ถือว่า fail)
    const lineResult = await sendAdvanceRequestToLine({
      employeeName: reqData.employeeName,
      amount: reqData.amount,
      reason: reqData.reason,
      month: reqData.month,
      bank: employee?.bank,
      bankAccountNumber: employee?.bankAccountNumber,
      submittedAt: new Date().toISOString(),
      requestId: id,
    });

    return { id, lineNotified: lineResult !== null };
  }

  /* ─── Admin update advance (approve/reject) ────────────────── */
  async function adminUpdateAdvance(
    reqId: string | number,
    updates: any,
    currentRequest?: AdvanceRequest,
  ) {
    // หา request ปัจจุบันเพื่อแสดง feedback หลังบันทึก Firestore
    const request =
      currentRequest || advanceRequests.find((r) => r.id === reqId);
    if (!request) return;

    // เรียก action ที่เหมาะสม (รองรับทั้ง in-memory และ Firebase)
    if (updates.status === "approved") {
      await approveAdvanceAction(reqId, updates.slipImageUrl || null);
    } else if (updates.status === "rejected") {
      await rejectAdvanceAction(reqId, updates.rejectionReason || "");
    }

    // LINE ถึงพนักงานถูกส่งจาก scheduled backend worker ตามสถานะใน Firestore
    // lookup ด้วย employeeId เสมอ — name อาจไม่ตรงหลังโดน rename
    const employee = employeeDirectory.find((e) => e.id === request.employeeId);
    const empLineId = employee?.lineUserId;
    if (
      (updates.status === "approved" || updates.status === "rejected") &&
      !empLineId
    ) {
      console.warn(
        "[Advance] LINE notify skipped: employee has no lineUserId",
        {
          requestId: reqId,
          employeeId: request.employeeId,
          employeeName: request.employeeName,
        },
      );
      showToast?.("อัปเดตแล้ว แต่พนักงานยังไม่มี LINE User ID");
      return;
    }
    if (updates.status === "approved" && empLineId) {
      showToast?.("อนุมัติแล้ว ระบบจะส่ง LINE จากเซิร์ฟเวอร์");
    } else if (updates.status === "rejected" && empLineId) {
      showToast?.("ปฏิเสธแล้ว ระบบจะส่ง LINE จากเซิร์ฟเวอร์");
    }
  }

  return {
    submitAdvanceRequest,
    adminUpdateAdvance,
  };
}
