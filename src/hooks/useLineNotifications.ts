/* ─── useLineNotifications — LINE Bot integration via Cloud Functions ── */

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";
import type { AdvanceRequest, Employee } from "../types";

interface UseLineNotificationsOptions {
  profileName: string;
  currentEmployee?: Employee | null;
  empDir: Employee[];
  advanceRequests: AdvanceRequest[];
  submitAdvanceAction: (req: any) => string | number | Promise<string>;
  approveAdvanceAction: (
    id: string | number,
    slipUrl?: string | null | undefined,
  ) => void | Promise<void>;
  rejectAdvanceAction: (
    id: string | number,
    reason?: string,
  ) => void | Promise<void>;
}

export default function useLineNotifications({
  profileName,
  currentEmployee,
  empDir,
  advanceRequests,
  submitAdvanceAction,
  approveAdvanceAction,
  rejectAdvanceAction,
}: UseLineNotificationsOptions) {
  // === Cloud Function callables ===
  const notifyAdvanceRequestFn = httpsCallable(
    functions,
    "notifyAdvanceRequest",
  );
  const notifyAdvanceApprovedFn = httpsCallable(
    functions,
    "notifyAdvanceApproved",
  );
  const notifyAdvanceRejectedFn = httpsCallable(
    functions,
    "notifyAdvanceRejected",
  );

  async function sendAdvanceRequestToLine(payload: Record<string, unknown>) {
    try {
      await notifyAdvanceRequestFn(payload);
    } catch (e) {
      console.warn("LINE notify failed:", e);
    }
  }
  async function notifyEmployeeApproved(payload: Record<string, unknown>) {
    try {
      await notifyAdvanceApprovedFn(payload);
    } catch (e) {
      console.warn("LINE notify failed:", e);
    }
  }
  async function notifyEmployeeRejected(payload: Record<string, unknown>) {
    try {
      await notifyAdvanceRejectedFn(payload);
    } catch (e) {
      console.warn("LINE notify failed:", e);
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
    const employee =
      currentEmployee || empDir.find((e) => e.name === profileName) || null;
    const empId = employee?.id || "";
    const reqData = {
      empId,
      empName: employee?.name || profileName || "-",
      amount,
      reason,
      month,
    };
    const id = await submitAdvanceAction(reqData);

    // ส่ง LINE notification (best-effort)
    sendAdvanceRequestToLine({
      empName: reqData.empName,
      amount: reqData.amount,
      reason: reqData.reason,
      month: reqData.month,
      bank: employee?.bank,
      bankAcc: employee?.bankAcc,
      submittedAt: new Date().toISOString(),
      requestId: id,
    });

    return id;
  }

  /* ─── Admin update advance (approve/reject) ────────────────── */
  async function adminUpdateAdvance(
    reqId: string | number,
    updates: any,
    currentRequest?: AdvanceRequest,
  ) {
    // หา request ปัจจุบันเพื่อใช้ส่ง LINE
    const req = currentRequest || advanceRequests.find((r) => r.id === reqId);
    if (!req) return;

    // เรียก action ที่เหมาะสม (รองรับทั้ง in-memory และ Firebase)
    if (updates.status === "approved") {
      await approveAdvanceAction(reqId, updates.slipUrl || null);
    } else if (updates.status === "rejected") {
      await rejectAdvanceAction(reqId, updates.rejectReason || "");
    }

    // ส่ง LINE notification ไปหาพนักงาน
    const emp =
      empDir.find((e) => e.id === req.empId) ||
      empDir.find((e) => e.name === req.empName);
    const empLineId = emp?.lineUserId;
    if (updates.status === "approved" && empLineId) {
      notifyEmployeeApproved({
        empLineUserId: empLineId,
        empName: req.empName,
        amount: req.amount,
        reason: req.reason,
        month: req.month,
        slipUrl: updates.slipUrl || null,
        slipImg: updates.slipImg || null,
        approvedAt: updates.approvedAt || new Date().toISOString(),
        requestId: reqId,
      });
    } else if (updates.status === "rejected" && empLineId) {
      notifyEmployeeRejected({
        empLineUserId: empLineId,
        empName: req.empName,
        amount: req.amount,
        reason: req.reason,
        month: req.month,
        rejectedAt: updates.rejectedAt || new Date().toISOString(),
        requestId: reqId,
      });
    }
  }

  return {
    submitAdvanceRequest,
    adminUpdateAdvance,
  };
}
