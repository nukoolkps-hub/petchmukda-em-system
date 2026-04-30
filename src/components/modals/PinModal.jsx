import { useState } from "react";
import { C, ADMIN_PIN } from "../../constants";

/* ─── PIN Modal ────────────────────────────────────────────────── */
export default function PinModal({onSuccess,onClose}){
  const [pin,setPin]=useState(""); const [shake,setShake]=useState(false);
  function pressKey(k){
    if(pin.length>=6) return;
    const next=pin+k; setPin(next);
    if(next.length===6){
      if(next===ADMIN_PIN){ setTimeout(onSuccess,200); }
      else{ setShake(true); setTimeout(()=>{setShake(false);setPin("");},600); }
    }
  }
  function del(){ setPin(p=>p.slice(0,-1)); }
  return(
    <div style={{position:"fixed",inset:0,zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",
      background:"rgba(45,26,14,0.7)",backdropFilter:"blur(6px)",padding:"0 32px"}}>
      <div style={{background:C.white,borderRadius:24,padding:"32px 28px 28px",width:"100%",maxWidth:340,
        boxShadow:"0 28px 70px rgba(45,26,14,0.35)",animation:"modalIn 0.25s cubic-bezier(.22,.68,0,1.2)"}}>
        <div style={{width:56,height:56,borderRadius:"50%",margin:"0 auto 18px",
          background:`linear-gradient(135deg,${C.maroon},${C.maroonLt})`,
          display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 6px 18px ${C.maroon}50`}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.goldLt} strokeWidth="2" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div style={{textAlign:"center",fontWeight:700,fontSize:18,color:C.text,marginBottom:4}}>รหัสผู้ดูแลระบบ</div>
        <div style={{textAlign:"center",fontSize:13,color:C.textSoft,marginBottom:24}}>กรอก PIN 6 หลัก</div>
        <div style={{display:"flex",justifyContent:"center",gap:14,marginBottom:28,animation:shake?"shake 0.5s ease":undefined}}>
          {[0,1,2,3,4,5].map(i=>(
            <div key={i} style={{width:14,height:14,borderRadius:"50%",transition:"all 0.15s",
              background:i<pin.length?C.gold:C.creamDk,
              boxShadow:i<pin.length?`0 2px 8px ${C.gold}60`:"none",
              transform:i<pin.length?"scale(1.15)":"scale(1)"}}/>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>{
            if(k==="") return <div key={i}/>;
            const isDel=k==="⌫";
            return(<button key={i} onClick={()=>isDel?del():pressKey(String(k))}
              style={{height:56,borderRadius:14,border:"none",cursor:"pointer",fontFamily:"inherit",
                fontSize:isDel?36:22,fontWeight:700,
                background:isDel?C.redLt:C.cream,color:isDel?C.red:C.text,
                boxShadow:"0 2px 6px rgba(90,30,10,0.08)",transition:"all 0.1s"}}>{k}</button>);
          })}
        </div>
        <button onClick={onClose} style={{width:"100%",marginTop:16,padding:"12px",
          background:"none",border:`1.5px solid ${C.border}`,borderRadius:12,
          color:C.textSoft,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
      </div>
      <style>{`
        @keyframes modalIn{from{opacity:0;transform:scale(.9);}to{opacity:1;transform:scale(1);}}
        @keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-6px);}80%{transform:translateX(6px);}}
      `}</style>
    </div>
  );
}
