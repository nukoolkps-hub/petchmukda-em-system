import { useState } from "react";
import { C, TH_MONTHS, BUSINESS_RULES } from "../../constants";
import { TH_NUMBER } from "../../utils/format";
import Diamond from "../shared/Diamond";

/* ─── Advance Request Modal ────────────────────────────────────── */
export default function AdvanceRequestModal({ profile, salaryData, advanceRequests, onSubmit, onClose }) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const empSalary = salaryData["me"]?.[ym];
  const baseSalary = empSalary?.base || 0;
  const maxAdvance = Math.floor(baseSalary * BUSINESS_RULES.ADVANCE_LIMIT_PERCENT);

  // total already approved this month
  const myReqs = (advanceRequests||[]).filter(r=>r.month===ym);
  const alreadyRequested = myReqs.filter(r=>r.status!=="rejected").reduce((s,r)=>s+r.amount,0);
  const remaining = Math.max(0, maxAdvance - alreadyRequested);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  function submit(){
    const amt = parseFloat(amount)||0;
    if(amt<=0){ setErr("กรุณาระบุจำนวนเงิน"); return; }
    if(amt>remaining){ setErr(`เกินวงเงินคงเหลือ (สูงสุด ฿${TH_NUMBER(remaining)})`); return; }
    if(!reason.trim()){ setErr("กรุณาระบุเหตุผล"); return; }
    setErr("");
    onSubmit({ amount:amt, reason:reason.trim(), month:ym });
    setAmount(""); setReason("");
  }

  return(
    <div style={{position:"fixed",inset:0,zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center",
      background:"rgba(45,26,14,0.65)",backdropFilter:"blur(6px)"}}>
      <div style={{background:C.white,borderRadius:"24px 24px 0 0",padding:"24px 22px 28px",width:"100%",maxWidth:430,
        boxShadow:"0 -12px 40px rgba(45,26,14,0.25)",animation:"slideUp 0.3s cubic-bezier(.22,.68,0,1.1)",maxHeight:"92vh",overflowY:"auto"}}>

        {/* handle */}
        <div style={{width:40,height:4,borderRadius:2,background:C.border,margin:"0 auto 16px"}}/>

        {/* header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
          <div style={{width:46,height:46,borderRadius:12,background:`linear-gradient(135deg,${C.maroon},${C.maroonLt})`,
            display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 14px ${C.maroon}40`}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.goldLt} strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:18,color:C.text}}>เบิกเงินล่วงหน้า</div>
            <div style={{fontSize:12,color:C.textSoft,marginTop:2}}>{TH_MONTHS[now.getMonth()]} {now.getFullYear()+543}</div>
          </div>
        </div>

        {/* limit info */}
        <div style={{background:C.goldPale,borderRadius:12,padding:"12px 14px",marginBottom:14,border:`1px solid ${C.gold}40`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,color:C.textMid}}>วงเงินสูงสุด (50% ของเงินเดือน)</span>
            <span style={{fontSize:13,fontWeight:700,color:C.maroon}}>฿{TH_NUMBER(maxAdvance)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,color:C.textMid}}>เบิกไปแล้วเดือนนี้</span>
            <span style={{fontSize:13,fontWeight:700,color:C.textMid}}>฿{TH_NUMBER(alreadyRequested)}</span>
          </div>
          <div style={{height:1,background:C.gold+"40",margin:"6px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:700,color:C.text}}>คงเหลือเบิกได้</span>
            <span style={{fontSize:18,fontWeight:800,color:C.green}}>฿{TH_NUMBER(remaining)}</span>
          </div>
        </div>

        {/* amount */}
        <label style={{display:"block",fontSize:13,color:C.textMid,fontWeight:600,marginBottom:6}}>จำนวนเงินที่ต้องการเบิก</label>
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:18,color:C.maroon,fontWeight:700}}>฿</span>
          <input type="number" inputMode="decimal" min="0" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"
            style={{width:"100%",padding:"14px 16px 14px 36px",borderRadius:12,border:`1.5px solid ${err.includes("เงิน")||err.includes("วงเงิน")?C.red:C.border}`,
              fontSize:18,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.cream}}/>
        </div>

        {/* quick buttons */}
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {[1000,2000,5000,Math.floor(remaining/2),remaining].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4).map(v=>(
            <button key={v} onClick={()=>setAmount(String(v))}
              style={{flex:1,padding:"7px 4px",borderRadius:9,border:`1px solid ${C.border}`,background:C.white,color:C.maroon,
                fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              ฿{TH_NUMBER(v)}
            </button>
          ))}
        </div>

        {/* reason */}
        <label style={{display:"block",fontSize:13,color:C.textMid,fontWeight:600,marginBottom:6}}>เหตุผล</label>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={150} placeholder="เช่น ค่ารักษาพยาบาล, เหตุฉุกเฉิน"
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1.5px solid ${err.includes("เหตุผล")?C.red:C.border}`,
            fontSize:14,resize:"none",outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,marginBottom:err?6:14,lineHeight:1.6}}/>

        {err&&<div style={{color:C.red,fontSize:12,marginBottom:14}}>⚠ {err}</div>}

        {/* LINE notice */}
        <div style={{background:"#06C75510",borderRadius:10,padding:"10px 14px",marginBottom:16,border:"1px solid #06C75530",display:"flex",gap:10,alignItems:"center"}}>
          <div style={{fontSize:18}}>💬</div>
          <div style={{fontSize:11,color:C.textMid,lineHeight:1.5}}>
            คำขอจะถูกส่งไปยัง Admin ผ่าน <b style={{color:"#06C755"}}>LINE</b> ทันที<br/>
            Admin จะโอนเงินและส่งสลิปกลับมาในแอป
          </div>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:12,border:`1.5px solid ${C.border}`,
            background:C.white,color:C.textMid,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
          <button onClick={submit} disabled={remaining<=0}
            style={{flex:2,padding:"13px",borderRadius:12,border:"none",
              background: remaining<=0 ? C.border : `linear-gradient(135deg,${C.gold},${C.goldLt})`,
              color: remaining<=0 ? C.textSoft : C.maroonDk,
              fontSize:15,fontWeight:700,cursor: remaining<=0?"not-allowed":"pointer",fontFamily:"inherit",
              boxShadow: remaining<=0?"none":`0 4px 14px ${C.gold}50`,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <Diamond size={14} color={remaining<=0?C.textSoft:C.maroonDk}/>
            {remaining<=0 ? "เต็มวงเงินแล้ว" : "ส่งคำขอผ่าน LINE"}
          </button>
        </div>
      </div>
    </div>
  );
}

