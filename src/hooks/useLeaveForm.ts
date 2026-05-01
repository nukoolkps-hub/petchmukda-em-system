/* ─── useLeaveForm — Leave request form logic ────────────────── */

import { useState } from "react";
import type { LeaveEntry } from "../types";
import { LEAVE_TYPES } from "../constants";
import { countWorkdays } from "../utils/dateUtils";

interface UseLeaveFormOptions {
  profileName: string | null;
  allLeaves: LeaveEntry[];
  empDir: { name: string; balance?: any; used?: any }[];
  setAllLeaves: React.Dispatch<React.SetStateAction<LeaveEntry[]>> | ((...args: any[]) => void);
  showToast: (msg: string) => void;
}

export default function useLeaveForm({
  profileName,
  allLeaves,
  empDir,
  setAllLeaves,
  showToast,
}: UseLeaveFormOptions) {
  const [form, setForm] = useState({ type: "", startDate: "", endDate: "" });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [histDetail, setHistDetail] = useState<string | number | null>(null);

  /* ─── Derived values ───────────────────────────────────────── */
  const myLeaves = allLeaves.filter(
    (lv) => profileName && lv.empName === profileName,
  );

  const empEntry = empDir.find((e) => profileName && e.name === profileName);
  const balance = empEntry?.balance || { personal: 15, sick: 15 };
  const used = empEntry?.used || { personal: 0, sick: 0 };

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
    if (overLimit) e.over = `วันลาเกินสิทธิ์คงเหลือ (${remain} วัน)`;
    return e;
  }

  /* ─── Submit ───────────────────────────────────────────────── */
  function submit(profile: { name: string; av: string; avType: string }) {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    const id = Date.now();
    const now = new Date().toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    (setAllLeaves as React.Dispatch<React.SetStateAction<LeaveEntry[]>>)((prev: LeaveEntry[]) => [
      {
        id,
        empId: "me",
        empName: profile.name,
        av: profile.av,
        avType: profile.avType,
        type: form.type as "personal" | "sick",
        start: form.startDate,
        end: form.endDate,
        days,
        reason: "",
        submitted: now,
      },
      ...prev,
    ]);
    setSubmitted(true);
  }

  /* ─── Reset ────────────────────────────────────────────────── */
  function reset() {
    setForm({ type: "", startDate: "", endDate: "" });
    setSubmitted(false);
    setErrors({});
  }

  /* ─── Delete ───────────────────────────────────────────────── */
  function handleDelete(id: string | number) {
    (setAllLeaves as React.Dispatch<React.SetStateAction<LeaveEntry[]>>)((prev: LeaveEntry[]) =>
      prev.filter((lv) => lv.id !== id),
    );
    showToast("ลบรายการลาเรียบร้อยแล้ว");
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
