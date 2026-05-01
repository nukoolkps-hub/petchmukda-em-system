import { C } from "../../constants";

/* ─── Leave Type Selection Card ────────────────────────────────── */
export default function LeaveTypeCard({lt,selected,onClick,balance,used}){
  const sel=selected===lt.id,left=balance-used;
  return(
    <button onClick={onClick}
      className={`rounded-2xl cursor-pointer font-[inherit] transition-all relative px-3 pt-5 pb-4 border-2
        ${sel ? `shadow-[0_4px_18px_var(--color-${lt.id==="personal"?"gold":"red"})/0.19]` : "shadow-[0_1px_4px_rgba(90,30,10,0.06)]"}
        ${sel ? (lt.id==="personal" ? "border-gold bg-gold-pale" : "border-red bg-red-lt") : "border-bdr bg-white"}`}>
      {sel&&(<div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center" style={{background:lt.color}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>)}
      <div className="text-[30px] mb-2.5">{lt.icon}</div>
      <div className={`font-bold text-[17px] ${sel ? (lt.id==="personal" ? "text-gold" : "text-red") : "text-txt"}`}>{lt.label}</div>
    </button>
  );
}
