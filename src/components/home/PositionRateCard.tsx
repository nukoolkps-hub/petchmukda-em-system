/* ─── Position + Pay-rate card (live · sync จาก admin ทันที) ─────
 * แสดงตำแหน่ง + เงินเดือนพื้นฐาน + อัตราค่าคอม "ปัจจุบัน" ของพนักงาน
 * ไม่อิงเดือนปีที่เลือก · อ่านจาก employee record ตรงๆ
 * (collapsible · เปิดอ่านเฉพาะตอนต้องการ) */

import {
  Briefcase as IconBriefcase,
  ChevronDown as IconChevronDown,
  CircleSlash as IconCircleSlash,
  Lock as IconLock,
} from "lucide-react";
import type { Employee, Role } from "../../types";
import { formatTenure } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import {
  getEffectiveBaseSalary,
  resolveBonusItemRate,
  resolvePieceItemRate,
  resolvePoolExclusionItemIds,
  resolvePoolItemRate,
  roleBonusItems,
  rolePaysPieceCommission,
  rolePieceItems,
  rolePoolItems,
} from "../../utils/salaryUtils";

/* "ไม่เข้ากองกลาง" footer label · `all`/legacy `both` → "ทั้งหมด" ·
   ที่เหลือ (array หรือ legacy `sell`/`buy`) → "N รายการ" จาก resolved count
   (resolvePoolExclusionItemIds map legacy sell→[normal,special] · buy→[buy]) */
function poolExclusionLabel(isAll: boolean, count: number): string {
  if (count === 0) return "";
  return isAll ? "ทั้งหมด" : `${count} รายการ`;
}

function RateRow({
  label,
  value,
  suffix,
  /** strike-through + lock icon · ใช้ตอน item ถูก exclude · สีแดงเพื่อชัดเจน */
  strike,
}: {
  label: string;
  value: number | undefined;
  suffix: string;
  strike?: boolean;
}) {
  // ใช้ pseudo-element bar (::after) สำหรับ strike แทน text-decoration
  // → เส้นตรงเป๊ะ · thickness เท่ากันทั้งบรรทัด · ไม่ต่างตาม font size
  // bar wrapper: relative inline-block · ::after เป็นแถบสีแดงทับกลางตัว
  const barCls =
    "relative inline-block after:content-[''] after:absolute after:inset-x-0 after:top-1/2 after:-translate-y-1/2 after:h-[3px] after:bg-red/75 after:rounded-full after:pointer-events-none";
  return (
    <div
      className={`flex justify-between items-baseline ${strike ? "text-red/75" : ""}`}
    >
      <span className="text-xs text-txt-mid inline-flex items-center gap-1">
        {strike && (
          <IconLock size={11} strokeWidth={2.5} className="text-red shrink-0" />
        )}
        {strike ? <span className={barCls}>{label}</span> : label}
      </span>
      <span
        className={`text-sm font-bold tabular-nums ${strike ? "text-red/80" : "text-maroon"}`}
      >
        {strike ? (
          <span className={barCls}>
            {formatThaiNumber(value || 0)}{" "}
            <span className="text-[10px] font-normal text-red/80">
              {suffix}
            </span>
          </span>
        ) : (
          <>
            {formatThaiNumber(value || 0)}{" "}
            <span className="text-[10px] text-txt-soft font-normal">
              {suffix}
            </span>
          </>
        )}
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
  // pool items + excluded ids (admin ปิดให้พนักงานคนนี้) · ใช้ขีดทับ
  const poolItemsCfg = role.poolGroup ? rolePoolItems(role) : [];
  const { excludedIds: poolExcludedIds, isAll: poolExcludedIsAll } =
    resolvePoolExclusionItemIds(employee?.poolExclusion as any, poolItemsCfg);
  // นับเฉพาะ kind=pool ที่ถูก exclude (personal items ไม่นับ · inherent)
  const excludedPoolItemsCount = poolItemsCfg.filter(
    (it) => it.kind === "pool" && poolExcludedIds.has(it.id),
  ).length;
  return (
    <details className="group mb-2.5 rounded-[14px] bg-white border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)] overflow-hidden">
      <summary className="px-4 py-3 cursor-pointer list-none flex items-center gap-3 hover:bg-cream/40">
        <div className="w-9 h-9 rounded-full bg-maroon/10 flex items-center justify-center shrink-0">
          <IconBriefcase size={16} strokeWidth={2.4} className="text-maroon" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-txt truncate">
              เงินเดือนพื้นฐานปัจจุบัน · อัตราค่าคอม
            </div>
            <span className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-green/10 text-green text-[9px] font-extrabold uppercase tracking-wider shrink-0">
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
          label="เงินเดือนพื้นฐานปัจจุบัน"
          value={getEffectiveBaseSalary(employee)}
          suffix="฿/เดือน"
        />
        {/* ── หัวข้อ "ค่าคอม" — โผล่เฉพาะตำแหน่งที่มี piece commission ── */}
        {(role.poolGroup ||
          (rolePaysPieceCommission(role) &&
            rolePieceItems(role).length > 0)) && (
          <div className="text-[11px] font-extrabold text-maroon uppercase tracking-wider pt-2 mt-2 border-t border-bdr/40">
            ค่าคอม
          </div>
        )}
        {role.poolGroup
          ? // pool sales — loop poolItems (รวม custom items ที่ admin เพิ่ม)
            // kind=pool → label "(กองกลาง)" · kind=personal → "(ส่วนตัว)"
            // strike-through เฉพาะ kind=pool ที่ถูก admin exclude · personal
            // items ใช้ "(ส่วนตัว)" suffix พอ ไม่ต้อง strike
            poolItemsCfg.map((item) => {
              const excluded =
                item.kind === "pool" && poolExcludedIds.has(item.id);
              const labelSuffix =
                item.kind === "pool" ? " (กองกลาง)" : " (ส่วนตัว)";
              return (
                <RateRow
                  key={item.id}
                  label={`${item.label}${labelSuffix}`}
                  value={resolvePoolItemRate(item.id, null, employee as any)}
                  suffix="฿/ชิ้น"
                  strike={excluded}
                />
              );
            })
          : rolePaysPieceCommission(role)
            ? // multi-item — 1 แถวต่อรายการค่าคอม
              rolePieceItems(role).map((item) => (
                <RateRow
                  key={item.id}
                  label={item.label}
                  value={resolvePieceItemRate(item.id, null, employee)}
                  suffix="฿/ชิ้น"
                />
              ))
            : null}
        {/* ── หัวข้อ "โบนัสอื่นๆ" — โผล่เฉพาะถ้ามี bonus items ── */}
        {rolePaysPieceCommission(role) && roleBonusItems(role).length > 0 && (
          <div className="text-[11px] font-extrabold text-maroon uppercase tracking-wider pt-2 mt-2 border-t border-bdr/40">
            โบนัสอื่นๆ
          </div>
        )}
        {rolePaysPieceCommission(role) &&
          roleBonusItems(role).map((item) => (
            <RateRow
              key={item.id}
              label={item.label}
              value={resolveBonusItemRate(item.id, null, employee as any)}
              suffix="฿/ครั้ง"
            />
          ))}
        {/* footer "ไม่เข้ากองกลาง" · นับเฉพาะ kind=pool ที่ถูก admin exclude
            (personal items ไม่นับ · inherent อยู่แล้ว ไม่ใช่ admin block) */}
        {excludedPoolItemsCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber font-semibold pt-1.5 mt-1 border-t border-bdr/40">
            <IconCircleSlash size={12} strokeWidth={2.5} />
            ไม่เข้ากองกลาง:{" "}
            {poolExclusionLabel(poolExcludedIsAll, excludedPoolItemsCount)}
          </div>
        )}
      </div>
    </details>
  );
}
