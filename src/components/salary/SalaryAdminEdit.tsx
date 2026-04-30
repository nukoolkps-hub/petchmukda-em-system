import { useState, useEffect, useMemo } from "react";
import { C, TH_MONTHS } from "../../constants";
import { TH_NUMBER } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import { computePoolSharesForGroup, calcSalary } from "../../utils/salaryUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Salary Admin Edit ────────────────────────────────────────── */
export default function SalaryAdminEdit({ empDir, salaryData, setSalaryData, allLeaves, advanceRequests, roles, setUnsavedDirty }) {
  const now = new Date();
  const [selEmp, setSelEmp] = useState(empDir[0]?.id||"");
  const [selMonth, setSelMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [draft, setDraft] = useState({});

  const empInfo = empDir.find(e=>e.id===selEmp);
  const empRole = roles?.find(r=>r.id===empInfo?.roleId);
  const savedData = salaryData[selEmp]?.[selMonth] || { base:0, piecesNormal:0, piecesSpecial:0, piecesBuy:0, piecesInvite:0, piecesTransfer:0, lateDeduction:0, socialSecurity:0, note:"" };
  const data = { ...savedData, ...draft };
  const dirty = Object.keys(draft).length > 0;

  // sync dirty ขึ้น parent (สำหรับเตือนก่อนเปลี่ยน section)
  useEffect(()=>{ setUnsavedDirty?.(dirty); },[dirty]);
  useEffect(()=>()=>setUnsavedDirty?.(false),[]); // unmount → clear

  // ถ้าเปลี่ยน emp ภายในหน้านี้ — ถ้ามี draft ให้เตือนก่อน
  function tryChangeEmp(newId){
    if(dirty){
      const ok = window.confirm("⚠️ คุณยังไม่ได้บันทึกการเปลี่ยนแปลง\n\nหากเปลี่ยนพนักงาน ข้อมูลที่แก้ไขจะหายไป\n\nต้องการเปลี่ยนพนักงานใช่ไหม?");
      if(!ok) return;
    }
    setDraft({});
    setSelEmp(newId);
  }

  useEffect(()=>{ setDraft({}); },[selEmp, selMonth]);

  const monthLeaves = empInfo ? allLeaves.filter(lv=>lv.empName===empInfo.name && lv.start.startsWith(selMonth)) : [];
  const overInfo = getOverQuotaDays(monthLeaves);
  const overTotalDays = overInfo.weekdays + overInfo.sundays;
  const totalLeaveDays = countWeekdayLeaves(monthLeaves);
  const monthApprovedAdvances = (advanceRequests||[]).filter(r=>r.empId===selEmp && r.month===selMonth && r.status==="approved");
  const approvedAdvanceTotal = monthApprovedAdvances.reduce((s,r)=>s+r.amount,0);

  // Pool share — ใช้ data ปัจจุบัน (รวม draft) เพื่อให้ Pool คำนวณ realtime
  // สร้าง salaryData ชั่วคราวที่รวม draft ของคนนี้
  const liveSalaryData = dirty ? {
    ...salaryData,
    [selEmp]: {
      ...(salaryData[selEmp]||{}),
      [selMonth]: data,
    },
  } : salaryData;

  /* ─── Heavy computation: memoized ───────────────────────────────── */
  const { poolShare, poolGroupEmps, calc } = useMemo(() => {
    let _poolShare: any = null;
    let _poolGroupEmps: any[] = [];
    if(empRole?.poolGroup){
      _poolGroupEmps = empDir.filter(e=>{
        const r = roles.find(rl=>rl.id===e.roleId);
        return r?.poolGroup===empRole.poolGroup;
      });
      const shares = computePoolSharesForGroup({
        groupEmpIds: _poolGroupEmps.map(e=>e.id),
        salaryData: liveSalaryData, allLeaves, ym:selMonth, empDir,
      });
      _poolShare = shares[selEmp];
    }
    const _calc = calcSalary(data, overInfo, empInfo, totalLeaveDays, approvedAdvanceTotal, _poolShare, empRole);
    return { poolShare: _poolShare, poolGroupEmps: _poolGroupEmps, calc: _calc };
  }, [empRole, empDir, roles, liveSalaryData, allLeaves, selMonth, selEmp, data, overInfo, empInfo, totalLeaveDays, approvedAdvanceTotal]);

  function update(field, value){
    const num = field==="note" ? value : (parseFloat(value)||0);
    setDraft(d=>({...d, [field]:num}));
  }

  function saveAll(){
    if(!dirty) return;
    setSalaryData(d=>{
      const next = {...d};
      if(!next[selEmp]) next[selEmp] = {};
      next[selEmp][selMonth] = { ...savedData, ...draft };
      return next;
    });
    setDraft({});
  }
  function cancelAll(){ setDraft({}); }

  const FIELDS_EARN: { key: string; label: string; icon: string }[] = [
  ];
  const FIELDS_DED = [
    { key:"lateDeduction", label:"หักขาดงาน/มาสาย", icon:"⏰" },
    { key:"socialSecurity", label:"หักประกันสังคม", icon:"🏛" },
  ];

  if(!calc) return <div style={{padding:20,color:C.textSoft,textAlign:"center"}}>ไม่มีข้อมูลเงินเดือน</div>;

  return (
    <div>
      {/* selectors */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <select value={selEmp} onChange={e=>tryChangeEmp(e.target.value)}
          style={{flex:2,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,color:C.text,background:C.white,fontFamily:"inherit",outline:"none"}}>
          {empDir.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <div style={{flex:1,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.gold}40`,fontSize:14,fontWeight:600,color:C.maroon,background:C.goldPale,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          📅 {TH_MONTHS[now.getMonth()]} {now.getFullYear()+543}
        </div>
      </div>

      {/* employee preview */}
      {empInfo&&(
        <div style={{background:C.cream,borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:12,border:`1px solid ${C.border}`}}>
          <AvatarCircle av={empInfo.av} avType={empInfo.avType} img={empInfo.img} size={40} fontSize={13} border={`2px solid ${C.gold}40`}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,color:C.text,fontSize:14}}>{empInfo.name}</div>
            <div style={{fontSize:12,color:C.textSoft}}>{empInfo.role||"-"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:C.textSoft}}>เงินสุทธิ</div>
            <div style={{fontSize:16,fontWeight:800,color:C.maroon}}>฿{TH_NUMBER(calc.net)}</div>
          </div>
        </div>
      )}

      {/* Pool info card — แสดงตอนอยู่ใน group */}
      {poolShare && poolGroupEmps.length>1 && (
        <div style={{background:`linear-gradient(135deg,${C.maroon}08,${C.gold}10)`,borderRadius:12,padding:"14px",marginBottom:14,border:`1px solid ${C.gold}40`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{fontSize:18}}>🤝</div>
            <div style={{fontSize:13,fontWeight:700,color:C.maroon}}>Pool ค่าคอม "{empRole?.name}"</div>
            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:C.gold+"30",color:C.maroon,marginLeft:"auto"}}>{poolGroupEmps.length} คน</span>
          </div>
          <div style={{fontSize:11,color:C.textMid,marginBottom:8,lineHeight:1.6}}>
            ตัดสิทธิ์ฝั่งขาย/รับซื้อ แยกกัน · &lt; 80% ของ Top = ตัดออก<br/>
            แบ่ง Pool ตามสูตร: % ได้ = Base − % หัก + Σ% แบ่งเพื่อน
          </div>

          {/* Admin-locked: ปิดสิทธิ์ Pool */}
          {poolShare.poolExclude && (() => {
            const exc = poolShare.poolExclude;
            const labels = {
              sell: { icon:"💎", title:"ปิดฝั่งขายโดย Admin",     desc:"ไม่ได้ Pool ฝั่งขาย · ฝั่งรับซื้อยังใช้กฎ 80% ปกติ" },
              buy:  { icon:"🛍", title:"ปิดฝั่งรับซื้อโดย Admin", desc:"ไม่ได้ Pool ฝั่งรับซื้อ · ฝั่งขายยังใช้กฎ 80% ปกติ" },
              both: { icon:"🔒", title:"ปิดทั้งคู่โดย Admin",      desc:"ไม่ได้ Pool ทั้ง 2 ฝั่ง · ได้แค่ขาย-พิเศษ" },
            };
            const info = labels[exc] || labels.both;
            return (
              <div style={{background:`linear-gradient(135deg,${C.red}15,${C.red}25)`,borderRadius:9,padding:"10px 12px",marginBottom:6,border:`1.5px solid ${C.red}50`,fontSize:12,color:C.red,fontWeight:700,lineHeight:1.5,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{info.icon}</span>
                <div style={{flex:1}}>
                  <div>{info.title}</div>
                  <div style={{fontWeight:500,fontSize:10.5,color:C.red+"CC",marginTop:2}}>{info.desc}</div>
                </div>
              </div>
            );
          })()}
          {poolShare.losesBaseSalary && (
            <div style={{background:C.red,borderRadius:9,padding:"10px 12px",marginBottom:6,fontSize:12,color:"#fff",fontWeight:700,lineHeight:1.5,boxShadow:`0 3px 10px ${C.red}50`}}>
              💸 ไม่ได้รับเงินเดือนพื้นฐาน
              <div style={{fontWeight:500,fontSize:11,marginTop:3,color:"#FFE0E0"}}>
                ขาย {poolShare.mySell} ชิ้น · {poolShare.topSell>0?((poolShare.mySell/poolShare.topSell)*100).toFixed(1):"0"}% ของ Top {poolShare.topSell} (ต่ำกว่า 50%)
              </div>
            </div>
          )}

          {/* not eligible warnings (เฉพาะคนที่ไม่ถูก Admin ปิดในฝั่งนั้น) */}
          {poolShare.poolExclude!=="sell" && poolShare.poolExclude!=="both" && !poolShare.eligibleSell && (
            <div style={{background:C.redLt,borderRadius:9,padding:"8px 12px",marginBottom:6,border:`1px solid ${C.red}40`,fontSize:12,color:C.red,fontWeight:600,lineHeight:1.5}}>
              ⚠ ฝั่งขาย: ไม่ได้รับชิ้นจาก Pool
              <div style={{fontWeight:500,fontSize:11,marginTop:2}}>
                ขาย {poolShare.mySell} ชิ้น · {poolShare.topSell>0?((poolShare.mySell/poolShare.topSell)*100).toFixed(1):"0"}% ของ Top {poolShare.topSell} (ขั้นต่ำ {poolShare.sellThreshold.toFixed(1)})
              </div>
            </div>
          )}
          {poolShare.poolExclude!=="buy" && poolShare.poolExclude!=="both" && !poolShare.eligibleBuy && (
            <div style={{background:C.redLt,borderRadius:9,padding:"8px 12px",marginBottom:10,border:`1px solid ${C.red}40`,fontSize:12,color:C.red,fontWeight:600,lineHeight:1.5}}>
              ⚠ ฝั่งรับซื้อ: ไม่ได้รับชิ้นจาก Pool
              <div style={{fontWeight:500,fontSize:11,marginTop:2}}>
                รับซื้อ {poolShare.myBuy} ชิ้น · {poolShare.topBuy>0?((poolShare.myBuy/poolShare.topBuy)*100).toFixed(1):"0"}% ของ Top {poolShare.topBuy} (ขั้นต่ำ {poolShare.buyThreshold.toFixed(1)})
              </div>
            </div>
          )}

          {/* this employee's share */}
          <div style={{background:C.white,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
              <span style={{color:C.textMid}}>หยุดทั้งหมด</span>
              <span style={{fontWeight:700,color:C.text}}>{poolShare.leaveDays} วัน</span>
            </div>
            <div style={{height:1,background:C.border,margin:"6px 0"}}/>

            {/* ฝั่งขาย */}
            {poolShare.eligibleSell && (
              <div style={{marginBottom:6,padding:"6px 8px",background:C.cream,borderRadius:7}}>
                <div style={{fontSize:11,fontWeight:700,color:C.maroon,marginBottom:3,display:"flex",justifyContent:"space-between"}}>
                  <span>💎 ฝั่งขาย ({poolShare.sellN} คน · Base {poolShare.sellBase.toFixed(1)}%)</span>
                  <span>{poolShare.sellPct.toFixed(2)}%</span>
                </div>
                <div style={{fontSize:10,color:C.textSoft,lineHeight:1.6}}>
                  หัก: <b>{poolShare.sellDeductPct.toFixed(2)}%</b> · แบ่งเพื่อน: <b>{poolShare.sellSharePct.toFixed(2)}%</b><br/>
                  ได้ชิ้น: <b style={{color:C.green}}>{calc.pcsN.toFixed(1)}</b> / {poolShare.poolN}
                </div>
              </div>
            )}
            {!poolShare.eligibleSell && (
              <div style={{marginBottom:6,padding:"6px 8px",background:C.redLt,borderRadius:7,fontSize:11,color:C.red,fontWeight:600}}>
                💎 ฝั่งขาย: ❌ ไม่ได้รับชิ้นจาก Pool
              </div>
            )}

            {/* ฝั่งรับซื้อ */}
            {poolShare.eligibleBuy && (
              <div style={{marginBottom:6,padding:"6px 8px",background:C.cream,borderRadius:7}}>
                <div style={{fontSize:11,fontWeight:700,color:C.maroon,marginBottom:3,display:"flex",justifyContent:"space-between"}}>
                  <span>🛍 ฝั่งรับซื้อ ({poolShare.buyN} คน · Base {poolShare.buyBase.toFixed(1)}%)</span>
                  <span>{poolShare.buyPct.toFixed(2)}%</span>
                </div>
                <div style={{fontSize:10,color:C.textSoft,lineHeight:1.6}}>
                  หัก: <b>{poolShare.buyDeductPct.toFixed(2)}%</b> · แบ่งเพื่อน: <b>{poolShare.buySharePct.toFixed(2)}%</b><br/>
                  ได้ชิ้น: <b style={{color:C.green}}>{calc.pcsB.toFixed(1)}</b> / {poolShare.poolB}
                </div>
              </div>
            )}
            {!poolShare.eligibleBuy && (
              <div style={{padding:"6px 8px",background:C.redLt,borderRadius:7,fontSize:11,color:C.red,fontWeight:600}}>
                🛍 ฝั่งรับซื้อ: ❌ ไม่ได้รับชิ้นจาก Pool
              </div>
            )}

            <div style={{marginTop:6,padding:"6px 8px",background:C.gold+"15",borderRadius:6,fontSize:10,color:C.maroon,textAlign:"center",fontWeight:600,lineHeight:1.6}}>
              สูตร: % ที่ได้ = Base − % การหัก + Σ(% แบ่งเพื่อน)<br/>
              ✨ ขาย-พิเศษไม่เข้า Pool — ใครขายใครได้
            </div>
          </div>

          {/* members */}
          <div style={{marginTop:10}}>
            <div style={{fontSize:11,color:C.textSoft,marginBottom:6}}>สมาชิกในกลุ่ม:</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {poolGroupEmps.map(g=>{
                const gSal = salaryData[g.id]?.[selMonth];
                const gSell = (gSal?.piecesNormal||0)+(gSal?.piecesSpecial||0);
                const gBuy  = (gSal?.piecesBuy||0);
                const gES = poolShare.topSell===0 ? true : gSell >= poolShare.sellThreshold;
                const gEB = poolShare.topBuy===0  ? true : gBuy  >= poolShare.buyThreshold;
                const isMe = g.id===selEmp;
                return (
                  <div key={g.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:9,
                    background:isMe?C.goldPale:C.white,
                    border:`1px solid ${isMe?C.gold:C.border}`,fontSize:11,color:C.textMid}}>
                    <span style={{fontWeight:isMe?700:500,minWidth:32}}>{g.av}</span>
                    <span style={{padding:"1px 6px",borderRadius:6,fontSize:10,fontWeight:600,
                      background:gES?C.greenLt:C.redLt, color:gES?C.green:C.red}}>
                      ขาย {gSell} {gES?"✓":"✗"}
                    </span>
                    <span style={{padding:"1px 6px",borderRadius:6,fontSize:10,fontWeight:600,
                      background:gEB?C.greenLt:C.redLt, color:gEB?C.green:C.red}}>
                      ซื้อ {gBuy} {gEB?"✓":"✗"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Commission section — single rate or 3 sub-sections */}
      {(empRole && !empRole.poolGroup) ? (
        /* Single rate (เช่น ฝ่ายบัญชี) */
        <div style={{background:C.white,borderRadius:14,padding:"16px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(90,30,10,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:6,height:18,borderRadius:3,background:C.gold}}/>
            <div style={{fontWeight:700,fontSize:14,color:C.text}}>ค่าคอม</div>
            <div style={{marginLeft:"auto",fontSize:14,fontWeight:700,color:C.gold}}>+฿{TH_NUMBER(calc.commSingle)}</div>
          </div>
          <div style={{background:C.goldPale,borderRadius:10,padding:"12px",border:`1px solid ${C.gold}30`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>📦 จำนวนชิ้น</div>
              <div style={{fontSize:11,color:C.textSoft}}>Rate: <b style={{color:C.maroon}}>฿{TH_NUMBER(empInfo?.ratePerPiece||0)}/ชิ้น</b></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{flex:1,position:"relative"}}>
                <input type="number" inputMode="numeric" value={data.pieces||0} onChange={e=>update("pieces",e.target.value)}
                  style={{width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:15,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
                <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:11,fontWeight:600,pointerEvents:"none"}}>ชิ้น</span>
              </div>
              <div style={{fontSize:14,color:C.textSoft,fontWeight:600}}>=</div>
              <div style={{minWidth:90,padding:"10px 12px",borderRadius:9,background:C.cream,fontSize:15,fontWeight:700,color:C.green,textAlign:"right",border:`1px solid ${C.border}`}}>
                ฿{TH_NUMBER(calc.commSingle)}
              </div>
            </div>
          </div>
          <div style={{fontSize:11,color:C.textSoft,marginTop:10,textAlign:"center"}}>
            💡 Rate ต่อชิ้นกำหนดในแท็บ "ข้อมูลพนักงาน"
          </div>
        </div>
      ) : (
      /* Commission ยอดขาย & รับซื้อ — pieces × rate (3 ช่อง) */
      <div style={{background:C.white,borderRadius:14,padding:"16px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(90,30,10,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:6,height:18,borderRadius:3,background:C.gold}}/>
          <div style={{fontWeight:700,fontSize:14,color:C.text}}>ค่าคอมตามจำนวนชิ้น</div>
          <div style={{marginLeft:"auto",fontSize:14,fontWeight:700,color:C.gold}}>+฿{TH_NUMBER(calc.commNormal+calc.commSpecial+calc.commBuy)}</div>
        </div>

        {/* Pre-compute disabled flags */}
        {(() => {
          const exc = empInfo?.poolExclude;
          const sellDisabled = exc==="sell" || exc==="both";
          const buyDisabled  = exc==="buy"  || exc==="both";
          return null;
        })()}

        {/* Normal */}
        {(() => {
          const exc = empInfo?.poolExclude;
          const disabled = exc==="sell" || exc==="both";
          return (
        <div style={{background:disabled?C.cream:C.goldPale,borderRadius:10,padding:"12px",marginBottom:10,border:`1px solid ${disabled?C.border:C.gold+"30"}`,opacity:disabled?0.6:1,position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:disabled?C.textSoft:C.text,display:"flex",alignItems:"center",gap:6}}>
              💎 ขาย (ทั่วไป)
              {disabled && <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:C.red+"20",color:C.red,fontWeight:700}}>🔒 ถูกปิด</span>}
            </div>
            <div style={{fontSize:11,color:C.textSoft}}>Rate: <b style={{color:C.maroon}}>฿{TH_NUMBER(empInfo?.ratePerPieceNormal||0)}/ชิ้น</b></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,position:"relative"}}>
              <input type="number" inputMode="numeric" value={disabled?0:(data.piecesNormal||0)} disabled={disabled} onChange={e=>update("piecesNormal",e.target.value)}
                style={{width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:15,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:disabled?C.textSoft:C.text,background:disabled?C.creamDk:C.white,textAlign:"center",cursor:disabled?"not-allowed":"text"}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:11,fontWeight:600,pointerEvents:"none"}}>ชิ้น</span>
            </div>
            <div style={{fontSize:14,color:C.textSoft,fontWeight:600}}>=</div>
            <div style={{minWidth:90,padding:"10px 12px",borderRadius:9,background:C.cream,fontSize:15,fontWeight:700,color:disabled?C.textSoft:C.green,textAlign:"right",border:`1px solid ${C.border}`}}>
              ฿{TH_NUMBER(disabled?0:calc.commNormal)}
            </div>
          </div>
        </div>
          );
        })()}

        {/* Special — ใครขายใครได้ ไม่ขึ้นกับ poolExclude */}
        <div style={{background:C.goldPale,borderRadius:10,padding:"12px",marginBottom:10,border:`1px solid ${C.gold}30`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>✨ ขาย (พิเศษ)</div>
            <div style={{fontSize:11,color:C.textSoft}}>Rate: <b style={{color:C.maroon}}>฿{TH_NUMBER(empInfo?.ratePerPieceSpecial||0)}/ชิ้น</b></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,position:"relative"}}>
              <input type="number" inputMode="numeric" value={data.piecesSpecial||0} onChange={e=>update("piecesSpecial",e.target.value)}
                style={{width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:15,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:11,fontWeight:600,pointerEvents:"none"}}>ชิ้น</span>
            </div>
            <div style={{fontSize:14,color:C.textSoft,fontWeight:600}}>=</div>
            <div style={{minWidth:90,padding:"10px 12px",borderRadius:9,background:C.cream,fontSize:15,fontWeight:700,color:C.green,textAlign:"right",border:`1px solid ${C.border}`}}>
              ฿{TH_NUMBER(calc.commSpecial)}
            </div>
          </div>
        </div>

        {/* Buy */}
        {(() => {
          const exc = empInfo?.poolExclude;
          const disabled = exc==="buy" || exc==="both";
          return (
        <div style={{background:disabled?C.cream:C.goldPale,borderRadius:10,padding:"12px",border:`1px solid ${disabled?C.border:C.gold+"30"}`,opacity:disabled?0.6:1,position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:disabled?C.textSoft:C.text,display:"flex",alignItems:"center",gap:6}}>
              🛍 รับซื้อ
              {disabled && <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:C.red+"20",color:C.red,fontWeight:700}}>🔒 ถูกปิด</span>}
            </div>
            <div style={{fontSize:11,color:C.textSoft}}>Rate: <b style={{color:C.maroon}}>฿{TH_NUMBER(empInfo?.ratePerPieceBuy||0)}/ชิ้น</b></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,position:"relative"}}>
              <input type="number" inputMode="numeric" value={disabled?0:(data.piecesBuy||0)} disabled={disabled} onChange={e=>update("piecesBuy",e.target.value)}
                style={{width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:15,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:disabled?C.textSoft:C.text,background:disabled?C.creamDk:C.white,textAlign:"center",cursor:disabled?"not-allowed":"text"}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:11,fontWeight:600,pointerEvents:"none"}}>ชิ้น</span>
            </div>
            <div style={{fontSize:14,color:C.textSoft,fontWeight:600}}>=</div>
            <div style={{minWidth:90,padding:"10px 12px",borderRadius:9,background:C.cream,fontSize:15,fontWeight:700,color:disabled?C.textSoft:C.green,textAlign:"right",border:`1px solid ${C.border}`}}>
              ฿{TH_NUMBER(disabled?0:calc.commBuy)}
            </div>
          </div>
        </div>
          );
        })()}

        <div style={{fontSize:11,color:C.textSoft,marginTop:10,textAlign:"center"}}>
          💡 Rate ต่อชิ้นกำหนดในแท็บ "ข้อมูลพนักงาน"
        </div>
        {poolShare && (
          <div style={{marginTop:8,fontSize:11,color:C.maroon,textAlign:"center",padding:"6px 10px",background:C.gold+"15",borderRadius:8}}>
            🤝 ค่าคอมจะถูกคำนวณจาก Pool หลังจากที่ Admin บันทึกชิ้นของทุกคนแล้ว
          </div>
        )}
      </div>
      )}

      {/* บัตรสมาชิก — pieces × rate */}
      <div style={{background:C.white,borderRadius:14,padding:"16px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(90,30,10,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:6,height:18,borderRadius:3,background:C.maroonLt}}/>
          <div style={{fontWeight:700,fontSize:14,color:C.text}}>โบนัสบัตรสมาชิก</div>
          <div style={{marginLeft:"auto",fontSize:14,fontWeight:700,color:C.maroon}}>+฿{TH_NUMBER(calc.memberBonusTotal)}</div>
        </div>

        {/* Invite */}
        <div style={{background:C.goldPale,borderRadius:10,padding:"12px",marginBottom:10,border:`1px solid ${C.gold}30`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>🎫 เชิญชวนสมัครบัตร</div>
            <div style={{fontSize:11,color:C.textSoft}}>Rate: <b style={{color:C.maroon}}>฿{TH_NUMBER(empInfo?.ratePerPieceInvite||0)}/ใบ</b></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,position:"relative"}}>
              <input type="number" inputMode="numeric" value={data.piecesInvite||0} onChange={e=>update("piecesInvite",e.target.value)}
                style={{width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:15,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:11,fontWeight:600,pointerEvents:"none"}}>ใบ</span>
            </div>
            <div style={{fontSize:14,color:C.textSoft,fontWeight:600}}>=</div>
            <div style={{minWidth:90,padding:"10px 12px",borderRadius:9,background:C.cream,fontSize:15,fontWeight:700,color:C.green,textAlign:"right",border:`1px solid ${C.border}`}}>
              ฿{TH_NUMBER(calc.commInvite)}
            </div>
          </div>
        </div>

        {/* Transfer */}
        <div style={{background:C.goldPale,borderRadius:10,padding:"12px",border:`1px solid ${C.gold}30`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>🔄 ย้ายข้อมูลบัตร</div>
            <div style={{fontSize:11,color:C.textSoft}}>Rate: <b style={{color:C.maroon}}>฿{TH_NUMBER(empInfo?.ratePerPieceTransfer||0)}/ใบ</b></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,position:"relative"}}>
              <input type="number" inputMode="numeric" value={data.piecesTransfer||0} onChange={e=>update("piecesTransfer",e.target.value)}
                style={{width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:15,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,textAlign:"center"}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:11,fontWeight:600,pointerEvents:"none"}}>ใบ</span>
            </div>
            <div style={{fontSize:14,color:C.textSoft,fontWeight:600}}>=</div>
            <div style={{minWidth:90,padding:"10px 12px",borderRadius:9,background:C.cream,fontSize:15,fontWeight:700,color:C.green,textAlign:"right",border:`1px solid ${C.border}`}}>
              ฿{TH_NUMBER(calc.commTransfer)}
            </div>
          </div>
        </div>
      </div>

      {/* Earnings inputs */}
      <div style={{background:C.white,borderRadius:14,padding:"16px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(90,30,10,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:6,height:18,borderRadius:3,background:C.green}}/>
          <div style={{fontWeight:700,fontSize:14,color:C.text}}>รายรับ</div>
          <div style={{marginLeft:"auto",fontSize:14,fontWeight:700,color:C.green}}>+฿{TH_NUMBER(calc.earnings)}</div>
        </div>

        {/* Base salary — read-only (กำหนดในข้อมูลพนักงาน) */}
        <div style={{padding:"10px 12px",background:C.cream,borderRadius:10,marginBottom:10,border:`1px dashed ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>💼</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:C.textSoft,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
              <span>เงินเดือนพื้นฐาน</span>
              <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:C.border,color:C.textSoft,fontWeight:700}}>แก้ในแท็บ "ข้อมูลพนักงาน"</span>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginTop:1}}>฿{TH_NUMBER(empInfo?.baseSalary||0)}</div>
          </div>
        </div>

        {FIELDS_EARN.map(f=>(
          <div key={f.key} style={{marginBottom:10}}>
            <label style={{display:"flex",fontSize:12,color:C.textMid,marginBottom:5,fontWeight:500}}>{f.icon} {f.label}</label>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:14,fontWeight:600}}>฿</span>
              <input type="number" inputMode="decimal" min="0" value={data[f.key]||0} onChange={e=>update(f.key,e.target.value)}
                style={{width:"100%",padding:"10px 14px 10px 30px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:15,fontWeight:600,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.cream}}/>
            </div>
          </div>
        ))}

        {/* auto perfect-attendance bonus */}
        <div style={{background:calc.attendBonus>0?C.greenLt:C.cream,borderRadius:9,padding:"12px 14px",marginTop:6,fontSize:12,border:`1px solid ${calc.attendBonus>0?C.green+"30":C.border}`,lineHeight:1.7}}>
          <div style={{fontWeight:700,color:calc.attendBonus>0?C.green:C.textMid,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
            🌟 โบนัสแห่งความขยัน(ไม่หยุด) <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:C.gold+"30",color:C.maroon,marginLeft:"auto"}}>อัตโนมัติ</span>
          </div>
          <div style={{color:C.textMid}}>เรท/วัน = ฿{TH_NUMBER(empInfo?.baseSalary||0)} ÷ 30 = <b>฿{TH_NUMBER(Math.round(calc.dayRate||0))}</b></div>
          <div style={{color:C.textMid}}>เดือนนี้ลาวันธรรมดา <b>{calc.lvDays}</b> วัน <span style={{fontSize:10,color:C.textSoft}}>(ไม่นับวันอาทิตย์)</span></div>
          {calc.lvDays<=2 ? (
            <div style={{color:C.green,fontWeight:700,marginTop:4,paddingTop:4,borderTop:`1px dashed ${C.green}40`}}>
              ได้โบนัส (2 − {calc.lvDays}) × ฿{TH_NUMBER(Math.round(calc.dayRate||0))} = +฿{TH_NUMBER(calc.attendBonus)}
            </div>
          ) : (
            <div style={{color:C.textSoft,marginTop:4,paddingTop:4,borderTop:`1px dashed ${C.border}`}}>ลาวันธรรมดาเกิน 2 วัน — ไม่ได้รับโบนัส</div>
          )}
        </div>
      </div>

      {/* Deductions inputs */}
      <div style={{background:C.white,borderRadius:14,padding:"16px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(90,30,10,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:6,height:18,borderRadius:3,background:C.red}}/>
          <div style={{fontWeight:700,fontSize:14,color:C.text}}>รายการหัก</div>
          <div style={{marginLeft:"auto",fontSize:14,fontWeight:700,color:C.red}}>−฿{TH_NUMBER(calc.deductions)}</div>
        </div>
        {FIELDS_DED.map(f=>(
          <div key={f.key} style={{marginBottom:10}}>
            <label style={{display:"flex",fontSize:12,color:C.textMid,marginBottom:5,fontWeight:500}}>{f.icon} {f.label}</label>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.textSoft,fontSize:14,fontWeight:600}}>฿</span>
              <input type="number" inputMode="decimal" min="0" value={data[f.key]||0} onChange={e=>update(f.key,e.target.value)}
                style={{width:"100%",padding:"10px 14px 10px 30px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:15,fontWeight:600,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.cream}}/>
            </div>
          </div>
        ))}
        {/* over-quota auto note */}
        <div style={{background:C.goldPale,borderRadius:9,padding:"12px 14px",marginTop:10,fontSize:12,color:C.textMid,border:`1px solid ${C.gold}30`,lineHeight:1.7}}>
          <div style={{fontWeight:700,color:C.maroon,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
            📋 หักลาเกินโควต้า <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:C.gold+"30",color:C.maroon,marginLeft:"auto"}}>อัตโนมัติ</span>
          </div>
          <div>เรท/วัน = ฿{TH_NUMBER(empInfo?.baseSalary||0)} ÷ 30 = <b>฿{TH_NUMBER(Math.round(calc.dayRate||0))}</b></div>
          {overInfo.weekdays>0&&<div>วันธรรมดา {overInfo.weekdays} วัน × ฿{TH_NUMBER(Math.round(calc.dayRate||0))} = <b>฿{TH_NUMBER(Math.round(overInfo.weekdays*(calc.dayRate||0)))}</b></div>}
          {overInfo.sundays>0&&<div>วันอาทิตย์ {overInfo.sundays} วัน × ฿{TH_NUMBER(Math.round(calc.dayRate||0))} × 1.5 = <b>฿{TH_NUMBER(Math.round(overInfo.sundays*(calc.dayRate||0)*1.5))}</b></div>}
          {overTotalDays===0&&<div style={{color:C.textSoft}}>ไม่มีการลาเกินโควต้า</div>}
          {overTotalDays>0&&<div style={{color:C.red,fontWeight:700,marginTop:4,paddingTop:4,borderTop:`1px dashed ${C.gold}50`}}>รวมหัก: −฿{TH_NUMBER(calc.overQ)}</div>}
        </div>

        {/* auto advance deduction note */}
        <div style={{background:C.goldPale,borderRadius:9,padding:"12px 14px",marginTop:10,fontSize:12,color:C.textMid,border:`1px solid ${C.gold}30`,lineHeight:1.7}}>
          <div style={{fontWeight:700,color:C.maroon,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
            💵 หักเงินเบิกล่วงหน้า <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:C.gold+"30",color:C.maroon,marginLeft:"auto"}}>อัตโนมัติ</span>
          </div>
          {monthApprovedAdvances.length===0 ? (
            <div style={{color:C.textSoft}}>ไม่มีการเบิกเงินที่ได้รับอนุมัติเดือนนี้</div>
          ) : (
            <>
              {monthApprovedAdvances.map((r,i)=>{
                const dt = new Date(r.approvedAt||r.submittedAt);
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0"}}>
                    <span>{dt.toLocaleDateString("th-TH",{day:"numeric",month:"short"})} · {r.reason||"-"}</span>
                    <b>฿{TH_NUMBER(r.amount)}</b>
                  </div>
                );
              })}
              <div style={{color:C.red,fontWeight:700,marginTop:4,paddingTop:4,borderTop:`1px dashed ${C.gold}50`}}>
                รวมหัก: −฿{TH_NUMBER(calc.advanceDed)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* note */}
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:13,color:C.textMid,marginBottom:6,fontWeight:600}}>หมายเหตุ (ถ้ามี)</label>
        <textarea value={data.note||""} onChange={e=>update("note",e.target.value)} rows={2}
          placeholder="ระบุหมายเหตุ..."
          style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,resize:"none",outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white}}/>
      </div>

      {/* Net summary */}
      <div style={{background:`linear-gradient(135deg,${C.maroon},${C.maroonLt})`,borderRadius:14,padding:"16px 18px",color:C.white,boxShadow:`0 4px 14px ${C.maroon}40`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:12,color:C.goldLt+"AA"}}>เงินสุทธิ {dirty && <span style={{padding:"1px 6px",borderRadius:6,background:C.amber+"40",color:C.goldLt,fontSize:9,fontWeight:700,marginLeft:5}}>ยังไม่บันทึก</span>}</div>
          <div style={{fontSize:24,fontWeight:800,color:C.goldLt,marginTop:2}}>฿{TH_NUMBER(calc.net)}</div>
        </div>
        <div style={{textAlign:"right",fontSize:12,color:C.goldLt+"99",lineHeight:1.7}}>
          รายรับ +฿{TH_NUMBER(calc.earnings)}<br/>
          รายหัก −฿{TH_NUMBER(calc.deductions)}
        </div>
      </div>

      {/* Save / Cancel buttons */}
      {dirty && (
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px dashed ${C.border}`,display:"flex",gap:8}}>
          <button onClick={cancelAll}
            style={{flex:1,padding:"12px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            ยกเลิกการแก้ไข
          </button>
          <button onClick={saveAll}
            style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 14px ${C.gold}50`,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      )}
    </div>
  );
}

