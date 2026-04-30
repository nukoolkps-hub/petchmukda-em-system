import { C, TH_MONTHS } from "../../constants";
import { TH_NUMBER } from "../../utils/format";

/* ─── Advance History Modal ────────────────────────────────────── */
export default function AdvanceHistoryModal({ advanceRequests, onClose }) {
  const list = [...(advanceRequests||[])].sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
  // group by month
  const grouped = {};
  list.forEach(r=>{
    const key = r.month || r.submittedAt.slice(0,7);
    if(!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  const months = Object.keys(grouped).sort().reverse();

  const sMap = {
    pending:  {bg:C.amberLt,color:C.amber, label:"รออนุมัติ", icon:"⏳"},
    approved: {bg:C.greenLt, color:C.green, label:"อนุมัติ • โอนแล้ว", icon:"✅"},
    rejected: {bg:C.redLt,   color:C.red,   label:"ไม่อนุมัติ", icon:"❌"},
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center",
      background:"rgba(45,26,14,0.65)",backdropFilter:"blur(6px)"}}>
      <div style={{background:C.white,borderRadius:"24px 24px 0 0",padding:"24px 22px 28px",width:"100%",maxWidth:430,
        boxShadow:"0 -12px 40px rgba(45,26,14,0.25)",animation:"slideUp 0.3s cubic-bezier(.22,.68,0,1.1)",maxHeight:"92vh",overflowY:"auto"}}>

        <div style={{width:40,height:4,borderRadius:2,background:C.border,margin:"0 auto 16px"}}/>

        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
          <div style={{width:46,height:46,borderRadius:12,background:C.goldPale,
            display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${C.gold}40`}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.maroon} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:18,color:C.text}}>ประวัติการเบิก</div>
            <div style={{fontSize:12,color:C.textSoft,marginTop:2}}>คำขอเบิกเงินล่วงหน้าทั้งหมด</div>
          </div>
        </div>

        {list.length===0 && (
          <div style={{textAlign:"center",color:C.textSoft,padding:"40px 0",fontSize:15}}>
            <div style={{fontSize:42,marginBottom:12}}>📭</div>
            ยังไม่มีประวัติการเบิก
          </div>
        )}

        {months.map(m=>{
          const [y,mo] = m.split("-");
          const monthLabel = `${TH_MONTHS[parseInt(mo)-1]} ${parseInt(y)+543}`;
          const monthList = grouped[m];
          const monthTotal = monthList.filter(r=>r.status==="approved").reduce((s,r)=>s+r.amount,0);
          return (
            <div key={m} style={{marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:C.maroon}}>{monthLabel}</div>
                {monthTotal>0&&(
                  <div style={{fontSize:11,color:C.textSoft}}>
                    เบิกแล้ว <b style={{color:C.green}}>฿{TH_NUMBER(monthTotal)}</b>
                  </div>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {monthList.map(r=>{
                  const s = sMap[r.status]||sMap.pending;
                  const dt = new Date(r.submittedAt);
                  return(
                    <div key={r.id} style={{padding:"12px 14px",background:C.cream,borderRadius:12,border:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{fontSize:18,fontWeight:800,color:C.text}}>฿{TH_NUMBER(r.amount)}</div>
                        <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:s.bg,color:s.color,whiteSpace:"nowrap"}}>
                          {s.icon} {s.label}
                        </span>
                      </div>
                      <div style={{fontSize:12,color:C.textMid,marginBottom:4,lineHeight:1.5}}>{r.reason}</div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <div style={{fontSize:11,color:C.textSoft}}>
                          📅 {dt.toLocaleDateString("th-TH",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                        </div>
                        {r.slipImg&&(
                          <button onClick={()=>{const w=window.open("","_blank");if(w){w.document.write(`<img src="${r.slipImg}" style="max-width:100%"/>`);}}}
                            style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${C.gold}60`,background:C.goldPale,color:C.maroon,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                            📄 ดูสลิป
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button onClick={onClose} style={{width:"100%",padding:"13px",marginTop:8,borderRadius:12,border:`1.5px solid ${C.border}`,
          background:C.white,color:C.textMid,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          ปิด
        </button>
      </div>
    </div>
  );
}
