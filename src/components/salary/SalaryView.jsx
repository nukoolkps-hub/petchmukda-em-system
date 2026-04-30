import { useState, useMemo } from "react";
import { C, TH_MONTHS } from "../../constants";
import { TH_NUMBER } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import { computePoolSharesForGroup, calcSalary } from "../../utils/salaryUtils";
import { printSalarySlip, downloadSalarySlipPDF } from "../../print/printSalarySlip";
import { printSalaryCertificate, downloadSalaryCertificatePDF } from "../../print/printSalaryCertificate";

/* ─── Salary View (employee — read only) ───────────────────────── */
export default function SalaryView({ profile, salaryData, allLeaves, empDir, advanceRequests, onOpenAdvance, onOpenHistory, roles }) {
  const now = new Date();
  const empId = "me";
  const [selMonth, setSelMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  // เฉพาะเดือนที่มีข้อมูลเงินเดือน · สูงสุด 12 เดือนล่าสุด
  const months = Object.keys(salaryData[empId]||{}).sort().reverse().slice(0,12);

  const data = salaryData[empId]?.[selMonth];
  const empInfo = empDir.find(e=>e.name===profile?.name);
  const empRole = roles?.find(r=>r.id===empInfo?.roleId);

  /* ─── Heavy computation: memoized — รันใหม่เฉพาะตอน input เปลี่ยน ─ */
  const { overInfo, overTotalDays, totalLeaveDays, monthApprovedAdvances, approvedAdvanceTotal, poolShare, calc } = useMemo(() => {
    const monthLeaves = profile ? allLeaves.filter(lv=>lv.empName===profile.name && lv.start.startsWith(selMonth)) : [];
    const _overInfo = getOverQuotaDays(monthLeaves);
    const _totalLeaveDays = countWeekdayLeaves(monthLeaves);
    const _monthApprovedAdvances = (advanceRequests||[]).filter(r=>r.month===selMonth && r.status==="approved");
    const _approvedAdvanceTotal = _monthApprovedAdvances.reduce((s,r)=>s+r.amount,0);

    // Pool share — ถ้า role มี poolGroup
    let _poolShare = null;
    if(empRole?.poolGroup){
      const groupEmps = empDir.filter(e=>{
        const r = roles.find(rl=>rl.id===e.roleId);
        return r?.poolGroup===empRole.poolGroup;
      });
      const shares = computePoolSharesForGroup({
        groupEmpIds: groupEmps.map(e=>e.id),
        salaryData, allLeaves, ym:selMonth, empDir,
      });
      _poolShare = shares[empInfo?.id];
    }

    const _calc = calcSalary(data, _overInfo, empInfo, _totalLeaveDays, _approvedAdvanceTotal, _poolShare, empRole);

    return {
      overInfo: _overInfo,
      overTotalDays: _overInfo.weekdays + _overInfo.sundays,
      totalLeaveDays: _totalLeaveDays,
      monthApprovedAdvances: _monthApprovedAdvances,
      approvedAdvanceTotal: _approvedAdvanceTotal,
      poolShare: _poolShare,
      calc: _calc,
    };
  }, [profile, allLeaves, selMonth, advanceRequests, empRole, empDir, roles, salaryData, empInfo, data]);

  /* ─── PDF download handlers ─────────────────────────────────── */
  const [pdfLoading, setPdfLoading] = useState(null); // null | "slip" | "cert"

  async function handleDownloadSlipPDF(){
    if(!data || !calc){ alert("ไม่มีข้อมูลเงินเดือนเดือนนี้"); return; }
    setPdfLoading("slip");
    try {
      await downloadSalarySlipPDF({
        profile, empInfo, empRole, data, calc, poolShare,
        selMonth, monthApprovedAdvances,
      });
    } catch(err){
      console.error(err);
      alert(err.message || "สร้าง PDF ไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setPdfLoading(null);
    }
  }

  async function handleDownloadCertPDF(){
    if(!data){ alert("ไม่มีข้อมูลสำหรับสร้างหนังสือรับรอง"); return; }
    setPdfLoading("cert");
    try {
      await downloadSalaryCertificatePDF({ profile, empInfo, data });
    } catch(err){
      console.error(err);
      alert(err.message || "สร้าง PDF ไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setPdfLoading(null);
    }
  }

  /* ─── Print handlers (window.print → user เลือก Save as PDF) ──── */
  function handlePrintSlip(){
    if(!data || !calc){ alert("ไม่มีข้อมูลเงินเดือนเดือนนี้"); return; }
    printSalarySlip({
      profile, empInfo, empRole, data, calc, poolShare,
      selMonth, monthApprovedAdvances,
    });
  }

  function handlePrintCert(){
    if(!data){ alert("ไม่มีข้อมูลสำหรับสร้างหนังสือรับรอง"); return; }
    printSalaryCertificate({ profile, empInfo, data });
  }

  if(!data) {
    const currentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    return (
      <div>
        {/* month selector — เผื่อเลือกใหม่ได้ */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:14}}>
          <div style={{fontSize:13,color:C.textSoft,flex:1}}>สลิปเงินเดือน</div>
          <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
            style={{padding:"7px 12px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:13,fontWeight:600,color:C.text,background:C.cream,fontFamily:"inherit",outline:"none"}}>
            {months.map(m=>{
              const [y,mo]=m.split("-");
              return <option key={m} value={m}>{TH_MONTHS[parseInt(mo)-1]} {parseInt(y)+543}</option>;
            })}
          </select>
        </div>

        {/* No-data message */}
        <div style={{textAlign:"center",color:C.textSoft,padding:"50px 24px 30px",fontSize:15,
          background:C.white,borderRadius:14,border:`1px dashed ${C.border}`}}>
          <div style={{fontSize:42,marginBottom:12}}>💰</div>
          <div style={{fontWeight:700,color:C.text,marginBottom:4}}>ยังไม่มีข้อมูลเงินเดือน</div>
          <div style={{fontSize:13,color:C.textSoft,marginBottom:20}}>
            เดือน {(() => {const [y,mo]=selMonth.split("-"); return `${TH_MONTHS[parseInt(mo)-1]} ${parseInt(y)+543}`;})()}
          </div>
          {selMonth!==currentYM && (
            <button onClick={()=>setSelMonth(currentYM)}
              style={{padding:"10px 20px",borderRadius:10,border:"none",
                background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,
                fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                boxShadow:`0 3px 10px ${C.gold}40`,display:"inline-flex",alignItems:"center",gap:6}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7"/><line x1="18" y1="12" x2="6" y2="12"/>
              </svg>
              กลับไปเดือนปัจจุบัน
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Bank info card — full width */}
      <div style={{background:C.white,borderRadius:14,padding:"14px 16px",marginBottom:10,
        border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(90,30,10,0.06)",
        display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:40,height:40,borderRadius:11,background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 2px 8px ${C.gold}40`}}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/>
            <path d="M9 21v-6h6v6"/><path d="M9 11h6"/>
          </svg>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,color:C.textSoft,marginBottom:2}}>โอนเข้าบัญชี</div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:1}}>{empInfo?.bank||"-"}</div>
          <div style={{fontSize:13,color:C.textMid,letterSpacing:"0.05em"}}>{empInfo?.bankAcc||"-"}</div>
        </div>
      </div>

      {/* Advance: 2 buttons */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {/* เบิกเงินล่วงหน้า */}
        <button onClick={onOpenAdvance} style={{background:`linear-gradient(135deg,${C.maroon},${C.maroonLt})`,
          borderRadius:14,padding:"12px 14px",border:"none",cursor:"pointer",fontFamily:"inherit",
          boxShadow:`0 3px 12px ${C.maroon}40`,textAlign:"left",position:"relative",overflow:"hidden"}}>
          <svg style={{position:"absolute",top:-6,right:-6,opacity:0.15}} width="50" height="50" viewBox="0 0 24 24" fill={C.goldLt}>
            <path d="M6 3h12l4 6-10 12L2 9z"/>
          </svg>
          <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}}>
            <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.18)",
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.goldLt} strokeWidth="2.4" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:C.goldLt,lineHeight:1.2}}>เบิกเงิน</div>
              <div style={{fontSize:11,color:C.goldLt+"AA",marginTop:1}}>ล่วงหน้า</div>
            </div>
          </div>
        </button>

        {/* ประวัติการเบิก */}
        <button onClick={onOpenHistory} style={{background:C.white,
          borderRadius:14,padding:"12px 14px",border:`1.5px solid ${C.gold}50`,cursor:"pointer",fontFamily:"inherit",
          boxShadow:"0 2px 10px rgba(90,30,10,0.06)",textAlign:"left",position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:34,height:34,borderRadius:10,background:C.goldPale,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${C.gold}40`}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.maroon} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:C.maroon,lineHeight:1.2}}>ประวัติ</div>
              <div style={{fontSize:11,color:C.textSoft,marginTop:1}}>
                {advanceRequests && advanceRequests.length>0 ? `${advanceRequests.length} คำขอ` : "ยังไม่มี"}
              </div>
            </div>
            {/* pending dot */}
            {advanceRequests && advanceRequests.some(r=>r.status==="pending")&&(
              <div style={{width:8,height:8,borderRadius:"50%",background:C.amber,boxShadow:`0 0 0 3px ${C.amber}30`,flexShrink:0}}/>
            )}
          </div>
        </button>
      </div>

      {/* month selector */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:12}}>
        <div style={{fontSize:13,color:C.textSoft,flex:1}}>สลิปเงินเดือน</div>
        <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
          style={{padding:"7px 12px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:13,fontWeight:600,color:C.text,background:C.cream,fontFamily:"inherit",outline:"none"}}>
          {months.map(m=>{
            const [y,mo]=m.split("-");
            return <option key={m} value={m}>{TH_MONTHS[parseInt(mo)-1]} {parseInt(y)+543}</option>;
          })}
        </select>
      </div>

      {/* Document download/print buttons — 2 rows */}
      <div style={{
        display:"flex",flexDirection:"column",gap:8,marginBottom:14,
        padding:"10px 12px",borderRadius:11,
        background:C.goldPale+"30",border:`1px solid ${C.gold}25`,
      }}>

        {/* Row 1: สลิปเงินเดือน */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{flex:"1 1 80px",fontSize:11,color:C.textMid,fontWeight:600,minWidth:0}}>📋 สลิป</div>
          <button onClick={handleDownloadSlipPDF}
            disabled={pdfLoading !== null}
            title="ดาวน์โหลด PDF (text searchable)"
            style={{padding:"7px 10px",borderRadius:8,border:`1px solid ${C.gold}50`,
              background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,
              fontSize:11,fontWeight:700,cursor: pdfLoading ? "wait" : "pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",gap:4,boxShadow:`0 2px 6px ${C.gold}30`,
              opacity: pdfLoading && pdfLoading !== "slip" ? 0.5 : 1, whiteSpace:"nowrap"}}>
            {pdfLoading === "slip" ? (
              <>
                <Spinner/>กำลังสร้าง...
              </>
            ) : (
              <>
                <DownloadIcon/>PDF
              </>
            )}
          </button>
          <button onClick={handlePrintSlip}
            title="พิมพ์ — เลือก Save as PDF ได้"
            style={{padding:"7px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,
              background:C.white,color:C.textMid,
              fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
            <PrintIcon/>พิมพ์
          </button>
        </div>

        {/* Row 2: หนังสือรับรอง */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{flex:"1 1 80px",fontSize:11,color:C.textMid,fontWeight:600,minWidth:0}}>📄 รับรอง</div>
          <button onClick={handleDownloadCertPDF}
            disabled={pdfLoading !== null}
            title="ดาวน์โหลดหนังสือรับรองเงินเดือน (PDF)"
            style={{padding:"7px 10px",borderRadius:8,border:`1.5px solid ${C.maroon}50`,
              background:C.white,color:C.maroon,
              fontSize:11,fontWeight:700,cursor: pdfLoading ? "wait" : "pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",gap:4,
              opacity: pdfLoading && pdfLoading !== "cert" ? 0.5 : 1, whiteSpace:"nowrap"}}>
            {pdfLoading === "cert" ? (
              <>
                <Spinner/>กำลังสร้าง...
              </>
            ) : (
              <>
                <DownloadIcon/>PDF
              </>
            )}
          </button>
          <button onClick={handlePrintCert}
            title="พิมพ์ — เลือก Save as PDF ได้"
            style={{padding:"7px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,
              background:C.white,color:C.textMid,
              fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
            <PrintIcon/>พิมพ์
          </button>
        </div>

        {/* Hint */}
        <div style={{fontSize:10,color:C.textSoft,lineHeight:1.5,marginTop:2}}>
          💡 <b>PDF</b> = ดาวน์โหลดทันที (text ค้นหาได้) · <b>พิมพ์</b> = ในกล่องพิมพ์เลือก "Save as PDF"
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Net pay big card */}
      <div style={{background:`linear-gradient(135deg,${C.maroonDk} 0%,${C.maroon} 100%)`,
        borderRadius:18,padding:"22px 22px 20px",color:C.white,marginBottom:18,
        boxShadow:`0 8px 28px ${C.maroon}40`,position:"relative",overflow:"hidden"}}>
        <svg style={{position:"absolute",top:-10,right:-10,opacity:0.15}} width="120" height="120" viewBox="0 0 24 24" fill={C.goldLt}>
          <path d="M6 3h12l4 6-10 12L2 9z"/>
        </svg>
        <div style={{position:"relative"}}>
          <div style={{fontSize:13,color:C.goldLt+"AA"}}>เงินสุทธิที่ได้รับ</div>
          <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4}}>
            <span style={{fontSize:36,fontWeight:800,color:C.goldLt,letterSpacing:"-0.02em"}}>฿{TH_NUMBER(calc.net)}</span>
          </div>
          <div style={{display:"flex",gap:14,marginTop:14,paddingTop:14,borderTop:`1px solid ${C.goldLt}20`}}>
            <div>
              <div style={{fontSize:11,color:C.goldLt+"80"}}>รวมรายรับ</div>
              <div style={{fontSize:16,fontWeight:700,color:C.green==="#1A6B3A"?"#7EE8B5":C.greenLt}}>+฿{TH_NUMBER(calc.earnings)}</div>
            </div>
            <div>
              <div style={{fontSize:11,color:C.goldLt+"80"}}>รวมรายหัก</div>
              <div style={{fontSize:16,fontWeight:700,color:"#FCA5A5"}}>−฿{TH_NUMBER(calc.deductions)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings */}
      <div style={{background:C.white,borderRadius:14,padding:"16px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(90,30,10,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:6,height:18,borderRadius:3,background:C.green}}/>
          <div style={{fontWeight:700,fontSize:15,color:C.text}}>รายรับ</div>
        </div>
        {[
          { icon:"💼", main:"เงินเดือนพื้นฐาน", sub:"", value:data.base },
          // ── Single rate (เช่น ฝ่ายบัญชี) ──
          ...(calc.isSingle ? [
            { icon:"📦", main:"ค่าคอม", sub:`${calc.pcsSingle} ชิ้น × ฿${TH_NUMBER(calc.rSingle)}`, value:calc.commSingle },
          ] : [
            { icon:"💎", main:"ค่าคอมขาย (ทั่วไป)",
              sub: poolShare ? `Pool ${poolShare.poolN} ชิ้น · ได้ ${poolShare.sellPct.toFixed(2)}% = ${calc.pcsN.toFixed(1)} ชิ้น × ฿${TH_NUMBER(calc.rNormal)}` : `${calc.pcsN} ชิ้น × ฿${TH_NUMBER(calc.rNormal)}`,
              value:calc.commNormal },
            { icon:"✨", main:"ค่าคอมขาย (พิเศษ)",
              sub: `${calc.pcsS} ชิ้น × ฿${TH_NUMBER(calc.rSpecial)}`,
              value:calc.commSpecial },
            { icon:"🛍", main:"ค่าคอมรับซื้อ",
              sub: poolShare ? `Pool ${poolShare.poolB} ชิ้น · ได้ ${poolShare.buyPct.toFixed(2)}% = ${calc.pcsB.toFixed(1)} ชิ้น × ฿${TH_NUMBER(calc.rBuy)}` : `${calc.pcsB} ชิ้น × ฿${TH_NUMBER(calc.rBuy)}`,
              value:calc.commBuy },
          ]),
          { icon:"🎫", main:"โบนัสเชิญชวนสมัครบัตร", sub:`${calc.pcsI} ใบ × ฿${TH_NUMBER(calc.rInvite)}`, value:calc.commInvite },
          { icon:"🔄", main:"โบนัสย้ายข้อมูลบัตร",   sub:`${calc.pcsT} ใบ × ฿${TH_NUMBER(calc.rTransfer)}`, value:calc.commTransfer },
          { icon:"🌟", main:"โบนัสแห่งความขยัน(ไม่หยุด)",
            sub: calc.lvDays<=2 ? `ลาวันธรรมดา ${calc.lvDays} วัน → ${calc.bonusDays} วัน × ฿${TH_NUMBER(Math.round(calc.dayRate))}` : `ลาวันธรรมดา ${calc.lvDays} วัน — ไม่ได้รับโบนัส`,
            value: calc.attendBonus },
        ].filter(x=>x.value>0).map((row,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:i>0?`1px dashed ${C.creamDk}`:"none"}}>
            <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>{row.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,color:C.textMid}}>{row.main}</div>
              {row.sub&&<div style={{fontSize:11,color:C.textSoft,marginTop:1}}>{row.sub}</div>}
            </div>
            <span style={{fontSize:15,fontWeight:600,color:C.green,whiteSpace:"nowrap"}}>+฿{TH_NUMBER(row.value)}</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 0",borderTop:`1.5px solid ${C.creamDk}`,marginTop:8}}>
          <span style={{fontSize:14,fontWeight:700,color:C.text}}>รวมรายรับ</span>
          <span style={{fontSize:18,fontWeight:800,color:C.green}}>฿{TH_NUMBER(calc.earnings)}</span>
        </div>
      </div>

      {/* Deductions */}
      <div style={{background:C.white,borderRadius:14,padding:"16px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(90,30,10,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:6,height:18,borderRadius:3,background:C.red}}/>
          <div style={{fontWeight:700,fontSize:15,color:C.text}}>รายการหัก</div>
        </div>
        {[
          { icon:"⏰", main:"หักขาดงาน/มาสาย", sub:"", value:data.lateDeduction },
          { icon:"💵", main:"หักเงินเบิกล่วงหน้า",
            sub: monthApprovedAdvances.length>0 ? `เบิกแล้ว ${monthApprovedAdvances.length} ครั้งในเดือนนี้` : "",
            value:calc.advanceDed },
          { icon:"🏛", main:"หักประกันสังคม", sub:"", value:data.socialSecurity },
          { icon:"📋", main:"หักลาเกินโควต้า",
            sub: overTotalDays>0
              ? `${overInfo.weekdays>0?`${overInfo.weekdays} วันธรรมดา`:""}${overInfo.weekdays>0&&overInfo.sundays>0?" + ":""}${overInfo.sundays>0?`${overInfo.sundays} วันอาทิตย์ ×1.5`:""}`
              : "",
            value:calc.overQ },
        ].filter(x=>x.value>0).map((row,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:i>0?`1px dashed ${C.creamDk}`:"none"}}>
            <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>{row.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,color:C.textMid}}>{row.main}</div>
              {row.sub&&<div style={{fontSize:11,color:C.textSoft,marginTop:1}}>{row.sub}</div>}
            </div>
            <span style={{fontSize:15,fontWeight:600,color:C.red,whiteSpace:"nowrap"}}>−฿{TH_NUMBER(row.value)}</span>
          </div>
        ))}
        {calc.deductions===0&&<div style={{textAlign:"center",color:C.textSoft,fontSize:14,padding:"8px 0"}}>ไม่มีรายการหัก ✨</div>}
        {calc.deductions>0&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 0",borderTop:`1.5px solid ${C.creamDk}`,marginTop:8}}>
            <span style={{fontSize:14,fontWeight:700,color:C.text}}>รวมรายหัก</span>
            <span style={{fontSize:18,fontWeight:800,color:C.red}}>฿{TH_NUMBER(calc.deductions)}</span>
          </div>
        )}
      </div>

      {data.note&&(
        <div style={{background:C.goldPale,borderRadius:12,padding:"12px 14px",fontSize:13,color:C.textMid,border:`1px solid ${C.gold}40`}}>
          📝 หมายเหตุ: {data.note}
        </div>
      )}

      <div style={{textAlign:"center",fontSize:11,color:C.textSoft,marginTop:16}}>
        ข้อมูลกำหนดโดย Admin · ติดต่อ HR หากมีข้อสงสัย
      </div>
    </div>
  );
}

/* ─── Icon helpers ────────────────────────────────────────────── */
function DownloadIcon(){
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function PrintIcon(){
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  );
}

function Spinner(){
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{animation:"spin 0.8s linear infinite"}}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

