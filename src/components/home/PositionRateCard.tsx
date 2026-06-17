/* ─── Position + Pay-rate card (live · sync จาก admin ทันที) ─────
 * แสดงตำแหน่ง + เงินเดือนพื้นฐาน + อัตราค่าคอม "ปัจจุบัน" ของพนักงาน
 * ไม่อิงเดือนปีที่เลือก · อ่านจาก employee record ตรงๆ
 * (collapsible · เปิดอ่านเฉพาะตอนต้องการ) */

import {
  Briefcase as IconBriefcase,
  ChevronDown as IconChevronDown,
  CircleSlash as IconCircleSlash,
} from "lucide-react";
import type { Employee, Role } from "../../types";
import { formatTenure } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import { getEffectiveBaseSalary } from "../../utils/salaryUtils";

function poolExclusionLabel(ex?: string | null): string {
  if (ex === "both") return "ขายทั่วไป + รับซื้อ";
  if (ex === "sell") return "ขายทั่วไป";
  if (ex === "buy") return "รับซื้อ";
  return "";
}

function RateRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | undefined;
  suffix: string;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-txt-mid">{label}</span>
      <span className="text-sm font-bold text-maroon tabular-nums">
        {formatThaiNumber(value || 0)}{" "}
        <span className="text-[10px] text-txt-soft font-normal">{suffix}</span>
      </span>
    </div>
  );
}

interface Props {
  employee: Employee | null | undefined;
  role: Role | null | undefined;
}

export default function PositionRateCard({ employee, role }: Props) {
  if (!role) return null;
  const tenure = formatTenure(employee?.startWorkMonth);
  return (
    <details className="group mb-2.5 rounded-[14px] bg-white border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)] overflow-hidden">
      <summary className="px-4 py-3 cursor-pointer list-none flex items-center gap-3 hover:bg-cream/40">
        <div className="w-9 h-9 rounded-full bg-maroon/10 flex items-center justify-center shrink-0">
          <IconBriefcase size={16} strokeWidth={2.4} className="text-maroon" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-txt truncate">
              เงินเดือนพื้นฐาน · อัตราค่าคอม
            </div>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green/10 text-green text-[9px] font-extrabold uppercase tracking-wider shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green" />
              </span>
              LIVE
            </span>
          </div>
          {(role.poolGroup || tenure) && (
            <div className="text-[11px] text-txt-soft font-semibold mt-0.5">
              {role.poolGroup && `กลุ่ม "${role.poolGroup}"`}
              {role.poolGroup && tenure && " · "}
              {tenure && `อายุงาน ${tenure}`}
            </div>
          )}
        </div>
        <IconChevronDown
          size={14}
          strokeWidth={2.4}
          className="text-txt-soft shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-4 pb-3 pt-2 border-t border-bdr/40 space-y-1.5">
        <RateRow
          label="เงินเดือนพื้นฐาน"
          value={getEffectiveBaseSalary(employee)}
          suffix="฿/เดือน"
        />
        {role.poolGroup ? (
          <>
            <RateRow
              label="ขายทั่วไป (กองกลาง)"
              value={employee?.normalSalePieceRate}
              suffix="฿/ชิ้น"
            />
            <RateRow
              label="ขายพิเศษ"
              value={employee?.specialSalePieceRate}
              suffix="฿/ชิ้น"
            />
            <RateRow
              label="รับซื้อ (กองกลาง)"
              value={employee?.buyPieceRate}
              suffix="฿/ชิ้น"
            />
          </>
        ) : (
          <RateRow
            label="ค่าคอมต่อชิ้น"
            value={employee?.singlePieceRate}
            suffix="฿/ชิ้น"
          />
        )}
        <RateRow
          label="เชิญสมัครบัตร"
          value={employee?.invitePieceRate}
          suffix="฿/ครั้ง"
        />
        <RateRow
          label="ย้ายข้อมูลบัตร"
          value={employee?.transferPieceRate}
          suffix="฿/ครั้ง"
        />
        {employee?.poolExclusion && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber font-semibold pt-1.5 mt-1 border-t border-bdr/40">
            <IconCircleSlash size={12} strokeWidth={2.5} />
            ไม่เข้ากองกลาง: {poolExclusionLabel(employee.poolExclusion)}
          </div>
        )}
      </div>
    </details>
  );
}
