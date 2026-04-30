import { C, LEAVE_TYPES } from "../../constants";
import { fmtDate } from "../../utils/dateUtils";

/* ─── Delete Confirm Modal ─────────────────────────────────────── */
export default function ConfirmModal({leave,onConfirm,onCancel}){
  if(!leave) return null;
  const lt=LEAVE_TYPES.find(t=>t.id===leave.type);
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",
      background:"rgba(45,26,14,0.55)",backdropFilter:"blur(4px)",padding:"0 24px"}}>
      <div style={{background:C.white,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:360,
        boxShadow:"0 24px 60px rgba(45,26,14,0.3)",animation:"modalIn 0.2s cubic-bezier(.22,.68,0,1.2)"}}>
        <div style={{width:56,height:56,borderRadius:"50%",background:C.redLt,
          display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </div>
        <div style={{fontWeight:700,fontSize:18,color:C.text,textAlign:"center",marginBottom:8}}>ลบรายการลานี้?</div>
        <div style={{fontSize:14,color:C.textMid,textAlign:"center",marginBottom:20,lineHeight:1.8}}>
          <b>{leave.empName}</b><br/>
          {lt?.icon} {lt?.label} · {fmtDate(leave.start)}{leave.start!==leave.end?` – ${fmtDate(leave.end)}`:""}<br/>
          <span style={{fontSize:13,color:C.textSoft}}>({leave.days} วันทำการ)</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"13px",borderRadius:12,border:`1.5px solid ${C.border}`,
            background:C.white,color:C.textMid,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
          <button onClick={onConfirm} style={{flex:1,padding:"13px",borderRadius:12,border:"none",
            background:C.red,color:C.white,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            boxShadow:`0 4px 12px ${C.red}50`}}>ลบรายการ</button>
        </div>
      </div>
    </div>
  );
}
