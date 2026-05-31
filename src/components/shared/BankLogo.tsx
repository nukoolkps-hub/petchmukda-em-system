/* ─── BankLogo — render Thai bank SVG จาก public/banks ──────────
   ใช้ slug จาก THAI_BANKS (เช่น "kbank", "bbl") ลงทะเบียนใน
   constants.ts → public/banks/{slug}.svg

   SVG จาก banks-logo เป็นโลโก้ขาว ออกแบบมาวางบนพื้นสีแบรนด์ →
   เราเรนเดอร์เป็น rounded square สีแบรนด์ + รูป SVG ขาวด้านใน

   รับ:
   - bank: ชื่อเต็มภาษาไทย (เช่น "ธนาคารกสิกรไทย") — lookup slug ให้
   - size: ขนาด container (px)
   - className: เพิ่ม class ภายนอก                                 */

import { Landmark } from "lucide-react";
import { THAI_BANKS } from "../../constants";

interface BankLogoProps {
  bank: string | undefined | null;
  size?: number;
  className?: string;
}

export default function BankLogo({
  bank,
  size = 32,
  className = "",
}: BankLogoProps) {
  const entry = bank ? THAI_BANKS.find((b) => b.name === bank) : null;
  if (!entry) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-[7px] bg-cream border border-bdr flex items-center justify-center text-txt-soft ${className}`}
        aria-label={bank || "ธนาคาร"}
      >
        <Landmark size={Math.round(size * 0.6)} strokeWidth={2.2} />
      </div>
    );
  }
  // บางแบงก์โลโก้ทางการรายละเอียดสูง (เช่น ออมสิน ตราครุฑ) — ย่อเล็กแล้ว
  // กลายเป็นก้อนสีอ่านไม่ออก → เรนเดอร์เป็น wordmark ตัวอักษรขาวบนพื้นแบรนด์แทน
  const textLogo =
    "textLogo" in entry && (entry as { textLogo?: boolean }).textLogo;
  if (textLogo) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: entry.color,
          fontSize: Math.round(size * (entry.short.length > 3 ? 0.3 : 0.36)),
        }}
        className={`rounded-[7px] inline-flex items-center justify-center shrink-0 text-white font-extrabold tracking-tight leading-none ${className}`}
        title={entry.name}
        aria-label={entry.name}
      >
        {entry.short}
      </div>
    );
  }
  // โลโก้บางแบงก์เป็นภาพสีเต็มในตัว (เช่น TTB น้ำเงิน+ส้ม) — วางบน
  // พื้นสีแบรนด์แล้วจะกลืน/ตีกัน → ใส่บนพื้นขาวแทน
  const solid = "solid" in entry && (entry as { solid?: boolean }).solid;
  const inner = Math.round(size * (solid ? 0.84 : 0.72));
  return (
    <div
      style={{
        width: size,
        height: size,
        background: solid ? "#fff" : entry.color,
      }}
      className={`rounded-[7px] inline-flex items-center justify-center shrink-0 overflow-hidden ${solid ? "border border-bdr" : ""} ${className}`}
      title={entry.name}
    >
      <img
        src={`${import.meta.env.BASE_URL}banks/${entry.slug}.svg`}
        alt={entry.name}
        width={inner}
        height={inner}
        className="object-contain block"
      />
    </div>
  );
}
