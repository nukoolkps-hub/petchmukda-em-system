import {
  Briefcase as IconBriefcase,
  Diamond as IconDiamond,
  Lock as IconLock,
  MessageCircle as IconMessageCircle,
  Settings as IconSettings,
  ShoppingBag as IconShoppingBag,
  Trash2 as IconTrash,
} from "lucide-react";
import { useState } from "react";
import { COLORS } from "../../constants";
import type { Employee, Role } from "../../types";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";
import EmployeeEditModal from "./EmployeeEditModal";
import { clearEmployeeDraft, hasEmployeeDraft } from "./employeeEditFields";

interface EmployeeAdminPanelProps {
  employeeDirectory: Employee[];
  roles: Role[];
  onUpdateRole: (employeeId: string, field: string, value: unknown) => void;
  onDeleteEmployee: (employeeId: string) => void;
  // draft + employee ที่เปิดอยู่ ถูกยกขึ้นไป AdminPanel — เพื่อให้ draft ที่ยัง
  // ไม่บันทึก (และ modal ที่เปิดค้าง) รอดเมื่อ admin สลับ section แล้วกลับมา
  editingRole: Record<string, any>;
  setEditingRole: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  editingEmpId: string | null;
  setEditingEmpId: React.Dispatch<React.SetStateAction<string | null>>;
}

/* ─── Admin: Employee management (list + edit modal) ───────────── */
export default function EmployeeAdminPanel({
  employeeDirectory,
  roles,
  onUpdateRole,
  onDeleteEmployee,
  editingRole,
  setEditingRole,
  editingEmpId,
  setEditingEmpId,
}: EmployeeAdminPanelProps) {
  const [confirmDeleteEmp, setConfirmDeleteEmp] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null);

  function copyLineId(text: string | undefined, employeeId: string) {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedLineId(employeeId);
          setTimeout(() => setCopiedLineId(null), 1500);
        })
        .catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedLineId(employeeId);
        setTimeout(() => setCopiedLineId(null), 1500);
      } catch (_e) {}
      document.body.removeChild(ta);
    }
  }

  const editingEmployee = employeeDirectory.find((e) => e.id === editingEmpId);
  const editingEmployeeRole = roles?.find(
    (r) => r.id === editingEmployee?.roleId,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5 gap-2">
        <div className="text-sm text-txt-soft">กดที่ชื่อพนักงานเพื่อเปิดหน้าต่างแก้ไข</div>
      </div>
      <div className="flex flex-col gap-2">
        {employeeDirectory.map((employee) => {
          const dirty = hasEmployeeDraft(editingRole, employee.id);
          return (
            <button
              key={employee.id}
              type="button"
              onClick={() => setEditingEmpId(employee.id)}
              className="w-full flex items-center gap-3 px-3.5 py-3 cursor-pointer rounded-2xl shadow-[0_2px_8px_rgba(90,30,10,0.06)] border border-bdr bg-white text-left font-[inherit] transition-[background-color,transform] duration-150 hover:bg-cream/70 active:scale-[0.99] active:bg-cream"
            >
              <AvatarCircle
                avatar={employee.avatar}
                avatarType={employee.avatarType}
                avatarImageUrl={employee.avatarImageUrl}
                size={40}
                fontSize={13}
                border={`2px solid ${COLORS.gold}40`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-txt text-sm truncate">
                  {employee.name}
                </div>
                <div className="text-xs text-txt-soft mt-px flex items-center gap-[5px] flex-wrap">
                  <IconBriefcase size={11} strokeWidth={2.4} />
                  {employee.role || "-"}
                  {(() => {
                    const exc = employee.poolExclusion;
                    if (!exc) return null;
                    // new variants: "all" | string[] · legacy: "sell" | "buy" | "both"
                    const m: Record<string, React.ReactNode> = {
                      sell: (
                        <span className="inline-flex items-center gap-0.5">
                          <IconDiamond size={10} strokeWidth={2.4} />
                          ปิดขาย
                        </span>
                      ),
                      buy: (
                        <span className="inline-flex items-center gap-0.5">
                          <IconShoppingBag size={10} strokeWidth={2.4} />
                          ปิดซื้อ
                        </span>
                      ),
                      both: (
                        <span className="inline-flex items-center gap-0.5">
                          <IconLock size={10} strokeWidth={2.4} />
                          ปิดทั้งคู่
                        </span>
                      ),
                      all: (
                        <span className="inline-flex items-center gap-0.5">
                          <IconLock size={10} strokeWidth={2.4} />
                          ปิดทั้งหมด
                        </span>
                      ),
                    };
                    let content: React.ReactNode;
                    if (Array.isArray(exc)) {
                      if (exc.length === 0) return null;
                      content = (
                        <span className="inline-flex items-center gap-0.5">
                          <IconLock size={10} strokeWidth={2.4} />
                          ปิด {exc.length} รายการ
                        </span>
                      );
                    } else {
                      content = m[exc as string];
                      if (!content) return null;
                    }
                    return (
                      <span className="px-1.5 py-0.5 rounded-md bg-red-lt text-red font-bold text-xs">
                        {content}
                      </span>
                    );
                  })()}
                  {employee.salaryDisabled && (
                    <span className="px-1.5 py-0.5 rounded-md bg-red-lt text-red font-bold text-xs inline-flex items-center gap-0.5">
                      <IconLock size={10} strokeWidth={2.4} />
                      ปิดเงินเดือน
                    </span>
                  )}
                  {employee.lineUserId && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[#06C75520] text-[#06A04E] font-bold text-xs inline-flex items-center gap-0.5">
                      <IconMessageCircle size={10} strokeWidth={2.4} />
                      LINE
                    </span>
                  )}
                </div>
              </div>
              {dirty && (
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-[#D9770630] text-amber">
                  มีการแก้ไข
                </span>
              )}
              <IconSettings
                size={16}
                color={COLORS.textSoft}
                strokeWidth={2.2}
                className="shrink-0"
              />
            </button>
          );
        })}
      </div>

      {editingEmployee && (
        <EmployeeEditModal
          employee={editingEmployee}
          employeeRole={editingEmployeeRole}
          editingRole={editingRole}
          setEditingRole={setEditingRole}
          onUpdateRole={onUpdateRole}
          copiedLineId={copiedLineId}
          copyLineId={copyLineId}
          onClose={() => setEditingEmpId(null)}
          onRequestDelete={() => {
            setEditingEmpId(null);
            setConfirmDeleteEmp({
              id: editingEmployee.id,
              name: editingEmployee.name,
            });
          }}
        />
      )}

      {confirmDeleteEmp && (
        <BaseModal
          onClose={() => setConfirmDeleteEmp(null)}
          zIndexClass="z-1000"
          maxWidthClass="max-w-[360px]"
          overlayClassName="px-6 bg-[rgba(45,26,14,0.55)] backdrop-blur-xs"
          contentClassName="rounded-[20px] px-6 py-7"
        >
          <div className="w-14 h-14 rounded-full bg-red-lt flex items-center justify-center mx-auto mb-4">
            <IconTrash size={26} color="var(--color-red)" strokeWidth={2.5} />
          </div>
          <div className="font-bold text-lg text-txt text-center mb-2">
            ลบพนักงานคนนี้?
          </div>
          <div className="text-sm text-txt-mid text-center mb-5 leading-[1.8]">
            <b>{confirmDeleteEmp.name}</b>
            <br />
            <span className="text-sm text-red">การลบจะไม่สามารถกู้คืนได้</span>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setConfirmDeleteEmp(null)}
              className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                onDeleteEmployee(confirmDeleteEmp.id);
                // เก็บกวาด draft ของคนที่ถูกลบ ไม่ให้ค้างใน editingRole
                setEditingRole((prev) =>
                  clearEmployeeDraft(prev, confirmDeleteEmp.id),
                );
                setConfirmDeleteEmp(null);
              }}
              className="flex-1 p-3.5 rounded-xl border-none bg-red text-white text-base font-bold cursor-pointer font-[inherit] shadow-[0_4px_12px_rgba(192,57,43,0.31)] active:scale-[0.98] transition-transform duration-100"
            >
              ลบพนักงาน
            </button>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
