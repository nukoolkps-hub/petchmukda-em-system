import { C } from "../../constants";

/* ─── Leave Type Selection Card ────────────────────────────────── */
export default function LeaveTypeCard({lt,selected,onClick,balance,used}){
  const sel=selected===lt.id,left=balance-used;
  return(
    <button onClick={onClick} style={{padding:"20px 12px 16px",borderRadius:16,cursor:"pointer",fontFamily:"inherit",border:`2px solid ${sel?lt.color:C.border}`,background:sel?lt.colorLt:C.white,transition:"all 0.2s",position:"relative",boxShadow:sel?`0 4px 18px ${lt.color}30`:`0 1px 4px rgba(90,30,10,0.06)`}}>
      {sel&&(<div style={{position:"absolute",top:10,right:10,width:20,height:20,borderRadius:"50%",background:lt.color,display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>)}
      <div style={{fontSize:30,marginBottom:10}}>{lt.icon}</div>
      <div style={{fontWeight:700,fontSize:17,color:sel?lt.color:C.text}}>{lt.label}</div>
    </button>
  );
}
