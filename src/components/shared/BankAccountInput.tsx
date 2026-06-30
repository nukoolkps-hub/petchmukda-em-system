/* ─── BankAccountInput — ช่องกรอกเลขบัญชีที่ใส่ - สดตอนพิมพ์ ────────────
   drop-in แทน <input inputMode="numeric"> ที่ผูกกับเลขบัญชี
   - แสดง - คั่นสดๆ ระหว่างพิมพ์ (format ตาม formatBankAccount · อ่านง่าย)
   - คงตำแหน่ง cursor หลัง - ถูกแทรก (ไม่กระโดดไปท้าย) — pattern เดียวกับ MoneyInput
   - onChange ส่งกลับเป็น "เลขล้วน" (ไม่มี -) → parent เก็บ/validate ได้เลย
   - maxDigits: จำกัดจำนวนหลัก (ตามธนาคาร) — เกินแล้วไม่รับ                      */

import { type InputHTMLAttributes, useLayoutEffect, useRef } from "react";
import { formatBankAccount } from "../../utils/bankFormat";

interface Props
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** raw value (มี - หรือไม่มีก็ได้ — จะถูก strip เหลือเลขล้วนก่อน format) */
  value: string | null | undefined;
  /** ส่งกลับเป็นเลขล้วน (ไม่มี -) */
  onChange: (digits: string) => void;
  /** จำกัดจำนวนหลักสูงสุด (ตามธนาคาร) · เกินแล้วไม่รับ input */
  maxDigits?: number;
}

/** ตำแหน่ง cursor หลังหลักที่ N ใน formatted string (นับเฉพาะ "ตัวเลข" ไม่นับ -) */
function caretAfterDigit(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      count++;
      if (count === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

export default function BankAccountInput({
  value,
  onChange,
  maxDigits,
  ...rest
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  // จำนวนหลักก่อน cursor ที่ค้างไว้รอคืนตำแหน่งหลัง re-render
  const pendingDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const digits = pendingDigits.current;
    if (digits == null) return;
    pendingDigits.current = null;
    const el = ref.current;
    // คืน cursor เฉพาะตอน field ถูก focus จริง — กัน caret เด้งตอน re-render
    // จากเหตุอื่น (เช่น parent state)
    if (!el || el !== document.activeElement) return;
    const pos = caretAfterDigit(el.value, digits);
    el.setSelectionRange(pos, pos);
  });

  const digits = (value == null ? "" : String(value)).replace(/\D/g, "");

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={formatBankAccount(digits)}
      onChange={(e) => {
        const nextDigits = e.target.value.replace(/\D/g, "");
        // เกิน maxDigits → ไม่รับ (คงค่าเดิม)
        if (maxDigits != null && nextDigits.length > maxDigits) return;
        const caret = e.target.selectionStart ?? e.target.value.length;
        pendingDigits.current = e.target.value
          .slice(0, caret)
          .replace(/\D/g, "").length;
        onChange(nextDigits);
      }}
    />
  );
}
