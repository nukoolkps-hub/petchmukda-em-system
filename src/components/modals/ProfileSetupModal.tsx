import {
  AlertTriangle as IconAlertTriangle,
  Camera as IconCamera,
  Check as IconCheck,
  Landmark as IconLandmark,
  Type as IconType,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COLORS, EMOJI_LIST, getBankAccountDigits } from "../../constants";
import { uploadAvatar } from "../../firebase/storage";
import { resizeAvatar } from "../../utils/imageUtils";
import { validateBankAccount, validateRequired } from "../../utils/validators";
import AvatarCircle from "../shared/AvatarCircle";
import BankPicker from "../shared/BankPicker";
import BaseModal from "../shared/BaseModal";

/* ─── Profile Setup Modal (first run / edit) ───────────────────── */
export default function ProfileSetupModal({
  initial,
  employeeId,
  lockName = false,
  lockBank = false,
  onSave,
  onClose,
}) {
  const [name, setName] = useState(initial?.name || "");
  const [avatarType, setAvType] = useState(initial?.avatarType || "text");
  const [avatar, setAv] = useState(initial?.avatar || "");
  const [avatarImageUrl, setAvatarImageUrl] = useState(
    initial?.avatarImageUrl || null,
  );
  const [bank, setBank] = useState(initial?.bank || "");
  const [bankAccountNumber, setBankAcc] = useState(
    initial?.bankAccountNumber || "",
  );
  const [nameErr, setNameErr] = useState("");
  const [avErr, setAvErr] = useState("");
  const [bankErr, setBankErr] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [pendingAvatarDataUrl, setPendingAvatarDataUrl] = useState<
    string | null
  >(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // นับ digit ของเลขบัญชี — เตือนถ้าพิมพ์แล้วยังไม่ครบจำนวนหลักของธนาคารนั้น
  const bankAccountDigitsTyped = bankAccountNumber.replace(
    /[^0-9]/g,
    "",
  ).length;
  const bankAccountIncomplete =
    !!bank &&
    bankAccountDigitsTyped > 0 &&
    bankAccountDigitsTyped < getBankAccountDigits(bank);
  const fileRef = useRef<HTMLInputElement>(null);

  // auto initials from name
  useEffect(() => {
    if (avatarType === "text" && name.trim()) {
      const parts = name.trim().split(" ");
      const initials = parts
        .map((p) => p.charAt(0))
        .join("")
        .slice(0, 2);
      setAv(initials);
    }
  }, [name, avatarType]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageBusy(true);
    setAvErr("");
    try {
      const dataUrl = await resizeAvatar(file);
      setAvatarImageUrl(dataUrl);
      setPendingAvatarDataUrl(dataUrl);
      setAvType("image");
    } catch (err) {
      setAvErr((err as Error).message || "อัปโหลดรูปไม่ได้");
    } finally {
      setImageBusy(false);
    }
  }

  async function save() {
    if (saving || imageBusy) return;
    let ok = true;
    setSaveErr("");

    // Name validation
    if (!lockName) {
      const nameError = validateRequired(name, "ชื่อ-นามสกุล");
      if (nameError) {
        setNameErr(nameError);
        ok = false;
      } else setNameErr("");
    } else setNameErr("");

    // Avatar validation
    if (avatarType === "text" && !avatar.trim()) {
      setAvErr("กรุณาระบุตัวย่อ (2-3 ตัวอักษร)");
      ok = false;
    } else if (avatarType === "emoji" && !avatar) {
      setAvErr("กรุณาเลือก Emoji");
      ok = false;
    } else if (avatarType === "image" && !avatarImageUrl) {
      setAvErr("กรุณาอัปโหลดรูปภาพ");
      ok = false;
    } else setAvErr("");

    // Bank validation: required — ต้องเลือกธนาคารและกรอกเลขบัญชี
    if (!bank || !bankAccountNumber.trim()) {
      setBankErr("กรุณาเลือกธนาคารและกรอกเลขบัญชี");
      ok = false;
    } else {
      const accError = validateBankAccount(bankAccountNumber);
      if (accError) {
        setBankErr(accError);
        ok = false;
      } else setBankErr("");
    }

    if (!ok) return;
    setSaving(true);
    try {
      let finalAvatarImageUrl = avatarImageUrl;
      if (avatarType === "image" && pendingAvatarDataUrl) {
        if (!employeeId) throw new Error("ไม่พบรหัสพนักงานสำหรับอัปโหลดรูป");
        finalAvatarImageUrl = await uploadAvatar(
          employeeId,
          pendingAvatarDataUrl,
        );
      }
      await onSave({
        name: initial?.name || name.trim(),
        avatar,
        avatarType,
        avatarImageUrl: finalAvatarImageUrl,
        bank,
        bankAccountNumber: bankAccountNumber.trim(),
      });
      setPendingAvatarDataUrl(null);
    } catch (err) {
      console.error("[ProfileSetupModal] save failed:", err);
      setSaveErr((err as Error).message || "บันทึกโปรไฟล์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BaseModal
      onClose={onClose || (() => {})}
      closeOnBackdrop={!!onClose}
      closeOnEsc={!!onClose}
      contentClassName="px-6 pt-7 pb-9"
    >
      {/* preview */}
      <div className="flex flex-col items-center mb-6">
        <AvatarCircle
          avatar={avatar || "?"}
          avatarType={avatarType}
          avatarImageUrl={avatarImageUrl}
          size={80}
          fontSize={24}
          border={`2px solid ${COLORS.gold}40`}
          className="mb-2.5 shadow-maroon-glow"
        />
        <div className="text-base font-bold text-txt">{name || "ชื่อของคุณ"}</div>
        <div className="text-sm text-txt-soft mt-0.5">ตำแหน่งกำหนดโดย ADMIN</div>
      </div>

      <div className="w-full h-px bg-bdr mb-5" />

      {/* name */}
      <div className="mb-4.5">
        <label className="block text-sm font-semibold text-txt-mid mb-2">
          ชื่อ-นามสกุล
        </label>
        <input
          value={name}
          onChange={(e) => !lockName && setName(e.target.value)}
          readOnly={lockName}
          placeholder="กรอกชื่อ-นามสกุล"
          className={`w-full px-4 py-3.5 rounded-xl text-base outline-none font-[inherit] box-border text-txt border-[1.5px] ${lockName ? "bg-cream text-txt-mid cursor-not-allowed" : "bg-white"} ${nameErr ? "border-red" : "border-bdr"}`}
        />
        {nameErr && (
          <div className="text-red text-sm mt-1.5">
            <span className="inline-flex items-center gap-1">
              <IconAlertTriangle size={14} strokeWidth={2.4} />
              {nameErr}
            </span>
          </div>
        )}
        {lockName && (
          <div className="text-xs text-txt-soft mt-1.5">
            ชื่อถูกกำหนดโดยผู้ดูแลระบบ
          </div>
        )}
      </div>

      {/* avatar type tabs */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-txt-mid mb-2.5">
          รูปโปรไฟล์
        </label>
        <div className="flex bg-cream-dk rounded-xl p-1 gap-0.5 mb-4">
          {[
            {
              id: "text",
              label: (
                <span className="inline-flex items-center gap-1">
                  <IconType size={13} strokeWidth={2.4} />
                  ตัวอักษร
                </span>
              ),
            },
            { id: "emoji", label: "😊 Emoji" },
            {
              id: "image",
              label: (
                <span className="inline-flex items-center gap-1">
                  <IconCamera size={13} strokeWidth={2.4} />
                  รูปภาพ
                </span>
              ),
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setAvType(t.id)}
              className={`flex-1 py-2.5 px-1 rounded-[9px] border-none cursor-pointer font-[inherit] text-sm font-semibold transition-all
                ${avatarType === t.id ? "bg-white text-maroon shadow-[0_1px_6px_rgba(90,30,10,0.10)]" : "bg-transparent text-txt-soft"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* text initials – auto generated, show preview only */}
        {avatarType === "text" && (
          <div className="bg-cream rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-linear-135 from-gold to-gold-lt flex items-center justify-center shrink-0">
              <span className="text-white font-extrabold text-base tracking-wide">
                {avatar || "?"}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-txt">
                ตัวย่อ: <b>{avatar || "—"}</b>
              </div>
              <div className="text-sm text-txt-soft mt-0.5">
                ระบบสร้างอัตโนมัติจากชื่อ
              </div>
            </div>
          </div>
        )}

        {/* emoji grid */}
        {avatarType === "emoji" && (
          <div>
            <div className="text-sm text-txt-soft mb-2">เลือก Emoji</div>
            <div className="grid grid-cols-5 gap-[7px] max-h-60 overflow-y-auto pr-0.5">
              {EMOJI_LIST.map((e) => (
                <button
                  key={e}
                  onClick={() => setAv(e)}
                  className={`h-[50px] rounded-xl text-2xl cursor-pointer transition-all duration-150 border-2
                    ${avatar === e ? "border-gold bg-gold-pale shadow-[0_2px_8px_var(--color-gold)/0.25]" : "border-bdr bg-white shadow-none"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* image upload */}
        {avatarType === "image" && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
            {avatarImageUrl ? (
              <div className="flex items-center gap-3.5">
                <img
                  src={avatarImageUrl}
                  alt="preview"
                  className="w-[70px] h-[70px] rounded-full object-cover border-2 border-gold"
                />
                <div className="flex-1">
                  <div className="text-sm text-green font-semibold mb-1.5">
                    {imageBusy ? (
                      "กำลังเตรียมรูป..."
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <IconCheck size={14} strokeWidth={3} />
                        เลือกรูปแล้ว
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-4 py-2 rounded-[10px] border-[1.5px] border-bdr bg-cream text-txt-mid text-sm font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
                  >
                    เปลี่ยนรูป
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full p-5 rounded-[14px] border-2 border-dashed border-bdr bg-cream cursor-pointer font-[inherit] flex flex-col items-center gap-2"
              >
                <IconCamera
                  size={30}
                  strokeWidth={1.8}
                  className="text-txt-soft"
                />
                <span className="text-sm font-semibold text-txt-mid">
                  แตะเพื่ออัปโหลดรูปภาพ
                </span>
                <span className="text-sm text-txt-soft">JPG, PNG รองรับ</span>
              </button>
            )}
          </div>
        )}
        {avErr && (
          <div className="text-red text-sm mt-2">
            <span className="inline-flex items-center gap-1">
              <IconAlertTriangle size={14} strokeWidth={2.4} />
              {avErr}
            </span>
          </div>
        )}
      </div>

      {/* ── Bank info section ── */}
      <div className="mb-4 pt-4 border-t border-dashed border-bdr">
        <label className="block text-sm font-semibold text-txt-mid mb-2.5">
          <IconLandmark
            size={14}
            strokeWidth={2.4}
            className="inline mr-1 -mt-px"
          />
          บัญชีธนาคารสำหรับรับเงินเดือน
        </label>

        {/* bank dropdown */}
        <label className="block text-sm text-txt-soft font-semibold mb-1">
          ธนาคาร
        </label>
        <div className="mb-2.5">
          <BankPicker
            value={bank}
            onChange={(name) => setBank(name)}
            error={!!bankErr}
            disabled={lockBank}
          />
        </div>

        {/* account number */}
        <label className="block text-sm text-txt-soft font-semibold mb-1">
          เลขที่บัญชี
        </label>
        <input
          value={bankAccountNumber}
          onChange={(e) => {
            if (lockBank) return;
            // sanitize + จำกัด digit count ตามธนาคารที่เลือก (ห้ามเกิน)
            const cleaned = e.target.value.replace(/[^0-9\- ]/g, "");
            const digitsOnly = cleaned.replace(/[^0-9]/g, "");
            if (digitsOnly.length > getBankAccountDigits(bank)) return;
            setBankAcc(cleaned);
          }}
          readOnly={lockBank}
          placeholder="เช่น 123-4-56789-0"
          className={`w-full px-4 py-3 rounded-xl text-base outline-none font-[inherit] box-border text-txt tracking-wide border-[1.5px] ${bankErr ? "border-red" : bankAccountIncomplete ? "border-amber" : "border-bdr"} ${lockBank ? "bg-cream-dk cursor-not-allowed opacity-80" : "bg-white"}`}
        />
        {bank &&
          !lockBank &&
          (bankAccountIncomplete ? (
            <div className="text-xs text-amber font-semibold mt-1 px-1 inline-flex items-center gap-1">
              <IconAlertTriangle size={12} strokeWidth={2.4} />
              ขาดอีก {getBankAccountDigits(bank) - bankAccountDigitsTyped} หลัก —{" "}
              {bank} ใช้เลขบัญชี {getBankAccountDigits(bank)} หลัก
            </div>
          ) : (
            <div className="text-xs text-txt-soft mt-1 px-1">
              {bank} ใช้เลขบัญชี {getBankAccountDigits(bank)} หลัก
            </div>
          ))}

        {lockBank && (
          <div className="text-xs text-txt-soft mt-2 px-2.5 py-2 bg-cream/60 rounded-lg border border-bdr/60 inline-flex items-start gap-1.5">
            <IconAlertTriangle
              size={13}
              strokeWidth={2.4}
              className="text-maroon shrink-0 mt-px"
            />
            <span>บัญชีธนาคารบันทึกไว้แล้ว — หากต้องการแก้ไข ติดต่อ ADMIN เท่านั้น</span>
          </div>
        )}

        {bankErr && (
          <div className="text-red text-sm mt-1.5">
            <span className="inline-flex items-center gap-1">
              <IconAlertTriangle size={14} strokeWidth={2.4} />
              {bankErr}
            </span>
          </div>
        )}
      </div>

      {saveErr && (
        <div className="text-red text-sm mb-3">
          <span className="inline-flex items-center gap-1">
            <IconAlertTriangle size={14} strokeWidth={2.4} />
            {saveErr}
          </span>
        </div>
      )}
      <div className="flex gap-2.5 mt-2">
        {initial && onClose && (
          <button
            onClick={onClose}
            className="basis-[34%] shrink-0 py-3.5 bg-transparent border-[1.5px] border-bdr rounded-[14px] text-base font-semibold text-txt-soft cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
          >
            ยกเลิก
          </button>
        )}
        <button
          onClick={save}
          disabled={saving || imageBusy}
          className={`flex-1 py-3.5 border-none rounded-[14px] text-base font-bold font-[inherit] shadow-[0_6px_20px_rgba(123,28,28,0.25)] flex items-center justify-center gap-2 ${saving || imageBusy ? "bg-bdr text-txt-soft cursor-not-allowed" : "bg-maroon text-white cursor-pointer"}`}
        >
          {saving ? "กำลังบันทึก..." : initial ? "บันทึก" : "เริ่มใช้งาน"}
        </button>
      </div>
    </BaseModal>
  );
}
