import { IconShield } from "@tabler/icons-react";
import { useState } from "react";
import { ADMIN_PIN } from "../../constants";
import BaseModal from "../shared/BaseModal";

/* ─── PIN Modal ────────────────────────────────────────────────── */
export default function PinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  function pressKey(k) {
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 6) {
      if (next === ADMIN_PIN) {
        setTimeout(onSuccess, 200);
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin("");
        }, 600);
      }
    }
  }
  function del() {
    setPin((p) => p.slice(0, -1));
  }
  return (
    <BaseModal
      onClose={onClose}
      zIndexClass="z-900"
      maxWidthClass="max-w-[340px]"
      overlayClassName="px-8 bg-[rgba(45,26,14,0.7)]"
      contentClassName="px-7 pt-8 pb-7 shadow-[0_28px_70px_rgba(45,26,14,0.35)]"
    >
      <div className="w-14 h-14 rounded-full mx-auto mb-4.5 bg-linear-135 from-maroon to-maroon-lt flex items-center justify-center shadow-[0_6px_18px_rgba(123,28,28,0.31)]">
        <IconShield size={24} color="var(--color-gold-lt)" stroke={2} />
      </div>
      <div className="text-center font-bold text-lg text-txt mb-1">
        รหัสผู้ดูแลระบบ
      </div>
      <div className="text-center text-sm text-txt-soft mb-6">กรอก PIN 6 หลัก</div>
      <div
        className={`flex justify-center gap-3.5 mb-7 ${shake ? "animate-[shake_0.5s_ease]" : ""}`}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-150
              ${i < pin.length ? "bg-gold shadow-[0_2px_8px_rgba(201,151,58,0.37)] scale-115" : "bg-cream-dk shadow-none scale-100"}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => {
          if (k === "") return <div key={i} />;
          const isDel = k === "⌫";
          return (
            <button
              key={i}
              onClick={() => (isDel ? del() : pressKey(String(k)))}
              className={`h-14 rounded-[14px] border-none cursor-pointer font-[inherit] font-bold shadow-[0_2px_6px_rgba(90,30,10,0.08)] transition-all duration-100
                ${isDel ? "bg-red-lt text-red text-4xl" : "bg-cream text-txt text-2xl"}`}
            >
              {k}
            </button>
          );
        })}
      </div>
      <button
        onClick={onClose}
        className="w-full mt-4 p-3 bg-transparent border-[1.5px] border-bdr rounded-xl text-txt-soft text-base font-semibold cursor-pointer font-[inherit]"
      >
        ยกเลิก
      </button>
    </BaseModal>
  );
}
