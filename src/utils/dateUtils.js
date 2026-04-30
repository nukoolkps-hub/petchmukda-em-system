/* ─── Date helpers ─────────────────────────────────────────────── */
import { TODAY } from "../constants";

export function toYMD(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function countWorkdays(s,e){
  if(!s||!e) return 0;
  const S=new Date(s+"T00:00:00"),E=new Date(e+"T00:00:00");
  if(E<S) return 0;
  let n=0; const c=new Date(S);
  while(c<=E){ if(c.getDay()!==6) n++; c.setDate(c.getDate()+1); }
  return n;
}

export function dateRange(s,e){
  const out=[],S=new Date(s+"T00:00:00"),E=new Date(e+"T00:00:00"),c=new Date(S);
  while(c<=E){ out.push(toYMD(c)); c.setDate(c.getDate()+1); }
  return out;
}

export function fmtDate(d){
  if(!d) return "-";
  return new Date(d+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"});
}

export function fmtShort(d){
  if(!d) return "เลือกวันที่";
  return new Date(d+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
}

export function isPast(e){ return e<TODAY; }
