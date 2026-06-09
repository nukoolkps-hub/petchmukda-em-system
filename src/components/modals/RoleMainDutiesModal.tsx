/* ─── หน้าที่หลักของตำแหน่ง — modal โชว์รายละเอียดที่ admin กรอกไว้ ──── */

import { ScrollText as IconScrollText, X as IconX } from "lucide-react";
import type { Role } from "../../types";
import BaseModal from "../shared/BaseModal";

interface Props {
  role: Role;
  onClose: () => void;
}

export default function RoleMainDutiesModal({ role, onClose }: Props) {
  const text = (role.mainDuties || "").trim();

  return (
    <BaseModal onClose={onClose} maxWidthClass="max-w-[460px]">
      <div className="sticky top-0 z-10 bg-cream px-5 py-4 border-b border-bdr flex items-center gap-3">
        <div className="w-10 h-10 rounded-[11px] bg-gold-pale flex items-center justify-center shrink-0">
          <IconScrollText size={20} strokeWidth={2.4} className="text-maroon" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt">หน้าที่หลัก</div>
          <div className="text-xs text-txt-soft mt-0.5 truncate">
            ตำแหน่ง: {role.name}
          </div>
        </div>
        <button
          type="button"
          aria-label="ปิด"
          onClick={onClose}
          className="w-9 h-9 rounded-[10px] border border-bdr bg-white text-txt-mid cursor-pointer flex items-center justify-center"
        >
          <IconX size={18} strokeWidth={2.3} />
        </button>
      </div>

      <div className="px-5 py-4">
        {text ? (
          <div className="whitespace-pre-wrap text-sm text-txt leading-relaxed">
            {text}
          </div>
        ) : (
          <div className="text-center text-txt-soft py-6 text-sm">
            ยังไม่ได้กำหนดหน้าที่หลักของตำแหน่งนี้
          </div>
        )}
      </div>
    </BaseModal>
  );
}
