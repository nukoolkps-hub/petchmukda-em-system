import { useState, useEffect } from "react";
import { C, LEAVE_TYPES, TH_MONTHS } from "../../constants";
import { fmtDate, isPast } from "../../utils/dateUtils";
import AvatarCircle from "../shared/AvatarCircle";
import ConfirmModal from "../modals/ConfirmModal";
import PayrollSummaryPanel from "./PayrollSummaryPanel";
import RolesAdminPanel from "./RolesAdminPanel";
import AdminAdvancePanel from "./AdminAdvancePanel";
import SalaryAdminEdit from "../salary/SalaryAdminEdit";

/* ─── Admin Panel (main container) ─────────────────────────────── */
export default function AdminPanel({allLeaves,empDir,onDelete,onLogout,onUpdateRole,salaryData,setSalaryData,advanceRequests,onUpdateAdvance,roles,setRoles,payrollConfirms,setPayrollConfirms,showToast}){
  const [section,setSection]=useState("summary");
  const [unsavedDirty, setUnsavedDirty] = useState(false);

  // ระบบเตือนก่อนเปลี่ยน section ถ้ามีข้อมูลยังไม่บันทึก
  function tryChangeSection(newId){
    if(unsavedDirty){
      const ok = window.confirm("⚠️ คุณยังไม่ได้บันทึกการเปลี่ยนแปลง\n\nหากออกจากหน้านี้ ข้อมูลที่แก้ไขจะหายไป\n\nต้องการออกจากหน้านี้ใช่ไหม?");
      if(!ok) return;
      setUnsavedDirty(false);
    }
    setSection(newId);
  }

  // เตือนตอนปิดหน้า/refresh ถ้ามี unsaved
  useEffect(()=>{
    if(!unsavedDirty) return;
    function handler(e){
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
    window.addEventListener("beforeunload", handler);
    return ()=>window.removeEventListener("beforeunload", handler);
  },[unsavedDirty]);
  const [confirmLeave,setConfirmLeave]=useState(null);
  const [filterEmp,setFilterEmp]=useState(""); const [filterType,setFilterType]=useState("");
  const [editingRole,setEditingRole]=useState({});
  const [expandedEmpId,setExpandedEmpId]=useState(null);
  const [copiedLineId,setCopiedLineId]=useState(null);

  function copyLineId(text, empId){
    if(!text) return;
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(text).then(()=>{
        setCopiedLineId(empId);
        setTimeout(()=>setCopiedLineId(null),1500);
      }).catch(()=>{});
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand("copy"); setCopiedLineId(empId); setTimeout(()=>setCopiedLineId(null),1500); }catch(e){}
      document.body.removeChild(ta);
    }
  }
  const now0 = new Date();
  const [selMonth,setSelMonth]=useState(`${now0.getFullYear()}-${String(now0.getMonth()+1).padStart(2,"0")}`);
  const [selYear,setSelYear]=useState(`${now0.getFullYear()}`);

  const pastLeaves=allLeaves.filter(lv=>isPast(lv.end)).filter(lv=>!filterEmp||lv.empName.includes(filterEmp)).filter(lv=>!filterType||lv.type===filterType).sort((a,b)=>b.end.localeCompare(a.end));
  const uniqueEmps=[...new Set(allLeaves.filter(lv=>isPast(lv.end)).map(lv=>lv.empName))];

  return(
    <div>
      {/* admin badge */}
      <div style={{display:"flex",alignItems:"center",gap:12,background:`linear-gradient(135deg,${C.maroon},${C.maroonLt})`,borderRadius:14,padding:"14px 16px",marginBottom:16,boxShadow:`0 4px 14px ${C.maroon}40`}}>
        <div style={{width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.goldLt} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div style={{flex:1}}><div style={{color:C.goldLt,fontWeight:700,fontSize:16}}>โหมดผู้ดูแลระบบ</div></div>
        <button onClick={()=>{
          if(unsavedDirty){
            const ok = window.confirm("⚠️ คุณยังไม่ได้บันทึกการเปลี่ยนแปลง\n\nหากออก ข้อมูลที่แก้ไขจะหายไป\n\nต้องการออกจากโหมด Admin ใช่ไหม?");
            if(!ok) return;
            setUnsavedDirty(false);
          }
          onLogout();
        }} style={{padding:"7px 14px",borderRadius:10,border:`1px solid ${C.goldLt}50`,background:"rgba(255,255,255,0.12)",color:C.goldLt,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>ออก</button>
      </div>

      {/* section tabs — grouped by category */}
      <div style={{background:C.creamDk,borderRadius:14,padding:10,marginBottom:18,display:"flex",flexDirection:"column",gap:10}}>
        {[
          { cat:"งานลา", icon:"📅", color:C.maroon, items:[
            {id:"summary",label:"สรุปการลา",icon:"📊"},
            {id:"leaves", label:"รายการลา",icon:"🗂"},
          ]},
          { cat:"เงินเดือน", icon:"💰", color:C.gold, items:[
            {id:"salary", label:"กำหนดค่าคอม",icon:"💎"},
            {id:"advance",label:"เบิกล่วงหน้า",icon:"💸"},
            {id:"payroll",label:"สรุปการจ่าย",icon:"💳"},
          ]},
          { cat:"ตั้งค่า", icon:"⚙️", color:C.textMid, items:[
            {id:"positions",label:"ตำแหน่ง",icon:"🏷"},
            {id:"roles",    label:"ข้อมูลพนักงาน",icon:"👤"},
          ]},
        ].map(group=>(
          <div key={group.cat}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"0 4px"}}>
              <span style={{fontSize:11}}>{group.icon}</span>
              <span style={{fontSize:11,fontWeight:700,color:group.color,letterSpacing:"0.02em"}}>{group.cat}</span>
              <div style={{flex:1,height:1,background:`linear-gradient(to right, ${group.color}30, transparent)`}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${group.items.length}, 1fr)`,gap:5}}>
              {group.items.map(s=>{
                const pendingCount = s.id==="advance" ? (advanceRequests||[]).filter(r=>r.status==="pending").length : 0;
                const active = section===s.id;
                return (
                  <button key={s.id} onClick={()=>tryChangeSection(s.id)}
                    style={{padding:"9px 6px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",
                      fontSize:12,fontWeight:600,transition:"all 0.2s",
                      background:active?C.white:"transparent",
                      color:active?C.maroon:C.textSoft,
                      boxShadow:active?"0 1px 6px rgba(90,30,10,0.10)":"none",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:5,position:"relative",whiteSpace:"nowrap"}}>
                    <span style={{fontSize:14}}>{s.icon}</span>
                    <span>{s.label}</span>
                    {pendingCount>0&&(
                      <span style={{position:"absolute",top:3,right:3,background:C.red,color:"#fff",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10,minWidth:16,textAlign:"center"}}>
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── POSITIONS section ── */}
      {section==="positions"&&(
        <RolesAdminPanel roles={roles} setRoles={setRoles} empDir={empDir} onUpdateEmpRole={onUpdateRole}/>
      )}

      {/* ── PAYROLL SUMMARY section ── */}
      {section==="payroll"&&(
        <PayrollSummaryPanel empDir={empDir} salaryData={salaryData} allLeaves={allLeaves} advanceRequests={advanceRequests} roles={roles}
          payrollConfirms={payrollConfirms} setPayrollConfirms={setPayrollConfirms} showToast={showToast}/>
      )}

      {/* ── ADVANCE section ── */}
      {section==="advance"&&(
        <AdminAdvancePanel advanceRequests={advanceRequests||[]} empDir={empDir} onUpdate={onUpdateAdvance}/>
      )}

      {/* ── SALARY edit section ── */}
      {section==="salary"&&(
        <SalaryAdminEdit empDir={empDir} salaryData={salaryData} setSalaryData={setSalaryData} allLeaves={allLeaves} advanceRequests={advanceRequests} roles={roles} setUnsavedDirty={setUnsavedDirty}/>
      )}

      {/* ── SUMMARY section ── */}
      {section==="summary"&&(()=>{
        const now = new Date();

        // gather all unique employee names
        const empNames = [...new Set(allLeaves.map(lv=>lv.empName))];
        const months = [...new Set(allLeaves.map(lv=>lv.start.slice(0,7)))].sort().reverse();
        const years  = [...new Set(allLeaves.map(lv=>lv.start.slice(0,4)))].sort().reverse();

        // count weekday vs sunday days in a leave entry
        function countByDayType(start, end){
          let weekdays=0, sundays=0;
          const s=new Date(start+"T00:00:00"), e=new Date(end+"T00:00:00"), c=new Date(s);
          while(c<=e){
            const dow=c.getDay();
            if(dow===0) sundays++;
            else if(dow!==6) weekdays++;
            c.setDate(c.getDate()+1);
          }
          return {weekdays, sundays};
        }
        function sumDayType(leaves){
          let weekdays=0, sundays=0;
          leaves.forEach(lv=>{ const r=countByDayType(lv.start,lv.end); weekdays+=r.weekdays; sundays+=r.sundays; });
          return {weekdays, sundays};
        }

        return(
          <div>
            {/* Monthly summary */}
            <div style={{background:C.white,borderRadius:16,padding:"16px",marginBottom:14,boxShadow:"0 2px 10px rgba(90,30,10,0.06)",border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{fontWeight:700,color:C.maroon,fontSize:15}}>📅 สรุปรายเดือน</div>
                <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
                  style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.cream,fontFamily:"inherit",outline:"none"}}>
                  {months.map(m=>{
                    const [y,mo]=m.split("-");
                    return <option key={m} value={m}>{TH_MONTHS[parseInt(mo)-1]} {parseInt(y)+543}</option>;
                  })}
                </select>
              </div>
              {empNames.length===0&&<div style={{color:C.textSoft,fontSize:14,textAlign:"center",padding:"16px 0"}}>ไม่มีข้อมูล</div>}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {empNames.map(name=>{
                  const empInfo=empDir.find(e=>e.name===name);
                  const monthLeaves=allLeaves.filter(lv=>lv.empName===name&&lv.start.startsWith(selMonth));
                  const totalTimes=monthLeaves.length;
                  if(totalTimes===0) return null;
                  const {weekdays, sundays}=sumDayType(monthLeaves);
                  const totalDays=weekdays+sundays;
                  const personalDays=monthLeaves.filter(lv=>lv.type==="personal").reduce((s,lv)=>s+lv.days,0);
                  const sickDays=monthLeaves.filter(lv=>lv.type==="sick").reduce((s,lv)=>s+lv.days,0);
                  const overQuota=totalTimes>2;
                  return(
                    <div key={name} style={{padding:"12px 14px",borderRadius:12,
                      background:overQuota?C.redLt:C.cream,border:`1px solid ${overQuota?C.red+"30":C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                        <AvatarCircle av={empInfo?.av||name.slice(0,2)} avType={empInfo?.avType||"text"} img={empInfo?.img||null} size={36} fontSize={12} border={`2px solid ${C.gold}40`}/>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,color:C.text,fontSize:14}}>{name}</div>
                          <div style={{fontSize:11,color:C.textSoft}}>{empInfo?.role||"-"}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontSize:18,color:overQuota?C.red:C.maroon}}>{totalTimes} <span style={{fontSize:11,fontWeight:500,color:C.textSoft}}>ครั้ง</span></div>
                          <div style={{fontSize:11,color:C.textSoft}}>{totalDays} วันรวม</div>
                          {overQuota&&<div style={{fontSize:11,color:C.red,fontWeight:700}}>🚨 เกินโควต้า</div>}
                        </div>
                      </div>
                      {/* day type chips */}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <div style={{background:C.goldPale,borderRadius:20,padding:"3px 10px",fontSize:12,color:C.textMid,fontWeight:600}}>
                          💼 ลากิจ {personalDays} วัน
                        </div>
                        <div style={{background:"#CCFBF1",borderRadius:20,padding:"3px 10px",fontSize:12,color:"#0F766E",fontWeight:600}}>
                          🏥 ลาป่วย {sickDays} วัน
                        </div>
                        <div style={{background:C.white,borderRadius:20,padding:"3px 10px",fontSize:12,color:C.textMid,fontWeight:600,border:`1px solid ${C.border}`}}>
                          📅 วันธรรมดา {weekdays} วัน
                        </div>
                        <div style={{background:"#EDE9FE",borderRadius:20,padding:"3px 10px",fontSize:12,color:"#6D28D9",fontWeight:600}}>
                          🌅 วันอาทิตย์ {sundays} วัน
                        </div>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
                {empNames.every(name=>allLeaves.filter(lv=>lv.empName===name&&lv.start.startsWith(selMonth)).length===0)&&(
                  <div style={{color:C.textSoft,fontSize:14,textAlign:"center",padding:"16px 0"}}>ไม่มีการลาในเดือนนี้</div>
                )}
              </div>
            </div>

            {/* Yearly summary */}
            <div style={{background:C.white,borderRadius:16,padding:"16px",boxShadow:"0 2px 10px rgba(90,30,10,0.06)",border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{fontWeight:700,color:C.maroon,fontSize:15}}>📆 สรุปรายปี</div>
                <select value={selYear} onChange={e=>setSelYear(e.target.value)}
                  style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.cream,fontFamily:"inherit",outline:"none"}}>
                  {years.map(y=>(
                    <option key={y} value={y}>ปี {parseInt(y)+543}</option>
                  ))}
                </select>
              </div>
              {empNames.length===0&&<div style={{color:C.textSoft,fontSize:14,textAlign:"center",padding:"16px 0"}}>ไม่มีข้อมูล</div>}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {empNames.map(name=>{
                  const empInfo=empDir.find(e=>e.name===name);
                  const yearLeaves=allLeaves.filter(lv=>lv.empName===name&&lv.start.startsWith(selYear));
                  const totalTimes=yearLeaves.length;
                  if(totalTimes===0) return null;
                  const {weekdays, sundays}=sumDayType(yearLeaves);
                  const totalDays=weekdays+sundays;
                  const personalDays=yearLeaves.filter(lv=>lv.type==="personal").reduce((s,lv)=>s+lv.days,0);
                  const sickDays=yearLeaves.filter(lv=>lv.type==="sick").reduce((s,lv)=>s+lv.days,0);
                  const barPct=Math.min(100,totalDays/30*100);
                  return(
                    <div key={name} style={{padding:"14px",borderRadius:12,background:C.cream,border:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                        <AvatarCircle av={empInfo?.av||name.slice(0,2)} avType={empInfo?.avType||"text"} img={empInfo?.img||null} size={38} fontSize={12} border={`2px solid ${C.gold}40`}/>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,color:C.text,fontSize:14}}>{name}</div>
                          <div style={{fontSize:12,color:C.textSoft}}>{empInfo?.role||"-"}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontSize:20,color:C.maroon}}>{totalDays}</div>
                          <div style={{fontSize:11,color:C.textSoft}}>วันรวม · {totalTimes} ครั้ง</div>
                        </div>
                      </div>
                      {/* bar */}
                      <div style={{background:C.creamDk,borderRadius:6,height:7,overflow:"hidden",marginBottom:10}}>
                        <div style={{width:`${barPct}%`,height:"100%",borderRadius:6,background:`linear-gradient(90deg,${C.gold},${C.goldLt})`}}/>
                      </div>
                      {/* breakdown chips */}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <div style={{background:C.goldPale,borderRadius:20,padding:"3px 10px",fontSize:12,color:C.textMid,fontWeight:600}}>
                          💼 ลากิจ {personalDays} วัน
                        </div>
                        <div style={{background:"#CCFBF1",borderRadius:20,padding:"3px 10px",fontSize:12,color:"#0F766E",fontWeight:600}}>
                          🏥 ลาป่วย {sickDays} วัน
                        </div>
                        <div style={{background:C.white,borderRadius:20,padding:"3px 10px",fontSize:12,color:C.textMid,fontWeight:600,border:`1px solid ${C.border}`}}>
                          📅 วันธรรมดา {weekdays} วัน
                        </div>
                        <div style={{background:"#EDE9FE",borderRadius:20,padding:"3px 10px",fontSize:12,color:"#6D28D9",fontWeight:600}}>
                          🌅 วันอาทิตย์ {sundays} วัน
                        </div>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
                {empNames.every(name=>allLeaves.filter(lv=>lv.empName===name&&lv.start.startsWith(selYear)).length===0)&&(
                  <div style={{color:C.textSoft,fontSize:14,textAlign:"center",padding:"16px 0"}}>ไม่มีการลาในปีนี้</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── LEAVES section ── */}
      {section==="leaves"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={{flex:1,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,color:C.text,background:C.white,fontFamily:"inherit",outline:"none"}}>
              <option value="">พนักงานทั้งหมด</option>
              {uniqueEmps.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{flex:1,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,color:C.text,background:C.white,fontFamily:"inherit",outline:"none"}}>
              <option value="">ประเภททั้งหมด</option>
              {LEAVE_TYPES.map(lt=><option key={lt.id} value={lt.id}>{lt.label}</option>)}
            </select>
          </div>
          {pastLeaves.length===0&&<div style={{textAlign:"center",color:C.textSoft,padding:"40px 0",fontSize:15}}>ไม่มีรายการลาย้อนหลัง</div>}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {pastLeaves.map(lv=>{
              const lt=LEAVE_TYPES.find(t=>t.id===lv.type);
              const empInfo=empDir.find(e=>e.name===lv.empName);
              return(
                <div key={lv.id} style={{background:C.white,borderRadius:16,padding:"16px",boxShadow:"0 2px 10px rgba(90,30,10,0.06)",border:`1px solid ${C.border}`,display:"flex",alignItems:"flex-start",gap:12}}>
                  <AvatarCircle av={empInfo?.av||lv.av} avType={empInfo?.avType||"text"} img={empInfo?.img||null} size={42} fontSize={13} border={`2px solid ${C.gold}40`}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:3}}>{lv.empName}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{fontSize:13,color:lt?.color,fontWeight:600}}>{lt?.icon} {lt?.label}</span><span style={{fontSize:12,color:C.textSoft}}>· {lv.days} วันทำการ</span></div>
                    <div style={{fontSize:13,color:C.textMid}}>{fmtDate(lv.start)}{lv.start!==lv.end?` – ${fmtDate(lv.end)}`:""}</div>
                  </div>
                  <button onClick={()=>setConfirmLeave(lv)} style={{width:36,height:36,borderRadius:10,border:`1.5px solid ${C.red}30`,background:C.redLt,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              );
            })}
          </div>
          <ConfirmModal leave={confirmLeave} onConfirm={()=>{onDelete(confirmLeave.id);setConfirmLeave(null);}} onCancel={()=>setConfirmLeave(null)}/>
        </div>
      )}

      {/* ── ROLES section ── */}
      {section==="roles"&&(
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,gap:8}}>
            <div style={{fontSize:13,color:C.textSoft}}>กดที่ชื่อพนักงานเพื่อแก้ไข</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setExpandedEmpId("__ALL__")}
                style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.maroon,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                ขยายทั้งหมด
              </button>
              <button onClick={()=>setExpandedEmpId(null)}
                style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                ย่อทั้งหมด
              </button>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {empDir.map(emp=>{
              const eRN      = editingRole[emp.id+"_rN"];
              const eRS      = editingRole[emp.id+"_rS"];
              const eRB      = editingRole[emp.id+"_rB"];
              const eRI      = editingRole[emp.id+"_rI"];
              const eRT      = editingRole[emp.id+"_rT"];
              const eRSingle = editingRole[emp.id+"_rSingle"];
              const eBase    = editingRole[emp.id+"_base"];
              const eSalDis  = editingRole[emp.id+"_salDis"];
              const ePoolExc = editingRole[emp.id+"_poolExc"];
              const dirty = eRN!==undefined || eRS!==undefined || eRB!==undefined || eRI!==undefined || eRT!==undefined || eRSingle!==undefined || eBase!==undefined || eSalDis!==undefined || ePoolExc!==undefined;
              const saveAll = ()=>{
                if(eRN!==undefined)      onUpdateRole(emp.id,"ratePerPieceNormal",parseFloat(eRN)||0);
                if(eRS!==undefined)      onUpdateRole(emp.id,"ratePerPieceSpecial",parseFloat(eRS)||0);
                if(eRB!==undefined)      onUpdateRole(emp.id,"ratePerPieceBuy",parseFloat(eRB)||0);
                if(eRI!==undefined)      onUpdateRole(emp.id,"ratePerPieceInvite",parseFloat(eRI)||0);
                if(eRT!==undefined)      onUpdateRole(emp.id,"ratePerPieceTransfer",parseFloat(eRT)||0);
                if(eRSingle!==undefined) onUpdateRole(emp.id,"ratePerPiece",parseFloat(eRSingle)||0);
                if(eBase!==undefined)    onUpdateRole(emp.id,"baseSalary",parseFloat(eBase)||0);
                if(eSalDis!==undefined)  onUpdateRole(emp.id,"salaryDisabled",eSalDis);
                if(ePoolExc!==undefined) onUpdateRole(emp.id,"poolExclude",ePoolExc||null);
                setEditingRole(r=>{const n={...r};delete n[emp.id+"_rN"];delete n[emp.id+"_rS"];delete n[emp.id+"_rB"];delete n[emp.id+"_rI"];delete n[emp.id+"_rT"];delete n[emp.id+"_rSingle"];delete n[emp.id+"_base"];delete n[emp.id+"_salDis"];delete n[emp.id+"_poolExc"];return n;});
              };
              const cancelAll = ()=>{
                setEditingRole(r=>{const n={...r};delete n[emp.id+"_rN"];delete n[emp.id+"_rS"];delete n[emp.id+"_rB"];delete n[emp.id+"_rI"];delete n[emp.id+"_rT"];delete n[emp.id+"_rSingle"];delete n[emp.id+"_base"];delete n[emp.id+"_salDis"];delete n[emp.id+"_poolExc"];return n;});
              };
              const isExpanded = expandedEmpId===emp.id || expandedEmpId==="__ALL__";
              const empR = roles?.find(r=>r.id===emp.roleId);
              return(
                <div key={emp.id} style={{background:C.white,borderRadius:16,boxShadow:"0 2px 8px rgba(90,30,10,0.06)",border:`1px solid ${C.border}`,overflow:"hidden",transition:"all 0.2s"}}>
                  {/* Clickable header */}
                  <div onClick={()=>{
                    if(expandedEmpId==="__ALL__"){
                      setExpandedEmpId(null);
                    } else {
                      setExpandedEmpId(isExpanded?null:emp.id);
                    }
                  }}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer",
                      background:isExpanded?C.cream:"transparent",borderBottom:isExpanded?`1px solid ${C.border}`:"none"}}>
                    <AvatarCircle av={emp.av} avType={emp.avType} img={emp.img} size={40} fontSize={13} border={`2px solid ${C.gold}40`}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,color:C.text,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{emp.name}</div>
                      <div style={{fontSize:11,color:C.textSoft,marginTop:1,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                        {empR?.icon} {emp.role||"-"}
                        {emp.poolExclude && (() => {
                          const m = {sell:"💎 ปิดขาย", buy:"🛍 ปิดซื้อ", both:"🔒 ปิดทั้งคู่"};
                          return <span style={{padding:"1px 6px",borderRadius:6,background:C.redLt,color:C.red,fontWeight:700,fontSize:9}}>{m[emp.poolExclude]}</span>;
                        })()}
                        {emp.salaryDisabled && <span style={{padding:"1px 6px",borderRadius:6,background:C.redLt,color:C.red,fontWeight:700,fontSize:9}}>🔒 ปิดเงินเดือน</span>}
                        {emp.lineUserId && <span style={{padding:"1px 6px",borderRadius:6,background:"#06C75520",color:"#06A04E",fontWeight:700,fontSize:9}}>💬 LINE</span>}
                      </div>
                    </div>
                    {dirty&&!isExpanded&&(
                      <span style={{padding:"2px 8px",borderRadius:8,background:C.amber+"30",color:C.amber,fontSize:10,fontWeight:700}}>มีการแก้ไข</span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textSoft} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      style={{flexShrink:0,transition:"transform 0.2s",transform:isExpanded?"rotate(180deg)":"rotate(0)"}}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>

                  {/* Expandable content */}
                  {isExpanded && (
                  <div style={{padding:"14px 16px"}}>

                  {/* Role — read-only (แก้จากแท็บ "ตำแหน่ง") */}
                  <div style={{marginBottom:10,padding:"10px 12px",background:C.cream,borderRadius:10,border:`1px dashed ${C.border}`}}>
                    <div style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:5,display:"flex",alignItems:"center",gap:6}}>
                      <span>👤 ตำแหน่ง</span>
                      <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:C.border,color:C.textSoft,fontWeight:700,marginLeft:"auto"}}>แก้ในแท็บ "ตำแหน่ง"</span>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:emp.role&&emp.role!=="-"?C.text:C.textSoft,fontStyle:emp.role&&emp.role!=="-"?"normal":"italic"}}>
                      {emp.role&&emp.role!=="-" ? emp.role : "ยังไม่กำหนดตำแหน่ง"}
                    </div>
                  </div>
                  {/* Bank info — read-only (พนักงานเป็นคนกรอกเอง) */}
                  <div style={{marginBottom:12,padding:"10px 12px",background:C.cream,borderRadius:10,border:`1px dashed ${C.border}`}}>
                    <div style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:5,display:"flex",alignItems:"center",gap:6}}>
                      <span>🏦 บัญชีรับเงินเดือน</span>
                      <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:C.border,color:C.textSoft,fontWeight:700,marginLeft:"auto"}}>พนักงานกรอกเอง</span>
                    </div>
                    {emp.bank||emp.bankAcc ? (
                      <>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:1}}>{emp.bank||"-"}</div>
                        <div style={{fontSize:13,color:C.textMid,letterSpacing:"0.05em"}}>{emp.bankAcc||"-"}</div>
                      </>
                    ):(
                      <div style={{fontSize:13,color:C.textSoft,fontStyle:"italic"}}>ยังไม่มีข้อมูลบัญชี</div>
                    )}
                  </div>

                  {/* LINE User ID — read-only, copy only */}
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4}}>💬 LINE User ID
                        {emp.lineUserId ? <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:"#06C75520",color:"#06A04E",fontWeight:700}}>เชื่อมแล้ว</span>
                                        : <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:C.border,color:C.textSoft,fontWeight:700}}>ยังไม่เชื่อม</span>}
                      </span>
                      <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:C.border,color:C.textSoft,fontWeight:700,marginLeft:"auto"}}>อ่านอย่างเดียว</span>
                    </label>
                    {emp.lineUserId ? (
                      <button onClick={()=>copyLineId(emp.lineUserId, emp.id)}
                        style={{width:"100%",padding:"9px 12px",borderRadius:9,
                          border:`1px solid ${copiedLineId===emp.id?C.green:C.border}`,
                          background:C.cream,cursor:"pointer",fontFamily:"inherit",
                          display:"flex",alignItems:"center",gap:8,transition:"all 0.2s"}}>
                        <span style={{flex:1,textAlign:"left",fontSize:12,color:C.text,fontFamily:"'Prompt',monospace",letterSpacing:"0.02em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>
                          {emp.lineUserId}
                        </span>
                        <span style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:7,
                          background:copiedLineId===emp.id?C.greenLt:C.goldPale,
                          color:copiedLineId===emp.id?C.green:C.maroon,
                          fontSize:11,fontWeight:700,whiteSpace:"nowrap",transition:"all 0.2s"}}>
                          {copiedLineId===emp.id ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              คัดลอก
                            </>
                          )}
                        </span>
                      </button>
                    ) : (
                      <div style={{padding:"10px 12px",borderRadius:9,border:`1px dashed ${C.border}`,
                        background:C.cream,fontSize:12,color:C.textSoft,fontStyle:"italic",textAlign:"center"}}>
                        — ยังไม่ได้เชื่อมต่อ LINE —
                      </div>
                    )}
                    <div style={{fontSize:10,color:C.textSoft,marginTop:3,lineHeight:1.5}}>
                      💡 ID จะถูกเก็บอัตโนมัติเมื่อพนักงานเข้าสู่ระบบผ่าน LINE
                    </div>
                  </div>

                  {/* Base Salary */}
                  <div style={{marginBottom:10,padding:"12px",background:C.goldPale+"60",borderRadius:10,border:`1px solid ${C.gold}30`}}>
                    <label style={{fontSize:11,color:C.maroon,fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                      💼 เงินเดือนพื้นฐาน
                    </label>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:14,fontWeight:600,pointerEvents:"none"}}>฿</span>
                      <input type="number" inputMode="decimal" min="0"
                        value={eBase!==undefined ? eBase : (emp.baseSalary||0)}
                        onChange={e=>setEditingRole(r=>({...r,[emp.id+"_base"]:e.target.value}))}
                        style={{width:"100%",padding:"9px 12px 9px 30px",borderRadius:9,border:`1.5px solid ${eBase!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:eBase!==undefined?C.white:C.cream,textAlign:"right"}}/>
                    </div>
                    <div style={{fontSize:10,color:C.textSoft,marginTop:3}}>หน่วย: บาท/เดือน</div>
                  </div>

                  {/* Disable Salary toggle */}
                  {(() => {
                    const cur = eSalDis!==undefined ? eSalDis : !!emp.salaryDisabled;
                    return (
                  <div style={{padding:"10px 12px",background:cur?C.redLt:C.cream,borderRadius:10,marginBottom:10,border:`1.5px solid ${cur?C.red+"50":C.border}`}}>
                    <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                      <input type="checkbox" checked={cur}
                        onChange={e=>setEditingRole(r=>({...r,[emp.id+"_salDis"]:e.target.checked}))}
                        style={{width:16,height:16,cursor:"pointer",accentColor:C.red}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:cur?C.red:C.text}}>
                          🔒 ปิดสิทธิ์ระบบเงินเดือน
                        </div>
                        <div style={{fontSize:10,color:C.textSoft,marginTop:2,lineHeight:1.5}}>
                          ซ่อนแท็บ "เงินเดือน" จากพนักงาน · ใช้ได้แค่ระบบลา
                        </div>
                      </div>
                    </label>
                  </div>
                    );
                  })()}

                  {/* Commission rates per piece */}
                  {(() => {
                    const empR = roles?.find(r=>r.id===emp.roleId);
                    const isSingle = (empR && !empR.poolGroup);
                    const eRSingle = editingRole[emp.id+"_rSingle"];
                    if(isSingle){
                      return (
                        <div style={{padding:"12px",borderRadius:10,background:C.goldPale+"60",border:`1px solid ${C.gold}30`}}>
                          <div style={{fontSize:12,fontWeight:700,color:C.maroon,marginBottom:8}}>💰 Rate ค่าคอมต่อชิ้น</div>
                          <div style={{display:"flex",gap:8}}>
                            <div style={{flex:1}}>
                              <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>📦 ค่าคอมต่อชิ้น</label>
                              <input type="number" inputMode="decimal" min="0"
                                value={eRSingle!==undefined ? eRSingle : (emp.ratePerPiece||0)}
                                onChange={e=>setEditingRole(r=>({...r,[emp.id+"_rSingle"]:e.target.value}))}
                                style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${eRSingle!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                            </div>
                          </div>
                          <div style={{fontSize:10,color:C.textSoft,textAlign:"center",marginTop:6}}>หน่วย: ฿/ชิ้น</div>

                          <div style={{height:1,background:C.gold+"30",margin:"10px 0"}}/>
                          <div style={{fontSize:11,fontWeight:700,color:C.maroon,marginBottom:8}}>🎫 Rate บัตรสมาชิกต่อใบ</div>
                          <div style={{display:"flex",gap:8}}>
                            <div style={{flex:1}}>
                              <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>🎫 เชิญชวนสมัคร</label>
                              <input type="number" inputMode="decimal" min="0"
                                value={eRI!==undefined ? eRI : (emp.ratePerPieceInvite||0)}
                                onChange={e=>setEditingRole(r=>({...r,[emp.id+"_rI"]:e.target.value}))}
                                style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${eRI!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                            </div>
                            <div style={{flex:1}}>
                              <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>🔄 ย้ายข้อมูล</label>
                              <input type="number" inputMode="decimal" min="0"
                                value={eRT!==undefined ? eRT : (emp.ratePerPieceTransfer||0)}
                                onChange={e=>setEditingRole(r=>({...r,[emp.id+"_rT"]:e.target.value}))}
                                style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${eRT!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                            </div>
                          </div>
                          <div style={{fontSize:10,color:C.textSoft,textAlign:"center",marginTop:6}}>หน่วย: ฿/ใบ</div>
                        </div>
                      );
                    }
                    return (
                  <div style={{padding:"12px",borderRadius:10,background:C.goldPale+"60",border:`1px solid ${C.gold}30`}}>
                    {/* Exclude from Pool — 3 levels (only for pool-group roles) */}
                    {empR?.poolGroup && (() => {
                      const cur = ePoolExc!==undefined ? ePoolExc : (emp.poolExclude || "");
                      const opts = [
                        { id:"",     label:"ไม่ปิด",         icon:"✅", desc:"ใช้กฎ 80% ปกติทั้ง 2 ฝั่ง" },
                        { id:"sell", label:"ปิดฝั่งขาย",     icon:"💎", desc:"ไม่ได้ Pool ขาย · รับซื้อยังใช้กฎ 80%" },
                        { id:"buy",  label:"ปิดฝั่งรับซื้อ", icon:"🛍", desc:"ไม่ได้ Pool รับซื้อ · ขายยังใช้กฎ 80%" },
                        { id:"both", label:"ปิดทั้งคู่",     icon:"🔒", desc:"ไม่ได้ Pool ทั้งหมด · ถ้าขาย < 50% ไม่ได้เงินเดือนพื้นฐาน" },
                      ];
                      return (
                        <div style={{padding:"10px 12px",background:cur?C.redLt+"80":C.cream,borderRadius:9,marginBottom:10,border:`1.5px solid ${cur?C.red+"50":C.border}`}}>
                          <div style={{fontSize:12,fontWeight:700,color:cur?C.red:C.text,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                            🚫 ปิดสิทธิ์ Pool ค่าคอม
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:5}}>
                            {opts.map(o=>{
                              const active = cur===o.id;
                              return (
                                <label key={o.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"7px 10px",borderRadius:7,
                                  background:active?(o.id?C.red+"15":C.greenLt):"transparent",
                                  border:`1px solid ${active?(o.id?C.red+"40":C.green+"30"):"transparent"}`,
                                  cursor:"pointer",transition:"all 0.15s"}}>
                                  <input type="radio" name={`poolExc_${emp.id}`} value={o.id} checked={active}
                                    onChange={()=>setEditingRole(r=>({...r,[emp.id+"_poolExc"]:o.id}))}
                                    style={{marginTop:2,cursor:"pointer",accentColor:o.id?C.red:C.green}}/>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:12,fontWeight:600,color:active?(o.id?C.red:C.green):C.text}}>
                                      {o.icon} {o.label}
                                    </div>
                                    <div style={{fontSize:10,color:C.textSoft,marginTop:1,lineHeight:1.5}}>{o.desc}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{fontSize:12,fontWeight:700,color:C.maroon,marginBottom:8}}>💰 Rate ค่าคอมต่อชิ้น</div>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <div style={{flex:1}}>
                        <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>💎 ขาย-ทั่วไป</label>
                        <input type="number" inputMode="decimal" min="0"
                          value={eRN!==undefined ? eRN : (emp.ratePerPieceNormal||0)}
                          onChange={e=>setEditingRole(r=>({...r,[emp.id+"_rN"]:e.target.value}))}
                          style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${eRN!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>✨ ขาย-พิเศษ</label>
                        <input type="number" inputMode="decimal" min="0"
                          value={eRS!==undefined ? eRS : (emp.ratePerPieceSpecial||0)}
                          onChange={e=>setEditingRole(r=>({...r,[emp.id+"_rS"]:e.target.value}))}
                          style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${eRS!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>🛍 รับซื้อ</label>
                        <input type="number" inputMode="decimal" min="0"
                          value={eRB!==undefined ? eRB : (emp.ratePerPieceBuy||0)}
                          onChange={e=>setEditingRole(r=>({...r,[emp.id+"_rB"]:e.target.value}))}
                          style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${eRB!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                      </div>
                    </div>
                    <div style={{fontSize:10,color:C.textSoft,textAlign:"center",marginBottom:10}}>หน่วย: ฿/ชิ้น</div>

                    <div style={{height:1,background:C.gold+"30",margin:"6px 0 10px"}}/>
                    <div style={{fontSize:11,fontWeight:700,color:C.maroon,marginBottom:8}}>🎫 Rate บัตรสมาชิกต่อใบ</div>
                    <div style={{display:"flex",gap:8}}>
                      <div style={{flex:1}}>
                        <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>🎫 เชิญชวนสมัคร</label>
                        <input type="number" inputMode="decimal" min="0"
                          value={eRI!==undefined ? eRI : (emp.ratePerPieceInvite||0)}
                          onChange={e=>setEditingRole(r=>({...r,[emp.id+"_rI"]:e.target.value}))}
                          style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${eRI!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>🔄 ย้ายข้อมูล</label>
                        <input type="number" inputMode="decimal" min="0"
                          value={eRT!==undefined ? eRT : (emp.ratePerPieceTransfer||0)}
                          onChange={e=>setEditingRole(r=>({...r,[emp.id+"_rT"]:e.target.value}))}
                          style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${eRT!==undefined?C.gold:C.border}`,fontSize:14,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                      </div>
                    </div>
                    <div style={{fontSize:10,color:C.textSoft,textAlign:"center",marginTop:6}}>หน่วย: ฿/ใบ</div>
                  </div>
                    );
                  })()}

                  {/* Bottom save button (when dirty) */}
                  {dirty&&(
                    <div style={{marginTop:14,paddingTop:14,borderTop:`1px dashed ${C.border}`,display:"flex",gap:8}}>
                      <button onClick={cancelAll}
                        style={{flex:1,padding:"11px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                        ยกเลิกการแก้ไข
                      </button>
                      <button onClick={saveAll}
                        style={{flex:2,padding:"11px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 14px ${C.gold}50`,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        บันทึกการเปลี่ยนแปลง
                      </button>
                    </div>
                  )}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

