import { useState } from "react";
import { C } from "../../constants";
import { TH_NUMBER } from "../../utils/format";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Admin: Advance Requests Panel ────────────────────────────── */
export default function AdminAdvancePanel({ advanceRequests, empDir, onUpdate }) {
  const [filter, setFilter] = useState("all");
  const [confirmReject, setConfirmReject] = useState<any>(null);
  const [copiedAcc, setCopiedAcc] = useState<string | null>(null); // request.id ที่เพิ่งกด copy

  function copyToClipboard(text, reqId){
    if(!text) return;
    const cleaned = String(text).replace(/[-\s]/g,"");
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(cleaned).then(()=>{
        setCopiedAcc(reqId);
        setTimeout(()=>setCopiedAcc(null), 1500);
      }).catch(()=>{});
    } else {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = cleaned;
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand("copy"); setCopiedAcc(reqId); setTimeout(()=>setCopiedAcc(null),1500); }catch(e){}
      document.body.removeChild(ta);
    }
  }

  const filtered = advanceRequests
    .filter(r=>filter==="all" ? true : r.status===filter)
    .sort((a,b)=>new Date(b.submittedAt).getTime()-new Date(a.submittedAt).getTime());

  function handleApproveSlip(reqId, file){
    const reader = new FileReader();
    reader.onload = ev => {
      onUpdate(reqId, {
        status:"approved",
        slipImg: (ev.target as FileReader).result,
        approvedAt: new Date().toISOString(),
      });
    };
    reader.readAsDataURL(file);
  }

  function handleReject(reqId){
    onUpdate(reqId, { status:"rejected", rejectedAt: new Date().toISOString() });
    setConfirmReject(null);
  }

  return(
    <div>
      {/* filter chips */}
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto"}}>
        {[
          {id:"all",label:"ทั้งหมด"},
          {id:"pending",label:"⏳ รออนุมัติ", count:advanceRequests.filter(r=>r.status==="pending").length},
          {id:"approved",label:"✅ อนุมัติแล้ว"},
          {id:"rejected",label:"❌ ไม่อนุมัติ"},
        ].map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)}
            style={{padding:"7px 14px",borderRadius:20,cursor:"pointer",fontFamily:"inherit",
              fontSize:12,fontWeight:600,whiteSpace:"nowrap",
              background:filter===f.id?C.maroon:C.cream,
              color:filter===f.id?C.goldLt:C.textMid,
              border:`1px solid ${filter===f.id?C.maroon:C.border}`}}>
            {f.label}{f.count>0&&` (${f.count})`}
          </button>
        ))}
      </div>

      {filtered.length===0&&(
        <div style={{textAlign:"center",color:C.textSoft,padding:"50px 0",fontSize:15}}>
          <div style={{fontSize:42,marginBottom:12}}>💸</div>
          ไม่มีคำขอเบิก
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.map(req=>{
          const empInfo = empDir.find(e=>e.id===req.empId) || empDir.find(e=>e.name===req.empName);
          const sMap = {
            pending:  {bg:C.amberLt,color:C.amber, label:"รออนุมัติ"},
            approved: {bg:C.greenLt, color:C.green, label:"โอนแล้ว"},
            rejected: {bg:C.redLt,   color:C.red,   label:"ไม่อนุมัติ"},
          };
          const s = sMap[req.status]||sMap.pending;
          const dt = new Date(req.submittedAt);
          return(
            <div key={req.id} style={{background:C.white,borderRadius:14,padding:"14px 16px",
              boxShadow:"0 2px 10px rgba(90,30,10,0.06)",border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                {empInfo
                  ? <AvatarCircle av={empInfo.av} avType={empInfo.avType} img={empInfo.img} size={40} fontSize={13} border={`2px solid ${C.gold}40`}/>
                  : <div style={{width:40,height:40,borderRadius:"50%",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13}}>?</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:C.text,fontSize:14}}>{req.empName}</div>
                  <div style={{fontSize:11,color:C.textSoft}}>{dt.toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                </div>
                <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:s.bg,color:s.color,whiteSpace:"nowrap"}}>{s.label}</span>
              </div>

              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:C.goldPale,borderRadius:10,marginBottom:10,border:`1px solid ${C.gold}30`}}>
                <span style={{fontSize:12,color:C.textMid}}>จำนวนเงินที่ขอเบิก</span>
                <span style={{fontSize:20,fontWeight:800,color:C.maroon}}>฿{TH_NUMBER(req.amount)}</span>
              </div>

              <div style={{fontSize:13,color:C.textMid,marginBottom:10,lineHeight:1.5}}>
                <span style={{color:C.textSoft}}>เหตุผล:</span> {req.reason}
              </div>

              {empInfo&&(empInfo.bank||empInfo.bankAcc)&&(
                <button onClick={()=>copyToClipboard(empInfo.bankAcc,req.id)}
                  style={{width:"100%",fontSize:12,marginBottom:10,padding:"10px 12px",background:C.cream,
                    border:`1px solid ${copiedAcc===req.id?C.green:C.border}`,borderRadius:8,
                    cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:10,
                    transition:"all 0.2s"}}>
                  <span style={{fontSize:14}}>🏦</span>
                  <div style={{flex:1,textAlign:"left",minWidth:0}}>
                    <div style={{fontSize:11,color:C.textSoft,marginBottom:1}}>{empInfo.bank||"-"}</div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text,letterSpacing:"0.04em"}}>
                      {empInfo.bankAcc||"-"}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:7,
                    background:copiedAcc===req.id?C.greenLt:C.goldPale,
                    color:copiedAcc===req.id?C.green:C.maroon,
                    fontSize:11,fontWeight:700,whiteSpace:"nowrap",transition:"all 0.2s"}}>
                    {copiedAcc===req.id ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        คัดลอก
                      </>
                    )}
                  </div>
                </button>
              )}

              {/* slip preview */}
              {req.slipImg&&(
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:C.textSoft,marginBottom:5,fontWeight:600}}>📄 สลิปการโอน</div>
                  <img src={req.slipImg} alt="slip"
                    onClick={()=>{const w=window.open("","_blank");if(w){w.document.write(`<img src="${req.slipImg}" style="max-width:100%"/>`);}}}
                    style={{maxWidth:"100%",maxHeight:200,borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer"}}/>
                </div>
              )}

              {/* actions */}
              {req.status==="pending"&&(
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button onClick={()=>setConfirmReject(req)}
                    style={{padding:"10px 14px",borderRadius:10,border:`1.5px solid ${C.red}40`,background:C.redLt,
                      color:C.red,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    ❌ ปฏิเสธ
                  </button>
                  <label style={{flex:1,padding:"10px 14px",borderRadius:10,border:"none",
                    background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,
                    fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                    boxShadow:`0 3px 10px ${C.gold}40`}}>
                    📤 อัปโหลดสลิป (อนุมัติ)
                    <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0]; if(f) handleApproveSlip(req.id,f);}} style={{display:"none"}}/>
                  </label>
                </div>
              )}

              {req.status==="approved"&&!req.slipImg&&(
                <label style={{display:"block",padding:"10px 14px",borderRadius:10,border:`1.5px dashed ${C.gold}60`,
                  background:C.goldPale,color:C.maroon,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                  📤 อัปโหลดสลิปย้อนหลัง
                  <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0]; if(f) handleApproveSlip(req.id,f);}} style={{display:"none"}}/>
                </label>
              )}
            </div>
          );
        })}
      </div>

      {confirmReject&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(45,26,14,0.55)",backdropFilter:"blur(4px)",padding:"0 24px"}}>
          <div style={{background:C.white,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:340}}>
            <div style={{textAlign:"center",fontSize:38,marginBottom:8}}>❌</div>
            <div style={{fontWeight:700,fontSize:17,color:C.text,textAlign:"center",marginBottom:6}}>ปฏิเสธคำขอนี้?</div>
            <div style={{fontSize:13,color:C.textMid,textAlign:"center",marginBottom:20}}>
              {confirmReject.empName} · ฿{TH_NUMBER(confirmReject.amount)}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmReject(null)} style={{flex:1,padding:"12px",borderRadius:12,border:`1.5px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
              <button onClick={()=>handleReject(confirmReject.id)} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:C.red,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>ปฏิเสธ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

