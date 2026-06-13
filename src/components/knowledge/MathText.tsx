/* ─── MathText — wrap เครื่องหมายคำนวณให้ใหญ่ + หนาขึ้น ────────────
   เพื่อให้ +/-/×/÷/= อ่านง่าย เห็นชัดในสูตร/ตัวอย่าง
   รองรับ markdown-style **bold** สำหรับเน้นคำสำคัญ                   */

import { Fragment } from "react";

// เครื่องหมายคำนวณ: + − (U+2212) × ÷ =
// (ไม่รวม ASCII "-" เพราะปนกับ "MD-03" / "0.05 ก. - 10 บ." ใน content
//  ถ้าจำเป็นต้องใช้ลบในสูตร ให้ใช้ U+2212 "−")
// (ไม่รวม % เพราะมันมาคู่กับเลขเสมอ — อ่านง่ายอยู่แล้ว)
const OP_REGEX = /([+−×÷=])/g;
// **text** → <strong> · ไม่ greedy (กัน "**a** ... **b**" จับรวมกัน)
const BOLD_REGEX = /\*\*([^*]+)\*\*/g;

interface Props {
  children: string;
  /** className เพิ่มสำหรับ operator span (default: ขยาย 1.25x + extrabold) */
  opClassName?: string;
}

function renderWithOps(text: string, opClassName: string, keyPrefix: string) {
  const parts = text.split(OP_REGEX);
  return parts.map((part, i) => {
    if (OP_REGEX.test(part)) {
      OP_REGEX.lastIndex = 0;
      return (
        <span key={`${keyPrefix}-${i}`} className={`mx-[0.15em] ${opClassName}`}>
          {part}
        </span>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

export default function MathText({
  children,
  // font-mono — operators ใน monospace มี stroke หนา + uniform width
  //             มองง่ายกว่า Prompt (font หลัก) ที่ stroke บางเกินไป
  // 1.3em — ขยายเล็กน้อย · tracking-wider — เว้นช่องระหว่างเครื่องหมายกับเลข
  opClassName = "text-[1.3em] font-mono font-black text-maroon tracking-wider",
}: Props) {
  // split โดย bold marker ก่อน · odd index = ตัวที่อยู่ใน **...**
  const boldParts = children.split(BOLD_REGEX);
  return (
    <>
      {boldParts.map((part, i) => {
        const isBold = i % 2 === 1;
        if (isBold) {
          return (
            <strong key={`b-${i}`} className="font-extrabold text-maroon">
              {renderWithOps(part, opClassName, `b-${i}`)}
            </strong>
          );
        }
        return (
          <Fragment key={`n-${i}`}>
            {renderWithOps(part, opClassName, `n-${i}`)}
          </Fragment>
        );
      })}
    </>
  );
}
