/* ─── useLeaveForm — Leave request form logic ────────────────── */

import { useState } from "react";
import type { LeaveEntry } from "../types";
import { countWorkdays, fmtShort } from "../utils/dateUtils";

interface UseLeaveFormOptions {
  profileName: string | null;
  allLeaves: LeaveEntry[];
  employeeDirectory: { name: string; balance?: any; used?: any }[];
  addLeave: (
    leave: Omit<LeaveEntry, "id">,
  ) => string | number | Promise<string>;
  deleteLeave: (id: string | number) => void | Promise<void>;
  authUid: string;
  showToast: (msg: string) => void;
}

export default function useLeaveForm({
  profileName,
  allLeaves,
  employeeDirectory,
  addLeave,
  deleteLeave,
  authUid,
  showToast,
}: UseLeaveFormOptions) {
  const [form, setForm] = useState({ type: "", startDate: "", endDate: "" });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [histDetail, setHistDetail] = useState<string | number | null>(null);

  /* ─── Derived values ───────────────────────────────────────── */
  const myLeaves = allLeaves.filter(
    (lv) => profileName && lv.employeeName === profileName,
  );

  const employeeEntry = employeeDirectory.find(
    (e) => profileName && e.name === profileName,
  );
  const balance = employeeEntry?.balance || { personal: 15, sick: 15 };
  const used = employeeEntry?.used || { personal: 0, sick: 0 };

  const days = countWorkdays(form.startDate, form.endDate);
  const remain = form.type ? balance[form.type] - used[form.type] : null;
  const overLimit = remain !== null && days > remain;

  /* ─── Validation ───────────────────────────────────────────── */
  function validate() {
    const e: Record<string, string> = {};
    if (!form.type) e.type = "กรุณาเลือกประเภทการลา";
    if (!form.startDate) e.startDate = "กรุณาเลือกวันที่เริ่มลา";
    if (!form.endDate) e.endDate = "กรุณาเลือกวันที่สิ้นสุด";
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = "วันที่สิ้นสุดต้องไม่ก่อนวันเริ่มต้น";
    // ลาป่วยห้ามข้ามเดือน · ถ้าคร่อม → ให้ยื่นเป็น 2 ใบแยกเดือน
    if (
      form.type === "sick" &&
      form.startDate &&
      form.endDate &&
      form.startDate.slice(0, 7) !== form.endDate.slice(0, 7)
    ) {
      e.endDate = "ลาป่วยข้ามเดือนไม่ได้ — กรุณายื่นแยกเดือน";
    }
    if (overLimit) e.over = `วันลาเกินสิทธิ์คงเหลือ (${remain} วัน)`;
    // กันลาทับวันที่ลาไปแล้ว — เช็คทับซ้อนกับ leave อื่นของพนักงานคนเดียวกัน
    if (form.startDate && form.endDate && form.endDate >= form.startDate) {
      const conflict = myLeaves.find(
        (lv) => lv.start <= form.endDate && lv.end >= form.startDate,
      );
      if (conflict) {
        const range =
          conflict.start === conflict.end
            ? fmtShort(conflict.start)
            : `${fmtShort(conflict.start)} → ${fmtShort(conflict.end)}`;
        e.over = `วันที่เลือกทับกับใบลาเดิม (${range})`;
      }
    }
    return e;
  }

  /* ─── Submit — writes to Firestore ─────────────────────────── */
  async function submit(profile: {
    name: string;
    avatar: string;
    avatarType: string;
  }) {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    const now = new Date().toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    try {
      await addLeave({
        employeeId: authUid,
        employeeName: profile.name,
        type: form.type as "personal" | "sick",
        start: form.startDate,
        end: form.endDate,
        days,
        reason: "",
        submitted: now,
      });
      setSubmitted(true);
    } catch (err) {
      console.error("[useLeaveForm] submit error:", err);
      showToast(
        err instanceof Error && err.message
          ? err.message
          : "เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่",
      );
    }
  }

  /* ─── Reset ────────────────────────────────────────────────── */
  function reset() {
    setForm({ type: "", startDate: "", endDate: "" });
    setSubmitted(false);
    setErrors({});
  }

  /* ─── Delete — deletes from Firestore ──────────────────────── */
  async function handleDelete(id: string | number) {
    try {
      await deleteLeave(id);
      showToast("ลบรายการลาเรียบร้อยแล้ว");
    } catch (err) {
      console.error("[useLeaveForm] delete error:", err);
      showToast(
        err instanceof Error && err.message
          ? err.message
          : "ลบรายการไม่สำเร็จ กรุณาลองใหม่",
      );
    }
  }

  return {
    form,
    setForm,
    errors,
    submitted,
    setSubmitted,
    histDetail,
    setHistDetail,
    myLeaves,
    balance,
    used,
    days,
    remain,
    overLimit,
    validate,
    submit,
    reset,
    handleDelete,
  };
}
