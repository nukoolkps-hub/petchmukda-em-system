import {
  Briefcase as IconBriefcase,
  ChevronDown as IconChevronDown,
  Handshake as IconHandshake,
  Pencil as IconPencil,
  Plus as IconPlus,
  Sparkles as IconSparkles,
  Target as IconTarget,
  Trash2 as IconTrash,
  User as IconUser,
  X as IconX,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import { COLORS } from "../../constants";
import type { PieceItem } from "../../types";
import {
  roleBonusItems,
  rolePieceItems,
  rolePoolItems,
} from "../../utils/salaryUtils";
import {
  isRichTextEmpty,
  sanitizeRichText,
} from "../../utils/sanitizeRichText";
import AvatarCircle from "../shared/AvatarCircle";
import RichTextEditor from "../shared/RichTextEditor";
import ThemedSelect from "../shared/ThemedSelect";

/** สร้าง id ใหม่ของ piece item (คงที่ตลอดอายุ — อ้าง rate/จำนวนชิ้น) */
function newPieceId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ─── ItemsEditor — แก้ไขรายการ {id,label}[] (เพิ่ม/ลบ/แก้)
   ใช้ทั้ง pieceItems (ค่าคอมรายชิ้น) + bonusItems (โบนัสอื่นๆ)             */
function ItemsEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: PieceItem[];
  onChange: (next: PieceItem[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, idx) => (
        <div key={item.id} className="flex gap-1.5 items-center">
          <input
            value={item.label}
            onChange={(ev) => {
              const next = items.slice();
              next[idx] = { ...item, label: ev.target.value };
              onChange(next);
            }}
            placeholder={placeholder}
            maxLength={40}
            className="flex-1 px-2.5 py-2 rounded-lg border-[1.5px] border-gold text-sm outline-none font-[inherit] box-border bg-gold-pale/30"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            aria-label="ลบรายการ"
            className="shrink-0 w-8 h-8 rounded-lg border border-red/25 bg-red-lt text-red flex items-center justify-center cursor-pointer"
          >
            <IconTrash size={13} strokeWidth={2.2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { id: newPieceId(), label: "" }])}
        className="self-start px-2.5 py-1.5 rounded-lg border border-dashed border-gold/50 bg-gold-pale/20 text-maroon text-xs font-bold cursor-pointer font-[inherit] inline-flex items-center gap-1"
      >
        <IconPlus size={12} strokeWidth={2.6} />
        {addLabel}
      </button>
    </div>
  );
}

/** sanitize รายการ piece ก่อนเก็บ: ตัด label ว่าง + trim · คืน null ถ้าไม่เหลือ */
function cleanPieceItems(items: PieceItem[] | undefined): PieceItem[] | null {
  if (!Array.isArray(items)) return null;
  const cleaned = items
    .map((it) => ({ id: it.id, label: (it.label || "").trim() }))
    .filter((it) => it.label);
  return cleaned.length > 0 ? cleaned : null;
}

/** resolve primary item id หลัง clean — ถ้า primary หาย (admin ลบ item ที่เป็น
 *  primary โดยไม่ตั้งใหม่) → fallback ตัวแรก kind=pool · ถ้าไม่มีเลย → null    */
function resolvePrimaryPoolItemId(
  cleanedItems: { id: string; kind: "pool" | "personal" }[],
  primaryId: string | null | undefined,
): string | null {
  if (primaryId && cleanedItems.some((it) => it.id === primaryId))
    return primaryId;
  const firstPool = cleanedItems.find((it) => it.kind === "pool");
  return firstPool?.id || cleanedItems[0]?.id || null;
}

/** sanitize pool items · ตัด label ว่าง · clamp threshold 0-100 · คืน []
 *  ถ้าไม่เหลือ (pool role ต้องมี items อย่างน้อย 1 ตัว · admin ต้องเพิ่ม)     */
function cleanPoolItems(
  items:
    | { id: string; label: string; kind?: string; threshold?: number }[]
    | undefined,
): {
  id: string;
  label: string;
  kind: "pool" | "personal";
  threshold: number;
}[] {
  if (!Array.isArray(items)) return [];
  // dedupe by id เก็บตัวแรกที่เจอ · audit fix #11 · กัน admin paste/copy
  // ทำให้ duplicate id (React warning + map overwrite ใน calc engine)
  const seen = new Set<string>();
  return items
    .map((it) => ({
      id: String(it.id),
      label: (it.label || "").trim(),
      kind: (it.kind === "personal" ? "personal" : "pool") as
        | "pool"
        | "personal",
      threshold:
        typeof it.threshold === "number"
          ? Math.max(0, Math.min(100, it.threshold))
          : 80,
    }))
    .filter((it) => {
      if (!it.label || !it.id) return false;
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });
}

/** PoolItemsEditor — แก้ไขรายการ pool sales (label + kind + threshold)
 *  + primary item picker (สำหรับ losesBaseSalary check)                       */
function PoolItemsEditor({
  items,
  primaryId,
  onChange,
  onChangePrimary,
}: {
  items: { id: string; label: string; kind: string; threshold: number }[];
  primaryId: string;
  onChange: (
    next: {
      id: string;
      label: string;
      kind: "pool" | "personal";
      threshold: number;
    }[],
  ) => void;
  onChangePrimary: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="border-[1.5px] border-gold/40 rounded-lg p-2 bg-gold-pale/30 flex flex-col gap-1.5"
        >
          <div className="flex gap-1.5 items-center">
            <input
              value={item.label}
              onChange={(ev) => {
                const next = items.slice();
                next[idx] = { ...item, label: ev.target.value } as any;
                onChange(next as any);
              }}
              placeholder='เช่น "ขายทั่วไป", "ขายมือสอง"'
              maxLength={40}
              className="flex-1 px-2.5 py-1.5 rounded-md border border-bdr text-sm outline-none font-[inherit] box-border bg-white"
            />
            <label className="flex items-center gap-1 cursor-pointer text-xs font-semibold text-maroon">
              <input
                type="radio"
                name="primaryPoolItem"
                checked={primaryId === item.id}
                onChange={() => onChangePrimary(item.id)}
                className="accent-maroon"
              />
              <span>หลัก</span>
            </label>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx) as any)}
              aria-label="ลบรายการ"
              className="shrink-0 w-7 h-7 rounded-md border border-red/25 bg-red-lt text-red flex items-center justify-center cursor-pointer"
            >
              <IconTrash size={11} strokeWidth={2.2} />
            </button>
          </div>
          <div className="flex gap-1.5 items-center text-xs">
            <ThemedSelect
              value={item.kind}
              onChange={(v) => {
                const next = items.slice();
                next[idx] = { ...item, kind: v as any } as any;
                onChange(next as any);
              }}
              options={[
                { value: "pool", label: "แชร์กองกลาง" },
                { value: "personal", label: "ส่วนตัว" },
              ]}
              className="inline-flex items-center px-1.5 pr-6 py-1 rounded-md border border-bdr text-xs text-txt bg-white font-[inherit] cursor-pointer text-left"
            />
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-txt-soft">เกณฑ์เข้ากอง:</span>
              <input
                type="text"
                min={0}
                max={100}
                value={item.threshold}
                disabled={item.kind === "personal"}
                onChange={(ev) => {
                  const next = items.slice();
                  next[idx] = {
                    ...item,
                    threshold: Number(ev.target.value) || 0,
                  } as any;
                  onChange(next as any);
                }}
                className="w-14 px-1.5 py-1 rounded-md border border-bdr text-xs text-center font-bold font-[inherit] bg-white disabled:bg-cream-dk disabled:text-txt-soft"
              />
              <span className="text-txt-soft">%</span>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...items,
            {
              id: newPieceId(),
              label: "",
              kind: "pool" as const,
              threshold: 80,
            },
          ] as any)
        }
        className="self-start px-2.5 py-1.5 rounded-lg border border-dashed border-gold/50 bg-gold-pale/20 text-maroon text-xs font-bold cursor-pointer font-[inherit] inline-flex items-center gap-1"
      >
        <IconPlus size={12} strokeWidth={2.6} />
        เพิ่มรายการ pool
      </button>
    </div>
  );
}

/** normalize ฟิลด์ "หน้าที่หลัก" ก่อนเก็บ:
 *  - ว่างจริง (เคลียร์แล้วเหลือ <br>) → null
 *  - มีเนื้อหา → sanitize ทันทีตอน write (single source of truth ปลอดภัย
 *    ทุก surface รวมถึง editor ฝั่ง admin — ไม่ต้องพึ่ง sanitize ตอน render) */
function cleanMainDuties(html: string | null | undefined): string | null {
  if (isRichTextEmpty(html)) return null;
  return sanitizeRichText(html || "");
}

/* ─── Admin: Roles Management Panel ────────────────────────────── */
export default function RolesAdminPanel({
  roles,
  employeeDirectory,
  onUpdateEmployeeRole,
  onUpsertRole,
  onDeleteRole,
  showToast,
}) {
  const [editing, setEditing] = useState({}); // {roleId: {name, poolGroup, pieceItems, bonusItems, poolItems, primaryPoolItemId, mainDuties}}
  // default ของ form "ตำแหน่งใหม่" — extract เพื่อ reuse ทั้งตอน save + ตอนปิดฟอร์ม
  const makeBlankNewRole = () => ({
    name: "",
    poolGroup: "",
    pieceItems: [] as PieceItem[],
    // ตำแหน่งใหม่ — bonusItems ว่าง (admin เพิ่มเอง · [] = ซ่อน section)
    bonusItems: [] as PieceItem[],
    // pool items (สำหรับ pool sales role) — default 3 รายการ ให้ admin
    // ลบ/เพิ่ม/แก้ได้ตามต้องการ · "ขายพิเศษ" kind=personal (ส่วนตัว)
    poolItems: [
      { id: "normal", label: "ขายทั่วไป", kind: "pool" as const, threshold: 80 },
      {
        id: "special",
        label: "ขายพิเศษ",
        kind: "personal" as const,
        threshold: 80,
      },
      { id: "buy", label: "รับซื้อ", kind: "pool" as const, threshold: 80 },
    ],
    primaryPoolItemId: "normal" as string,
    mainDuties: "",
  });
  const [newRole, setNewRole] = useState(makeBlankNewRole);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);

  async function saveEdit(roleId) {
    const e = editing[roleId];
    if (!e) return;
    const current = roles.find((rl) => rl.id === roleId);
    if (!current) return;
    try {
      // pieceItems: เก็บ null ถ้าว่าง (force opt-in) · drop ถ้าใส่ pool
      // (pool sales ใช้ normal/special/buy ไม่ใช้ piece items)
      const poolValue = e.poolGroup?.trim() || null;
      const pieceItemsDraft =
        e.pieceItems !== undefined ? e.pieceItems : rolePieceItems(current);
      const pieceItemsValue = poolValue
        ? null
        : cleanPieceItems(pieceItemsDraft);
      // bonusItems: drop pool sales กฎเหมือน pieceItems · array ว่าง = ปิด section
      // (ถ้า admin ไม่แตะ field นี้ → ใช้ default migration จาก roleBonusItems)
      const bonusItemsDraft =
        e.bonusItems !== undefined ? e.bonusItems : roleBonusItems(current);
      const bonusItemsValue = cleanPieceItems(bonusItemsDraft) ?? [];
      await onUpsertRole({
        ...current,
        name: e.name || current.name,
        poolGroup: poolValue,
        pieceItems: pieceItemsValue,
        bonusItems: bonusItemsValue,
        // pool items — เก็บ array เสมอถ้า pool role · null ถ้าไม่ใช่ pool
        // primary fallback ถ้า admin ลบ item ที่เป็น primary (กัน orphan id
        // ค้างใน doc → losesBaseSalary check ล้มเหลวเงียบ)
        ...(() => {
          const cleaned = poolValue
            ? cleanPoolItems(
                e.poolItems !== undefined
                  ? e.poolItems
                  : (rolePoolItems(current) as any),
              )
            : null;
          const primary = poolValue
            ? resolvePrimaryPoolItemId(
                cleaned || [],
                e.primaryPoolItemId !== undefined
                  ? e.primaryPoolItemId
                  : current.primaryPoolItemId,
              )
            : null;
          return { poolItems: cleaned, primaryPoolItemId: primary };
        })(),
        // ย้ายมา pieceItems แล้ว → ล้าง legacy pieceLabel กัน migrate-on-read
        // หยิบ label เก่ามาซ้ำ
        pieceLabel: null,
        mainDuties: cleanMainDuties(e.mainDuties),
      });
      setEditing((prev) => {
        const n = { ...prev };
        delete n[roleId];
        return n;
      });
      showToast?.("บันทึกตำแหน่งแล้ว");
    } catch (err) {
      console.error("[RolesAdminPanel] save role failed:", err);
      showToast?.("บันทึกตำแหน่งไม่สำเร็จ");
    }
  }

  async function addRole() {
    if (!newRole.name.trim()) return;
    const id = `r_${Date.now()}`;
    try {
      const poolValue = newRole.poolGroup.trim() || null;
      await onUpsertRole({
        id,
        name: newRole.name.trim(),
        poolGroup: poolValue,
        // pieceItems ไม่ใช้ใน pool sales (มี normal/special/buy แล้ว)
        pieceItems: poolValue ? null : cleanPieceItems(newRole.pieceItems),
        bonusItems: cleanPieceItems(newRole.bonusItems) ?? [],
        ...(() => {
          const cleaned = poolValue ? cleanPoolItems(newRole.poolItems) : null;
          const primary = poolValue
            ? resolvePrimaryPoolItemId(cleaned || [], newRole.primaryPoolItemId)
            : null;
          return { poolItems: cleaned, primaryPoolItemId: primary };
        })(),
        pieceLabel: null,
        mainDuties: cleanMainDuties(newRole.mainDuties),
      });
      setNewRole(makeBlankNewRole());
      setShowAdd(false);
      showToast?.("เพิ่มตำแหน่งแล้ว");
    } catch (err) {
      console.error("[RolesAdminPanel] add role failed:", err);
      showToast?.("เพิ่มตำแหน่งไม่สำเร็จ");
    }
  }

  async function deleteRole(roleId) {
    try {
      await onDeleteRole(roleId);
      setConfirmDel(null);
      showToast?.("ลบตำแหน่งแล้ว");
    } catch (err) {
      console.error("[RolesAdminPanel] delete role failed:", err);
      showToast?.("ลบตำแหน่งไม่สำเร็จ");
    }
  }

  // group roles by poolGroup
  const groups = {};
  roles.forEach((r) => {
    const k = r.poolGroup || "_individual_";
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  });

  // useCallback → ref คงที่ ให้ EmployeeRoleAssignmentList ที่ memo ไว้
  // ไม่ re-render ตอนพิมพ์ใน editor (onUpdateEmployeeRole เป็น prop คงที่)
  const changeEmpRole = useCallback(
    (employeeId: string, roleId: string, roleName: string) => {
      onUpdateEmployeeRole(employeeId, "roleId", roleId);
      onUpdateEmployeeRole(employeeId, "role", roleName);
    },
    [onUpdateEmployeeRole],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-sm text-txt-soft">
          กำหนดตำแหน่งและกลุ่มค่าคอมกองกลาง
        </div>
        <button
          onClick={() => {
            // ปิดฟอร์ม → ทิ้ง draft ที่กรอกค้างไว้ (parity กับปุ่ม "ยกเลิก" inline edit)
            if (showAdd) setNewRole(makeBlankNewRole());
            setShowAdd(!showAdd);
          }}
          className="px-3.5 py-[7px] rounded-[9px] border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] shadow-[0_2px_8px_var(--color-maroon)/0.25] flex items-center gap-[5px]"
        >
          {showAdd ? (
            <IconX size={14} strokeWidth={2.6} />
          ) : (
            <IconPlus size={14} strokeWidth={2.6} />
          )}
          เพิ่มตำแหน่ง
        </button>
      </div>

      {/* Add new role form */}
      {showAdd && (
        <div className="bg-gold-pale rounded-xl p-3.5 mb-3.5 border-[1.5px] border-dashed border-gold/40">
          <div className="text-sm font-bold text-maroon mb-2.5 flex items-center gap-1.5">
            <IconSparkles size={14} strokeWidth={2.4} />
            ตำแหน่งใหม่
          </div>
          <div className="flex gap-2 mb-2">
            <input
              value={newRole.name}
              onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              placeholder="ชื่อตำแหน่ง"
              className="flex-1 px-3 py-[9px] rounded-[9px] border border-bdr text-sm outline-none font-[inherit] box-border"
            />
          </div>
          <input
            value={newRole.poolGroup}
            onChange={(e) =>
              setNewRole({ ...newRole, poolGroup: e.target.value })
            }
            placeholder='กลุ่มกองกลาง (ทิ้งว่างถ้าไม่แชร์ค่าคอม) เช่น "sales"'
            className="w-full px-3 py-[9px] rounded-[9px] border border-bdr text-sm outline-none font-[Prompt,monospace] box-border mb-2.5"
          />
          {!newRole.poolGroup.trim() ? (
            <div className="mb-2.5">
              <label className="text-xs text-txt-soft font-semibold mb-1 block">
                รายการค่าคอมต่อชิ้น (ไม่เพิ่ม = ไม่มีค่าคอม)
              </label>
              <ItemsEditor
                placeholder='เช่น "ทำบิล", "นับสต๊อก"'
                addLabel="เพิ่มรายการค่าคอม"
                items={newRole.pieceItems}
                onChange={(next) =>
                  setNewRole({ ...newRole, pieceItems: next })
                }
              />
            </div>
          ) : (
            <div className="mb-2.5">
              <label className="text-xs text-txt-soft font-semibold mb-1 block">
                รายการ pool sales (custom · เลือก "หลัก" = primary item สำหรับ กฎ
                &lt; 50% ขาด base salary ตอน "ปิดทั้งหมด")
              </label>
              <PoolItemsEditor
                items={newRole.poolItems}
                primaryId={newRole.primaryPoolItemId}
                onChange={(next) => setNewRole({ ...newRole, poolItems: next })}
                onChangePrimary={(id) =>
                  setNewRole({ ...newRole, primaryPoolItemId: id })
                }
              />
            </div>
          )}
          <div className="mb-2.5">
            <label className="text-xs text-txt-soft font-semibold mb-1 block">
              โบนัสอื่นๆ (ไม่เพิ่ม = ซ่อน section)
            </label>
            <ItemsEditor
              placeholder='เช่น "เชิญชวนสมัครบัตร", "ย้ายข้อมูล"'
              addLabel="เพิ่มโบนัส"
              items={newRole.bonusItems}
              onChange={(next) => setNewRole({ ...newRole, bonusItems: next })}
            />
          </div>
          <label className="text-xs text-txt-soft font-semibold mb-1 block">
            หน้าที่หลัก (พนักงานจะเห็นในหน้า Home)
          </label>
          <div className="mb-2.5">
            <RichTextEditor
              value={newRole.mainDuties}
              onChange={(html) => setNewRole({ ...newRole, mainDuties: html })}
              placeholder="เช่น ดูแลลูกค้าหน้าร้าน · เช็คทอง+ของแถม · ปิดยอดประจำวัน"
            />
          </div>
          <button
            onClick={addRole}
            disabled={!newRole.name.trim()}
            className={`w-full p-2.5 rounded-[9px] border-none text-sm font-bold font-[inherit]
              ${newRole.name.trim() ? "bg-maroon text-white cursor-pointer" : "bg-bdr text-txt-soft cursor-not-allowed"}`}
          >
            บันทึกตำแหน่ง
          </button>
        </div>
      )}

      {/* roles by group */}
      {Object.keys(groups).map((groupKey) => {
        const isPool = groupKey !== "_individual_";
        const groupRoles = groups[groupKey];
        return (
          <div key={groupKey} className="mb-4.5">
            <div className="flex items-center gap-2 mb-2">
              {isPool ? (
                <>
                  <IconHandshake
                    size={16}
                    strokeWidth={2.2}
                    color={COLORS.gold}
                  />
                  <span className="text-sm font-bold text-maroon">
                    กองกลาง:{" "}
                    <code className="bg-gold-pale px-2 py-0.5 rounded-md text-sm">
                      {groupKey}
                    </code>
                  </span>
                  <span className="text-xs text-txt-soft ml-auto">
                    แชร์ค่าคอม
                  </span>
                </>
              ) : (
                <>
                  <IconUser
                    size={16}
                    strokeWidth={2.2}
                    color={COLORS.textSoft}
                  />
                  <span className="text-sm font-bold text-txt">ส่วนตัว</span>
                  <span className="text-xs text-txt-soft ml-auto">
                    ใช้ piece rate / ไม่มีค่าคอม
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {groupRoles.map((rl) => {
                const e = editing[rl.id];
                const dirty = !!e;
                const employeeCount = employeeDirectory.filter(
                  (employee) => employee.roleId === rl.id,
                ).length;
                const canDelete = employeeCount === 0;
                return (
                  <div
                    key={rl.id}
                    className="bg-white rounded-xl px-3.5 py-3 border border-bdr shadow-[0_1px_6px_rgba(90,30,10,0.05)]"
                  >
                    <div
                      className={`flex items-center gap-2.5 ${dirty ? "mb-2.5" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-cream border border-bdr flex items-center justify-center shrink-0">
                        <IconBriefcase
                          size={18}
                          strokeWidth={2.2}
                          color={COLORS.maroon}
                        />
                      </div>
                      <input
                        value={e?.name !== undefined ? e.name : rl.name}
                        onChange={(ev) =>
                          setEditing((p) => ({
                            ...p,
                            [rl.id]: {
                              ...(p[rl.id] || rl),
                              name: ev.target.value,
                            },
                          }))
                        }
                        className={`flex-1 px-2.5 py-2 rounded-lg text-sm font-semibold outline-none font-[inherit] box-border text-txt
                          ${dirty ? "border border-gold bg-gold-pale/30" : "border border-bdr bg-cream"}`}
                      />
                      <span className="text-xs text-txt-soft px-2 py-0.5 rounded-lg bg-cream border border-bdr font-semibold whitespace-nowrap">
                        {employeeCount} คน
                      </span>
                    </div>
                    {dirty && (
                      <>
                        <div className="mb-2.5">
                          <label className="text-xs text-txt-soft font-semibold mb-1 block">
                            กลุ่มกองกลาง (ทิ้งว่างถ้าไม่แชร์)
                          </label>
                          <input
                            value={
                              e?.poolGroup !== undefined
                                ? e.poolGroup
                                : rl.poolGroup || ""
                            }
                            onChange={(ev) =>
                              setEditing((p) => ({
                                ...p,
                                [rl.id]: {
                                  ...(p[rl.id] || rl),
                                  poolGroup: ev.target.value,
                                },
                              }))
                            }
                            placeholder="เช่น sales"
                            className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-gold text-sm outline-none font-[Prompt,monospace] box-border bg-gold-pale/30"
                          />
                        </div>
                        {/* pieceItems — เฉพาะตำแหน่งที่ไม่ใช่ pool sales */}
                        {!(
                          e?.poolGroup !== undefined
                            ? e.poolGroup
                            : rl.poolGroup || ""
                        ).trim() ? (
                          <div className="mb-2.5">
                            <label className="text-xs text-txt-soft font-semibold mb-1 block">
                              รายการค่าคอมต่อชิ้น (ไม่เพิ่ม = ไม่มีค่าคอม)
                            </label>
                            <ItemsEditor
                              placeholder='เช่น "ทำบิล", "นับสต๊อก"'
                              addLabel="เพิ่มรายการค่าคอม"
                              items={
                                e?.pieceItems !== undefined
                                  ? e.pieceItems
                                  : rolePieceItems(rl)
                              }
                              onChange={(next) =>
                                setEditing((p) => ({
                                  ...p,
                                  [rl.id]: {
                                    ...(p[rl.id] || rl),
                                    pieceItems: next,
                                  },
                                }))
                              }
                            />
                          </div>
                        ) : (
                          <div className="mb-2.5">
                            <label className="text-xs text-txt-soft font-semibold mb-1 block">
                              รายการ pool sales (เลือก "หลัก" = primary)
                            </label>
                            <PoolItemsEditor
                              items={
                                (e?.poolItems !== undefined
                                  ? e.poolItems
                                  : rolePoolItems(rl)) as any
                              }
                              primaryId={
                                e?.primaryPoolItemId !== undefined
                                  ? e.primaryPoolItemId || ""
                                  : rl.primaryPoolItemId || ""
                              }
                              onChange={(next) =>
                                setEditing((p) => ({
                                  ...p,
                                  [rl.id]: {
                                    ...(p[rl.id] || rl),
                                    poolItems: next,
                                  },
                                }))
                              }
                              onChangePrimary={(id) =>
                                setEditing((p) => ({
                                  ...p,
                                  [rl.id]: {
                                    ...(p[rl.id] || rl),
                                    primaryPoolItemId: id,
                                  },
                                }))
                              }
                            />
                          </div>
                        )}
                        <div className="mb-2.5">
                          <label className="text-xs text-txt-soft font-semibold mb-1 block">
                            โบนัสอื่นๆ (ไม่เพิ่ม = ซ่อน section)
                          </label>
                          <ItemsEditor
                            placeholder='เช่น "เชิญชวนสมัครบัตร", "ย้ายข้อมูล"'
                            addLabel="เพิ่มโบนัส"
                            items={
                              e?.bonusItems !== undefined
                                ? e.bonusItems
                                : roleBonusItems(rl)
                            }
                            onChange={(next) =>
                              setEditing((p) => ({
                                ...p,
                                [rl.id]: {
                                  ...(p[rl.id] || rl),
                                  bonusItems: next,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="mb-2.5">
                          <label className="text-xs text-txt-soft font-semibold mb-1 block">
                            หน้าที่หลัก (พนักงานจะเห็นในหน้า Home)
                          </label>
                          <RichTextEditor
                            value={
                              e?.mainDuties !== undefined
                                ? e.mainDuties
                                : rl.mainDuties || ""
                            }
                            onChange={(html) =>
                              setEditing((p) => ({
                                ...p,
                                [rl.id]: {
                                  ...(p[rl.id] || rl),
                                  mainDuties: html,
                                },
                              }))
                            }
                            placeholder="เช่น ดูแลลูกค้าหน้าร้าน · เช็คทอง+ของแถม"
                          />
                        </div>
                      </>
                    )}
                    {dirty ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() =>
                            setEditing((p) => {
                              const n = { ...p };
                              delete n[rl.id];
                              return n;
                            })
                          }
                          className="flex-1 p-2 rounded-lg border border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={() => saveEdit(rl.id)}
                          className="flex-1 p-2 rounded-lg border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
                        >
                          บันทึก
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() =>
                            setEditing((p) => ({
                              ...p,
                              [rl.id]: {
                                name: rl.name,
                                poolGroup: rl.poolGroup || "",
                                // seed pieceItems จาก rolePieceItems() —
                                // migrate legacy pieceLabel ให้เห็นใน editor
                                // (กันกด save แล้ว legacy หายเงียบ)
                                pieceItems: rolePieceItems(rl),
                                // seed bonusItems จาก roleBonusItems() —
                                // default [invite, transfer] ถ้า role doc
                                // ไม่มี field (legacy) · admin แก้ได้
                                bonusItems: roleBonusItems(rl),
                                // seed pool items จาก rolePoolItems() · default
                                // 3 รายการ (legacy migration) ถ้าไม่มี
                                poolItems: rolePoolItems(rl),
                                primaryPoolItemId:
                                  rl.primaryPoolItemId || "normal",
                                // sanitize ก่อนใส่ editor — กัน HTML ดิบ/พิษ
                                // จาก DB รันใน contentEditable ฝั่ง admin
                                mainDuties: sanitizeRichText(
                                  rl.mainDuties || "",
                                ),
                              },
                            }))
                          }
                          className="flex-1 py-[7px] rounded-lg border border-bdr bg-cream text-maroon text-sm font-semibold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5"
                        >
                          <IconPencil size={13} strokeWidth={2.4} />
                          แก้ไข
                        </button>
                        <button
                          onClick={() => canDelete && setConfirmDel(rl)}
                          disabled={!canDelete}
                          title={
                            canDelete
                              ? "ลบตำแหน่ง"
                              : "มีพนักงานอยู่ในตำแหน่งนี้ — ย้ายออกก่อนถึงลบได้"
                          }
                          className={`px-3 py-[7px] rounded-lg text-sm font-semibold font-[inherit] border border-red/25 bg-red-lt text-red inline-flex items-center justify-center ${canDelete ? "cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                        >
                          <IconTrash size={14} strokeWidth={2.2} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Assign roles to employees — แยก + memo: ไม่ขึ้นกับ draft แก้ไข
          ตำแหน่ง จึงไม่ต้อง re-render ตอนพิมพ์ใน editor หน้าที่หลัก */}
      <EmployeeRoleAssignmentList
        employeeDirectory={employeeDirectory}
        roles={roles}
        onChangeEmpRole={changeEmpRole}
      />

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-[rgba(45,26,14,0.55)] backdrop-blur-xs px-6">
          <div className="bg-white rounded-[20px] px-6 py-7 w-full max-w-[340px]">
            <div className="flex justify-center mb-2 text-red">
              <IconTrash size={36} strokeWidth={2} />
            </div>
            <div className="font-bold text-lg text-txt text-center mb-2">
              ลบตำแหน่งนี้?
            </div>
            <div className="text-sm text-txt-mid text-center mb-5">
              {confirmDel.name}
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 p-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => deleteRole(confirmDel.id)}
                className="flex-1 p-3 rounded-xl border-none bg-red text-white text-sm font-bold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── EmployeeRoleAssignmentList — รายชื่อพนักงาน + dropdown ตำแหน่ง ──
   memo: re-render เฉพาะเมื่อ employeeDirectory/roles/handler เปลี่ยน —
   ไม่ใช่ทุก keystroke ที่ admin พิมพ์ใน editor หน้าที่หลัก             */
const EmployeeRoleAssignmentList = memo(function EmployeeRoleAssignmentList({
  employeeDirectory,
  roles,
  onChangeEmpRole,
}: {
  employeeDirectory: any[];
  roles: any[];
  onChangeEmpRole: (
    employeeId: string,
    roleId: string,
    roleName: string,
  ) => void;
}) {
  return (
    <div className="mt-6 pt-4 border-t border-dashed border-bdr">
      <div className="text-sm font-bold text-maroon mb-2.5 flex items-center gap-2">
        <IconTarget size={16} strokeWidth={2.2} />
        กำหนดตำแหน่งให้พนักงาน
      </div>
      <div className="flex flex-col gap-2">
        {employeeDirectory.map((employee) => (
          <div
            key={employee.id}
            className="bg-white rounded-[10px] px-3 py-2.5 border border-bdr flex items-center gap-2.5"
          >
            <AvatarCircle
              avatar={employee.avatar}
              avatarType={employee.avatarType}
              avatarImageUrl={employee.avatarImageUrl}
              size={34}
              fontSize={11}
              border={`1.5px solid ${COLORS.gold}30`}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-txt whitespace-nowrap overflow-hidden text-ellipsis">
                {employee.name}
              </div>
            </div>
            <div className="min-w-[160px]">
              <ThemedSelect
                value={employee.roleId || ""}
                onChange={(v) => {
                  const rl = roles.find((r) => r.id === v);
                  if (rl) onChangeEmpRole(employee.id, rl.id, rl.name);
                }}
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
                placeholder="— เลือก —"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
