/* ─── EmployeeViewPreview — แบนเนอร์ + ตัวเลือก "ดูมุมมองพนักงาน" (admin) ──
   admin เลือกพนักงาน → App render หน้าตาแบบที่พนักงานคนนั้นเห็น (read-only)
   · ไม่แตะ Firestore rules (admin มีสิทธิ์อ่านข้อมูลทุกคนอยู่แล้ว)
   · โหมดนี้ "ดูอย่างเดียว" — กดบันทึก/ส่งไม่ได้ (กันสร้างข้อมูลผิด)
   · ปุ่ม "เข้าโหมด" อยู่บน header (ข้างปุ่มคู่มือ) — เปิด picker ผ่าน
     pickerOpen ที่คุมจาก App                                            */

import { Eye as IconEye, Users as IconUsers, X as IconX } from "lucide-react";
import type { Employee } from "../../types";
import BaseModal from "../shared/BaseModal";

interface Props {
  employees: Employee[];
  previewEmpId: string | null;
  onSelect: (id: string | null) => void;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
}

export default function EmployeeViewPreview({
  employees,
  previewEmpId,
  onSelect,
  pickerOpen,
  onPickerOpenChange,
}: Props) {
  const current = previewEmpId
    ? (employees.find((e) => e.id === previewEmpId) ?? null)
    : null;

  return (
    <>
      {/* แบนเนอร์ขณะ preview */}
      {current && (
        <div className="fixed z-[1100] top-2 left-1/2 -translate-x-1/2 md:left-[calc(50%+130px)] inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gold text-maroon-dk text-sm font-bold font-[inherit] shadow-[0_6px_20px_rgba(201,151,58,0.45)] whitespace-nowrap">
          <IconEye size={15} strokeWidth={2.6} />
          มุมมองของ <span className="font-extrabold">{current.name}</span>
          <button
            type="button"
            onClick={() => onPickerOpenChange(true)}
            className="ml-1 px-2 py-0.5 rounded-full border-none bg-maroon/15 text-maroon-dk text-xs font-bold cursor-pointer font-[inherit]"
          >
            เปลี่ยน
          </button>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="ออกจากมุมมองพนักงาน"
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border-none bg-maroon text-white text-xs font-bold cursor-pointer font-[inherit]"
          >
            <IconX size={13} strokeWidth={2.6} />
            ออก
          </button>
        </div>
      )}

      {/* ตัวเลือกพนักงาน */}
      {pickerOpen && (
        <BaseModal
          onClose={() => onPickerOpenChange(false)}
          zIndexClass="z-[1000]"
          maxWidthClass="max-w-[380px]"
          contentClassName="rounded-[18px]"
        >
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3 text-maroon">
              <IconUsers size={18} strokeWidth={2.4} />
              <span className="text-base font-extrabold">
                เลือกพนักงานที่จะดูมุมมอง
              </span>
            </div>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {employees.length === 0 && (
                <div className="text-sm text-txt-soft italic text-center py-4">
                  ยังไม่มีพนักงานในระบบ
                </div>
              )}
              {employees.map((e) => {
                const active = e.id === previewEmpId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      onSelect(e.id);
                      onPickerOpenChange(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[10px] border-[1.5px] cursor-pointer font-[inherit] text-left ${
                      active
                        ? "border-maroon bg-gold-pale"
                        : "border-bdr bg-white hover:bg-cream"
                    }`}
                  >
                    <span className="text-sm font-bold text-txt truncate">
                      {e.name}
                    </span>
                    <span className="text-xs text-txt-soft shrink-0">
                      {e.role || "-"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </BaseModal>
      )}
    </>
  );
}
