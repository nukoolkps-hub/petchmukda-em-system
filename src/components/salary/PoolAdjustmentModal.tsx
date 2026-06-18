/* ─── Commission Exclusions Modal (รายการยกเว้นค่าคอม) ─────────────
   ระดับเดือน · admin ใส่รายการที่ไม่เอามาคิดค่าคอม · 2 ประเภท:

   - kind="pool"  → pool sales (poolGroup + ฝั่ง): หักจากกองที่หารแบ่ง
     · เกณฑ์ 80% ยังใช้ gross เหมือนเดิม (พนักงานยังมีสิทธิ์อยู่ในกอง)
   - kind="piece" → multi-item piece: หักจาก count ของพนักงานคนนึง รายการเดียว
     · admin เลือก ตำแหน่ง → พนักงาน → รายการค่าคอม → จำนวน → เหตุผล อิสระ

   Modal global (ไม่ผูกพนักงาน) — admin จัดการทุก exclusion ของเดือนได้ที่นี่    */
import {
  ChevronDown as IconChevronDown,
  Lock as IconLock,
  Minus as IconMinus,
  Plus as IconPlus,
  Trash2 as IconTrash,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Employee, Role } from "../../types";
import { formatYmThai } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import {
  rolePaysPieceCommission,
  rolePieceItems,
} from "../../utils/salaryUtils";
import BaseModal from "../shared/BaseModal";

interface Item {
  id: string;
  kind: "pool" | "piece";
  // pool variant
  poolGroup?: string;
  /** legacy side (Phase < 3D) — fallback ถ้าไม่มี poolItemId */
  side?: "normal" | "buy";
  /** pool item id — Phase 3D · รองรับ custom items ของ role */
  poolItemId?: string;
  // piece variant
  employeeId?: string;
  pieceItemId?: string;
  /** roleId — ใช้ filter dropdown รายการ + ลูกอัพ pieceItems ใน UI */
  roleId?: string;
  /** snapshot ของชื่อพนักงาน · ใช้แสดงตอน orphan (employee เปลี่ยน role / ลบ) */
  employeeName?: string;
  /** snapshot ของชื่อรายการค่าคอม · ใช้แสดงตอน orphan (item ถูกลบจาก role) */
  pieceItemLabel?: string;
  // shared
  pieces: number;
  label: string;
}

/** PoolGroupInfo — ข้อมูลของแต่ละ pool group สำหรับ Modal
 *  items: pool items ของ role (kind=pool เท่านั้น) · gross ต่อ item
 *  legacy normal/buy คงไว้สำหรับ summary backward-compat                     */
interface PoolGroupInfo {
  id: string;
  label: string;
  items: { id: string; label: string; gross: number }[];
  /** legacy aggregate — ใช้ใน summary fallback ถ้า items ว่าง */
  normal: number;
  buy: number;
}

interface Props {
  yearMonth: string;
  locked: boolean;
  adjustment?: { items?: Item[] };
  /** กลุ่มกองกลางในเดือนนี้ — pool variant */
  poolGroups: PoolGroupInfo[];
  /** ตำแหน่งทั้งหมด · ใช้ filter dropdown ใน piece variant */
  roles: Role[];
  /** พนักงานทั้งหมด · ใช้ dropdown ใน piece variant */
  employeeDirectory: Employee[];
  onSave: (yearMonth: string, fields: { items: Item[] }) => Promise<void>;
  onClose: () => void;
  showToast?: (msg: string) => void;
}

function randomId() {
  return Math.random().toString(36).slice(2, 11);
}

function normalizeItems(
  items: Item[] | undefined,
  employeeDirectory: Employee[],
  roles: Role[],
): Item[] {
  return (items || []).map((it) => {
    let roleId = it.roleId || "";
    // backward compat: exclusion เก่า (ก่อน persist roleId) ไม่มี field นี้
    // strategy 1 — หา role ที่ยังมี pieceItemId นี้ (เชื่อถือได้สุด · ตรงตาม
    // ตำแหน่งจริงที่ pieceItem อยู่ ไม่ใช่ตำแหน่งปัจจุบันของพนักงาน)
    if (!roleId && it.kind === "piece" && it.pieceItemId) {
      const role = roles.find((r) =>
        rolePieceItems(r).some((p) => p.id === it.pieceItemId),
      );
      if (role) roleId = role.id;
    }
    // strategy 2 — fallback มา employee.roleId ปัจจุบัน (ถ้า pieceItem ถูกลบ
    // จาก role แล้ว · best-effort เพื่อกัน dropdown ว่าง)
    if (!roleId && it.kind === "piece" && it.employeeId) {
      const emp = employeeDirectory.find((e) => e.id === it.employeeId);
      roleId = emp?.roleId || "";
    }
    // legacy side → poolItemId migration · ถ้าไม่มี poolItemId แต่มี side
    // ให้ resolve: side="normal" → "normal" id · side="buy" → "buy" id
    let poolItemId = it.poolItemId || "";
    if (!poolItemId && it.kind !== "piece") {
      poolItemId = it.side === "buy" ? "buy" : "normal";
    }
    return {
      id: it.id || randomId(),
      kind: it.kind === "piece" ? "piece" : "pool",
      poolGroup: it.poolGroup || "",
      side: it.side === "buy" ? "buy" : "normal",
      poolItemId,
      employeeId: it.employeeId || "",
      pieceItemId: it.pieceItemId || "",
      roleId,
      employeeName: it.employeeName || "",
      pieceItemLabel: it.pieceItemLabel || "",
      pieces: Number(it.pieces) || 0,
      label: it.label || "",
    };
  });
}

export default function PoolAdjustmentModal({
  yearMonth,
  locked,
  adjustment,
  poolGroups,
  roles,
  employeeDirectory,
  onSave,
  onClose,
  showToast,
}: Props) {
  const firstGroup = poolGroups[0]?.id || "";
  // ตำแหน่งที่มี multi-item piece (ใช้ใน piece dropdown)
  const pieceRoles = roles.filter(
    (r) =>
      !r.poolGroup &&
      rolePaysPieceCommission(r) &&
      rolePieceItems(r).length > 0,
  );

  const [items, setItems] = useState<Item[]>(() =>
    normalizeItems(adjustment?.items, employeeDirectory, roles),
  );
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-sync ตามเดือนเท่านั้น
  useEffect(() => {
    setItems(normalizeItems(adjustment?.items, employeeDirectory, roles));
  }, [yearMonth]);

  const monthLabel = formatYmThai(yearMonth);

  const compareKey = (arr: Item[]) =>
    arr
      .map((i) =>
        i.kind === "piece"
          ? `piece:${i.employeeId}:${i.pieceItemId}:${i.pieces}:${i.label.trim()}`
          : `pool:${i.poolGroup}:${i.poolItemId || i.side}:${i.pieces}:${i.label.trim()}`,
      )
      .sort()
      .join("|");
  const dirty =
    compareKey(items) !==
    compareKey(normalizeItems(adjustment?.items, employeeDirectory, roles));

  // นำพนักงานในตำแหน่งที่เลือก (ใช้ filter dropdown employee ของ row piece)
  function employeesInRole(roleId: string) {
    return employeeDirectory.filter((e) => e.roleId === roleId);
  }
  function itemsInRole(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    return role ? rolePieceItems(role) : [];
  }

  function addPoolItem() {
    // default poolItemId = item แรกของ group แรก
    // audit fix: ถ้า group ไม่มี items เลย ห้ามเพิ่ม (จะเป็น orphan id "normal"
    // ที่ไม่ตรงกับ role config · admin กด ลบ-เพิ่ม ค่าหัก ไม่มีผล)
    const firstGroupObj = poolGroups[0];
    const firstItem = firstGroupObj?.items?.[0];
    if (!firstItem) {
      showToast?.("ตำแหน่งของกองนี้ยังไม่มี pool items — เพิ่มในแท็บ 'ตำแหน่ง' ก่อน");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: randomId(),
        kind: "pool",
        poolGroup: firstGroup,
        side: firstItem.id === "buy" ? "buy" : "normal",
        poolItemId: firstItem.id,
        pieces: 0,
        label: "",
      },
    ]);
  }
  function addPieceItem() {
    const firstRole = pieceRoles[0];
    const firstEmp = firstRole ? employeesInRole(firstRole.id)[0] : null;
    const firstItem = firstRole ? itemsInRole(firstRole.id)[0] : null;
    setItems((prev) => [
      ...prev,
      {
        id: randomId(),
        kind: "piece",
        roleId: firstRole?.id || "",
        employeeId: firstEmp?.id || "",
        pieceItemId: firstItem?.id || "",
        pieces: 0,
        label: "",
      },
    ]);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const next = { ...i, ...patch };
        // เมื่อเปลี่ยน role — reset employee + item เป็นตัวแรกของ role ใหม่
        if (patch.roleId && patch.roleId !== i.roleId) {
          const emp = employeesInRole(patch.roleId)[0];
          const it0 = itemsInRole(patch.roleId)[0];
          next.employeeId = emp?.id || "";
          next.pieceItemId = it0?.id || "";
        }
        return next;
      }),
    );
  }

  async function save() {
    if (locked || saving || !dirty) return;
    setSaving(true);
    // re-snapshot names ตอน save จากข้อมูลปัจจุบัน · กัน name ใน UI เก่า
    // ไม่ตรงกับที่ admin เห็นล่าสุด (ถ้า admin rename หลังเปิด modal)
    const itemsToSave = items.map((it) => {
      if (it.kind !== "piece") return it;
      const emp = it.employeeId
        ? employeeDirectory.find((e) => e.id === it.employeeId)
        : null;
      const role = it.roleId ? roles.find((r) => r.id === it.roleId) : null;
      const pi = role
        ? rolePieceItems(role).find((p) => p.id === it.pieceItemId)
        : null;
      return {
        ...it,
        employeeName: emp ? emp.nickname || emp.name : it.employeeName || "",
        pieceItemLabel: pi ? pi.label : it.pieceItemLabel || "",
      };
    });
    try {
      await onSave(yearMonth, { items: itemsToSave });
      showToast?.("บันทึกรายการยกเว้นค่าคอมแล้ว");
      onClose();
    } catch (err) {
      console.error("[CommissionExclusion] save failed:", err);
      showToast?.(
        err instanceof Error && err.message ? err.message : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  /** ผลรวมที่ admin หักแล้วของ group + pool item id (Phase 3D) */
  function deductedItem(groupId: string, itemId: string) {
    return items
      .filter(
        (i) =>
          i.kind === "pool" &&
          i.poolGroup === groupId &&
          (i.poolItemId === itemId ||
            // legacy fallback: ถ้าไม่มี poolItemId → mapping จาก side
            (!i.poolItemId &&
              ((i.side === "normal" && itemId === "normal") ||
                (i.side === "buy" && itemId === "buy")))),
      )
      .reduce((s, i) => s + Math.max(0, Number(i.pieces) || 0), 0);
  }

  const poolItems = items.filter((i) => i.kind === "pool");
  const pieceItems = items.filter((i) => i.kind === "piece");

  return (
    <BaseModal onClose={onClose} contentClassName="px-5.5 pt-6 pb-7">
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-[46px] h-[46px] rounded-xl bg-red-lt flex items-center justify-center shrink-0 border border-red/20">
          <IconMinus size={22} className="text-red" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt">
            รายการยกเว้นค่าคอม
          </div>
          <div className="text-sm text-txt-soft mt-0.5">{monthLabel}</div>
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-2 px-3.5 py-3 mb-3.5 rounded-[12px] bg-cream border-[1.5px] border-bdr">
          <IconLock
            size={16}
            strokeWidth={2.4}
            className="text-txt-mid mt-0.5 shrink-0"
          />
          <div className="text-sm text-txt-mid leading-normal">
            <b className="text-txt">ปิดรอบแล้ว</b> — เดือนนี้แก้ไขไม่ได้
          </div>
        </div>
      )}

      {/* ── SECTION A: Pool (กองกลาง) ──────────────────────────── */}
      {poolGroups.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-bold text-maroon mb-2 px-1">
            หักจากกองกลาง
          </div>
          <div className="text-xs text-txt-soft mb-2 px-1 leading-relaxed">
            ยอดที่หักจะไม่ถูกนำไปแบ่งในกองกลาง แต่ยังนับเป็นยอดของพนักงาน (เกณฑ์ 80%)
          </div>
          {poolItems.length === 0 ? (
            <div className="text-center text-xs text-txt-soft py-4 px-4 bg-cream/60 rounded-[10px] border border-dashed border-bdr mb-2">
              ยังไม่มีรายการหัก
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-2">
              {poolItems.map((item) => (
                <PoolRow
                  key={item.id}
                  item={item}
                  poolGroups={poolGroups}
                  locked={locked}
                  onUpdate={(patch) => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          )}
          {!locked && (
            <button
              type="button"
              onClick={addPoolItem}
              className="w-full py-2 rounded-[10px] border-[1.5px] border-dashed border-maroon/30 bg-cream text-maroon text-xs font-bold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5"
            >
              <IconPlus size={12} strokeWidth={2.4} />
              เพิ่มรายการ — กองกลาง
            </button>
          )}
          {/* สรุป pool summary — loop ทุก pool item (รวม custom · Phase 3D) */}
          <div className="bg-gold-pale/60 rounded-[12px] p-2.5 mt-2.5 border border-gold/25 text-xs flex flex-col gap-1.5">
            {poolGroups.map((g) => {
              // legacy: ถ้า items ว่าง (data เก่าก่อน Phase 1A) ใช้ normal/buy
              const fallbackItems =
                g.items && g.items.length > 0
                  ? g.items
                  : [
                      { id: "normal", label: "ขาย (ทั่วไป)", gross: g.normal },
                      { id: "buy", label: "รับซื้อ", gross: g.buy },
                    ];
              return (
                <div key={g.id}>
                  <div className="font-bold text-maroon mb-0.5">{g.label}</div>
                  {fallbackItems.map((it) => {
                    const d = deductedItem(g.id, it.id);
                    return (
                      <div key={it.id} className="flex justify-between">
                        <span className="text-txt-mid">{it.label}</span>
                        <span className="font-semibold">
                          {formatThaiNumber(it.gross)} − {formatThaiNumber(d)}{" "}
                          = {formatThaiNumber(Math.max(0, it.gross - d))} ชิ้น
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION B: Piece (ตำแหน่ง multi-item) ─────────────── */}
      {pieceRoles.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-bold text-maroon mb-2 px-1">
            หักจากค่าคอมรายชิ้น
          </div>
          <div className="text-xs text-txt-soft mb-2 px-1 leading-relaxed">
            หัก count ของพนักงานในรายการที่เลือก — เลือก ตำแหน่ง · พนักงาน · รายการ
            ได้อิสระ
            {/* ถ้ามี row orphan ใดๆ → อธิบาย */}
            {pieceItems.some((it) => {
              if (it.kind !== "piece") return false;
              const roleOrphan =
                !!it.roleId && !pieceRoles.some((r) => r.id === it.roleId);
              const empOrphan =
                !!it.employeeId &&
                !!it.roleId &&
                !employeesInRole(it.roleId).some(
                  (e) => e.id === it.employeeId,
                );
              const itemOrphan =
                !!it.pieceItemId &&
                !!it.roleId &&
                !itemsInRole(it.roleId).some((p) => p.id === it.pieceItemId);
              return roleOrphan || empOrphan || itemOrphan;
            }) && (
              <span className="block mt-1 text-amber font-semibold">
                ⚠ มีรายการที่อ้างถึงข้อมูลเก่า (พนักงานย้ายตำแหน่ง / รายการถูกลบ).
                payout ของเดือนนั้นยังถูกต้องตาม snapshot · เก็บ/เปลี่ยน/ลบ row ได้
              </span>
            )}
          </div>
          {pieceItems.length === 0 ? (
            <div className="text-center text-xs text-txt-soft py-4 px-4 bg-cream/60 rounded-[10px] border border-dashed border-bdr mb-2">
              ยังไม่มีรายการหัก
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-2">
              {pieceItems.map((item) => (
                <PieceRow
                  key={item.id}
                  item={item}
                  pieceRoles={pieceRoles}
                  roles={roles}
                  employeeDirectory={employeeDirectory}
                  employeesInRole={employeesInRole}
                  itemsInRole={itemsInRole}
                  locked={locked}
                  onUpdate={(patch) => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          )}
          {!locked &&
            (() => {
              // เช็คว่ามีตำแหน่งที่มีพนักงานจริง · ถ้าไม่มี → disable + แสดงเหตุผล
              // (กัน admin กดเพิ่มแล้วบันทึก กลับมาเปิดใหม่รายการหาย เพราะ
              // sanitize filter ใน poolAdjustments.ts ทิ้ง row ที่ employeeId="")
              const canAdd = pieceRoles.some(
                (r) => employeesInRole(r.id).length > 0,
              );
              return (
                <button
                  type="button"
                  onClick={addPieceItem}
                  disabled={!canAdd}
                  className={`w-full py-2 rounded-[10px] border-[1.5px] border-dashed text-xs font-bold font-[inherit] inline-flex items-center justify-center gap-1.5 ${
                    canAdd
                      ? "border-maroon/30 bg-cream text-maroon cursor-pointer"
                      : "border-bdr bg-cream/40 text-txt-soft cursor-not-allowed"
                  }`}
                >
                  <IconPlus size={12} strokeWidth={2.4} />
                  {canAdd
                    ? "เพิ่มรายการ — รายชิ้น"
                    : "เพิ่มรายการ — ยังไม่มีพนักงานในตำแหน่งที่มีค่าคอมรายชิ้น"}
                </button>
              );
            })()}
        </div>
      )}

      {poolGroups.length === 0 && pieceRoles.length === 0 && (
        <div className="text-center text-sm text-txt-soft py-6 px-4 bg-cream/60 rounded-[12px] border border-dashed border-bdr mb-3">
          ยังไม่มีตำแหน่งที่ใช้ค่าคอมรายชิ้น
        </div>
      )}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
        >
          ปิด
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || locked || !dirty}
          className={`flex-2 p-3.5 rounded-xl border-none text-base font-bold font-[inherit] inline-flex items-center justify-center gap-1.5 ${
            saving || locked || !dirty
              ? "bg-bdr text-txt-soft cursor-not-allowed"
              : "bg-maroon text-white cursor-pointer shadow-[0_4px_14px_rgba(123,28,28,0.25)]"
          }`}
        >
          {locked && <IconLock size={14} strokeWidth={2.5} />}
          {locked ? "ปิดรอบแล้ว" : saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </BaseModal>
  );
}

const selectCls =
  "w-full appearance-none pl-2.5 pr-7 py-2 rounded-[8px] border border-bdr text-sm font-semibold outline-none font-[inherit] bg-white text-txt cursor-pointer disabled:bg-cream-dk disabled:text-txt-soft disabled:cursor-not-allowed";
const chevronCls =
  "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft";

function PoolRow({
  item,
  poolGroups,
  locked,
  onUpdate,
  onRemove,
}: {
  item: Item;
  poolGroups: PoolGroupInfo[];
  locked: boolean;
  onUpdate: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[10px] p-2.5 border border-bdr bg-cream/60 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <select
            value={item.poolGroup}
            disabled={locked}
            onChange={(e) => onUpdate({ poolGroup: e.target.value })}
            className={selectCls}
          >
            {poolGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <IconChevronDown size={12} strokeWidth={2.4} className={chevronCls} />
        </div>
        <div className="relative">
          {(() => {
            // pool items ของ group ที่ admin เลือก (kind=pool เท่านั้น)
            // legacy fallback: ถ้าไม่มี items → normal/buy hardcoded
            const group = poolGroups.find((g) => g.id === item.poolGroup);
            const groupItems =
              group?.items && group.items.length > 0
                ? group.items
                : [
                    { id: "normal", label: "ขาย (ทั่วไป)" },
                    { id: "buy", label: "รับซื้อ" },
                  ];
            const currentItemId =
              item.poolItemId || (item.side === "buy" ? "buy" : "normal");
            return (
              <select
                value={currentItemId}
                disabled={locked}
                onChange={(e) =>
                  onUpdate({
                    poolItemId: e.target.value,
                    // sync legacy side สำหรับ backward-compat
                    side:
                      e.target.value === "buy"
                        ? "buy"
                        : e.target.value === "normal"
                          ? "normal"
                          : item.side,
                  })
                }
                className={selectCls}
              >
                {groupItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.label}
                  </option>
                ))}
              </select>
            );
          })()}
          <IconChevronDown size={12} strokeWidth={2.4} className={chevronCls} />
        </div>
        {!locked && (
          <button
            type="button"
            aria-label="ลบรายการ"
            onClick={onRemove}
            className="w-9 h-9 shrink-0 rounded-[10px] bg-red-lt flex items-center justify-center cursor-pointer border-[1.5px] border-[#C0392B30]"
          >
            <IconTrash size={15} className="text-red" strokeWidth={2.2} />
          </button>
        )}
      </div>
      <PiecesAndLabelRow item={item} locked={locked} onUpdate={onUpdate} />
    </div>
  );
}

function PieceRow({
  item,
  pieceRoles,
  roles,
  employeeDirectory,
  employeesInRole,
  itemsInRole,
  locked,
  onUpdate,
  onRemove,
}: {
  item: Item;
  pieceRoles: Role[];
  /** ทุก role · ใช้ resolve orphan roleId (role ที่ถูกเปลี่ยน config ไปแล้ว) */
  roles: Role[];
  /** ทุกพนักงาน · ใช้ resolve orphan employeeId */
  employeeDirectory: Employee[];
  employeesInRole: (roleId: string) => Employee[];
  itemsInRole: (roleId: string) => { id: string; label: string }[];
  locked: boolean;
  onUpdate: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const emps = item.roleId ? employeesInRole(item.roleId) : [];
  const its = item.roleId ? itemsInRole(item.roleId) : [];

  // ── Orphan detection: row อ้าง id ที่ไม่อยู่ใน live list ──────────
  // ถ้าเจอ → ใส่ option "(ข้อมูลเก่า)" ท้าย list ให้ admin เห็น + จัดการได้
  // (เช่น admin เปลี่ยน role พนักงานหลังบันทึก exclusion · payout ยังถูก
  //  เพราะ calculateSalary ใช้ snapshot · แค่ UI ต้องโชว์ให้แก้/ลบได้)
  const roleIsOrphan =
    !!item.roleId && !pieceRoles.some((r) => r.id === item.roleId);
  const orphanRole = roleIsOrphan
    ? roles.find((r) => r.id === item.roleId)
    : null;
  const empIsOrphan =
    !!item.employeeId && !emps.some((e) => e.id === item.employeeId);
  const orphanEmp = empIsOrphan
    ? employeeDirectory.find((e) => e.id === item.employeeId)
    : null;
  const itemIsOrphan =
    !!item.pieceItemId && !its.some((it) => it.id === item.pieceItemId);

  return (
    <div className="rounded-[10px] p-2.5 border border-bdr bg-cream/60 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <select
            value={item.roleId}
            disabled={locked}
            onChange={(e) => onUpdate({ roleId: e.target.value })}
            className={selectCls}
          >
            {pieceRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            {roleIsOrphan && (
              <option value={item.roleId}>
                {orphanRole
                  ? `${orphanRole.name} (เก่า)`
                  : "(ตำแหน่งเก่า)"}
              </option>
            )}
          </select>
          <IconChevronDown size={12} strokeWidth={2.4} className={chevronCls} />
        </div>
        {!locked && (
          <button
            type="button"
            aria-label="ลบรายการ"
            onClick={onRemove}
            className="w-9 h-9 shrink-0 rounded-[10px] bg-red-lt flex items-center justify-center cursor-pointer border-[1.5px] border-[#C0392B30]"
          >
            <IconTrash size={15} className="text-red" strokeWidth={2.2} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <select
            value={item.employeeId}
            disabled={locked || (emps.length === 0 && !empIsOrphan)}
            onChange={(e) => onUpdate({ employeeId: e.target.value })}
            className={selectCls}
          >
            {emps.length === 0 && !empIsOrphan ? (
              <option value="">— ไม่มีพนักงาน —</option>
            ) : (
              <>
                {emps.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nickname || e.name}
                  </option>
                ))}
                {empIsOrphan && (
                  <option value={item.employeeId}>
                    {orphanEmp
                      ? `${orphanEmp.nickname || orphanEmp.name} (ย้ายแล้ว)`
                      : item.employeeName
                        ? `${item.employeeName} (ลบแล้ว)`
                        : "(พนักงานเก่า)"}
                  </option>
                )}
              </>
            )}
          </select>
          <IconChevronDown size={12} strokeWidth={2.4} className={chevronCls} />
        </div>
        <div className="relative flex-1 min-w-0">
          <select
            value={item.pieceItemId}
            disabled={locked || (its.length === 0 && !itemIsOrphan)}
            onChange={(e) => onUpdate({ pieceItemId: e.target.value })}
            className={selectCls}
          >
            {its.length === 0 && !itemIsOrphan ? (
              <option value="">— ไม่มีรายการ —</option>
            ) : (
              <>
                {its.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.label}
                  </option>
                ))}
                {itemIsOrphan && (
                  <option value={item.pieceItemId}>
                    {item.pieceItemLabel
                      ? `${item.pieceItemLabel} (ลบแล้ว)`
                      : "(รายการเก่า)"}
                  </option>
                )}
              </>
            )}
          </select>
          <IconChevronDown size={12} strokeWidth={2.4} className={chevronCls} />
        </div>
      </div>
      <PiecesAndLabelRow item={item} locked={locked} onUpdate={onUpdate} />
    </div>
  );
}

function PiecesAndLabelRow({
  item,
  locked,
  onUpdate,
}: {
  item: Item;
  locked: boolean;
  onUpdate: (patch: Partial<Item>) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={item.label}
        disabled={locked}
        maxLength={120}
        placeholder="เหตุผล (เช่น โปรโมชั่น)"
        onChange={(e) => onUpdate({ label: e.target.value })}
        className={`flex-1 min-w-0 px-3 py-2 rounded-[8px] border border-bdr text-sm outline-none font-[inherit] ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white"}`}
      />
      <div className="relative w-[110px] shrink-0">
        <input
          type="text"
          inputMode="numeric"
          value={item.pieces || ""}
          disabled={locked}
          placeholder="0"
          onChange={(e) => onUpdate({ pieces: Number(e.target.value) || 0 })}
          className={`w-full px-3 py-2 rounded-[8px] border border-bdr text-base font-bold outline-none font-[inherit] text-center ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white"}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs pointer-events-none">
          ชิ้น
        </span>
      </div>
    </div>
  );
}
