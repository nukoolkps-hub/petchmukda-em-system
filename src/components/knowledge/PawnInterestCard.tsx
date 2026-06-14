/* ─── PawnInterestCard — ดอกเบี้ยจำนำ พร้อมตัวช่วยปฏิทิน auto-fill ──────
   wrapper รวม DateDiffHelper + Calculator · เลือกวันที่ในปฏิทินจะ auto-fill
   "เดือนเต็ม" + "วันเศษ" ของเครื่องคิดเลขให้เอง · user แก้ตัวเลขทับได้     */

import { useState } from "react";
import Calculator from "./Calculator";
import DateDiffHelper from "./DateDiffHelper";

export default function PawnInterestCard() {
  const [preset, setPreset] = useState<Record<string, number>>({});

  return (
    <>
      <DateDiffHelper
        hint="เลือกวันที่ → ระบบจะเติม &quot;เดือนเต็ม&quot; + &quot;วันเศษ&quot; ในเครื่องคิดเลขให้เอง · แก้ตัวเลขเองได้"
        onComputed={(months, days) => {
          // อัปเดตเฉพาะเมื่อค่าเปลี่ยน — กัน re-render ลูปจาก Calculator
          setPreset((p) => {
            if (p.months === months && p.extraDays === days) return p;
            return { months, extraDays: days };
          });
        }}
      />
      <Calculator
        title="ดอกเบี้ยจำนำ (รวมขั้นต่ำ 30 ฿)"
        inputs={[
          {
            id: "principal",
            label: "เงินจำนำ",
            suffix: "฿",
          },
          {
            id: "months",
            label: "ระยะเวลา (เดือนเต็ม)",
            suffix: "ด.",
          },
          {
            id: "extraDays",
            label: "วันเศษ (0-31)",
            suffix: "ว.",
          },
        ]}
        compute={({ principal, months, extraDays }) => {
          // กัน months = 0 + extraDays = 0 → ยังกรอกไม่ครบ
          if (!(months >= 0) || !(extraDays >= 0)) return [];
          let total = 0;
          for (let i = 0; i < months; i++) {
            total += Math.max(30, principal * 0.015);
          }
          if (extraDays > 0) {
            const rate = extraDays <= 15 ? 0.0075 : 0.015;
            total += Math.max(30, principal * rate);
          }
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          const extraRate = extraDays <= 15 ? "0.75%" : "1.5%";
          const hintExtra =
            extraDays > 0
              ? ` + (${principal} × ${extraRate}, ขั้นต่ำ 30 ฿) วันเศษ`
              : "";
          return [
            {
              label: "ดอกเบี้ยรวมทั้งหมด",
              value: total,
              format: "currency",
              hint: `(${principal} × 1.5%, ขั้นต่ำ 30 ฿) × ${months} ด.${hintExtra}`,
            },
            {
              label: "ยอดที่ต้องจ่ายเพื่อไถ่",
              value: principal + total,
              format: "currency",
              hint: `${principal} + ${fmt(total)}`,
            },
          ];
        }}
        presetValues={preset}
      />
    </>
  );
}
