/* ─── หน้าที่หลักของตำแหน่ง — modal โชว์รายละเอียดที่ admin กรอกไว้ ──── */

import { ScrollText as IconScrollText } from "lucide-react";
import { useMemo } from "react";
import type { Role } from "../../types";
import {
  isRichTextEmpty,
  looksLikeHtml,
  sanitizeRichText,
} from "../../utils/sanitizeRichText";
import BaseModal from "../shared/BaseModal";
import ModalHeader from "../shared/ModalHeader";

interface Props {
  role: Role;
  onClose: () => void;
}

export default function RoleMainDutiesModal({ role, onClose }: Props) {
  const text = (role.mainDuties || "").trim();
  // เช็คเนื้อหาจริง — legacy value อาจมีแต่ <br>/<div> ว่างที่ trim ไม่ตัด
  const empty = isRichTextEmpty(text);
  const isHtml = useMemo(() => looksLikeHtml(text), [text]);
  const safeHtml = useMemo(
    () => (isHtml ? sanitizeRichText(text) : ""),
    [isHtml, text],
  );

  return (
    <BaseModal onClose={onClose} maxWidthClass="max-w-[460px]">
      <ModalHeader
        Icon={IconScrollText}
        title="หน้าที่หลัก"
        subtitle={`ตำแหน่ง: ${role.name}`}
        onClose={onClose}
      />

      <div className="px-5 py-4">
        {empty ? (
          <div className="text-center text-txt-soft py-6 text-sm">
            ยังไม่ได้กำหนดหน้าที่หลักของตำแหน่งนี้
          </div>
        ) : isHtml ? (
          <div
            className="rich-text text-sm text-txt"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via whitelist (sanitizeRichText)
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm text-txt leading-relaxed">
            {text}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
