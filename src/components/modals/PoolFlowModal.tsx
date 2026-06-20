import {
  ArrowDown as IconArrowDown,
  Ban as IconBan,
  ChevronDown as IconChevronDown,
  Diamond as IconDiamond,
  Layers as IconLayers,
  Lock as IconLock,
  Network as IconNetwork,
  ShoppingBag as IconShoppingBag,
  TrendingDown as IconTrendingDown,
  Users as IconUsers,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { Employee, Role } from "../../types";
import { currentYearMonth, formatYmThai } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import {
  computePoolSharesForGroup,
  LEGACY_POOL_BUY_ID,
  LEGACY_POOL_NORMAL_ID,
} from "../../utils/salaryUtils";
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
  poolAdjustments?: Record<
    string,
    { items?: { side: string; pieces: number; label: string }[] }
  >;
  storeCalendar?: {
    extraOpenSaturdays: string[];
    extraClosedWeekdays: string[];
    extraClosedSundays?: string[];
  } | null;
  // เดือนนี้ admin "ยืนยันยอด" แล้วหรือยัง — ถ้ายัง ตัวเลขในแผนผังยังเปลี่ยนได้
  // (admin ยังแก้/พนักงานยื่นลาเพิ่มได้) → ล็อกแผนผังกันสับสน เปิดดูได้หลัง
  // confirm เท่านั้น
  isConfirmed?: boolean;
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
  poolAdjustments,
  storeCalendar,
  isConfirmed = false,
}: PoolFlowModalProps) {
  const currentYM = currentYearMonth();

  // เดือนที่มีข้อมูลเงินเดือน (union ของทุกคน)
  const months = useMemo(() => {
    const set = new Set<string>();
    Object.values(salaryData).forEach((byMonth) => {
      Object.keys((byMonth as Record<string, unknown>) || {}).forEach((m) => {
        set.add(m);
      });
    });
    const arr = [...set].sort().reverse();
    if (!arr.includes(currentYM)) arr.unshift(currentYM);
    return arr;
  }, [salaryData, currentYM]);

  // เดือนคงที่ตลอดอายุของ modal: ใช้ initialMonth ที่ caller ส่งมา
  // (เช่น SalaryView ส่ง selectedMonth ของ dropdown) — fallback เป็นเดือน
  // ปัจจุบัน. ไม่มี dropdown ให้เปลี่ยนในตัว modal เพราะ caller คุมไว้แล้ว
  const selectedMonth =
    initialMonth || (months.includes(currentYM) ? currentYM : months[0]);

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
    // ตำแหน่ง "ณ เดือนที่ดู" — snapshot roleId ก่อน fallback ปัจจุบัน
    const ownRoleId =
      salaryData[currentEmployee.id]?.[selectedMonth]?.roleId ??
      currentEmployee.roleId;
    const ownRole = roles.find((r) => r.id === ownRoleId);
    return ownRole?.poolGroup || null;
  }, [isAdmin, currentEmployee, roles, salaryData, selectedMonth]);

  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    isAdmin ? poolGroups[0]?.id || null : ownPoolGroup,
  );
  const activeGroup = isAdmin ? selectedGroup : ownPoolGroup;

  // สมาชิกใน pool group ของเดือนนี้
  // admin: enumerate จาก employeeDirectory (มีครบ + ชื่อจริง)
  // employee: enumerate จาก salaryData ตาม roleId snapshot (มีแค่ pieces ของคนอื่น
  //           — ไม่มีชื่อ) + รวมตัวเองเสมอ
  const groupEmployeeIds = useMemo(() => {
    if (!activeGroup) return [];
    if (isAdmin) {
      return employeeDirectory
        .filter((e) => {
          if (e.salaryDisabled) return false;
          const roleIdForMonth =
            salaryData[e.id]?.[selectedMonth]?.roleId ?? e.roleId;
          const r = roles.find((rl) => rl.id === roleIdForMonth);
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
        roles,
        poolAdjustment: poolAdjustments?.[selectedMonth] || null,
        poolGroup: activeGroup,
        storeCalendar,
      }),
    [
      groupEmployeeIds,
      salaryData,
      allLeaves,
      selectedMonth,
      employeeDirectory,
      poolAdjustments,
      activeGroup,
      storeCalendar,
    ],
  );

  // ชื่อแสดงผล (admin = ชื่อจริง · พนักงาน = "คุณ" / "เพื่อนร่วมงาน #n")
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
        labels[id] = { name: `เพื่อนร่วมงาน #${peerNo}`, isSelf: false };
      }
    });
    return labels;
  }, [groupEmployeeIds, isAdmin, employeeDirectory, currentEmployee]);

  const monthLabel = formatYmThai(selectedMonth);

  const sample = groupEmployeeIds.length ? shares[groupEmployeeIds[0]] : null;
  // pool items (kind=pool เท่านั้น) ที่มีอย่างน้อย 1 คนทำได้ หรือมีคนเข้ากอง
  const flowItems: { id: string; label: string }[] = (() => {
    if (!sample?.poolItems) return [];
    return sample.poolItems
      .filter((it: any) => it.kind === "pool")
      .filter((it: any) => {
        // เช็คเฉพาะ item นี้: มี pool total > 0 หรือมีคนสักคนเข้ากองเฉพาะ
        // item นี้ (eligible + allocated > 0) — เดิมใช้ Object.values(itemShares)
        // .some ครอบทุก item ของ sample → ถ้าคนนี้ได้กองของ item อื่น
        // item นี้ก็โผล่ทั้งที่ไม่มี data
        const total = sample.totalItemPool?.[it.id] ?? 0;
        if (total > 0) return true;
        // เช็คทั้ง group: มีพนักงานคนใดได้กองของ item นี้ไหม
        return groupEmployeeIds.some((empId) => {
          const s = shares[empId]?.itemShares?.[it.id];
          return s?.eligible && s?.allocatedPieces > 0;
        });
      })
      .map((it: any) => ({ id: it.id, label: it.label }));
  })();

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

      {/* controls — เดือนไม่มี dropdown แล้ว (โชว์อยู่ใน subtitle header แล้ว
          + เปิดมาตาม dropdown เดือนของหน้าที่เรียก) เหลือเฉพาะ pool group
          สำหรับ admin ที่อาจมีหลายกลุ่ม */}
      {isAdmin && poolGroups.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Dropdown
            icon={<IconUsers size={13} strokeWidth={2.4} />}
            value={selectedGroup || ""}
            onChange={setSelectedGroup}
            options={poolGroups.map((g) => ({ value: g.id, label: g.label }))}
          />
        </div>
      )}
      {!isAdmin && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-[9px] bg-gold-pale border border-gold/30 text-sm font-semibold text-maroon">
            <IconUsers size={13} strokeWidth={2.4} />
            {poolGroups.find((g) => g.id === ownPoolGroup)?.label || "ทีมของคุณ"}
          </div>
        </div>
      )}

      {/* body */}
      {!isConfirmed ? (
        <LockedState monthLabel={monthLabel} />
      ) : !activeGroup ? (
        <EmptyState text="ตำแหน่งของคุณไม่ได้ใช้ระบบกองกลาง — ค่าคอมคิดตามจำนวนชิ้นของตัวเองโดยตรง" />
      ) : groupEmployeeIds.length === 0 ? (
        <EmptyState text={`ยังไม่มีข้อมูลค่าคอมของทีมนี้ในเดือน ${monthLabel}`} />
      ) : flowItems.length === 0 ? (
        <EmptyState text={`ยังไม่มีการขายหรือรับซื้อในเดือน ${monthLabel}`} />
      ) : (
        <div className="flex flex-col gap-5">
          {flowItems.map((it) => (
            <PoolItemFlow
              key={it.id}
              itemId={it.id}
              title={it.label}
              titleIcon={
                it.id === LEGACY_POOL_BUY_ID ? (
                  <IconShoppingBag size={15} strokeWidth={2.4} />
                ) : (
                  <IconDiamond size={15} strokeWidth={2.4} />
                )
              }
              groupEmployeeIds={groupEmployeeIds}
              shares={shares}
              nameOf={nameOf}
            />
          ))}
          <div className="text-center text-xs text-txt-soft flex items-center justify-center gap-1.5">
            <IconLayers size={12} strokeWidth={2.2} />
            ตัวเลขคำนวณจากสูตรเดียวกับสลิปเงินเดือนและหน้าจ่ายเงินของแอดมิน
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full p-3.5 mt-5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
      >
        ปิด
      </button>
    </BaseModal>
  );
}

/* ─── One side (ขาย หรือ รับซื้อ) ───────────────────────────────── */
function PoolItemFlow({
  itemId,
  title,
  titleIcon,
  groupEmployeeIds,
  shares,
  nameOf,
}: {
  itemId: string;
  title: string;
  titleIcon: any;
  groupEmployeeIds: string[];
  shares: Record<string, any>;
  nameOf: Record<string, any>;
}) {
  const sample = shares[groupEmployeeIds[0]];
  const itemShare = sample.itemShares?.[itemId];
  const totalPool = sample.totalItemPool?.[itemId] ?? 0;
  const grossPool = sample.grossItemPool?.[itemId] ?? totalPool;
  const excludedTotal = Math.max(0, grossPool - totalPool);
  const topPieces = sample.topItemPieces?.[itemId] ?? 0;
  const poolItemCfg = (sample.poolItems || []).find(
    (it: any) => it.id === itemId,
  );
  const threshold = topPieces * ((poolItemCfg?.threshold ?? 80) / 100);
  // Phase 4 audit fix: per-item adjustment items (รวม custom) · fallback ไป
  // legacy excludedNormalItems/excludedBuyItems ถ้าไม่มี
  const excludedItems =
    sample.excludedItemsByItemId?.[itemId] ??
    (itemId === LEGACY_POOL_NORMAL_ID
      ? (sample.excludedNormalItems ?? [])
      : itemId === LEGACY_POOL_BUY_ID
        ? (sample.excludedBuyItems ?? [])
        : []);

  // เรียงตามชิ้นมาก→น้อย · per-item
  const members = groupEmployeeIds
    .map((id) => {
      const s = shares[id];
      const itemShareForEmp = s.itemShares?.[itemId];
      const excludedIds = new Set<string>(s.excludedItemIds || []);
      const excluded = excludedIds.has(itemId);
      const pieces = s.itemPieces?.[itemId] ?? 0;
      return {
        id,
        ...nameOf[id],
        pieces,
        leaveDays: s.leaveDays,
        eligible: itemShareForEmp?.eligible ?? false,
        sharePercent: itemShareForEmp?.finalSharePercent ?? 0,
        allocated: itemShareForEmp?.allocatedPieces ?? 0,
        excluded,
        exclusion: s.poolExclusion,
      };
    })
    .sort((a, b) => b.pieces - a.pieces);
  const eligibleCount = members.filter((m) => m.eligible).length;
  const baseSharePercent = eligibleCount > 0 ? 100 / eligibleCount : 0;

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
            {m.exclusion && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red bg-red-lt rounded px-1 py-0.5 mt-0.5">
                <IconBan size={9} strokeWidth={2.6} />
                {exclusionLabel(m.exclusion)}
              </span>
            )}
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
            {!m.eligible && !m.excluded && (
              <div className="text-[10px] font-bold text-red mt-0.5 inline-flex items-center gap-0.5">
                <IconTrendingDown size={10} strokeWidth={2.6} />
                ต่ำกว่า 80%
              </div>
            )}
          </div>
        ))}
      </div>

      <Arrow />

      {/* Step 2: รวม Pool + หักรายการที่ admin ตั้งไว้ + ฐาน% */}
      <div className="rounded-[10px] bg-linear-135 from-maroon to-maroon-lt text-white px-3.5 py-2.5 text-center">
        <div className="text-xs text-gold-lt/70">กองกลางรวมทั้งทีม</div>
        <div className="text-xl font-extrabold text-gold-lt">
          {formatThaiNumber(totalPool)}{" "}
          <span className="text-sm font-semibold">ชิ้น</span>
        </div>
        {excludedTotal > 0 && (
          <div className="text-[11px] text-gold-lt/80 mt-1 text-left bg-white/10 rounded px-2 py-1.5">
            <div className="font-semibold mb-0.5">
              ก่อนหัก {formatThaiNumber(grossPool)} −{" "}
              {formatThaiNumber(excludedTotal)} = {formatThaiNumber(totalPool)}{" "}
              ชิ้น
            </div>
            {excludedItems.map((it, idx) => (
              <div key={idx} className="opacity-90">
                · {it.label || "(ไม่ระบุเหตุผล)"}: {formatThaiNumber(it.pieces)} ชิ้น
              </div>
            ))}
          </div>
        )}
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
function exclusionLabel(ex: string | null | undefined): string {
  if (ex === "both") return "ปิดทั้งคู่";
  if (ex === "sell") return "ปิดฝั่งขาย";
  if (ex === "buy") return "ปิดฝั่งรับซื้อ";
  return "";
}

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

function LockedState({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="text-center py-10 px-6 bg-cream/50 rounded-[14px] border border-dashed border-bdr flex flex-col items-center gap-2.5">
      <div className="w-12 h-12 rounded-full bg-amber-lt flex items-center justify-center">
        <IconLock size={22} className="text-amber" strokeWidth={2.4} />
      </div>
      <div className="font-bold text-txt text-base">รอยืนยันยอด</div>
      <div className="text-sm text-txt-soft">
        เดือน {monthLabel} ยังไม่ได้ยืนยันยอด
      </div>
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
