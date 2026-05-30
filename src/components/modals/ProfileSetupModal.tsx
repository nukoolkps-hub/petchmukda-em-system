import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { COLORS, EMOJI_LIST, THAI_BANKS } from "../../constants";
import { uploadAvatar } from "../../firebase/storage";
import { resizeAvatar } from "../../utils/imageUtils";
import { validateBankAccount, validateRequired } from "../../utils/validators";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";
import Diamond from "../shared/Diamond";

/* ─── Profile Setup Modal (first run / edit) ───────────────────── */
export default function ProfileSetupModal({
  initial,
  employeeId,
  lockName = false,
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
          className="mb-2.5 shadow-gold-glow"
        />
        <div className="text-base font-bold text-txt">{name || "ชื่อของคุณ"}</div>
        <div className="text-sm text-txt-soft mt-0.5">ตำแหน่งกำหนดโดย Admin</div>
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
        {nameErr && <div className="text-red text-sm mt-1.5">⚠ {nameErr}</div>}
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
            { id: "text", label: "✏️ ตัวอักษร" },
            { id: "emoji", label: "😊 Emoji" },
            { id: "image", label: "📷 รูปภาพ" },
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
                    {imageBusy ? "กำลังเตรียมรูป..." : "✓ เลือกรูปแล้ว"}
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-4 py-2 rounded-[10px] border-[1.5px] border-bdr bg-cream text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
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
                <span className="text-3xl">📷</span>
                <span className="text-sm font-semibold text-txt-mid">
                  แตะเพื่ออัปโหลดรูปภาพ
                </span>
                <span className="text-sm text-txt-soft">JPG, PNG รองรับ</span>
              </button>
            )}
          </div>
        )}
        {avErr && <div className="text-red text-sm mt-2">⚠ {avErr}</div>}
      </div>

      {/* ── Bank info section ── */}
      <div className="mb-4 pt-4 border-t border-dashed border-bdr">
        <label className="block text-sm font-semibold text-txt-mid mb-2.5">
          🏦 บัญชีธนาคารสำหรับรับเงินเดือน
        </label>

        {/* bank dropdown */}
        <label className="block text-sm text-txt-soft font-semibold mb-1">
          ธนาคาร
        </label>
        <div className="relative mb-2.5">
          <select
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className={`w-full py-3 pr-10 pl-4 rounded-xl text-base outline-none font-[inherit] box-border appearance-none cursor-pointer border-[1.5px]
              ${bankErr ? "border-red" : "border-bdr"}
              ${bank ? "text-txt bg-gold-pale/30 font-semibold" : "text-txt-soft bg-white font-normal"}`}
          >
            <option value="">— เลือกธนาคาร —</option>
            {THAI_BANKS.map((b) => (
              <option key={b.name} value={b.name}>
                {b.emoji} {b.name}
                {b.short ? `  (${b.short})` : ""}
              </option>
            ))}
          </select>
          <IconChevronDown
            className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            size={14}
            color="var(--color-txt-soft)"
            stroke={2.5}
          />
        </div>

        {/* account number */}
        <label className="block text-sm text-txt-soft font-semibold mb-1">
          เลขที่บัญชี
        </label>
        <input
          value={bankAccountNumber}
          onChange={(e) => setBankAcc(e.target.value)}
          placeholder="เช่น 123-4-56789-0"
          className={`w-full px-4 py-3 rounded-xl text-base outline-none font-[inherit] box-border text-txt bg-white tracking-wide border-[1.5px] ${bankErr ? "border-red" : "border-bdr"}`}
        />

        {bankErr && <div className="text-red text-sm mt-1.5">⚠ {bankErr}</div>}
      </div>

      {saveErr && <div className="text-red text-sm mb-3">⚠ {saveErr}</div>}
      <button
        onClick={save}
        disabled={saving || imageBusy}
        className={`w-full p-4 mt-2 border-none rounded-[14px] text-lg font-bold font-[inherit] shadow-[0_6px_20px_rgba(201,151,58,0.25)] flex items-center justify-center gap-2 ${saving || imageBusy ? "bg-bdr text-txt-soft cursor-not-allowed" : "bg-linear-135 from-gold to-gold-lt text-maroon-dk cursor-pointer"}`}
      >
        <Diamond size={16} color={COLORS.maroonDark} />
        {saving ? "กำลังบันทึก..." : initial ? "บันทึกการเปลี่ยนแปลง" : "เริ่มใช้งาน"}
      </button>
      {initial && onClose && (
        <button
          onClick={onClose}
          className="w-full p-3.5 mt-2.5 bg-transparent border-[1.5px] border-bdr rounded-[14px] text-base font-semibold text-txt-soft cursor-pointer font-[inherit]"
        >
          ยกเลิก
        </button>
      )}
    </BaseModal>
  );
}
