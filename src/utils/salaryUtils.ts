/* ─── Salary calculation helpers ───────────────────────────────── */

import { BUSINESS_RULES } from "../constants";
import type { PieceItem } from "../types";
import { countWeekdayLeaves, getOverQuotaDays } from "./leaveUtils";

/* ─── Role piece-commission policy ────────────────────────────────
   ตำแหน่งเก็บค่าคอมแยก 3 รูปแบบ:
   1. Pool sales — poolGroup ตั้ง → ใช้ normal/special/buy + invite/transfer
   2. Multi piece — poolGroup ว่าง + pieceItems ≥ 1 → แต่ละรายการมี rate
      (ต่อพนักงาน) + จำนวนชิ้น (ต่อเดือน) + invite/transfer
   3. ไม่มีค่าคอม — poolGroup ว่าง + ไม่มี pieceItems → เงินเดือนพื้นฐานอย่างเดียว
      (พนักงานทั่วไป รปภ. ทำความสะอาด)
   backward-compat: legacy role ที่มี pieceLabel (single) → migrate-on-read เป็น
   1 pieceItem id="default" ที่อ่าน rate จาก singlePieceRate + จำนวนจาก
   singleRatePieces                                                            */

/** id ของ piece item เริ่มต้น (legacy single-rate) — map กับ singlePieceRate /
 *  singleRatePieces ของข้อมูลเก่า                                              */
export const LEGACY_PIECE_ITEM_ID = "default";

interface RolePieceShape {
  poolGroup?: string | null;
  pieceItems?: PieceItem[] | null;
  pieceLabel?: string | null;
}

/** รายการ piece item ของตำแหน่ง (normalize legacy pieceLabel → 1 item)
 *  คืน [] ถ้า pool sales หรือไม่มีค่าคอมรายชิ้น                                  */
export function rolePieceItems(
  role: RolePieceShape | null | undefined,
): PieceItem[] {
  if (!role || role.poolGroup) return [];
  if (Array.isArray(role.pieceItems) && role.pieceItems.length > 0) {
    return role.pieceItems
      .filter((it) => it && it.id && (it.label ?? "").trim())
      .map((it) => ({ id: it.id, label: it.label.trim() }));
  }
  // legacy single label → 1 item id="default"
  if (role.pieceLabel?.trim()) {
    return [{ id: LEGACY_PIECE_ITEM_ID, label: role.pieceLabel.trim() }];
  }
  return [];
}

/** ตำแหน่งนี้มีค่าคอมแบบ "ต่อชิ้น" (รวม invite/transfer ด้วย) ไหม
 *  คืน true ถ้า: pool sales หรือ non-pool ที่มี pieceItems ≥ 1                  */
export function rolePaysPieceCommission(
  role: RolePieceShape | null | undefined,
): boolean {
  if (!role) return false;
  if (role.poolGroup) return true;
  return rolePieceItems(role).length > 0;
}

/** label ของ piece item แรก · "" ถ้าตำแหน่งไม่ใช้ piece (pool / no commission)
 *  ใช้แสดงหัวข้อรวมตอนมีรายการเดียว — backward-compat กับโค้ดเดิม                */
export function rolePieceLabel(
  role: RolePieceShape | null | undefined,
): string {
  const items = rolePieceItems(role);
  return items[0]?.label || "";
}

/** อัตราค่าคอมต่อชิ้นของ item นี้ (ต่อพนักงาน) — snapshot (salary) ก่อน live (rates)
 *  legacy item "default" → fallback singlePieceRate                            */
export function resolvePieceItemRate(
  itemId: string,
  salary:
    | { pieceRates?: Record<string, number>; singlePieceRate?: number }
    | null
    | undefined,
  rates:
    | { pieceRates?: Record<string, number>; singlePieceRate?: number }
    | null
    | undefined,
): number {
  if (salary?.pieceRates && typeof salary.pieceRates[itemId] === "number")
    return salary.pieceRates[itemId];
  if (itemId === LEGACY_PIECE_ITEM_ID && salary?.singlePieceRate != null)
    return salary.singlePieceRate;
  if (rates?.pieceRates && typeof rates.pieceRates[itemId] === "number")
    return rates.pieceRates[itemId];
  if (itemId === LEGACY_PIECE_ITEM_ID) return rates?.singlePieceRate ?? 0;
  return 0;
}

/** จำนวนชิ้นของ item นี้ในเดือน (จาก salary doc) — legacy "default" → fallback
 *  singleRatePieces                                                            */
export function resolvePieceItemPieces(
  itemId: string,
  salary:
    | { piecePieces?: Record<string, number>; singleRatePieces?: number }
    | null
    | undefined,
): number {
  if (salary?.piecePieces && typeof salary.piecePieces[itemId] === "number")
    return salary.piecePieces[itemId];
  if (itemId === LEGACY_PIECE_ITEM_ID) return salary?.singleRatePieces ?? 0;
  return 0;
}

/* ─── Pool items (ก่อนหน้านี้: hardcode normal/special/buy) ──────────────
   role.poolItems = null/undefined → migrate default 3 items
   role.poolItems = []             → no items (display 0)
   role.poolItems = [items]        → admin custom รายการเอง                     */
export const LEGACY_POOL_NORMAL_ID = "normal";
export const LEGACY_POOL_SPECIAL_ID = "special";
export const LEGACY_POOL_BUY_ID = "buy";
const DEFAULT_POOL_THRESHOLD_PCT = 80;
const DEFAULT_POOL_ITEMS: {
  id: string;
  label: string;
  kind: "pool" | "personal";
  threshold: number;
}[] = [
  {
    id: LEGACY_POOL_NORMAL_ID,
    label: "ขายทั่วไป",
    kind: "pool",
    threshold: DEFAULT_POOL_THRESHOLD_PCT,
  },
  {
    id: LEGACY_POOL_SPECIAL_ID,
    label: "ขายพิเศษ",
    kind: "personal",
    threshold: DEFAULT_POOL_THRESHOLD_PCT,
  },
  {
    id: LEGACY_POOL_BUY_ID,
    label: "รับซื้อ",
    kind: "pool",
    threshold: DEFAULT_POOL_THRESHOLD_PCT,
  },
];
export function rolePoolItems(
  role:
    | {
        poolItems?:
          | { id: string; label: string; kind?: string; threshold?: number }[]
          | null;
        poolGroup?: string | null;
      }
    | null
    | undefined,
): typeof DEFAULT_POOL_ITEMS {
  if (!role) return [];
  // ตำแหน่งที่ไม่ใช่ pool sales (poolGroup ว่าง) → ไม่มี pool items
  if (!role.poolGroup) return [];
  if (Array.isArray(role.poolItems)) {
    return role.poolItems.map((it) => ({
      id: it.id,
      label: it.label,
      kind: it.kind === "personal" ? "personal" : "pool",
      threshold:
        typeof it.threshold === "number"
          ? Math.max(0, Math.min(100, it.threshold))
          : DEFAULT_POOL_THRESHOLD_PCT,
    }));
  }
  // null/undefined → default 3 items (legacy migration)
  return DEFAULT_POOL_ITEMS;
}
/** primary item id ใช้สำหรับ losesBaseSalary check (poolExclusion = "all") */
export function rolePrimaryPoolItemId(
  role:
    | {
        primaryPoolItemId?: string | null;
        poolItems?:
          | { id: string; label: string; kind?: string; threshold?: number }[]
          | null;
        poolGroup?: string | null;
      }
    | null
    | undefined,
): string {
  if (!role) return LEGACY_POOL_NORMAL_ID;
  // ตรวจว่า primaryPoolItemId ยังอยู่ใน poolItems ปัจจุบัน · ถ้า admin ลบ
  // item ที่เคยเป็น primary โดยไม่ตั้งใหม่ → fallback ตัวแรกของ items · กัน
  // orphan id ค้างทำให้ losesBaseSalary check ล้มเหลวเงียบ (top = 0 ตลอด)
  const items = rolePoolItems(role);
  if (
    role.primaryPoolItemId &&
    items.some((it) => it.id === role.primaryPoolItemId)
  )
    return role.primaryPoolItemId;
  // fallback: ตัวแรก kind=pool ก่อน · ถ้าไม่มี → ตัวแรกใด ๆ · ถ้าไม่มีเลย → legacy
  const firstPool = items.find((it) => it.kind === "pool");
  return firstPool?.id || items[0]?.id || LEGACY_POOL_NORMAL_ID;
}
export function resolvePoolItemPieces(
  itemId: string,
  salary:
    | {
        poolItemPieces?: Record<string, number>;
        normalSalePieces?: number;
        specialSalePieces?: number;
        buyPieces?: number;
      }
    | null
    | undefined,
): number {
  if (
    salary?.poolItemPieces &&
    typeof salary.poolItemPieces[itemId] === "number"
  )
    return salary.poolItemPieces[itemId];
  // legacy fallback by id
  if (itemId === LEGACY_POOL_NORMAL_ID) return salary?.normalSalePieces ?? 0;
  if (itemId === LEGACY_POOL_SPECIAL_ID) return salary?.specialSalePieces ?? 0;
  if (itemId === LEGACY_POOL_BUY_ID) return salary?.buyPieces ?? 0;
  return 0;
}
export function resolvePoolItemRate(
  itemId: string,
  salary:
    | {
        poolItemRates?: Record<string, number>;
        normalSalePieceRate?: number;
        specialSalePieceRate?: number;
        buyPieceRate?: number;
      }
    | null
    | undefined,
  rates?: {
    poolItemRates?: Record<string, number>;
    normalSalePieceRate?: number;
    specialSalePieceRate?: number;
    buyPieceRate?: number;
  },
): number {
  // priority: snapshot map → snapshot legacy field → rates map → rates legacy
  if (salary?.poolItemRates && typeof salary.poolItemRates[itemId] === "number")
    return salary.poolItemRates[itemId];
  if (itemId === LEGACY_POOL_NORMAL_ID && salary?.normalSalePieceRate != null)
    return salary.normalSalePieceRate;
  if (itemId === LEGACY_POOL_SPECIAL_ID && salary?.specialSalePieceRate != null)
    return salary.specialSalePieceRate;
  if (itemId === LEGACY_POOL_BUY_ID && salary?.buyPieceRate != null)
    return salary.buyPieceRate;
  if (rates?.poolItemRates && typeof rates.poolItemRates[itemId] === "number")
    return rates.poolItemRates[itemId];
  if (itemId === LEGACY_POOL_NORMAL_ID) return rates?.normalSalePieceRate ?? 0;
  if (itemId === LEGACY_POOL_SPECIAL_ID)
    return rates?.specialSalePieceRate ?? 0;
  if (itemId === LEGACY_POOL_BUY_ID) return rates?.buyPieceRate ?? 0;
  return 0;
}
/** แปลง poolExclusion → list ของ item ids ที่โดน exclude
 *  - null/""/[]         → ไม่ปิด
 *  - "all"              → ทุก item id
 *  - string[]           → ใช้ตรงๆ
 *  - legacy "sell"      → ทุก pool item kind=pool ฝั่งขาย (label เริ่ม "ขาย" หรือ
 *                          item id ใน [normal, special]) · fallback id "normal","special"
 *  - legacy "buy"       → "buy" item id
 *  - legacy "both"      → "all" → ทุก item id                                    */
export function resolvePoolExclusionItemIds(
  exclusion: "sell" | "buy" | "both" | "all" | "" | string[] | null | undefined,
  poolItems: { id: string }[],
): { excludedIds: Set<string>; isAll: boolean } {
  const allIds = new Set(poolItems.map((it) => it.id));
  if (!exclusion || (Array.isArray(exclusion) && exclusion.length === 0))
    return { excludedIds: new Set(), isAll: false };
  if (exclusion === "all" || exclusion === "both")
    return { excludedIds: allIds, isAll: true };
  if (Array.isArray(exclusion)) {
    const filtered = exclusion.filter((id) => allIds.has(id));
    return {
      excludedIds: new Set(filtered),
      isAll: filtered.length === allIds.size && allIds.size > 0,
    };
  }
  // legacy string variant
  if (exclusion === "sell") {
    const sellIds = new Set([LEGACY_POOL_NORMAL_ID, LEGACY_POOL_SPECIAL_ID]);
    const filtered = [...allIds].filter((id) => sellIds.has(id));
    return { excludedIds: new Set(filtered), isAll: false };
  }
  if (exclusion === "buy") {
    const buyIds = new Set([LEGACY_POOL_BUY_ID]);
    const filtered = [...allIds].filter((id) => buyIds.has(id));
    return { excludedIds: new Set(filtered), isAll: false };
  }
  return { excludedIds: new Set(), isAll: false };
}

/* ─── โบนัสอื่นๆ (ก่อนหน้านี้: บัตรสมาชิก hardcode invite/transfer) ──────
   role.bonusItems = null/undefined → default [invite, transfer]
   role.bonusItems = []             → ไม่มีโบนัสอื่นๆ (ซ่อน section)
   role.bonusItems = [items]        → admin custom รายการเอง                   */
export const LEGACY_BONUS_INVITE_ID = "invite";
export const LEGACY_BONUS_TRANSFER_ID = "transfer";
const DEFAULT_BONUS_ITEMS: { id: string; label: string }[] = [
  { id: LEGACY_BONUS_INVITE_ID, label: "เชิญชวนสมัครบัตร" },
  { id: LEGACY_BONUS_TRANSFER_ID, label: "ย้ายข้อมูลบัตร" },
];
export function roleBonusItems(
  role:
    | { bonusItems?: { id: string; label: string }[] | null }
    | null
    | undefined,
): { id: string; label: string }[] {
  if (!role) return [];
  if (Array.isArray(role.bonusItems)) return role.bonusItems;
  // null/undefined → default 2 รายการ (legacy data fallback)
  return DEFAULT_BONUS_ITEMS;
}
export function resolveBonusItemRate(
  itemId: string,
  salary:
    | {
        bonusRates?: Record<string, number>;
        invitePieceRate?: number;
        transferPieceRate?: number;
      }
    | null
    | undefined,
  rates?: {
    bonusRates?: Record<string, number>;
    invitePieceRate?: number;
    transferPieceRate?: number;
  },
): number {
  // priority: snapshot bonusRates → snapshot legacy field → rates bonusRates → rates legacy field
  if (salary?.bonusRates && typeof salary.bonusRates[itemId] === "number")
    return salary.bonusRates[itemId];
  if (itemId === LEGACY_BONUS_INVITE_ID && salary?.invitePieceRate != null)
    return salary.invitePieceRate;
  if (itemId === LEGACY_BONUS_TRANSFER_ID && salary?.transferPieceRate != null)
    return salary.transferPieceRate;
  if (rates?.bonusRates && typeof rates.bonusRates[itemId] === "number")
    return rates.bonusRates[itemId];
  if (itemId === LEGACY_BONUS_INVITE_ID) return rates?.invitePieceRate ?? 0;
  if (itemId === LEGACY_BONUS_TRANSFER_ID) return rates?.transferPieceRate ?? 0;
  return 0;
}
export function resolveBonusItemCount(
  itemId: string,
  salary:
    | {
        bonusCounts?: Record<string, number>;
        invitePieces?: number;
        transferPieces?: number;
      }
    | null
    | undefined,
): number {
  if (salary?.bonusCounts && typeof salary.bonusCounts[itemId] === "number")
    return salary.bonusCounts[itemId];
  if (itemId === LEGACY_BONUS_INVITE_ID) return salary?.invitePieces ?? 0;
  if (itemId === LEGACY_BONUS_TRANSFER_ID) return salary?.transferPieces ?? 0;
  return 0;
}

const {
  DAYS_PER_MONTH,
  POOL_THRESHOLD,
  BASE_SALARY_THRESHOLD,
  SUNDAY_LEAVE_MULTIPLIER,
  WEEKDAY_LEAVE_QUOTA,
  LEAVE_DEDUCTION_FREE_DAYS,
} = BUSINESS_RULES;

/* ─── Annual Raise Helpers ───────────────────────────────────────
   เงินเดือนปัจจุบัน = baseSalary (ตอนเริ่มทำงาน) + ผลรวมของ raise ราย
   ปีจนถึงปีที่ต้องการคำนวณ · raise มีผลตั้งแต่ Jan ของปีนั้น

   2 source:
   - annualRaiseAmount: AUTO ทุกปี (admin ตั้งครั้งเดียว · 0 = ไม่ขึ้น)
   - annualRaises[year]: OVERRIDE per year (มี precedence เหนือ auto)     */

interface RaiseSource {
  baseSalary?: number;
  startWorkMonth?: string | null;
  annualRaiseAmount?: number;
  annualRaises?: Record<string, number>;
}

/** ส่วนเพิ่มของปีนั้น (override > auto > 0) */
function raiseAmountForYear(source: RaiseSource, year: number): number {
  const overrides = source.annualRaises ?? {};
  const key = String(year);
  if (overrides[key] !== undefined) return Number(overrides[key]) || 0;
  return Number(source.annualRaiseAmount ?? 0) || 0;
}

/** เงินเดือนพื้นฐาน "ของเดือน YYYY-MM" — รวม raises ของปีนั้นและก่อนหน้า ·
 *  ใช้ตอนคำนวณเงินเดือน live · admin ปรับ raise แล้วเดือนปัจจุบันเปลี่ยนทันที */
export function getEffectiveBaseSalary(
  source: RaiseSource | null | undefined,
  yearMonthOrYear?: string,
): number {
  if (!source) return 0;
  const base = source.baseSalary ?? 0;
  // default = ปีปัจจุบัน (ตามเครื่อง user)
  const targetYear = (() => {
    if (yearMonthOrYear) {
      const ys = yearMonthOrYear.slice(0, 4);
      const y = parseInt(ys, 10);
      if (Number.isFinite(y)) return y;
    }
    return new Date().getFullYear();
  })();
  const startWM = source.startWorkMonth;
  if (!startWM) return Math.max(0, base);
  const startYear = parseInt(startWM.slice(0, 4), 10);
  if (!Number.isFinite(startYear)) return Math.max(0, base);
  let sum = base;
  // loop ปีตั้งแต่ startYear+1 → targetYear · skip ปีที่ยังไม่ครบ 1 ปี
  for (let y = startYear + 1; y <= targetYear; y++) {
    if (!isEligibleForRaiseYear(startWM, y)) continue;
    sum += raiseAmountForYear(source, y);
  }
  return Math.max(0, sum);
}

/** ตรวจว่าพนักงานทำงานครบ 1 ปีก่อน Jan 1 ของ raiseYear หรือไม่ ·
 *  เกณฑ์: (raiseDate − startDate) ≥ 365 วัน · startWorkMonth = YYYY-MM
 *  → treat เป็นวันที่ 1 ของเดือนนั้น                                       */
export function isEligibleForRaiseYear(
  startWorkMonth: string | undefined | null,
  raiseYear: number,
): boolean {
  if (!startWorkMonth) return false;
  const [ys, ms] = startWorkMonth.split("-");
  const sy = parseInt(ys ?? "", 10);
  const sm = parseInt(ms ?? "", 10);
  if (!Number.isFinite(sy) || !Number.isFinite(sm)) return false;
  const startMs = Date.UTC(sy, sm - 1, 1);
  const raiseMs = Date.UTC(raiseYear, 0, 1);
  const days = (raiseMs - startMs) / (1000 * 60 * 60 * 24);
  return days >= 365;
}

/** รายการประวัติ raise · ทุกปีที่ eligible ตั้งแต่ startYear+1 → currentYear
 *  (ไม่รวมปีอนาคต · ประวัติ = ที่เกิดขึ้นแล้ว/กำลังเกิดในปีปัจจุบัน)
 *  ส่ง back per-row: { year, amount, source: "auto" | "override" } */
export function buildRaiseHistory(
  source: RaiseSource | null | undefined,
  currentYear?: number,
): { year: number; amount: number; isOverride: boolean }[] {
  if (!source?.startWorkMonth) return [];
  const startYear = parseInt(source.startWorkMonth.slice(0, 4), 10);
  if (!Number.isFinite(startYear)) return [];
  const now = currentYear ?? new Date().getFullYear();
  const overrides = source.annualRaises ?? {};
  const list: { year: number; amount: number; isOverride: boolean }[] = [];
  for (let y = startYear + 1; y <= now; y++) {
    if (!isEligibleForRaiseYear(source.startWorkMonth, y)) continue;
    list.push({
      year: y,
      amount: raiseAmountForYear(source, y),
      isOverride: overrides[String(y)] !== undefined,
    });
  }
  return list.sort((a, b) => b.year - a.year); // ใหม่ → เก่า
}

/* ─── Pool Share Helper (สูตรตาม Excel) ──────────────────────────
   ฝั่ง "ขาย"   = เกณฑ์ 80% ใช้ (ทั่วไป+พิเศษ) · กองกลางที่หารแบ่งใช้ "ทั่วไป" เท่านั้น
                  − poolAdjustment.excludedNormalPieces (สินค้าโปรโมชั่น ฯลฯ)
   ฝั่ง "รับซื้อ" = รับซื้อของแต่ละคน − poolAdjustment.excludedBuyPieces (MD ฯลฯ)
                  ขาย-พิเศษ → ของใครของมัน: นับ 80% แต่ไม่เอาเข้ากองที่หารแบ่ง
   poolAdjustment ระดับ "เดือน" ที่ admin ใส่แยก ไม่ใช่ per-employee — หักเฉพาะ
   ยอดที่เข้ากอง ไม่กระทบเกณฑ์ 80% (พนักงานยังมีสิทธิ์อยู่ในกอง)

   สูตรการแบ่งทำแยกฝั่งขายและฝั่งรับซื้อ:
   - effectiveLeave = max(0, totalLeave − LEAVE_DEDUCTION_FREE_DAYS)
     (2 วันแรกฟรี ไม่ถูกหัก ไม่ถูกเอามาเกลี่ย — โบนัสหยุดน้อยไม่เกี่ยว)
   - เปอร์เซ็นต์ฐาน = 100 / จำนวนคนที่มีสิทธิ์ใน Pool
   - ตัวคูณหักวันลา = เปอร์เซ็นต์ฐาน / จำนวนวันทำงานต่อเดือน
   - เปอร์เซ็นต์หัก = effectiveLeave × ตัวคูณหักวันลา × (จำนวนคนที่มีสิทธิ์ - 1)
   - เปอร์เซ็นต์แบ่งเพื่อน = เปอร์เซ็นต์หัก / (จำนวนคนที่มีสิทธิ์ - 1)
   - เปอร์เซ็นต์สุทธิ = เปอร์เซ็นต์ฐาน - เปอร์เซ็นต์หัก + ผลรวมเปอร์เซ็นต์แบ่งจากคนอื่น
   - ชิ้นที่ได้ = เปอร์เซ็นต์สุทธิ × จำนวนชิ้นรวมใน Pool

   poolExclusion (Admin ตั้งให้แต่ละคน):
   - "sell"  → ปิดฝั่งขาย → ตัดออกจาก Pool ขาย
   - "buy"   → ปิดฝั่งรับซื้อ
   - "both"  → ปิดทั้งคู่ + ถ้าขาย < 50% ของ Top → ไม่ได้เงินเดือนพื้นฐาน

   กฎ 80%: ถ้าชิ้น (ทั่วไป+พิเศษ) น้อยกว่า 80% ของ Top → ตัดออกจาก Pool
   ขาย-พิเศษ → ของใครของมัน: นับตอนเช็ก 80% แต่ไม่เอาเข้ากองที่หารแบ่ง */
export function computePoolSharesForGroup({
  groupEmployeeIds,
  salaryData,
  allLeaves,
  yearMonth,
  employeeDirectory,
  roles,
  poolAdjustment, // { items: [{poolGroup, side, pieces, label}] } — ระดับเดือน
  poolGroup, // ตำแหน่ง/กลุ่มที่กำลังคำนวณ — กรอง adjustment เฉพาะของกลุ่มนี้
  storeCalendar, // ปฏิทินเปิด-ปิดร้าน · ใช้นับวันลา (Sat ปิด → ไม่นับ)
}: {
  groupEmployeeIds: string[];
  salaryData: any;
  allLeaves: any[];
  yearMonth: string;
  employeeDirectory: any[];
  /** roles — ใช้ resolve role.poolItems + primaryPoolItemId · ถ้าไม่ส่งหรือไม่
   *  เจอ role ของ group นี้ จะ fallback ใช้ default 3 items (legacy behavior) */
  roles?: any[];
  poolAdjustment?: {
    items?: {
      poolGroup?: string;
      side: string;
      pieces: number;
      label: string;
    }[];
  } | null;
  poolGroup?: string | null;
  storeCalendar?: {
    extraOpenSaturdays: string[];
    extraClosedWeekdays: string[];
  } | null;
}) {
  if (!groupEmployeeIds || groupEmployeeIds.length === 0) return {};

  // กรองพนักงานที่ "ปิดสิทธิ์ระบบเงินเดือน" ออกก่อน — กลุ่มนี้ใช้แอปเฉพาะ
  // ระบบลา ไม่นับเข้ากองกลาง ไม่ pull เกณฑ์ 80% และไม่ได้รับ commission
  // CRITICAL: ใช้ salary snapshot ก่อน fall back current state
  // → past month ที่ admin flip salaryDisabled ภายหลัง ไม่ทำให้ pool เก่า
  //   ขยับ (เดิมใช้ current state ทำให้ peers ได้ share ของ Charlie ที่
  //   เคย active ในเดือนนั้นซ้ำ)
  const activeIds = groupEmployeeIds.filter((id) => {
    const salary = salaryData[id]?.[yearMonth];
    if (salary && typeof salary.salaryDisabled === "boolean") {
      return !salary.salaryDisabled;
    }
    const employee = employeeDirectory.find((e) => e.id === id);
    return !employee?.salaryDisabled;
  });
  if (activeIds.length === 0) return {};

  // --- Resolve poolItems config สำหรับกลุ่มนี้ ---
  // หา role ของพนักงานคนใดคนหนึ่งใน group · ใช้ role.poolItems config
  // เป็น canonical · ถ้าไม่เจอ role / roles ไม่ได้ส่งมา → fallback default 3 items
  const groupRole = (() => {
    if (!roles || roles.length === 0) return null;
    for (const empId of activeIds) {
      const salary = salaryData[empId]?.[yearMonth];
      const emp = employeeDirectory.find((e) => e.id === empId);
      const roleId = salary?.roleId || emp?.roleId;
      const role = roles.find((r) => r.id === roleId);
      if (role) return role;
    }
    return null;
  })();
  // audit bug F: warn ถ้า roles ไม่ส่งมา (จะ fallback default 3 items
  // ทำให้ custom pool items หาย · admin จะเห็นเลขผิดในเดือนเก่า)
  if (!roles && typeof console !== "undefined") {
    console.warn(
      "[computePoolSharesForGroup] roles array not provided — falling back to default poolItems · custom items lost",
    );
  }
  const poolItemsConfig = rolePoolItems(
    groupRole || { poolGroup: poolGroup || "_" },
  );
  const primaryItemId = rolePrimaryPoolItemId(
    groupRole || { poolGroup: poolGroup || "_" },
  );
  // แยก item ids ตาม kind
  const poolItemIds = poolItemsConfig
    .filter((it) => it.kind === "pool")
    .map((it) => it.id);
  // map id → threshold (%) · ใช้ตรวจ eligibility แต่ละ item
  const itemThresholds: Record<string, number> = {};
  poolItemsConfig.forEach((it) => {
    itemThresholds[it.id] = it.threshold / 100;
  });

  // --- Step 0: คัดข้อมูลพื้นฐานของแต่ละคน · per-item pieces ---
  // itemPiecesByEmp[empId][itemId] = ชิ้นของพนักงานในรายการนั้น (จาก resolver)
  const itemPiecesByEmp: Record<string, Record<string, number>> = {};
  const sellPieces: Record<string, number> = {}; // legacy: ทั่วไป + พิเศษ
  const buyPieces: Record<string, number> = {}; // legacy: รับซื้อของตัวเอง
  const totalLeave: Record<string, number> = {}; // วันหยุดรวม (ปกติ + อาทิตย์)
  const poolExclusion: Record<string, any> = {};
  // เดือนนี้คนนี้ทำ monthly duty ที่ให้สิทธิ์กองกลาง → ยกเว้นเกณฑ์ 80%
  const thresholdExempt: Record<string, boolean> = {};
  activeIds.forEach((employeeId) => {
    const salary = salaryData[employeeId]?.[yearMonth];
    const employee = employeeDirectory.find(
      (candidateEmployee) => candidateEmployee.id === employeeId,
    );
    // per-item pieces via resolver (fallback chain legacy → new schema)
    itemPiecesByEmp[employeeId] = {};
    poolItemsConfig.forEach((it) => {
      itemPiecesByEmp[employeeId][it.id] = resolvePoolItemPieces(it.id, salary);
    });
    // legacy aggregate: sellPieces = normal + special (สำหรับ backward-compat
    // fields ใน result · pool eligibility ใช้ itemPiecesByEmp ต่อ item แทน)
    sellPieces[employeeId] =
      (salary?.normalSalePieces || 0) + (salary?.specialSalePieces || 0);
    buyPieces[employeeId] = salary?.buyPieces || 0;
    // ใช้ snapshot ที่เขียนพร้อม salary ก่อนเสมอ — admin/พนักงานจะเห็นเลข
    // ตรงกัน. fallback มา employee directory + allLeaves เฉพาะเดือนเก่าที่
    // ยังไม่มี snapshot field (data จากก่อน feature นี้)
    poolExclusion[employeeId] =
      salary?.poolExclusion !== undefined
        ? salary.poolExclusion
        : employee?.poolExclusion || null;
    thresholdExempt[employeeId] = salary?.poolThresholdExempt === true;
    if (typeof salary?.totalLeaveDays === "number") {
      totalLeave[employeeId] = salary.totalLeaveDays;
    } else if (employee) {
      const monthLeaves = allLeaves.filter(
        (leave) =>
          leave.employeeId === employeeId && leave.start.startsWith(yearMonth),
      );
      const weekdayLeaves = countWeekdayLeaves(monthLeaves, storeCalendar);
      const overInfo = getOverQuotaDays(monthLeaves, storeCalendar);
      // วันหยุดรวมตาม Excel = ปกติ + อาทิตย์ทั้งหมด (ไม่ใช่แค่ที่เกินโควต้า)
      totalLeave[employeeId] = weekdayLeaves + (overInfo.sundays || 0);
    } else {
      totalLeave[employeeId] = 0;
    }
  });
  const topSellPieces = Math.max(0, ...Object.values(sellPieces));
  const topBuyPieces = Math.max(0, ...Object.values(buyPieces));
  const sellEligibilityThreshold = topSellPieces * POOL_THRESHOLD;
  const buyEligibilityThreshold = topBuyPieces * POOL_THRESHOLD;
  const baseSalaryEligibilityThreshold = topSellPieces * BASE_SALARY_THRESHOLD;

  // per-item top pieces (สำหรับ kind=pool ใช้ตรวจ eligibility) · primary item
  // top (สำหรับ losesBaseSalary check)
  const topItemPieces: Record<string, number> = {};
  poolItemsConfig.forEach((it) => {
    topItemPieces[it.id] = Math.max(
      0,
      ...activeIds.map((empId) => itemPiecesByEmp[empId]?.[it.id] || 0),
    );
  });
  const topPrimaryPieces = topItemPieces[primaryItemId] ?? 0;
  const primaryBaseSalaryThreshold = topPrimaryPieces * BASE_SALARY_THRESHOLD;

  // --- Step 1: per-item eligibility (รวม legacy ฝั่งขาย/ฝั่งรับซื้อ) ---
  // resolve poolExclusion → set ของ item ids ที่โดน exclude ต่อพนักงาน
  const exclusionByEmp: Record<string, Set<string>> = {};
  activeIds.forEach((employeeId) => {
    const { excludedIds } = resolvePoolExclusionItemIds(
      poolExclusion[employeeId],
      poolItemsConfig,
    );
    exclusionByEmp[employeeId] = excludedIds;
  });
  // itemEligibility[empId][itemId] = true/false · เฉพาะ kind=pool item
  const itemEligibility: Record<string, Record<string, boolean>> = {};
  activeIds.forEach((employeeId) => {
    itemEligibility[employeeId] = {};
    const exempt = thresholdExempt[employeeId];
    const excludedIds = exclusionByEmp[employeeId];
    poolItemsConfig.forEach((it) => {
      if (it.kind !== "pool") return;
      if (excludedIds.has(it.id)) {
        itemEligibility[employeeId][it.id] = false;
        return;
      }
      const top = topItemPieces[it.id] || 0;
      if (exempt || top === 0) {
        itemEligibility[employeeId][it.id] = true;
        return;
      }
      const myPieces = itemPiecesByEmp[employeeId][it.id] || 0;
      itemEligibility[employeeId][it.id] =
        myPieces >= top * itemThresholds[it.id];
    });
  });
  // legacy aggregate eligibility (สำหรับ backward-compat fields)
  const sellPoolEligibility: Record<string, boolean> = {};
  const buyPoolEligibility: Record<string, boolean> = {};
  activeIds.forEach((employeeId) => {
    sellPoolEligibility[employeeId] =
      itemEligibility[employeeId][LEGACY_POOL_NORMAL_ID] ?? false;
    buyPoolEligibility[employeeId] =
      itemEligibility[employeeId][LEGACY_POOL_BUY_ID] ?? false;
  });

  // --- Step 2: รวม Pool ต่อ item · per-item gross & adjustments ---
  // grossItemPool[itemId] = ผลรวมก่อนหัก · totalItemPool[itemId] = หลังหัก
  const grossItemPool: Record<string, number> = {};
  poolItemsConfig.forEach((it) => {
    if (it.kind !== "pool") return;
    grossItemPool[it.id] = activeIds.reduce(
      (s, empId) => s + (itemPiecesByEmp[empId]?.[it.id] || 0),
      0,
    );
  });
  let totalSellPoolPieces = grossItemPool[LEGACY_POOL_NORMAL_ID] ?? 0;
  let totalBuyPoolPieces = grossItemPool[LEGACY_POOL_BUY_ID] ?? 0;
  // หัก adjustment ระดับเดือน (admin ใส่แยก — เช่น สินค้าโปรโมชั่น / ทองแท่ง MD)
  // รวมจาก items แยกตามฝั่ง · clamp ≥ 0 · เก็บ gross + รายการไว้สำหรับแสดงผล
  const grossSellPoolPieces = totalSellPoolPieces;
  const grossBuyPoolPieces = totalBuyPoolPieces;
  // กรองเฉพาะรายการของ "ตำแหน่งนี้" + เป็น pool variant — item เก่าที่ไม่มี
  // poolGroup ถือว่าใช้ได้กับทุกกลุ่ม (backward compat data ก่อนมี field นี้)
  // ใหม่: ข้าม piece variant (kind="piece") — apply แยกใน calculateSalary
  const adjItems = (poolAdjustment?.items || []).filter(
    (it: any) =>
      it.kind !== "piece" &&
      (!it.poolGroup || !poolGroup || it.poolGroup === poolGroup),
  );
  // Phase 3D — resolve target item id per adjustment · poolItemId ก่อน · ถ้า
  // ไม่มี → fallback legacy side ("normal" → LEGACY_POOL_NORMAL_ID, "buy" →
  // LEGACY_POOL_BUY_ID) · กระจาย excluded pieces ต่อ item id
  const excludedByItemId: Record<string, number> = {};
  const excludedItemsByItemId: Record<string, any[]> = {};
  adjItems.forEach((it: any) => {
    const targetId =
      it.poolItemId ||
      (it.side === "buy"
        ? LEGACY_POOL_BUY_ID
        : it.side === "normal"
          ? LEGACY_POOL_NORMAL_ID
          : null);
    if (!targetId) return;
    const p = Math.max(0, Number(it.pieces) || 0);
    excludedByItemId[targetId] = (excludedByItemId[targetId] || 0) + p;
    if (!excludedItemsByItemId[targetId]) excludedItemsByItemId[targetId] = [];
    excludedItemsByItemId[targetId].push(it);
  });
  // legacy aggregate ตัวเลข (สำหรับ backward-compat return fields)
  const excludedNormal = excludedByItemId[LEGACY_POOL_NORMAL_ID] || 0;
  const excludedBuy = excludedByItemId[LEGACY_POOL_BUY_ID] || 0;
  const excludedNormalItems =
    excludedItemsByItemId[LEGACY_POOL_NORMAL_ID] || [];
  const excludedBuyItems = excludedItemsByItemId[LEGACY_POOL_BUY_ID] || [];
  totalSellPoolPieces = Math.max(0, totalSellPoolPieces - excludedNormal);
  totalBuyPoolPieces = Math.max(0, totalBuyPoolPieces - excludedBuy);

  // --- Step 3: คำนวณตามสูตร Excel แยก 2 ฝั่ง ---
  function computeShares(poolEligibility, totalPoolPieces) {
    const eligibleEmployeeIds = activeIds.filter(
      (employeeId) => poolEligibility[employeeId],
    );
    const eligibleEmployeeCount = eligibleEmployeeIds.length;
    if (eligibleEmployeeCount === 0) {
      return {
        shares: {},
        eligibleEmployeeCount: 0,
        baseSharePercent: 0,
        leaveDeductionFactor: 0,
      };
    }
    const baseSharePercent = 100 / eligibleEmployeeCount;
    const leaveDeductionFactor = baseSharePercent / DAYS_PER_MONTH;

    // % การหัก ของแต่ละคน — 2 วันแรก (LEAVE_DEDUCTION_FREE_DAYS) ฟรี ไม่ถูกหัก
    const leaveDeductionPercent = {};
    const redistributedPercent = {};
    eligibleEmployeeIds.forEach((employeeId) => {
      const effectiveLeave = Math.max(
        0,
        totalLeave[employeeId] - LEAVE_DEDUCTION_FREE_DAYS,
      );
      leaveDeductionPercent[employeeId] =
        effectiveLeave * leaveDeductionFactor * (eligibleEmployeeCount - 1);
      redistributedPercent[employeeId] =
        eligibleEmployeeCount > 1
          ? leaveDeductionPercent[employeeId] / (eligibleEmployeeCount - 1)
          : 0;
    });

    // % ที่ได้
    const shares = {};
    const totalRedistributedPercent = eligibleEmployeeIds.reduce(
      (sum, employeeId) => sum + redistributedPercent[employeeId],
      0,
    );
    eligibleEmployeeIds.forEach((employeeId) => {
      const redistributedFromOthers =
        totalRedistributedPercent - redistributedPercent[employeeId];
      const finalSharePercent =
        baseSharePercent -
        leaveDeductionPercent[employeeId] +
        redistributedFromOthers;
      const allocatedPieces = (finalSharePercent / 100) * totalPoolPieces;
      shares[employeeId] = {
        finalSharePercent,
        allocatedPieces,
        leaveDeductionPercent: leaveDeductionPercent[employeeId],
        redistributedPercent: redistributedPercent[employeeId],
        leaveDays: totalLeave[employeeId],
      };
    });
    return {
      shares,
      eligibleEmployeeCount,
      baseSharePercent,
      leaveDeductionFactor,
      eligibleEmployeeIds,
    };
  }

  // legacy aggregate computes (sellResult/buyResult สำหรับ backward-compat
  // return fields)
  const sellResult = computeShares(sellPoolEligibility, totalSellPoolPieces);
  const buyResult = computeShares(buyPoolEligibility, totalBuyPoolPieces);

  // per-item shares (รวม normal/special/buy + custom items ใน Phase 2/3)
  // kind=pool: ใช้ eligibility + share calc
  // kind=personal: pieces ของตัวเอง · ไม่แชร์ · ไม่มี share% (sharePercent=100)
  const itemShares: Record<
    string,
    Record<
      string,
      {
        finalSharePercent: number;
        allocatedPieces: number;
        leaveDeductionPercent: number;
        redistributedPercent: number;
        eligible: boolean;
        kind: "pool" | "personal";
      }
    >
  > = {};
  // per-item pool totals (หลังหัก adjustment ที่ apply ได้)
  const totalItemPool: Record<string, number> = {};
  // Phase 3D: per-item pool total · หัก excludedByItemId ของแต่ละ item
  // legacy normal/buy ก็ใช้ path เดียวกัน (excludedByItemId ครอบ legacy ผ่าน
  // mapping ใน adjItems loop ด้านบน)
  poolItemsConfig.forEach((it) => {
    if (it.kind !== "pool") return;
    const gross = grossItemPool[it.id] || 0;
    const excluded = excludedByItemId[it.id] || 0;
    totalItemPool[it.id] = Math.max(0, gross - excluded);
  });
  poolItemsConfig.forEach((it) => {
    if (it.kind === "pool") {
      const itemEligPerEmp: Record<string, boolean> = {};
      activeIds.forEach((empId) => {
        itemEligPerEmp[empId] = itemEligibility[empId][it.id] || false;
      });
      const r = computeShares(itemEligPerEmp, totalItemPool[it.id]);
      activeIds.forEach((empId) => {
        if (!itemShares[empId]) itemShares[empId] = {};
        const s = r.shares[empId];
        itemShares[empId][it.id] = {
          finalSharePercent: s?.finalSharePercent ?? 0,
          allocatedPieces: s?.allocatedPieces ?? 0,
          leaveDeductionPercent: s?.leaveDeductionPercent ?? 0,
          redistributedPercent: s?.redistributedPercent ?? 0,
          eligible: itemEligPerEmp[empId],
          kind: "pool",
        };
      });
    } else {
      // personal: pieces ของตัวเอง · 100% share · ไม่หักลาแบบกอง
      // CRITICAL bug fix: ถ้า admin set poolExclusion ของพนักงานครอบคลุม item นี้
      // (รวม "all") → ตัด commission ของ item นี้ด้วย (เดิม personal ได้เงิน
      // ตลอด ไม่ honor exclusion · admin ปิดทั้งหมดแล้ว personal ยังได้เงิน)
      activeIds.forEach((empId) => {
        if (!itemShares[empId]) itemShares[empId] = {};
        const myPieces = itemPiecesByEmp[empId]?.[it.id] || 0;
        const excluded = exclusionByEmp[empId]?.has(it.id) ?? false;
        itemShares[empId][it.id] = {
          finalSharePercent: excluded ? 0 : 100,
          allocatedPieces: excluded ? 0 : myPieces,
          leaveDeductionPercent: 0,
          redistributedPercent: 0,
          eligible: !excluded,
          kind: "personal",
        };
      });
    }
  });

  // --- Step 4: ประกอบผลลัพธ์ของแต่ละคน ---
  const result = {};
  activeIds.forEach((employeeId) => {
    const sellShare = sellResult.shares[employeeId];
    const buyShare = buyResult.shares[employeeId];
    // losesBaseSalary: "ปิดทั้งหมด" (legacy "both" หรือ new "all" หรือ
    // string[] ที่ครอบคลุมทุก item) + พนักงานทำได้ < 50% ของ Top บน primary item
    const exc = poolExclusion[employeeId];
    const { isAll } = resolvePoolExclusionItemIds(exc, poolItemsConfig);
    const myPrimaryPieces = itemPiecesByEmp[employeeId]?.[primaryItemId] || 0;
    const losesBaseSalary =
      isAll &&
      topPrimaryPieces > 0 &&
      myPrimaryPieces < primaryBaseSalaryThreshold;

    result[employeeId] = {
      // จำนวนชิ้นที่ได้
      normalSalePieces: sellShare ? sellShare.allocatedPieces : 0,
      buyPieces: buyShare ? buyShare.allocatedPieces : 0,
      // เปอร์เซ็นต์ (สำหรับแสดงผล)
      sellSharePercent: sellShare ? sellShare.finalSharePercent : 0,
      sellLeaveDeductionPercent: sellShare
        ? sellShare.leaveDeductionPercent
        : 0,
      sellRedistributedPercent: sellShare ? sellShare.redistributedPercent : 0,
      buySharePercent: buyShare ? buyShare.finalSharePercent : 0,
      buyLeaveDeductionPercent: buyShare ? buyShare.leaveDeductionPercent : 0,
      buyRedistributedPercent: buyShare ? buyShare.redistributedPercent : 0,
      // ข้อมูล Pool
      totalSellPoolPieces,
      totalBuyPoolPieces,
      grossSellPoolPieces,
      grossBuyPoolPieces,
      excludedNormalPieces: excludedNormal,
      excludedBuyPieces: excludedBuy,
      excludedNormalItems,
      excludedBuyItems,
      eligibleSellEmployeeCount: sellResult.eligibleEmployeeCount,
      sellBaseSharePercent: sellResult.baseSharePercent,
      sellLeaveDeductionFactor: sellResult.leaveDeductionFactor,
      eligibleBuyEmployeeCount: buyResult.eligibleEmployeeCount,
      buyBaseSharePercent: buyResult.baseSharePercent,
      buyLeaveDeductionFactor: buyResult.leaveDeductionFactor,
      leaveDays: totalLeave[employeeId],
      // สิทธิ์
      eligibleForSellPool: sellPoolEligibility[employeeId],
      eligibleForBuyPool: buyPoolEligibility[employeeId],
      employeeSellPieces: sellPieces[employeeId],
      employeeBuyPieces: buyPieces[employeeId],
      topSellPieces,
      topBuyPieces,
      sellEligibilityThreshold,
      buyEligibilityThreshold,
      baseSalaryEligibilityThreshold,
      poolExclusion: poolExclusion[employeeId],
      losesBaseSalary,
      sellShareRatio: sellShare ? sellShare.finalSharePercent / 100 : 0,
      buyShareRatio: buyShare ? buyShare.finalSharePercent / 100 : 0,
      workDays: DAYS_PER_MONTH - totalLeave[employeeId],
      totalSellWorkDays: DAYS_PER_MONTH * sellResult.eligibleEmployeeCount,
      totalBuyWorkDays: DAYS_PER_MONTH * buyResult.eligibleEmployeeCount,
      // ── New item-based fields (Phase 1B) ──────────────────────
      poolItems: poolItemsConfig,
      primaryPoolItemId: primaryItemId,
      itemShares: itemShares[employeeId] || {},
      itemPieces: itemPiecesByEmp[employeeId] || {},
      topItemPieces,
      grossItemPool,
      totalItemPool,
      excludedItemIds: [...exclusionByEmp[employeeId]],
      /** per-item exclusion items (adjustment) สำหรับ PoolFlowModal แสดง
       *  reason list ของ custom items ด้วย (เดิม legacy normal/buy เท่านั้น) */
      excludedItemsByItemId,
    };
  });
  return result;
}

export function calculateSalary(
  salary,
  overQuotaInfo,
  rates,
  totalLeaveDays,
  approvedAdvanceTotal,
  poolShare,
  roleConfig,
  // เงินกู้ผ่อนคืน (Stage B): { yearMonth, loans: [{id, monthlyDeduction,
  // principal, startMonth, repayments}] } ของพนักงานคนนี้ (ไม่รวม cancelled)
  loanContext?: {
    yearMonth: string;
    loans: {
      id: string;
      monthlyDeduction: number;
      principal: number;
      startMonth: string;
      repayments?: Record<string, number>;
    }[];
  } | null,
  // รายการยกเว้นค่าคอม "ระดับ piece" (multi-item) ของพนักงานคนนี้ เดือนนี้ ·
  // [{ pieceItemId, pieces, label }] · ลบจาก piecePieces[itemId] ก่อนคูณ rate
  // pool variant ไม่ส่งมาทางนี้ (apply ใน computePoolSharesForGroup)
  pieceExclusions?:
    | { pieceItemId: string; pieces: number; label?: string }[]
    | null,
  // เสาร์เปิดพิเศษ "ที่ ADMIN tick ให้เงินเพิ่ม" ของเดือนนี้ที่พนักงานคนนี้
  // มาทำงาน (ไม่ลา) · caller filter จาก storeCalendar.paidExtraSaturdays −
  // ใบลาของพนักงาน · ได้เงินเพิ่ม = workedDates.length × dailyRate
  extraOpenSaturdayContext?: {
    workedDates: string[]; // ["YYYY-MM-DD", ...] เสาร์ที่มาทำงาน
  } | null,
) {
  if (!salary) return null;
  const weekdayOverQuotaDays = overQuotaInfo?.weekdays || 0;
  const sundayOverQuotaDays = overQuotaInfo?.sundays || 0;
  // เงินเดือนพื้นฐาน + เรท + ประกันสังคม:
  // อ่าน snapshot ใน salary doc ก่อนเสมอ (ค่าที่ถูก freeze ของเดือนนั้น) →
  // ถ้าเปลี่ยนตำแหน่ง/เรทในอนาคต อดีตไม่ขยับ. fallback เป็นค่าปัจจุบันจาก
  // employeeInfo (rates) เฉพาะเดือนที่ยังไม่มี snapshot (งวดเปิด / data เก่า
  // ก่อนมี feature นี้)
  // baseSalary ใช้ || (ไม่ใช่ ??) — ค่า 0 ถือว่า "ยังไม่ได้ตั้ง" (เงินเดือน
  // พื้นฐานไม่มีทางเป็น 0 จริง) จึง fallback ไปเรทปัจจุบัน กัน data เก่าที่เผลอ
  // เก็บ baseSalary:0 ไว้ทำให้แถวเงินเดือนพื้นฐานหาย
  // — สำหรับ live fallback (เดือนที่ยังไม่มี snapshot) ใช้ effective base
  //   salary ของปีนั้น (baseSalary + Σ annualRaises ≤ year) เพื่อสะท้อนการ
  //   ขึ้นเงินเดือนประจำปีทันที
  const liveEffectiveBase = getEffectiveBaseSalary(
    rates,
    loanContext?.yearMonth,
  );
  // ใช้ ?? แทน || → เคารพ salary.baseSalary=0 ที่ admin ตั้งตั้งใจ (เช่น
  // เดือนที่ลาไม่รับเงินเดือน) · เดิม || ทำให้ 0 ถูก fall back ไป live rate
  const baseSalaryAmount =
    salary.baseSalary !== undefined && salary.baseSalary !== null
      ? salary.baseSalary
      : (liveEffectiveBase ?? 0);
  const socialSecurityAmount =
    salary.socialSecurity ?? rates?.socialSecurity ?? 0;
  const dailySalaryRate = baseSalaryAmount / DAYS_PER_MONTH;
  const overQuotaDeduction = Math.round(
    weekdayOverQuotaDays * dailySalaryRate +
      sundayOverQuotaDays * dailySalaryRate * SUNDAY_LEAVE_MULTIPLIER,
  );

  // ตำแหน่งนี้มีค่าคอมรายชิ้นไหม (pool sales / single piece / ไม่มี)
  const usesPieceCommission = rolePaysPieceCommission(roleConfig);
  const usesSinglePieceRate =
    usesPieceCommission && roleConfig && !roleConfig.poolGroup;
  const singlePieceRate = salary.singlePieceRate ?? rates?.singlePieceRate ?? 0;
  const normalSalePieceRate =
    salary.normalSalePieceRate ?? rates?.normalSalePieceRate ?? 0;
  const specialSalePieceRate =
    salary.specialSalePieceRate ?? rates?.specialSalePieceRate ?? 0;
  const buyPieceRate = salary.buyPieceRate ?? rates?.buyPieceRate ?? 0;
  const invitePieceRate = salary.invitePieceRate ?? rates?.invitePieceRate ?? 0;
  const transferPieceRate =
    salary.transferPieceRate ?? rates?.transferPieceRate ?? 0;

  let singleRatePieces = 0,
    normalSalePieces = 0,
    specialSalePieces = 0,
    buyPieces = 0;
  let singleRateCommission = 0,
    normalSaleCommission = 0,
    specialSaleCommission = 0,
    buyCommission = 0;
  // breakdown รายการ pool sales (multi-item · custom + default normal/special/buy)
  // ทุก kind=pool ใช้ allocatedPieces จาก poolShare.itemShares · ทุก kind=personal
  // ใช้ pieces ของตัวเอง · amount = pieces × rate ของพนักงานคนนั้น
  let poolItemsBreakdown: {
    id: string;
    label: string;
    kind: "pool" | "personal";
    pieces: number;
    rate: number;
    amount: number;
  }[] = [];
  // breakdown รายการ piece (multi-item) — ใช้แสดงผลในสลิป/หน้า admin
  // excluded = ผลรวมจริงที่ admin ใส่ (ไม่ cap) เพื่อให้ UI โชว์ตรง · pieces
  // = max(0, gross-excluded) ตัวที่จ่ายเงินจริง · exclusionEntries = list
  // {pieces,label} ของรายการยกเว้นต่อ item เพื่อให้ UI โชว์ "เหตุผล" ให้ admin
  // และพนักงานเห็น (ไม่ใช่แค่ตัวเลขรวม)
  let pieceBreakdown: {
    id: string;
    label: string;
    pieces: number;
    excluded: number;
    exclusionEntries: { pieces: number; label: string }[];
    rate: number;
    amount: number;
  }[] = [];

  if (!usesPieceCommission) {
    // ตำแหน่งไม่มีค่าคอมรายชิ้น (พนักงานทั่วไป รปภ. ทำความสะอาด ฯลฯ)
    // → ทุก commission = 0 · เงินเดือนพื้นฐานอย่างเดียว
  } else if (usesSinglePieceRate) {
    // multi-item: รวมทุกรายการ → singleRateCommission = ผลรวม · pieceBreakdown
    // เก็บราย item · singleRatePieces = ผลรวมจำนวนชิ้น (สำหรับ backward-compat)
    const items = rolePieceItems(roleConfig);
    // ผลรวมยกเว้นต่อ item id (จาก pieceExclusions) — ลบจาก gross ก่อนคูณ rate
    // เก็บ list entries (pieces+label) ด้วย เพื่อให้ UI โชว์เหตุผลของแต่ละ row
    const exclusionsByItem: Record<string, number> = {};
    const entriesByItem: Record<string, { pieces: number; label: string }[]> =
      {};
    for (const ex of pieceExclusions || []) {
      if (!ex?.pieceItemId) continue;
      const p = Math.max(0, Number(ex.pieces) || 0);
      exclusionsByItem[ex.pieceItemId] =
        (exclusionsByItem[ex.pieceItemId] || 0) + p;
      if (!entriesByItem[ex.pieceItemId]) entriesByItem[ex.pieceItemId] = [];
      entriesByItem[ex.pieceItemId].push({
        pieces: p,
        label: (ex.label || "").trim(),
      });
    }
    pieceBreakdown = items.map((item) => {
      const gross = resolvePieceItemPieces(item.id, salary);
      const excluded = exclusionsByItem[item.id] || 0;
      const pieces = Math.max(0, gross - excluded);
      const rate = resolvePieceItemRate(item.id, salary, rates);
      return {
        id: item.id,
        label: item.label,
        pieces,
        excluded,
        exclusionEntries: entriesByItem[item.id] || [],
        rate,
        amount: Math.round(pieces * rate),
      };
    });
    singleRatePieces = pieceBreakdown.reduce((s, b) => s + b.pieces, 0);
    singleRateCommission = pieceBreakdown.reduce((s, b) => s + b.amount, 0);
  } else {
    const inPool = !!poolShare;
    // Build per-item breakdown · loop poolItems (รวม custom items ที่ admin
    // เพิ่ม) · kind=pool → ใช้ poolShare.itemShares[id].allocatedPieces ·
    // kind=personal → ใช้ pieces ของตัวเอง · fallback ไป legacy fields ถ้า
    // poolShare ไม่มี (เช่น role config เก่า ก่อน Phase 1A)
    const poolItems =
      (poolShare?.poolItems as any) || rolePoolItems(roleConfig);
    poolItemsBreakdown = poolItems.map((item: any) => {
      const itemShare = inPool ? poolShare?.itemShares?.[item.id] : null;
      const pieces = itemShare
        ? itemShare.allocatedPieces || 0
        : resolvePoolItemPieces(item.id, salary);
      const rate = resolvePoolItemRate(item.id, salary, rates);
      return {
        id: item.id,
        label: item.label,
        kind: item.kind === "personal" ? "personal" : "pool",
        pieces,
        rate,
        amount: Math.round(pieces * rate),
      };
    });
    // Backward-compat: legacy salary doc มี normalSalePieces/specialSalePieces/
    // buyPieces แต่ admin ลบ item ออกจาก role.poolItems → pieces จะถูก orphan
    // → เพิ่ม legacy item ที่หายไปกลับเข้า breakdown (กัน past month เงินหาย)
    const ensureLegacy = (
      id: string,
      label: string,
      kind: "pool" | "personal",
    ) => {
      if (poolItemsBreakdown.find((b) => b.id === id)) return;
      const pieces = resolvePoolItemPieces(id, salary);
      if (pieces === 0) return; // ไม่ต้องเพิ่มถ้าไม่มี data
      const rate = resolvePoolItemRate(id, salary, rates);
      poolItemsBreakdown.push({
        id,
        label,
        kind,
        pieces,
        rate,
        amount: Math.round(pieces * rate),
      });
    };
    ensureLegacy("normal", "ขายทั่วไป", "pool");
    ensureLegacy("special", "ขายพิเศษ", "personal");
    ensureLegacy("buy", "รับซื้อ", "pool");
    // Map ต้น 3 items กลับ legacy aggregate fields (backward-compat ของ UI/PDF)
    const normalItem = poolItemsBreakdown.find((b) => b.id === "normal");
    const specialItem = poolItemsBreakdown.find((b) => b.id === "special");
    const buyItem = poolItemsBreakdown.find((b) => b.id === "buy");
    normalSalePieces = normalItem?.pieces ?? 0;
    specialSalePieces = specialItem?.pieces ?? 0;
    buyPieces = buyItem?.pieces ?? 0;
    normalSaleCommission = normalItem?.amount ?? 0;
    specialSaleCommission = specialItem?.amount ?? 0;
    buyCommission = buyItem?.amount ?? 0;
  }

  // ── "โบนัสอื่นๆ" (multi-item · เดิม: invite + transfer hardcode) ───────
  // breakdown ต่อ item: {id, label, pieces, rate, amount} · ใช้แสดงผลใน UI
  // gate ด้วย bonusItems ของ role เอง — decouple จาก piece commission
  // (admin อยากได้ตำแหน่งที่ "ไม่มีค่าคอม แต่มีโบนัส" → bonus ต้องโผล่ตาม role.bonusItems)
  const bonusItems = roleBonusItems(roleConfig);
  const bonusBreakdown = bonusItems.map((item) => {
    const pieces = resolveBonusItemCount(item.id, salary);
    const rate = resolveBonusItemRate(item.id, salary, rates);
    return {
      id: item.id,
      label: item.label,
      pieces,
      rate,
      amount: Math.round(pieces * rate),
    };
  });
  const memberBonusTotal = bonusBreakdown.reduce((s, b) => s + b.amount, 0);
  // backward-compat: legacy fields (consumed by old UIs / mirror to salary doc)
  const invitePieces = resolveBonusItemCount(LEGACY_BONUS_INVITE_ID, salary);
  const transferPieces = resolveBonusItemCount(
    LEGACY_BONUS_TRANSFER_ID,
    salary,
  );
  const inviteCommission =
    bonusBreakdown.find((b) => b.id === LEGACY_BONUS_INVITE_ID)?.amount || 0;
  const transferCommission =
    bonusBreakdown.find((b) => b.id === LEGACY_BONUS_TRANSFER_ID)?.amount || 0;

  // ถ้าถูกปิดสิทธิ์ Pool และขาย < 50% ของ Top → เงินเดือนพื้นฐาน = 0
  // (ต้อง compute losesBaseSalary ก่อน attendanceBonus เพื่อ zero มันด้วย)
  const losesBaseSalary = !!poolShare?.losesBaseSalary;
  const baseSalary = losesBaseSalary ? 0 : baseSalaryAmount;

  // โบนัสแห่งความขยัน — totalLeaveDays รวม sundays อยู่แล้ว
  // (useFirebaseAppData L213: totalLeaveDays = weekdayLeaves + overInfo.sundays)
  // เดิมบวก sundayOverQuotaDays ซ้ำ → Sunday นับ 2 เท่า → bonus ผิด
  // ถ้า losesBaseSalary → ไม่ได้ bonus (base = 0 อยู่แล้ว · กัน paying
  // 2× dailyRate ให้คนที่ไม่ควรได้ base · CRITICAL)
  const leaveDays = totalLeaveDays || 0;
  const bonusDays = losesBaseSalary
    ? 0
    : Math.max(0, WEEKDAY_LEAVE_QUOTA - leaveDays);
  const attendanceBonus = Math.round(bonusDays * dailySalaryRate);

  const customEarningsTotal = Array.isArray(salary.customEarnings)
    ? salary.customEarnings.reduce(
        (sum, item) => sum + (Number(item?.amount) || 0),
        0,
      )
    : 0;
  // รายการประจำเดือนของพนักงาน (recurringItems) — ตั้งครั้งเดียวที่
  // employee doc ใช้ทุกๆ เดือนจนกว่าจะลบ. แยก income/deduction.
  const recurringItems: { type: string; label: string; amount: number }[] =
    Array.isArray(rates?.recurringItems) ? rates.recurringItems : [];
  const recurringIncomes = recurringItems
    .filter((it) => it.type === "income")
    .map((it) => ({
      label: it.label || "(ไม่ระบุ)",
      amount: Number(it.amount) || 0,
    }));
  const recurringDeductions = recurringItems
    .filter((it) => it.type === "deduction")
    .map((it) => ({
      label: it.label || "(ไม่ระบุ)",
      amount: Number(it.amount) || 0,
    }));
  const recurringIncomesTotal = recurringIncomes.reduce(
    (s, it) => s + it.amount,
    0,
  );
  const recurringDeductionsTotal = recurringDeductions.reduce(
    (s, it) => s + it.amount,
    0,
  );
  // เงินค่าแทน (coverage) — admin stamp ตอน save salary · denorm ใน snapshot
  const coveragePay = Number(salary.coveragePay) || 0;
  // เงินเสาร์เปิดพิเศษ — caller pre-filter เสาร์ paid + พนักงานมาทำงาน (ไม่ลา)
  const extraOpenSaturdayWorkedDates =
    extraOpenSaturdayContext?.workedDates ?? [];
  const extraOpenSaturdayDays = extraOpenSaturdayWorkedDates.length;
  const extraOpenSaturdayBonus = Math.round(
    extraOpenSaturdayDays * dailySalaryRate,
  );
  // ค่าคอม custom pool items (admin เพิ่ม id ที่ไม่ใช่ normal/special/buy) ·
  // ตัวแรก 3 ตัวถูก map ไป legacy fields แล้ว · custom items ต้องบวกแยก
  const customPoolCommission = poolItemsBreakdown
    .filter((b) => !["normal", "special", "buy"].includes(b.id))
    .reduce((s, b) => s + b.amount, 0);
  const earnings =
    baseSalary +
    singleRateCommission +
    normalSaleCommission +
    specialSaleCommission +
    buyCommission +
    customPoolCommission +
    memberBonusTotal +
    attendanceBonus +
    coveragePay +
    extraOpenSaturdayBonus +
    customEarningsTotal +
    recurringIncomesTotal;
  const advanceDeduction = approvedAdvanceTotal || 0;
  const customDeductionsTotal = Array.isArray(salary.customDeductions)
    ? salary.customDeductions.reduce(
        (sum, item) => sum + (Number(item?.amount) || 0),
        0,
      )
    : 0;
  // ─── หักเงินกู้ผ่อนคืน (หักเท่าที่มี: cap ที่เงินสุทธิก่อนหักกู้) ───
  // FIFO: เรียงตามเดือนเริ่ม → id · ต่อก้อน หัก = min(ผ่อนเดือนละ, คงเหลือ)
  // คงเหลือคิดจาก principal − Σ(repayments ที่ไม่ใช่เดือนนี้) → re-confirm
  // เดือนเดิมได้ผลเท่าเดิม (idempotent)
  const deductionsBeforeLoan =
    advanceDeduction +
    socialSecurityAmount +
    overQuotaDeduction +
    customDeductionsTotal +
    recurringDeductionsTotal;
  let loanDeduction = 0;
  const loanRepayments: Record<string, number> = {}; // {loanId: ยอดหักเดือนนี้}
  const loanBreakdown: { id: string; amount: number }[] = [];
  if (loanContext?.loans?.length) {
    const ym = loanContext.yearMonth;
    let avail = Math.max(0, earnings - deductionsBeforeLoan);
    const sorted = [...loanContext.loans].sort((a, b) => {
      const m = (a.startMonth || "").localeCompare(b.startMonth || "");
      return m !== 0 ? m : String(a.id).localeCompare(String(b.id));
    });
    for (const loan of sorted) {
      if ((loan.startMonth || "") > ym) continue; // ยังไม่ถึงเดือนเริ่มหัก
      const paidExcludingThis = Object.entries(loan.repayments || {}).reduce(
        (s, [k, v]) => (k === ym ? s : s + (Number(v) || 0)),
        0,
      );
      const remaining = Math.max(
        0,
        (Number(loan.principal) || 0) - paidExcludingThis,
      );
      const due = Math.min(Number(loan.monthlyDeduction) || 0, remaining);
      const take = Math.min(due, avail);
      if (take > 0) {
        avail -= take;
        loanDeduction += take;
        loanRepayments[loan.id] = take;
        loanBreakdown.push({ id: loan.id, amount: take });
      }
    }
  }

  const deductions = deductionsBeforeLoan + loanDeduction;
  const netSalary = earnings - deductions;
  return {
    earnings,
    deductions,
    netSalary,
    loanDeduction,
    loanRepayments, // {loanId: ยอดหักเดือนนี้} — ใช้บันทึก ledger ตอนยืนยันยอด
    loanBreakdown, // [{id, amount}] — เรียงตามที่หัก (สำหรับแสดงผล)
    recurringIncomes, // [{label, amount}] — รายรับประจำเดือนจาก employee doc
    recurringDeductions, // [{label, amount}] — รายจ่ายประจำเดือน
    recurringIncomesTotal,
    recurringDeductionsTotal,
    overQuotaDeduction,
    dailySalaryRate,
    weekdayOverQuotaDays,
    sundayOverQuotaDays,
    usesSinglePieceRate,
    singleRatePieces,
    singleRateCommission,
    singlePieceRate,
    pieceBreakdown, // [{id,label,pieces,rate,amount}] — multi-item piece commission
    poolItemsBreakdown, // [{id,label,kind,pieces,rate,amount}] — multi-item pool sales (รวม custom)
    customPoolCommission, // ผลรวม amount ของ custom pool items (id ไม่ใช่ normal/special/buy)
    normalSaleCommission,
    specialSaleCommission,
    buyCommission,
    inviteCommission,
    transferCommission,
    memberBonusTotal,
    bonusBreakdown, // [{id,label,pieces,rate,amount}] — multi-item bonus
    normalSalePieces,
    specialSalePieces,
    buyPieces,
    invitePieces,
    transferPieces,
    normalSalePieceRate,
    specialSalePieceRate,
    buyPieceRate,
    invitePieceRate,
    transferPieceRate,
    attendanceBonus,
    bonusDays,
    coveragePay,
    extraOpenSaturdayBonus,
    extraOpenSaturdayDays,
    extraOpenSaturdayWorkedDates,
    leaveDays,
    advanceDeduction,
    socialSecurity: socialSecurityAmount,
    baseSalary,
    losesBaseSalary,
  };
}

/* ─── Helper: compute เสาร์เปิดพิเศษที่มีเงินเพิ่ม ของพนักงานคนนึง ────
   ใช้กับ caller (SalaryAdminEdit / SalaryView / PayrollSummaryPanel) เพื่อ
   สร้าง extraOpenSaturdayContext.workedDates ก่อนเรียก calculateSalary().

   เงื่อนไข "ได้เงินเพิ่ม":
   1. วันนั้นอยู่ใน storeCalendar.paidExtraSaturdays (admin ติ๊ก)
   2. อยู่ในช่วง YYYY-MM ที่ระบุ
   3. พนักงานไม่ลาวันนั้น (ตรวจจาก leaves: start ≤ ymd ≤ end)              */
export function computeExtraOpenSaturdayWorkedDates(
  yearMonth: string, // "YYYY-MM"
  storeCalendar: { paidExtraSaturdays?: string[] } | null | undefined,
  employeeLeaves: { start: string; end: string }[],
): string[] {
  const paid = storeCalendar?.paidExtraSaturdays ?? [];
  if (paid.length === 0) return [];
  const prefix = `${yearMonth}-`;
  return paid
    .filter((d) => d.startsWith(prefix))
    .filter((d) => {
      // ลา = วันนั้นอยู่ในช่วง start..end ของใบลาใดๆ
      const onLeave = employeeLeaves.some((lv) => lv.start <= d && d <= lv.end);
      return !onLeave;
    })
    .sort();
}
