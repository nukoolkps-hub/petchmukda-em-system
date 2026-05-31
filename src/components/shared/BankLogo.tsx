/* ─── BankLogo — render Thai bank SVG จาก public/banks ──────────
   ใช้ slug จาก THAI_BANKS (เช่น "kbank", "bbl") ลงทะเบียนใน
   constants.ts → public/banks/{slug}.svg

   รับ:
   - bank: ชื่อเต็มภาษาไทย (เช่น "ธนาคารกสิกรไทย") — lookup slug ให้
   - size: ความกว้าง/สูง (px)
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
  size = 18,
  className = "",
}: BankLogoProps) {
  const entry = bank ? THAI_BANKS.find((b) => b.name === bank) : null;
  if (!entry) {
    return (
      <Landmark
        size={size}
        strokeWidth={2.2}
        className={className}
        aria-label={bank || "ธนาคาร"}
      />
    );
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}banks/${entry.slug}.svg`}
      alt={entry.name}
      width={size}
      height={size}
      className={`object-contain inline-block ${className}`}
    />
  );
}
