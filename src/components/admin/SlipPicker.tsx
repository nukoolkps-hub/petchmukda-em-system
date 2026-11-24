import { Upload as IconUpload } from "lucide-react";
import { useEffect, useState } from "react";

/** ช่องแนบสลิปโอน (บังคับ) — โชว์รูปตัวอย่างให้ ADMIN ตรวจก่อนกดยืนยัน ·
 *  ใช้ร่วมทั้งอนุมัติเบิกปกติ (`ApproveAdvanceModal`) และเบิกฉุกเฉิน
 *  (`EmergencyAdvanceModal`) — เลือกไฟล์ ≠ บันทึก · บันทึกเกิดตอนกดยืนยันเท่านั้น */
export default function SlipPicker({
  file,
  onChange,
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="mb-4">
      <div className="text-sm font-semibold text-txt-mid mb-1.5">
        สลิปโอนเงิน <span className="text-red">*</span>
      </div>
      {preview && (
        <img
          src={preview}
          alt="สลิปโอนเงิน"
          className="w-full max-h-[260px] object-contain rounded-[10px] border border-bdr bg-cream mb-2"
        />
      )}
      <label
        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-[10px] border-[1.5px] border-dashed text-sm font-semibold cursor-pointer ${file ? "border-bdr text-txt-mid bg-white" : "border-maroon/50 text-maroon bg-gold-pale"}`}
      >
        <IconUpload size={16} strokeWidth={2.2} />
        {file ? "เปลี่ยนสลิป" : "แนบสลิปโอนเงิน"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
