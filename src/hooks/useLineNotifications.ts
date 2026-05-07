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
}

export default function useLineNotifications({
  profileName,
  currentEmployee,
  employeeDirectory,
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
      currentEmployee ||
      employeeDirectory.find((e) => e.name === profileName) ||
      null;
    const employeeId = employee?.id || "";
    const reqData = {
      employeeId,
      employeeName: employee?.name || profileName || "-",
      amount,
      reason,
      month,
    };
    const id = await submitAdvanceAction(reqData);

    // ส่ง LINE notification (best-effort)
    sendAdvanceRequestToLine({
      employeeName: reqData.employeeName,
      amount: reqData.amount,
      reason: reqData.reason,
      month: reqData.month,
      bank: employee?.bank,
      bankAccountNumber: employee?.bankAccountNumber,
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
    const request =
      currentRequest || advanceRequests.find((r) => r.id === reqId);
    if (!request) return;

    // เรียก action ที่เหมาะสม (รองรับทั้ง in-memory และ Firebase)
    if (updates.status === "approved") {
      await approveAdvanceAction(reqId, updates.slipImageUrl || null);
    } else if (updates.status === "rejected") {
      await rejectAdvanceAction(reqId, updates.rejectionReason || "");
    }

    // ส่ง LINE notification ไปหาพนักงาน
    const employee =
      employeeDirectory.find((e) => e.id === request.employeeId) ||
      employeeDirectory.find((e) => e.name === request.employeeName);
    const empLineId = employee?.lineUserId;
    if (updates.status === "approved" && empLineId) {
      notifyEmployeeApproved({
        employeeLineUserId: empLineId,
        employeeName: request.employeeName,
        amount: request.amount,
        requestReason: request.reason,
        month: request.month,
        slipImageUrl: updates.slipImageUrl || null,
        slipImageDataUrl: updates.slipImageDataUrl || null,
        approvedAt: updates.approvedAt || new Date().toISOString(),
        requestId: reqId,
      });
    } else if (updates.status === "rejected" && empLineId) {
      notifyEmployeeRejected({
        employeeLineUserId: empLineId,
        employeeName: request.employeeName,
        amount: request.amount,
        requestReason: request.reason,
        rejectionReason: updates.rejectionReason || "",
        month: request.month,
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
