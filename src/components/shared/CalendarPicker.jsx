import { useState, useRef, useEffect } from "react";
import { C, TH_MONTHS, TH_DAYS_SHORT, TODAY } from "../../constants";
import { toYMD, fmtShort } from "../../utils/dateUtils";

/* ─── Calendar date picker ─────────────────────────────────────── */
export default function CalendarPicker({value,onChange,minDate,error}){
  const [open,setOpen]=useState(false);
  const initD=value?new Date(value+"T00:00:00"):new Date();
  const [vy,setVy]=useState(initD.getFullYear());
  const [vm,setVm]=useState(initD.getMonth());
  const ref=useRef(null);
  useEffect(()=>{ const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);}; document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h); },[]);
  useEffect(()=>{ if(value){const d=new Date(value+"T00:00:00");setVy(d.getFullYear());setVm(d.getMonth());} },[value]);
  const dim=new Date(vy,vm+1,0).getDate(),fd=new Date(vy,vm,1).getDay();
  const cells=[...Array(fd).fill(null),...Array.from({length:dim},(_,i)=>i+1)];
  function prevM(){if(vm===0){setVm(11);setVy(y=>y-1);}else setVm(m=>m-1);}
  function nextM(){if(vm===11){setVm(0);setVy(y=>y+1);}else setVm(m=>m+1);}
  function pick(d){onChange(toYMD(new Date(vy,vm,d)));setOpen(false);}
  function cState(d){
    if(!d) return "empty"; const dow=new Date(vy,vm,d).getDay(),ds=toYMD(new Date(vy,vm,d));
    if(minDate&&ds<minDate) return "disabled"; if(dow===6) return "weekend";
    if(value&&ds===value) return "selected"; if(ds===TODAY) return "today"; return "normal";
  }
  const has=!!value;
  return(
    <div ref={ref} style={{position:"relative",marginBottom:14}}>
      <button onClick={()=>setOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 16px",border:`1.5px solid ${error?C.red:open?C.gold:has?C.gold+"90":C.border}`,borderRadius:14,cursor:"pointer",fontFamily:"inherit",background:has?C.goldPale+"50":C.white,boxShadow:open?`0 0 0 3px ${C.gold}20`:"none",transition:"all 0.2s",boxSizing:"border-box"}}>
        <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:has?`linear-gradient(135deg,${C.gold},${C.goldLt})`:C.creamDk,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={has?"#fff":C.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div style={{flex:1,textAlign:"left"}}><div style={{fontSize:16,fontWeight:has?600:400,color:has?C.text:C.textSoft}}>{has?fmtShort(value):"เลือกวันที่"}</div></div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textSoft} strokeWidth="2.5" strokeLinecap="round" style={{transform:open?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {error&&<div style={{color:C.red,fontSize:13,marginTop:5}}>⚠ {error}</div>}
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:400,background:C.white,borderRadius:16,padding:"18px 16px 14px",boxShadow:"0 16px 48px rgba(90,30,10,0.15)",border:`1px solid ${C.border}`,animation:"calFade 0.18s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <button onClick={prevM} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMid} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
            <div style={{fontWeight:700,fontSize:15,color:C.maroon}}>{TH_MONTHS[vm]} {vy+543}</div>
            <button onClick={nextM} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMid} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:6}}>{TH_DAYS_SHORT.map((d,i)=>(<div key={d} style={{textAlign:"center",fontSize:12,fontWeight:600,padding:"4px 0",color:i===6?C.textSoft+"70":C.textSoft}}>{d}</div>))}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {cells.map((d,i)=>{ const st=cState(d),ok=st==="normal"||st==="today"; return(<button key={i} onClick={()=>ok&&pick(d)} style={{height:34,borderRadius:8,fontFamily:"inherit",fontSize:13,border:"none",cursor:!d?"default":ok?"pointer":"not-allowed",fontWeight:st==="selected"||st==="today"?700:400,background:st==="selected"?`linear-gradient(135deg,${C.gold},${C.goldLt})`:st==="today"?C.goldPale:"transparent",color:!d?"transparent":st==="selected"?C.white:st==="disabled"||st==="weekend"?C.border:st==="today"?C.gold:C.text,boxShadow:st==="selected"?`0 2px 8px ${C.gold}50`:"none"}}>{d||""}</button>); })}
          </div>
        </div>
      )}
      <style>{`@keyframes calFade{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}`}</style>
    </div>
  );
}
