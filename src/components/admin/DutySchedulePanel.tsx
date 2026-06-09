/* ─── Admin: Duty Schedule (ตารางหน้าที่) ──────────────────────────
   Router บางๆ — list การ์ดหน้าที่ + เปิด modal เพิ่ม/แก้/ลบ + ดูล่วงหน้า
   DutyCard / DutyEditModal แยกเป็นไฟล์ของตัวเอง                          */

import {
  CalendarClock as IconCalendarClock,
  CalendarRange as IconCalendarRange,
  Plus as IconPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  DutyAssignmentsSnapshot,
  SnapshotAssignment,
  SnapshotPoolMember,
} from "../../firebase/dutyAssignments";
import type { Duty, Employee, Role } from "../../types";
import DutyForecastModal from "../modals/DutyForecastModal";
import BaseModal from "../shared/BaseModal";
import DutyCard from "./DutyCard";
import DutyEditModal from "./DutyEditModal";

interface Props {
  duties: Duty[];
  dutyAssignmentsToday: DutyAssignmentsSnapshot | null;
  roles: Role[];
  employeeDirectory: Employee[];
  onUpsertDuty: (
    id: string | null,
    data: Omit<Duty, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  onDeleteDuty: (id: string) => Promise<void>;
  showToast?: (msg: string) => void;
}

export default function DutySchedulePanel({
  duties,
  dutyAssignmentsToday,
  roles,
  employeeDirectory,
  onUpsertDuty,
  onDeleteDuty,
  showToast,
}: Props) {
  const [editing, setEditing] = useState<Duty | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Duty | null>(null);
  const [showForecast, setShowForecast] = useState(false);

  // assignments + pool มาจาก server snapshot — single source of truth
  // กับฝั่งพนักงาน (Firestore rules ปิดให้พนักงานอ่าน peer data ไม่ได้)
  const assignments = useMemo(
    () => dutyAssignmentsToday?.assignments || [],
    [dutyAssignmentsToday],
  );
  // 1 หน้าที่ → assignment หลายรายการได้ (coverage เป้าหมายลาหลายคน)
  const assignmentsByDuty = useMemo(() => {
    const m = new Map<string, SnapshotAssignment[]>();
    for (const a of assignments) {
      const list = m.get(a.dutyId);
      if (list) list.push(a);
      else m.set(a.dutyId, [a]);
    }
    return m;
  }, [assignments]);
  const empById = useMemo(() => {
    const m = new Map<string, SnapshotPoolMember>();
    for (const a of assignments) {
      for (const member of a.pool) m.set(member.id, member);
    }
    return m;
  }, [assignments]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="text-sm text-txt-soft">
          ตารางหน้าที่รับผิดชอบ — ระบบหมุนคนอัตโนมัติ + หาคนแทนถ้าลา
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {duties.length > 0 && (
            <button
              type="button"
              onClick={() => setShowForecast(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border-[1.5px] border-bdr bg-cream text-maroon text-sm font-bold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
            >
              <IconCalendarRange size={15} strokeWidth={2.4} />
              ดูล่วงหน้า
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] shadow-[0_3px_10px_rgba(123,28,28,0.25)] active:scale-[0.98] transition-transform duration-100"
          >
            <IconPlus size={15} strokeWidth={2.4} />
            เพิ่มหน้าที่
          </button>
        </div>
      </div>

      {duties.length === 0 ? (
        <div className="text-center text-txt-soft py-12 px-6 bg-white rounded-[14px] border border-dashed border-bdr">
          <div className="flex justify-center mb-3 text-gold">
            <IconCalendarClock size={44} strokeWidth={1.8} />
          </div>
          ยังไม่มีหน้าที่ — เริ่มกดเพิ่ม
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {duties.map((duty) => (
            <DutyCard
              key={duty.id}
              duty={duty}
              assignments={assignmentsByDuty.get(duty.id) || []}
              empById={empById}
              roles={roles}
              onEdit={() => setEditing(duty)}
              onDelete={() => setConfirmDelete(duty)}
            />
          ))}
        </div>
      )}

      {showForecast && (
        <DutyForecastModal
          duties={duties}
          dutyAssignmentsToday={dutyAssignmentsToday}
          profileId={null}
          onClose={() => setShowForecast(false)}
        />
      )}

      {editing && (
        <DutyEditModal
          duty={editing === "new" ? null : editing}
          roles={roles}
          employeeDirectory={employeeDirectory}
          onSave={async (data) => {
            await onUpsertDuty(editing === "new" ? null : editing.id, data);
            showToast?.(editing === "new" ? "เพิ่มหน้าที่แล้ว" : "บันทึกแล้ว");
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <BaseModal
          onClose={() => setConfirmDelete(null)}
          maxWidthClass="max-w-[360px]"
          contentClassName="px-6 py-7"
        >
          <div className="text-center">
            <div className="font-bold text-lg text-txt mb-1.5">ลบหน้าที่นี้?</div>
            <div className="text-sm text-txt-mid mb-5">
              "{confirmDelete.name}"
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  onDeleteDuty(target.id)
                    .then(() => showToast?.("ลบหน้าที่แล้ว"))
                    .catch((err: unknown) => {
                      showToast?.(
                        err instanceof Error
                          ? `ลบไม่สำเร็จ: ${err.message}`
                          : "ลบไม่สำเร็จ",
                      );
                      setConfirmDelete(target);
                    });
                }}
                className="flex-1 py-3 rounded-xl border-none bg-red text-white font-bold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform"
              >
                ลบ
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
