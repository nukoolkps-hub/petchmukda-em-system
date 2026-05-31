import {
  ArrowDown as IconArrowDown,
  Ban as IconBan,
  CalendarDays as IconCalendar,
  ChevronDown as IconChevronDown,
  Diamond as IconDiamond,
  Layers as IconLayers,
  Network as IconNetwork,
  ShoppingBag as IconShoppingBag,
  TrendingDown as IconTrendingDown,
  Users as IconUsers,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { THAI_MONTH_NAMES } from "../../constants";
import type { Employee, Role } from "../../types";
import { formatThaiNumber } from "../../utils/format";
import { computePoolSharesForGroup } from "../../utils/salaryUtils";
import BaseModal from "../shared/BaseModal";

interface PoolFlowModalProps {
  onClose: () => void;
  isAdmin?: boolean;
  currentEmployee?: Employee | null;
  employeeDirectory?: Employee[];
  salaryData?: Record<string, Record<string, any>>;
  allLeaves?: any[];
  roles?: Role[];
  initialMonth?: string;
}

/* ─── Pool Flow Modal — แผนผังการแบ่งค่าคอม Pool ─────────────────
   อธิบาย flow: ใครขาย/รับซื้อกี่ชิ้น → รวม Pool → หักวันลา → แบ่งเพื่อน
   → ได้ชิ้นจริง. ใช้ computePoolSharesForGroup (source เดียวกับ /salary และ
   /admin/payroll) เพื่อให้ตัวเลขตรงกันทั้งระบบ.

   Admin: เลือก pool group ได้ทุกกลุ่ม + เห็นชื่อจริงของทุกคน
   พนักงาน: ล็อกที่ pool group ของตัวเอง + เพื่อนแสดงแบบไม่ระบุชื่อ
            (employeeDirectory ฝั่งพนักงานมีแค่ตัวเอง — ปกป้องความเป็นส่วนตัว) */
export default function PoolFlowModal({
  onClose,
  isAdmin = false,
  currentEmployee = null,
  employeeDirectory = [],
  salaryData = {},
  allLeaves = [],
  roles = [],
  initialMonth,
}: PoolFlowModalProps) {
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // เดือนที่มีข้อมูลเงินเดือน (union ของทุกคน)
  const months = useMemo(() => {
    const set = new Set<string>();
    Object.values(salaryData).forEach((byMonth) => {
      Object.keys((byMonth as Record<string, unknown>) || {}).forEach((m) => {
        set.add(m);
      });
    });
    const arr = [...set].sort().reverse();
    if (!arr.includes(currentYearMonth)) arr.unshift(currentYearMonth);
    return arr;
  }, [salaryData, currentYearMonth]);

  // ค่าเริ่ม: ใช้ initialMonth ถ้า caller ระบุ (เช่น เปิดจาก SalaryView ตาม
  // dropdown เดือนที่พนักงานกำลังดูอยู่) — fallback มาเดือนปัจจุบัน
  const [selectedMonth, setSelectedMonth] = useState(
    initialMonth ||
      (months.includes(currentYearMonth) ? currentYearMonth : months[0]),
  );

  // pool groups ที่มีอยู่ (เฉพาะ role ที่ poolGroup ไม่ว่าง)
  const poolGroups = useMemo(() => {
    const map = new Map<string, string>(); // poolGroup → label (ชื่อ role รวม)
    roles.forEach((r) => {
      if (!r.poolGroup) return;
      const prev = map.get(r.poolGroup);
      map.set(r.poolGroup, prev ? `${prev} / ${r.name}` : r.name);
    });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [roles]);

  // pool group ของพนักงานเอง (ใช้ล็อกฝั่ง employee)
  const ownPoolGroup = useMemo(() => {
    if (isAdmin || !currentEmployee) return null;
    const ownRole = roles.find((r) => r.id === currentEmployee.roleId);
    return ownRole?.poolGroup || null;
  }, [isAdmin, currentEmployee, roles]);

  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    isAdmin ? poolGroups[0]?.id || null : ownPoolGroup,
  );
  const activeGroup = isAdmin ? selectedGroup : ownPoolGroup;

  // สมาชิกใน pool group ของเดือนนี้
  // admin: enumerate จาก employeeDirectory (มีครบ + ชื่อจริง)
  // employee: enumerate จาก salaryData ตาม roleId snapshot (มีแค่ pieces ของเพื่อน
  //           — ไม่มีชื่อ) + รวมตัวเองเสมอ
  const groupEmployeeIds = useMemo(() => {
    if (!activeGroup) return [];
    if (isAdmin) {
      return employeeDirectory
        .filter((e) => {
          const r = roles.find((rl) => rl.id === e.roleId);
          return r?.poolGroup === activeGroup;
        })
        .map((e) => e.id);
    }
    const ids = new Set<string>();
    if (currentEmployee?.id) ids.add(currentEmployee.id);
    Object.keys(salaryData).forEach((peerId) => {
      const peerSalary = salaryData[peerId]?.[selectedMonth];
      if (!peerSalary?.roleId) return;
      const peerRole = roles.find((r) => r.id === peerSalary.roleId);
      if (peerRole?.poolGroup === activeGroup) ids.add(peerId);
    });
    return [...ids];
  }, [
    activeGroup,
    isAdmin,
    employeeDirectory,
    roles,
    salaryData,
    selectedMonth,
    currentEmployee,
  ]);

  const shares = useMemo(
    () =>
      computePoolSharesForGroup({
        groupEmployeeIds,
        salaryData,
        allLeaves,
        yearMonth: selectedMonth,
        employeeDirectory,
      }),
    [groupEmployeeIds, salaryData, allLeaves, selectedMonth, employeeDirectory],
  );

  // ชื่อแสดงผล (admin = ชื่อจริง · พนักงาน = "คุณ" / "เพื่อนร่วมทีม #n")
  const nameOf = useMemo(() => {
    const sorted = [...groupEmployeeIds].sort();
    let peerNo = 0;
    const labels: Record<string, { name: string; isSelf: boolean }> = {};
    sorted.forEach((id) => {
      const isSelf = !isAdmin && id === currentEmployee?.id;
      if (isAdmin) {
        const e = employeeDirectory.find((emp) => emp.id === id);
        labels[id] = { name: e?.name || "—", isSelf: false };
      } else if (isSelf) {
        labels[id] = {
          name: `${currentEmployee?.name || "คุณ"} (คุณ)`,
          isSelf: true,
        };
      } else {
        peerNo += 1;
        labels[id] = { name: `เพื่อนร่วมทีม #${peerNo}`, isSelf: false };
      }
    });
    return labels;
  }, [groupEmployeeIds, isAdmin, employeeDirectory, currentEmployee]);

  const monthLabel = (() => {
    const [y, mo] = selectedMonth.split("-");
    return `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;
  })();

  const sample = groupEmployeeIds.length ? shares[groupEmployeeIds[0]] : null;
  const hasSell =
    !!sample &&
    (sample.totalSellPoolPieces > 0 || sample.eligibleSellEmployeeCount > 0);
  const hasBuy =
    !!sample &&
    (sample.totalBuyPoolPieces > 0 || sample.eligibleBuyEmployeeCount > 0);

  return (
    <BaseModal
      onClose={onClose}
      maxWidthClass="max-w-[620px]"
      contentClassName="px-4.5 pt-5 pb-6"
    >
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-[46px] h-[46px] rounded-xl bg-linear-135 from-maroon to-maroon-lt flex items-center justify-center shadow-[0_4px_14px_rgba(123,28,28,0.25)] shrink-0">
          <IconNetwork size={22} color="#fff" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt">แผนผังเงินเดือน</div>
          <div className="text-sm text-txt-soft mt-0.5">
            การแบ่งค่าคอมกองกลาง · {monthLabel}
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Dropdown
          icon={<IconCalendar size={13} strokeWidth={2.4} />}
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={months.map((m) => {
            const [y, mo] = m.split("-");
            return {
              value: m,
              label: `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`,
            };
          })}
        />
        {isAdmin ? (
          poolGroups.length > 0 && (
            <Dropdown
              icon={<IconUsers size={13} strokeWidth={2.4} />}
              value={selectedGroup || ""}
              onChange={setSelectedGroup}
              options={poolGroups.map((g) => ({ value: g.id, label: g.label }))}
            />
          )
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-[9px] bg-gold-pale border border-gold/30 text-sm font-semibold text-maroon">
            <IconUsers size={13} strokeWidth={2.4} />
            {poolGroups.find((g) => g.id === ownPoolGroup)?.label || "ทีมของคุณ"}
          </div>
        )}
      </div>

      {/* body */}
      {!activeGroup ? (
        <EmptyState text="ตำแหน่งของคุณไม่ได้ใช้ระบบกองกลาง — ค่าคอมคิดตามจำนวนชิ้นของตัวเองโดยตรง" />
      ) : groupEmployeeIds.length === 0 ? (
        <EmptyState text={`ยังไม่มีข้อมูลค่าคอมของทีมนี้ในเดือน ${monthLabel}`} />
      ) : !hasSell && !hasBuy ? (
        <EmptyState text={`ยังไม่มีการขายหรือรับซื้อในเดือน ${monthLabel}`} />
      ) : (
        <div className="flex flex-col gap-5">
          {hasSell && (
            <PoolSideFlow
              side="sell"
              title="ฝั่งขาย"
              titleIcon={<IconDiamond size={15} strokeWidth={2.4} />}
              groupEmployeeIds={groupEmployeeIds}
              shares={shares}
              nameOf={nameOf}
            />
          )}
          {hasBuy && (
            <PoolSideFlow
              side="buy"
              title="ฝั่งรับซื้อ"
              titleIcon={<IconShoppingBag size={15} strokeWidth={2.4} />}
              groupEmployeeIds={groupEmployeeIds}
              shares={shares}
              nameOf={nameOf}
            />
          )}
          <div className="text-center text-xs text-txt-soft flex items-center justify-center gap-1.5">
            <IconLayers size={12} strokeWidth={2.2} />
            ตัวเลขคำนวณจากสูตรเดียวกับสลิปเงินเดือนและหน้าจ่ายเงินของแอดมิน
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full p-3.5 mt-5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit]"
      >
        ปิด
      </button>
    </BaseModal>
  );
}

/* ─── One side (ขาย หรือ รับซื้อ) ───────────────────────────────── */
function PoolSideFlow({
  side,
  title,
  titleIcon,
  groupEmployeeIds,
  shares,
  nameOf,
}) {
  const isSell = side === "sell";
  const sample = shares[groupEmployeeIds[0]];
  const totalPool = isSell
    ? sample.totalSellPoolPieces
    : sample.totalBuyPoolPieces;
  const eligibleCount = isSell
    ? sample.eligibleSellEmployeeCount
    : sample.eligibleBuyEmployeeCount;
  const baseSharePercent = isSell
    ? sample.sellBaseSharePercent
    : sample.buyBaseSharePercent;
  const threshold = isSell
    ? sample.sellEligibilityThreshold
    : sample.buyEligibilityThreshold;
  const topPieces = isSell ? sample.topSellPieces : sample.topBuyPieces;

  // เรียงตามชิ้นมาก→น้อย
  const members = groupEmployeeIds
    .map((id) => {
      const s = shares[id];
      const exclusion = s.poolExclusion;
      const excluded = exclusion === side || exclusion === "both";
      return {
        id,
        ...nameOf[id],
        pieces: isSell ? s.employeeSellPieces : s.employeeBuyPieces,
        leaveDays: s.leaveDays,
        eligible: isSell ? s.eligibleForSellPool : s.eligibleForBuyPool,
        sharePercent: isSell ? s.sellSharePercent : s.buySharePercent,
        allocated: isSell ? s.normalSalePieces : s.buyPieces,
        excluded,
      };
    })
    .sort((a, b) => b.pieces - a.pieces);

  return (
    <div className="rounded-[14px] border border-bdr bg-cream/40 p-3.5">
      <div className="flex items-center gap-1.5 font-bold text-maroon text-sm mb-3">
        {titleIcon}
        {title}
        <span className="ml-auto text-xs font-semibold text-txt-soft">
          มีสิทธิ์ {eligibleCount} คน
        </span>
      </div>

      {/* Step 1: ใครขาย/รับซื้อกี่ชิ้น + วันลา */}
      <StepLabel n={1} text="ชิ้นที่ทำได้ + วันลาของแต่ละคน" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {members.map((m) => (
          <div
            key={m.id}
            className={`rounded-[10px] px-2.5 py-2 border ${
              m.isSelf
                ? "border-gold bg-gold-pale/60 shadow-[0_0_0_1.5px_var(--color-gold)]"
                : m.eligible
                  ? "border-bdr bg-white"
                  : "border-red/30 bg-red-lt/50"
            }`}
          >
            <div className="text-xs font-bold text-txt truncate">{m.name}</div>
            <div className="text-base font-extrabold text-maroon leading-tight">
              {formatThaiNumber(m.pieces)}
              <span className="text-xs font-semibold text-txt-soft"> ชิ้น</span>
            </div>
            <div className="text-[11px] text-txt-soft mt-0.5">
              ลา {m.leaveDays} วัน
              {m.leaveDays > 2 && (
                <span className="text-red font-semibold">
                  {" "}
                  (หัก {m.leaveDays - 2})
                </span>
              )}
            </div>
            {!m.eligible && (
              <div className="text-[10px] font-bold text-red mt-0.5 inline-flex items-center gap-0.5">
                {m.excluded ? (
                  <>
                    <IconBan size={10} strokeWidth={2.6} />
                    ปิดสิทธิ์
                  </>
                ) : (
                  <>
                    <IconTrendingDown size={10} strokeWidth={2.6} />
                    ต่ำกว่า 80%
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Arrow />

      {/* Step 2: รวม Pool + ฐาน% */}
      <div className="rounded-[10px] bg-linear-135 from-maroon to-maroon-lt text-white px-3.5 py-2.5 text-center">
        <div className="text-xs text-gold-lt/70">กองกลางรวมทั้งทีม</div>
        <div className="text-xl font-extrabold text-gold-lt">
          {formatThaiNumber(totalPool)}{" "}
          <span className="text-sm font-semibold">ชิ้น</span>
        </div>
        <div className="text-[11px] text-gold-lt/60 mt-0.5">
          เกณฑ์เข้ากองกลาง: ≥ 80% ของสูงสุด ({formatThaiNumber(topPieces)} ชิ้น) ={" "}
          {formatThaiNumber(threshold)} ชิ้น
        </div>
      </div>

      <Arrow />

      <StepLabel
        n={2}
        text={`เปอร์เซ็นต์ฐาน = 100% ÷ ${eligibleCount} คน = ${baseSharePercent.toFixed(2)}% ต่อคน`}
      />

      <Arrow />

      {/* Step 3 + 4: % สุทธิ + ชิ้นที่ได้จริง */}
      <StepLabel n={3} text="หักวันลาที่เกิน 2 (2 วันแรกฟรี) → เกลี่ยให้เพื่อน → ได้ชิ้นจริง" />
      <div className="flex flex-col gap-1.5">
        {members
          .filter((m) => m.eligible)
          .map((m) => {
            const diff = m.sharePercent - baseSharePercent;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-2 rounded-[10px] px-3 py-2 border ${
                  m.isSelf
                    ? "border-gold bg-gold-pale/50"
                    : "border-bdr bg-white"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-txt truncate">
                    {m.name}
                  </div>
                  <div className="text-[11px] text-txt-soft">
                    {m.sharePercent.toFixed(2)}%
                    {Math.abs(diff) >= 0.01 && (
                      <span className={diff > 0 ? "text-green" : "text-red"}>
                        {" "}
                        ({diff > 0 ? "+" : ""}
                        {diff.toFixed(2)} จากฐาน)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-extrabold text-maroon leading-tight">
                    {formatThaiNumber(m.allocated)}
                  </div>
                  <div className="text-[10px] text-txt-soft">ชิ้นที่ได้</div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ─── bits ──────────────────────────────────────────────────────── */
function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-0.5">
      <span className="w-5 h-5 rounded-full bg-maroon text-white text-xs font-bold flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="text-xs font-semibold text-txt-mid">{text}</span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center py-1.5 text-gold">
      <IconArrowDown size={18} strokeWidth={2.6} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-txt-soft py-10 px-6 text-sm bg-cream/50 rounded-[14px] border border-dashed border-bdr">
      {text}
    </div>
  );
}

function Dropdown({
  icon,
  value,
  onChange,
  options,
}: {
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer pl-7 pr-7 py-[7px] rounded-[9px] border border-bdr text-sm font-semibold text-txt bg-cream font-[inherit] outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={12}
        strokeWidth={2.4}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
      />
    </div>
  );
}
