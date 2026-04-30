import { useState, useMemo } from "react";
import { C, TH_MONTHS } from "../../constants";
import { TH_NUMBER } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import { computePoolSharesForGroup, calcSalary } from "../../utils/salaryUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Admin: Payroll Summary Panel ───────────────────────────────
   สรุปเงินเดือนสุทธิทุกคน + ข้อมูลธนาคาร พร้อมปุ่มคัดลอกเลขบัญชี
   ใช้ logic เดียวกับ SalaryAdminEdit เพื่อให้ตัวเลขตรงกัน           */
export default function PayrollSummaryPanel({ empDir, salaryData, allLeaves, advanceRequests, roles, payrollConfirms, setPayrollConfirms, showToast }) {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [copiedAcc, setCopiedAcc] = useState(null);
  const [search, setSearch] = useState("");

  function copyToClipboard(text, key){
    if(!text) return;
    const cleaned = String(text).replace(/[-\s]/g,"");
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(cleaned).then(()=>{
        setCopiedAcc(key);
        setTimeout(()=>setCopiedAcc(null), 1500);
      }).catch(()=>{});
    } else {
      const ta = document.createElement("textarea");
      ta.value = cleaned;
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand("copy"); setCopiedAcc(key); setTimeout(()=>setCopiedAcc(null),1500); }catch(e){}
      document.body.removeChild(ta);
    }
  }

  /* ─── Heavy computation: memoized ───────────────────────────────
     คำนวณเงินเดือนทุกคนใหม่ เฉพาะตอน salaryData/leaves/advances/roles เปลี่ยน
     สำคัญมาก — ก่อน memo: re-run ทุกครั้งที่กด/พิมพ์ในหน้านี้                */
  const rows = useMemo(() => {
    // group employees by role for shared Pool
    const groupedEmpsByPool = {};
    empDir.forEach(emp=>{
      const r = roles.find(rl=>rl.id===emp.roleId);
      if(r?.poolGroup){
        if(!groupedEmpsByPool[r.poolGroup]) groupedEmpsByPool[r.poolGroup] = [];
        groupedEmpsByPool[r.poolGroup].push(emp.id);
      }
    });

    // compute each employee's net salary
    return empDir.map(emp=>{
      const empRole = roles.find(r=>r.id===emp.roleId);
      const data = salaryData[emp.id]?.[selMonth] || null;
      const monthLeaves = allLeaves.filter(lv=>lv.empName===emp.name && lv.start.startsWith(selMonth));
      const overInfo = getOverQuotaDays(monthLeaves);
      const totalLeaveDays = countWeekdayLeaves(monthLeaves);
      const monthApprovedAdvances = (advanceRequests||[]).filter(r=>r.empId===emp.id && r.month===selMonth && r.status==="approved");
      const approvedAdvanceTotal = monthApprovedAdvances.reduce((s,r)=>s+r.amount,0);

      let poolShare = null;
      if(empRole?.poolGroup){
        const groupIds = groupedEmpsByPool[empRole.poolGroup]||[];
        const shares = computePoolSharesForGroup({
          groupEmpIds: groupIds, salaryData, allLeaves, ym:selMonth, empDir,
        });
        poolShare = shares[emp.id];
      }
      const calc = data ? calcSalary(data, overInfo, emp, totalLeaveDays, approvedAdvanceTotal, poolShare, empRole) : null;
      return { emp, empRole, data, calc, advanceTotal: approvedAdvanceTotal, poolShare };
    }).filter(r=>r.calc);
  }, [empDir, roles, salaryData, selMonth, allLeaves, advanceRequests]);

  // filter by search
  const filtered = search.trim()
    ? rows.filter(r=>r.emp.name.includes(search.trim()) || r.emp.role?.includes(search.trim()))
    : rows;

  const totalPayout = filtered.reduce((s,r)=>s+r.calc.net,0);
  const totalAdvance = filtered.reduce((s,r)=>s+r.advanceTotal,0);

  // available months in salary data
  const monthSet = new Set();
  Object.values(salaryData).forEach(m=>Object.keys(m||{}).forEach(k=>monthSet.add(k)));
  const months = [...monthSet].sort().reverse();
  if(!months.includes(selMonth)) months.unshift(selMonth);

  return(
    <div>
      {/* header bar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.maroon}}>💳 สรุปการจ่ายเงินเดือน</div>
          <div style={{fontSize:11,color:C.textSoft,marginTop:2}}>คัดลอกเลขบัญชีไปวางในแอปธนาคารได้</div>
        </div>
        <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
          style={{padding:"7px 10px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:13,fontWeight:600,color:C.text,background:C.cream,fontFamily:"inherit",outline:"none"}}>
          {months.map(m=>{
            const [y,mo]=m.split("-");
            return <option key={m} value={m}>{TH_MONTHS[parseInt(mo)-1]} {parseInt(y)+543}</option>;
          })}
        </select>
      </div>

      {/* grand total card */}
      <div style={{background:`linear-gradient(135deg,${C.maroonDk},${C.maroon})`,borderRadius:16,padding:"18px 20px",marginBottom:14,color:"#fff",boxShadow:`0 6px 20px ${C.maroon}40`,position:"relative",overflow:"hidden"}}>
        <svg style={{position:"absolute",top:-10,right:-10,opacity:0.12}} width="100" height="100" viewBox="0 0 24 24" fill={C.goldLt}>
          <path d="M6 3h12l4 6-10 12L2 9z"/>
        </svg>
        <div style={{position:"relative"}}>
          <div style={{fontSize:12,color:C.goldLt+"AA",marginBottom:3}}>ยอดที่ต้องโอนเดือนนี้ ({filtered.length} คน)</div>
          <div style={{fontSize:30,fontWeight:800,color:C.goldLt,letterSpacing:"-0.02em",marginBottom:8}}>
            ฿{TH_NUMBER(totalPayout)}
          </div>
          {totalAdvance>0 && (
            <div style={{fontSize:12,color:C.goldLt+"99",paddingTop:8,borderTop:`1px solid ${C.goldLt}25`}}>
              💵 หักเบิกล่วงหน้าไปแล้ว: <b>฿{TH_NUMBER(totalAdvance)}</b> ({filtered.filter(r=>r.advanceTotal>0).length} คน)
            </div>
          )}
        </div>
      </div>

      {/* Confirm payroll status / button */}
      {(() => {
        const confirmed = payrollConfirms?.[selMonth];
        const totalForMonth = rows.reduce((s,r)=>s+r.calc.net,0);
        const empCountForMonth = rows.length;

        if(confirmed){
          const dt = new Date(confirmed.confirmedAt);
          const dtStr = dt.toLocaleString("th-TH",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
          const isStale = (confirmed.totalAmount !== totalForMonth) || (confirmed.empCount !== empCountForMonth);
          return (
            <div style={{background:isStale?C.amberLt:C.greenLt, borderRadius:14, padding:"14px 16px", marginBottom:14,
              border:`1.5px solid ${isStale?C.amber+"60":C.green+"40"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:10,background:isStale?C.amberLt:"#fff",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  border:`1.5px solid ${isStale?C.amber:C.green}`}}>
                  {isStale ? "⚠️" : "✅"}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:isStale?C.amber:C.green}}>
                    {isStale ? "ข้อมูลเปลี่ยนหลังยืนยัน" : "ยืนยันยอดเรียบร้อยแล้ว"}
                  </div>
                  <div style={{fontSize:11,color:C.textSoft,marginTop:2}}>
                    📅 {dtStr}
                  </div>
                </div>
              </div>
              {isStale ? (
                <>
                  <div style={{fontSize:12,color:C.textMid,padding:"8px 12px",background:"#fff",borderRadius:8,marginBottom:8,border:`1px dashed ${C.amber}40`,lineHeight:1.5}}>
                    <div>ตอนยืนยัน: <b>{confirmed.empCount} คน</b> · <b>฿{TH_NUMBER(confirmed.totalAmount)}</b></div>
                    <div>ตอนนี้: <b>{empCountForMonth} คน</b> · <b>฿{TH_NUMBER(totalForMonth)}</b></div>
                  </div>
                  <button onClick={()=>{
                    setPayrollConfirms(p=>({...p, [selMonth]:{
                      confirmedAt:new Date().toISOString(),
                      totalAmount:totalForMonth, empCount:empCountForMonth,
                    }}));
                    showToast?.("ยืนยันยอดใหม่เรียบร้อย");
                  }} style={{width:"100%",padding:"11px",borderRadius:10,border:"none",
                    background:`linear-gradient(135deg,${C.amber},${C.gold})`,color:"#fff",
                    fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                    boxShadow:`0 3px 10px ${C.amber}40`}}>
                    🔄 ยืนยันยอดใหม่
                  </button>
                </>
              ) : (
                <div style={{fontSize:12,color:C.textMid,padding:"6px 10px",background:"#fff",borderRadius:8}}>
                  ยอด <b>฿{TH_NUMBER(confirmed.totalAmount)}</b> · {confirmed.empCount} คน
                </div>
              )}
            </div>
          );
        }

        return (
          <button onClick={()=>{
            if(!confirm(`ยืนยันการโอนเงินเดือนเดือนนี้?\n\nยอดรวม ฿${TH_NUMBER(totalForMonth)}\nจำนวน ${empCountForMonth} คน\n\nคุณยังสามารถแก้ไขข้อมูลภายหลังได้`)) return;
            setPayrollConfirms(p=>({...p, [selMonth]:{
              confirmedAt:new Date().toISOString(),
              totalAmount:totalForMonth, empCount:empCountForMonth,
            }}));
            showToast?.("ยืนยันยอดเรียบร้อย");
          }} style={{width:"100%",padding:"14px",marginBottom:14,borderRadius:12,border:"none",
            background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,
            fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            boxShadow:`0 4px 14px ${C.gold}50`,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            ยืนยันยอดก่อนโอนเงิน
          </button>
        );
      })()}

      {/* search */}
      <div style={{position:"relative",marginBottom:14}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อหรือตำแหน่ง..."
          style={{width:"100%",padding:"10px 14px 10px 38px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white}}/>
        <svg style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textSoft} strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </div>

      {filtered.length===0 && (
        <div style={{textAlign:"center",color:C.textSoft,padding:"40px 0",fontSize:14}}>
          {search.trim() ? `ไม่พบ "${search}"` : "ยังไม่มีข้อมูลเงินเดือนในเดือนนี้"}
        </div>
      )}

      {/* employee rows */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.map(({emp, empRole, calc, advanceTotal, poolShare})=>{
          const hasBank = emp.bank && emp.bankAcc;
          const lostBase = poolShare?.losesBaseSalary;
          return(
            <div key={emp.id} style={{background:C.white,borderRadius:14,padding:"14px",
              border:`1px solid ${lostBase?C.red+"40":C.border}`,
              boxShadow:lostBase?`0 2px 10px ${C.red}15`:"0 2px 10px rgba(90,30,10,0.06)"}}>
              {/* row 1: name + role + net amount */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:hasBank?10:0}}>
                <AvatarCircle av={emp.av} avType={emp.avType} img={emp.img} size={42} fontSize={13} border={`2px solid ${C.gold}40`}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:C.text,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{emp.name}</div>
                  <div style={{fontSize:11,color:C.textSoft,display:"flex",alignItems:"center",gap:4}}>
                    {empRole?.icon} {emp.role||"-"}
                    {emp.poolExclude && (() => {
                      const m = {sell:"💎 ปิดขาย", buy:"🛍 ปิดซื้อ", both:"🔒 ปิดทั้งคู่"};
                      return <span style={{padding:"1px 6px",borderRadius:6,background:C.redLt,color:C.red,fontWeight:700,fontSize:9}}>{m[emp.poolExclude]}</span>;
                    })()}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:C.textSoft}}>เงินสุทธิ</div>
                  <div style={{fontSize:18,fontWeight:800,color:lostBase?C.red:C.maroon}}>฿{TH_NUMBER(calc.net)}</div>
                  {advanceTotal>0&&<div style={{fontSize:10,color:C.textSoft,marginTop:1}}>(หักเบิก ฿{TH_NUMBER(advanceTotal)})</div>}
                </div>
              </div>

              {/* row 2: bank info with copy button */}
              {hasBank ? (
                <button onClick={()=>copyToClipboard(emp.bankAcc,emp.id)}
                  style={{width:"100%",fontSize:12,padding:"10px 12px",background:C.cream,
                    border:`1px solid ${copiedAcc===emp.id?C.green:C.border}`,borderRadius:9,
                    cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:10,
                    transition:"all 0.2s"}}>
                  <span style={{fontSize:14}}>🏦</span>
                  <div style={{flex:1,textAlign:"left",minWidth:0}}>
                    <div style={{fontSize:11,color:C.textSoft,marginBottom:1}}>{emp.bank}</div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text,letterSpacing:"0.04em"}}>
                      {emp.bankAcc}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:7,
                    background:copiedAcc===emp.id?C.greenLt:C.goldPale,
                    color:copiedAcc===emp.id?C.green:C.maroon,
                    fontSize:11,fontWeight:700,whiteSpace:"nowrap",transition:"all 0.2s"}}>
                    {copiedAcc===emp.id ? (
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
              ) : (
                <div style={{padding:"8px 12px",background:C.redLt,borderRadius:9,fontSize:11,color:C.red,fontWeight:600,display:"flex",alignItems:"center",gap:6,border:`1px solid ${C.red}30`}}>
                  ⚠ พนักงานยังไม่กรอกข้อมูลธนาคาร
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

