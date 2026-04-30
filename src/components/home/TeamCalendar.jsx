import { useState } from "react";
import { C, TH_MONTHS, TH_DAYS_SHORT, LEAVE_TYPES, TODAY } from "../../constants";
import { toYMD, dateRange } from "../../utils/dateUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Team Calendar ────────────────────────────────────────────── */
export default function TeamCalendar({allLeaves,empDir}){
  const now=new Date();
  const [vy,setVy]=useState(now.getFullYear()); const [vm,setVm]=useState(now.getMonth()); const [sel,setSel]=useState(TODAY);
  function prevM(){if(vm===0){setVm(11);setVy(y=>y-1);}else setVm(m=>m-1);}
  function nextM(){if(vm===11){setVm(0);setVy(y=>y+1);}else setVm(m=>m+1);}
  const dim=new Date(vy,vm+1,0).getDate(),fd=new Date(vy,vm,1).getDay();
  const cells=[...Array(fd).fill(null),...Array.from({length:dim},(_,i)=>i+1)];
  const leaveMap={};
  allLeaves.forEach(lv=>dateRange(lv.start,lv.end).forEach(ds=>{ if(!leaveMap[ds])leaveMap[ds]=[]; leaveMap[ds].push(lv); }));
  const selLeaves=sel?(leaveMap[sel]||[]):[];
  return(
    <div>
      <div style={{background:C.white,borderRadius:18,padding:"18px 16px 16px",boxShadow:"0 2px 14px rgba(90,30,10,0.08)",border:`1px solid ${C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontWeight:700,color:C.maroon,fontSize:17}}>ปฏิทินการลา</div><div style={{fontSize:13,color:C.textSoft,marginTop:2}}>แตะวันเพื่อดูรายละเอียด</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={prevM} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMid} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
            <span style={{fontSize:14,fontWeight:600,color:C.text,minWidth:108,textAlign:"center"}}>{TH_MONTHS[vm]} {vy+543}</span>
            <button onClick={nextM} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMid} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:6}}>{TH_DAYS_SHORT.map((d,i)=>(<div key={d} style={{textAlign:"center",fontSize:12,fontWeight:700,padding:"3px 0",color:i===6?C.textSoft+"70":C.textSoft}}>{d}</div>))}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {cells.map((d,idx)=>{
            if(!d) return <div key={idx}/>;
            const ds=toYMD(new Date(vy,vm,d)),dow=new Date(vy,vm,d).getDay();
            const isWknd=dow===6,isToday=ds===TODAY,isSel=ds===sel;
            const lvList=leaveMap[ds]||[],hasLv=lvList.length>0;
            return(
              <div key={idx} onClick={()=>setSel(isSel?null:ds)} style={{minHeight:50,borderRadius:10,padding:"5px 2px 4px",cursor:"pointer",background:isSel?"#E8E8E8":isToday?C.goldPale:C.white,border:`1.5px solid ${isSel?"#C8C8C8":hasLv?C.gold+"70":"transparent"}`,transition:"all 0.15s",boxShadow:isSel?"0 2px 6px rgba(0,0,0,0.10)":hasLv?`0 1px 4px ${C.gold}25`:"none"}}>
                <div style={{textAlign:"center",fontSize:13,lineHeight:1,fontWeight:isToday||isSel?800:500,color:isSel?"#666":isWknd?C.textSoft+"80":isToday?C.gold:C.text}}>
                  {isToday&&!isSel?(<span style={{display:"inline-flex",width:22,height:22,borderRadius:"50%",background:C.gold,color:C.white,alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>{d}</span>):d}
                </div>
                {hasLv&&(<div style={{display:"flex",flexWrap:"wrap",gap:1,justifyContent:"center",marginTop:3}}>
                  {lvList.slice(0,3).map((lv,i)=>{ const lt=LEAVE_TYPES.find(t=>t.id===lv.type); return(<div key={i} style={{width:14,height:14,borderRadius:"50%",background:lt?.color||C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",fontWeight:700,border:`1px solid ${C.white}`}}>{lv.av?.charAt(0)||"?"}</div>); })}
                  {lvList.length>3&&(<div style={{width:14,height:14,borderRadius:"50%",background:C.textSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",fontWeight:700}}>+{lvList.length-3}</div>)}
                </div>)}
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:14,marginTop:14,paddingTop:12,borderTop:`1px solid ${C.creamDk}`}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:C.gold}}/><span style={{fontSize:12,color:C.textSoft}}>ลากิจ</span></div>
          <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:C.red}}/><span style={{fontSize:12,color:C.textSoft}}>ลาป่วย</span></div>
        </div>
      </div>
      {sel&&(
        <div style={{background:C.white,borderRadius:18,padding:"16px",marginBottom:14,boxShadow:"0 2px 14px rgba(90,30,10,0.08)",border:`1px solid ${C.border}`}}>
          <div style={{fontWeight:700,color:C.maroon,fontSize:15,marginBottom:selLeaves.length?12:0}}>
            {new Date(sel+"T00:00:00").toLocaleDateString("th-TH",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </div>
          {selLeaves.length===0?(
            <div style={{color:C.textSoft,fontSize:14,marginTop:8,textAlign:"center"}}>✨ ไม่มีพนักงานลาในวันนี้</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {selLeaves.map((lv,i)=>{
                const lt=LEAVE_TYPES.find(t=>t.id===lv.type);
                const empInfo=empDir.find(e=>e.name===lv.empName);
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,background:C.cream,border:`1px solid ${C.border}`}}>
                    <AvatarCircle av={empInfo?.av||lv.av} avType={empInfo?.avType||"text"} img={empInfo?.img||null} size={38} fontSize={13} border={`2px solid ${C.gold}40`}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,color:C.text,fontSize:15}}>{lv.empName}</div>
                      <div style={{fontSize:13,color:C.textMid,marginTop:2}}>{lt?.icon} {lt?.label} · {lv.days} วันทำการ</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
