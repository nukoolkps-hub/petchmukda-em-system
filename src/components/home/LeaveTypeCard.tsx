import { Check as IconCheck } from "lucide-react";

/* ─── Leave Type Selection Card ────────────────────────────────── */
export default function LeaveTypeCard({
  lt,
  selected,
  onClick,
  balance,
  used,
}) {
  const sel = selected === lt.id,
    _left = balance - used;
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl cursor-pointer font-[inherit] transition-all relative px-3 pt-5 pb-4 border-2
        ${sel ? `shadow-[0_4px_18px_var(--color-${lt.id === "personal" ? "gold" : "red"})/0.19]` : "shadow-[0_1px_4px_rgba(90,30,10,0.06)]"}
        ${sel ? (lt.id === "personal" ? "border-gold bg-gold-pale" : "border-red bg-red-lt") : "border-bdr bg-white"}`}
    >
      {sel && (
        <div
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: lt.color }}
        >
          <IconCheck size={11} color="#fff" strokeWidth={3} />
        </div>
      )}
      <div className="text-3xl mb-2.5">{lt.icon}</div>
      <div
        className={`font-bold text-lg ${sel ? (lt.id === "personal" ? "text-gold" : "text-red") : "text-txt"}`}
      >
        {lt.label}
      </div>
    </button>
  );
}
