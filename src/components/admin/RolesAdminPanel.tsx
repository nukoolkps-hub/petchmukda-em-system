import { useState } from "react";
import { C } from "../../constants";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Admin: Roles Management Panel ────────────────────────────── */
export default function RolesAdminPanel({
  roles,
  setRoles,
  empDir,
  onUpdateEmpRole,
}) {
  const [editing, setEditing] = useState({}); // {roleId: {name, poolGroup, icon}}
  const [newRole, setNewRole] = useState({ name: "", poolGroup: "", icon: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);

  function saveEdit(roleId) {
    const e = editing[roleId];
    if (!e) return;
    setRoles((r) =>
      r.map((rl) =>
        rl.id === roleId
          ? {
              ...rl,
              name: e.name || rl.name,
              poolGroup: e.poolGroup || null,
              icon: e.icon || rl.icon,
            }
          : rl,
      ),
    );
    setEditing((prev) => {
      const n = { ...prev };
      delete n[roleId];
      return n;
    });
  }

  function addRole() {
    if (!newRole.name.trim()) return;
    const id = `r_${Date.now()}`;
    setRoles((r) => [
      ...r,
      {
        id,
        name: newRole.name.trim(),
        poolGroup: newRole.poolGroup.trim() || null,
        icon: newRole.icon || "💼",
      },
    ]);
    setNewRole({ name: "", poolGroup: "", icon: "" });
    setShowAdd(false);
  }

  function deleteRole(roleId) {
    setRoles((r) => r.filter((rl) => rl.id !== roleId));
    setConfirmDel(null);
  }

  // group roles by poolGroup
  const groups = {};
  roles.forEach((r) => {
    const k = r.poolGroup || "_individual_";
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  });

  function changeEmpRole(empId, roleId, roleName) {
    onUpdateEmpRole(empId, "roleId", roleId);
    onUpdateEmpRole(empId, "role", roleName);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[13px] text-txt-soft">
          กำหนดตำแหน่งและกลุ่ม Pool ค่าคอม
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3.5 py-[7px] rounded-[9px] border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-[13px] font-bold cursor-pointer font-[inherit] shadow-[0_2px_8px_var(--color-gold)/0.25] flex items-center gap-[5px]"
        >
          {showAdd ? "✕" : "+"} เพิ่มตำแหน่ง
        </button>
      </div>

      {/* Add new role form */}
      {showAdd && (
        <div className="bg-gold-pale rounded-xl p-3.5 mb-3.5 border-[1.5px] border-dashed border-gold/40">
          <div className="text-[13px] font-bold text-maroon mb-2.5">
            🆕 ตำแหน่งใหม่
          </div>
          <div className="flex gap-2 mb-2">
            <input
              value={newRole.icon}
              onChange={(e) =>
                setNewRole({ ...newRole, icon: e.target.value.slice(0, 2) })
              }
              placeholder="🎯"
              maxLength={2}
              className="w-[50px] p-[9px] rounded-[9px] border border-bdr text-lg outline-none font-[inherit] text-center box-border"
            />
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
            placeholder='Pool Group (ทิ้งว่างถ้าไม่แชร์ค่าคอม) เช่น "sales"'
            className="w-full px-3 py-[9px] rounded-[9px] border border-bdr text-[13px] outline-none font-[Prompt,monospace] box-border mb-2.5"
          />
          <button
            onClick={addRole}
            disabled={!newRole.name.trim()}
            className={`w-full p-2.5 rounded-[9px] border-none text-[13px] font-bold font-[inherit]
              ${newRole.name.trim() ? "bg-linear-135 from-gold to-gold-lt text-maroon-dk cursor-pointer" : "bg-bdr text-txt-soft cursor-not-allowed"}`}
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
                  <span className="text-sm">🤝</span>
                  <span className="text-[13px] font-bold text-maroon">
                    Pool:{" "}
                    <code className="bg-gold-pale px-2 py-px rounded-md text-xs">
                      {groupKey}
                    </code>
                  </span>
                  <span className="text-[11px] text-txt-soft ml-auto">
                    แชร์ค่าคอม
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm">👤</span>
                  <span className="text-[13px] font-bold text-txt">
                    ค่าคอมแยก (Rate ต่อชิ้นเดียว)
                  </span>
                  <span className="text-[10px] text-txt-soft ml-auto">
                    ใครขายใครได้
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {groupRoles.map((rl) => {
                const e = editing[rl.id];
                const dirty = !!e;
                const empCount = empDir.filter(
                  (emp) => emp.roleId === rl.id,
                ).length;
                return (
                  <div
                    key={rl.id}
                    className="bg-white rounded-xl px-3.5 py-3 border border-bdr shadow-[0_1px_6px_rgba(90,30,10,0.05)]"
                  >
                    <div
                      className={`flex items-center gap-2.5 ${dirty ? "mb-2.5" : ""}`}
                    >
                      <input
                        value={e?.icon !== undefined ? e.icon : rl.icon}
                        onChange={(ev) =>
                          setEditing((p) => ({
                            ...p,
                            [rl.id]: {
                              ...(p[rl.id] || rl),
                              icon: ev.target.value.slice(0, 2),
                            },
                          }))
                        }
                        maxLength={2}
                        className={`w-[42px] p-2 rounded-lg text-lg outline-none font-[inherit] text-center box-border
                          ${dirty ? "border border-gold bg-gold-pale/30" : "border border-bdr bg-cream"}`}
                      />
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
                      <span className="text-[11px] text-txt-soft px-2 py-0.5 rounded-lg bg-cream border border-bdr font-semibold whitespace-nowrap">
                        {empCount} คน
                      </span>
                    </div>
                    {dirty && (
                      <div className="mb-2.5">
                        <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                          Pool Group (ทิ้งว่างถ้าไม่แชร์)
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
                          className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-gold text-[13px] outline-none font-[Prompt,monospace] box-border bg-gold-pale/30"
                        />
                      </div>
                    )}
                    {dirty && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() =>
                            setEditing((p) => {
                              const n = { ...p };
                              delete n[rl.id];
                              return n;
                            })
                          }
                          className="flex-1 p-2 rounded-lg border border-bdr bg-white text-txt-mid text-xs font-semibold cursor-pointer font-[inherit]"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={() => saveEdit(rl.id)}
                          className="flex-1 p-2 rounded-lg border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-xs font-bold cursor-pointer font-[inherit]"
                        >
                          บันทึก
                        </button>
                      </div>
                    )}
                    {!dirty && (
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() =>
                            setEditing((p) => ({
                              ...p,
                              [rl.id]: {
                                name: rl.name,
                                poolGroup: rl.poolGroup || "",
                                icon: rl.icon,
                              },
                            }))
                          }
                          className="flex-1 py-[7px] rounded-lg border border-bdr bg-cream text-maroon text-xs font-semibold cursor-pointer font-[inherit]"
                        >
                          ✎ แก้ไข
                        </button>
                        <button
                          onClick={() => setConfirmDel(rl)}
                          disabled={empCount > 0}
                          className={`px-3 py-[7px] rounded-lg text-xs font-semibold font-[inherit]
                            ${empCount > 0 ? "border border-bdr bg-cream text-txt-soft cursor-not-allowed" : "border border-red/25 bg-red-lt text-red cursor-pointer"}`}
                        >
                          🗑
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

      {/* Assign roles to employees */}
      <div className="mt-6 pt-4 border-t border-dashed border-bdr">
        <div className="text-[13px] font-bold text-maroon mb-2.5 flex items-center gap-2">
          🎯 กำหนดตำแหน่งให้พนักงาน
        </div>
        <div className="flex flex-col gap-2">
          {empDir.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-[10px] px-3 py-2.5 border border-bdr flex items-center gap-2.5"
            >
              <AvatarCircle
                av={emp.av}
                avType={emp.avType}
                img={emp.img}
                size={34}
                fontSize={11}
                border={`1.5px solid ${C.gold}30`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-txt whitespace-nowrap overflow-hidden text-ellipsis">
                  {emp.name}
                </div>
              </div>
              <select
                value={emp.roleId || ""}
                onChange={(ev) => {
                  const rl = roles.find((r) => r.id === ev.target.value);
                  if (rl) changeEmpRole(emp.id, rl.id, rl.name);
                }}
                className="px-2.5 py-[7px] rounded-lg border border-bdr text-[13px] font-semibold outline-none font-[inherit] bg-cream text-txt cursor-pointer min-w-[130px]"
              >
                <option value="">— เลือก —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.icon} {r.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-[rgba(45,26,14,0.55)] backdrop-blur-xs px-6">
          <div className="bg-white rounded-[20px] px-6 py-7 w-full max-w-[340px]">
            <div className="text-center text-[38px] mb-2">🗑</div>
            <div className="font-bold text-[17px] text-txt text-center mb-2">
              ลบตำแหน่งนี้?
            </div>
            <div className="text-[13px] text-txt-mid text-center mb-5">
              {confirmDel.icon} {confirmDel.name}
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 p-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => deleteRole(confirmDel.id)}
                className="flex-1 p-3 rounded-xl border-none bg-red text-white text-sm font-bold cursor-pointer font-[inherit]"
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
