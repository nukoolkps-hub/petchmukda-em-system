/* ─── MathText — wrap เครื่องหมายคำนวณให้ใหญ่ + หนาขึ้น ────────────
   เพื่อให้ +/-/×/÷/= อ่านง่าย เห็นชัดในสูตร/ตัวอย่าง                 */

import { Fragment } from "react";

// เครื่องหมายคำนวณ: + − (U+2212) × ÷ =
// (ไม่รวม ASCII "-" เพราะปนกับ "MD-03" / "0.05 ก. - 10 บ." ใน content
//  ถ้าจำเป็นต้องใช้ลบในสูตร ให้ใช้ U+2212 "−")
// (ไม่รวม % เพราะมันมาคู่กับเลขเสมอ — อ่านง่ายอยู่แล้ว)
const OP_REGEX = /([+−×÷=])/g;

interface Props {
  children: string;
  /** className เพิ่มสำหรับ operator span (default: ขยาย 1.25x + extrabold) */
  opClassName?: string;
}

export default function MathText({
  children,
  opClassName = "text-[1.25em] font-extrabold text-maroon",
}: Props) {
  const parts = children.split(OP_REGEX);
  return (
    <>
      {parts.map((part, i) => {
        if (OP_REGEX.test(part)) {
          // reset lastIndex (regex มี /g)
          OP_REGEX.lastIndex = 0;
          return (
            <span key={i} className={`mx-[0.15em] ${opClassName}`}>
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
