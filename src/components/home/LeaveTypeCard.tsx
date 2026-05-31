import { Check as IconCheck } from "lucide-react";

/* ─── Leave Type Selection Card ──────────────────────────────────
   พื้นหลัง = lt.colorLt (สีอ่อนของแต่ละประเภท จาก LEAVE_TYPES) เสมอ
   ตัวอักษร = lt.color (สีเข้มของประเภท) เสมอ
   ตอนเลือก: เพิ่ม border 2px + checkmark มุมขวาบน + shadow                */
export default function LeaveTypeCard({
  lt,
  selected,
  onClick,
  balance,
  used,
}) {
  const sel = selected === lt.id;
  const _left = balance - used;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: lt.colorLt,
        borderColor: sel ? lt.color : "transparent",
        boxShadow: sel
          ? `0 4px 18px ${lt.color}30`
          : "0 1px 4px rgba(90,30,10,0.06)",
      }}
      className="rounded-2xl cursor-pointer font-[inherit] relative px-3 pt-5 pb-4 border-2"
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
      <div className="font-bold text-lg" style={{ color: lt.color }}>
        {lt.label}
      </div>
    </button>
  );
}
