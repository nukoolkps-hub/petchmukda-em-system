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
import {
  isRichTextEmpty,
  sanitizeRichText,
} from "../../utils/sanitizeRichText";
import AvatarCircle from "../shared/AvatarCircle";
import RichTextEditor from "../shared/RichTextEditor";

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
  const [editing, setEditing] = useState({}); // {roleId: {name, poolGroup, pieceLabel, mainDuties}}
  const [newRole, setNewRole] = useState({
    name: "",
    poolGroup: "",
    pieceLabel: "",
    mainDuties: "",
  });
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);

  async function saveEdit(roleId) {
    const e = editing[roleId];
    if (!e) return;
    const current = roles.find((rl) => rl.id === roleId);
    if (!current) return;
    try {
      // pieceLabel: เก็บ null ถ้าว่าง (force opt-in) · trim + drop ถ้าใส่ pool
      // (pool sales ใช้ normal/special/buy ไม่ใช้ singlePieceRate)
      const poolValue = e.poolGroup?.trim() || null;
      const pieceLabelDraft =
        e.pieceLabel !== undefined ? e.pieceLabel : current.pieceLabel || "";
      const pieceLabelValue = poolValue ? null : pieceLabelDraft.trim() || null;
      await onUpsertRole({
        ...current,
        name: e.name || current.name,
        poolGroup: poolValue,
        pieceLabel: pieceLabelValue,
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
        // pieceLabel ไม่ใช้ใน pool sales (มี normal/special/buy แล้ว)
        pieceLabel: poolValue ? null : newRole.pieceLabel.trim() || null,
        mainDuties: cleanMainDuties(newRole.mainDuties),
      });
      setNewRole({ name: "", poolGroup: "", pieceLabel: "", mainDuties: "" });
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
          onClick={() => setShowAdd(!showAdd)}
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
          {!newRole.poolGroup.trim() && (
            <>
              <label className="text-xs text-txt-soft font-semibold mb-1 block">
                ป้ายค่าคอมต่อชิ้น (ทิ้งว่าง = ไม่มีค่าคอม)
              </label>
              <input
                value={newRole.pieceLabel}
                onChange={(e) =>
                  setNewRole({ ...newRole, pieceLabel: e.target.value })
                }
                placeholder='เช่น "ค่าคอมต่อบิล" / "ค่าคอมต่อชิ้น"'
                maxLength={40}
                className="w-full px-3 py-[9px] rounded-[9px] border border-bdr text-sm outline-none font-[inherit] box-border mb-2.5"
              />
            </>
          )}
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
                    <code className="bg-gold-pale px-2 py-px rounded-md text-sm">
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
                  <span className="text-sm font-bold text-txt">
                    ไม่แชร์กองกลาง
                  </span>
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
                        {/* pieceLabel — เฉพาะตำแหน่งที่ไม่ใช่ pool sales */}
                        {!(e?.poolGroup !== undefined
                          ? e.poolGroup
                          : rl.poolGroup || ""
                        ).trim() && (
                          <div className="mb-2.5">
                            <label className="text-xs text-txt-soft font-semibold mb-1 block">
                              ป้ายค่าคอมต่อชิ้น (ทิ้งว่าง = ไม่มีค่าคอม)
                            </label>
                            <input
                              value={
                                e?.pieceLabel !== undefined
                                  ? e.pieceLabel
                                  : rl.pieceLabel || ""
                              }
                              onChange={(ev) =>
                                setEditing((p) => ({
                                  ...p,
                                  [rl.id]: {
                                    ...(p[rl.id] || rl),
                                    pieceLabel: ev.target.value,
                                  },
                                }))
                              }
                              placeholder='เช่น "ค่าคอมต่อบิล"'
                              maxLength={40}
                              className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-gold text-sm outline-none font-[inherit] box-border bg-gold-pale/30"
                            />
                          </div>
                        )}
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
            <div className="relative">
              <select
                value={employee.roleId || ""}
                onChange={(ev) => {
                  const rl = roles.find((r) => r.id === ev.target.value);
                  if (rl) onChangeEmpRole(employee.id, rl.id, rl.name);
                }}
                className="appearance-none cursor-pointer pl-2.5 pr-7 py-[7px] rounded-lg border border-bdr text-sm font-semibold outline-none font-[inherit] bg-cream text-txt"
              >
                <option value="">— เลือก —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <IconChevronDown
                size={12}
                strokeWidth={2.4}
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
