/* ─── MoneyInput — ช่องกรอกตัวเลขที่ใส่ comma ทันทีตอนพิมพ์ ────────────
   drop-in แทน <input type="text" inputMode="decimal"> ที่ผูกกับ raw string
   - แสดง comma คั่นหลักพันสด ๆ ระหว่างพิมพ์ (อ่านง่าย ไม่สับสนหลัก)
   - คงตำแหน่ง cursor หลัง comma ถูกแทรก (ไม่กระโดดไปท้าย)
   - พิมพ์ทศนิยม "3.79" / ติดลบได้ตามปกติ
   - onChange ส่งกลับเป็น raw (ไม่มี comma) → parent ใช้ parseFloat ได้เลย    */

import { type InputHTMLAttributes, useLayoutEffect, useRef } from "react";
import { setCaretKeepScroll } from "../../utils/caret";
import { caretPosFromDigits, formatTypedNumber } from "../../utils/format";

interface Props
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** raw value (number/string/ว่าง) — comma จะถูก strip ก่อน format */
  value: string | number | null | undefined;
  /** ส่งกลับเป็น raw string (ไม่มี comma) */
  onChange: (raw: string) => void;
}

export default function MoneyInput({ value, onChange, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  // จำนวนตัวอักษรสำคัญก่อน cursor ที่ค้างไว้รอคืนตำแหน่งหลัง re-render
  const pendingDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const digits = pendingDigits.current;
    if (digits == null) return;
    pendingDigits.current = null;
    const el = ref.current;
    // คืนตำแหน่ง cursor เฉพาะตอน field นี้ถูก focus อยู่จริง — กัน caret ถูก
    // ดึงไปตำแหน่งเก่าเมื่อ re-render จากเหตุอื่น (live data/parent state) ทำให้
    // cursor เด้งผิดที่
    if (!el || el !== document.activeElement) return;
    const pos = caretPosFromDigits(el.value, digits);
    // ตั้ง caret โดยไม่ให้หน้าจอเลื่อน (กัน iOS เด้ง scroll ตอน setSelectionRange)
    setCaretKeepScroll(el, pos);
  });

  const raw = value == null ? "" : String(value).replace(/,/g, "");

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={formatTypedNumber(raw)}
      onChange={(e) => {
        const caret = e.target.selectionStart ?? e.target.value.length;
        pendingDigits.current = e.target.value
          .slice(0, caret)
          .replace(/[^\d.-]/g, "").length;
        onChange(e.target.value.replace(/,/g, ""));
      }}
    />
  );
}
