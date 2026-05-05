import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { C, EMOJI_LIST, TH_BANKS } from "../../constants";
import { validateBankAccount, validateRequired } from "../../utils/validators";
import AvatarCircle from "../shared/AvatarCircle";
import Diamond from "../shared/Diamond";

/* ─── Profile Setup Modal (first run / edit) ───────────────────── */
export default function ProfileSetupModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [avType, setAvType] = useState(initial?.avType || "text");
  const [av, setAv] = useState(initial?.av || "");
  const [img, setImg] = useState(initial?.img || null);
  const [bank, setBank] = useState(initial?.bank || "");
  const [bankAcc, setBankAcc] = useState(initial?.bankAcc || "");
  const [nameErr, setNameErr] = useState("");
  const [avErr, setAvErr] = useState("");
  const [bankErr, setBankErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // auto initials from name
  useEffect(() => {
    if (avType === "text" && name.trim()) {
      const parts = name.trim().split(" ");
      const initials = parts
        .map((p) => p.charAt(0))
        .join("")
        .slice(0, 2);
      setAv(initials);
    }
  }, [name, avType]);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImg((ev.target as FileReader).result as string);
      setAvType("image");
    };
    reader.readAsDataURL(file);
  }

  function save() {
    let ok = true;

    // Name validation
    const nameError = validateRequired(name, "ชื่อ-นามสกุล");
    if (nameError) {
      setNameErr(nameError);
      ok = false;
    } else setNameErr("");

    // Avatar validation
    if (avType === "text" && !av.trim()) {
      setAvErr("กรุณาระบุตัวย่อ (2-3 ตัวอักษร)");
      ok = false;
    } else if (avType === "emoji" && !av) {
      setAvErr("กรุณาเลือก Emoji");
      ok = false;
    } else if (avType === "image" && !img) {
      setAvErr("กรุณาอัปโหลดรูปภาพ");
      ok = false;
    } else setAvErr("");

    // Bank validation: optional field, but if either filled, both required + format check
    if ((bank && !bankAcc.trim()) || (!bank && bankAcc.trim())) {
      setBankErr("กรุณาเลือกธนาคารและกรอกเลขบัญชีให้ครบ");
      ok = false;
    } else if (bankAcc.trim()) {
      const accError = validateBankAccount(bankAcc);
      if (accError) {
        setBankErr(accError);
        ok = false;
      } else setBankErr("");
    } else setBankErr("");

    if (!ok) return;
    onSave({
      name: name.trim(),
      av,
      avType,
      img,
      bank,
      bankAcc: bankAcc.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-800 flex items-end justify-center bg-[rgba(45,26,14,0.65)] backdrop-blur-[6px]">
      <div className="bg-white rounded-t-3xl px-6 pt-7 pb-9 w-full max-w-[430px] shadow-[0_-12px_40px_rgba(45,26,14,0.25)] animate-[slideUp_0.3s_cubic-bezier(.22,.68,0,1.1)] max-h-[92vh] overflow-y-auto">
        {/* handle */}
        <div className="w-10 h-1 rounded-sm bg-bdr mx-auto mb-5" />

        {/* preview */}
        <div className="flex flex-col items-center mb-6">
          <AvatarCircle
            av={av || "?"}
            avType={avType}
            img={img}
            size={80}
            fontSize={24}
            border={`2px solid ${C.gold}40`}
            className="mb-2.5 shadow-gold-glow"
          />
          <div className="text-base font-bold text-txt">
            {name || "ชื่อของคุณ"}
          </div>
          <div className="text-[13px] text-txt-soft mt-0.5">
            ตำแหน่งกำหนดโดย Admin
          </div>
        </div>

        <div className="w-full h-px bg-bdr mb-5" />

        {/* name */}
        <div className="mb-4.5">
          <label className="block text-sm font-semibold text-txt-mid mb-2">
            ชื่อ-นามสกุล
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="กรอกชื่อ-นามสกุล"
            className={`w-full px-4 py-3.5 rounded-xl text-[15px] outline-none font-[inherit] box-border text-txt bg-white border-[1.5px] ${nameErr ? "border-red" : "border-bdr"}`}
          />
          {nameErr && (
            <div className="text-red text-xs mt-1.5">⚠ {nameErr}</div>
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
                className={`flex-1 py-2.5 px-1 rounded-[9px] border-none cursor-pointer font-[inherit] text-xs font-semibold transition-all
                  ${avType === t.id ? "bg-white text-maroon shadow-[0_1px_6px_rgba(90,30,10,0.10)]" : "bg-transparent text-txt-soft"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* text initials – auto generated, show preview only */}
          {avType === "text" && (
            <div className="bg-cream rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-linear-135 from-gold to-gold-lt flex items-center justify-center shrink-0">
                <span className="text-white font-extrabold text-base tracking-wide">
                  {av || "?"}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-txt">
                  ตัวย่อ: <b>{av || "—"}</b>
                </div>
                <div className="text-xs text-txt-soft mt-0.5">
                  ระบบสร้างอัตโนมัติจากชื่อ
                </div>
              </div>
            </div>
          )}

          {/* emoji grid */}
          {avType === "emoji" && (
            <div>
              <div className="text-[13px] text-txt-soft mb-2">เลือก Emoji</div>
              <div className="grid grid-cols-5 gap-[7px] max-h-60 overflow-y-auto pr-0.5">
                {EMOJI_LIST.map((e) => (
                  <button
                    key={e}
                    onClick={() => setAv(e)}
                    className={`h-[50px] rounded-xl text-2xl cursor-pointer transition-all duration-150 border-2
                      ${av === e ? "border-gold bg-gold-pale shadow-[0_2px_8px_var(--color-gold)/0.25]" : "border-bdr bg-white shadow-none"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* image upload */}
          {avType === "image" && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
              {img ? (
                <div className="flex items-center gap-3.5">
                  <img
                    src={img}
                    alt="preview"
                    className="w-[70px] h-[70px] rounded-full object-cover border-2 border-gold"
                  />
                  <div className="flex-1">
                    <div className="text-sm text-green font-semibold mb-1.5">
                      ✓ อัปโหลดสำเร็จ
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-4 py-2 rounded-[10px] border-[1.5px] border-bdr bg-cream text-txt-mid text-[13px] font-semibold cursor-pointer font-[inherit]"
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
                  <span className="text-[32px]">📷</span>
                  <span className="text-sm font-semibold text-txt-mid">
                    แตะเพื่ออัปโหลดรูปภาพ
                  </span>
                  <span className="text-xs text-txt-soft">JPG, PNG รองรับ</span>
                </button>
              )}
            </div>
          )}
          {avErr && <div className="text-red text-xs mt-2">⚠ {avErr}</div>}
        </div>

        {/* ── Bank info section ── */}
        <div className="mb-4 pt-4 border-t border-dashed border-bdr">
          <label className="flex items-center gap-2 text-sm font-semibold text-txt-mid mb-2.5">
            🏦 บัญชีธนาคารสำหรับรับเงินเดือน
            <span className="text-[10px] font-semibold py-0.5 px-[7px] rounded-full bg-cream text-txt-soft ml-auto border border-bdr">
              ไม่บังคับ
            </span>
          </label>

          {/* bank dropdown */}
          <label className="block text-xs text-txt-soft font-semibold mb-1">
            ธนาคาร
          </label>
          <div className="relative mb-2.5">
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className={`w-full py-3 pr-10 pl-4 rounded-xl text-[15px] outline-none font-[inherit] box-border appearance-none cursor-pointer border-[1.5px]
                ${bankErr ? "border-red" : "border-bdr"}
                ${bank ? "text-txt bg-gold-pale/30 font-semibold" : "text-txt-soft bg-white font-normal"}`}
            >
              <option value="">— เลือกธนาคาร —</option>
              {TH_BANKS.map((b) => (
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
          <label className="block text-xs text-txt-soft font-semibold mb-1">
            เลขที่บัญชี
          </label>
          <input
            value={bankAcc}
            onChange={(e) => setBankAcc(e.target.value)}
            placeholder="เช่น 123-4-56789-0"
            className={`w-full px-4 py-3 rounded-xl text-[15px] outline-none font-[inherit] box-border text-txt bg-white tracking-wide border-[1.5px] ${bankErr ? "border-red" : "border-bdr"}`}
          />

          {bankErr && (
            <div className="text-red text-xs mt-1.5">⚠ {bankErr}</div>
          )}
        </div>

        <button
          onClick={save}
          className="w-full p-4 mt-2 bg-linear-135 from-gold to-gold-lt text-maroon-dk border-none rounded-[14px] text-[17px] font-bold cursor-pointer font-[inherit] shadow-[0_6px_20px_rgba(201,151,58,0.25)] flex items-center justify-center gap-2"
        >
          <Diamond size={16} color={C.maroonDk} />
          {initial ? "บันทึกการเปลี่ยนแปลง" : "เริ่มใช้งาน"}
        </button>
        {initial && onClose && (
          <button
            onClick={onClose}
            className="w-full p-3.5 mt-2.5 bg-transparent border-[1.5px] border-bdr rounded-[14px] text-[15px] font-semibold text-txt-soft cursor-pointer font-[inherit]"
          >
            ยกเลิก
          </button>
        )}
      </div>
    </div>
  );
}
