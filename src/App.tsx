import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "./contexts/AuthContext";

/* ─── Constants & seed data ────────────────────────────────────── */
import {
  C, FONT_LINK, TODAY,
  LEAVE_TYPES,
} from "./constants";

/* ─── Data layer (in-memory or Firebase, sw via VITE_USE_FIREBASE) ─ */
import useAppData, { USE_FIREBASE } from "./data/useAppData";

/* ─── Cloud Functions ──────────────────────────────────────────── */
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase/config";

/* ─── Utilities ────────────────────────────────────────────────── */
import { countWorkdays, fmtDate } from "./utils/dateUtils";

/* ─── Shared components ────────────────────────────────────────── */
import AvatarCircle from "./components/shared/AvatarCircle";
import Diamond from "./components/shared/Diamond";
import GoldDivider from "./components/shared/GoldDivider";
import CalendarPicker from "./components/shared/CalendarPicker";

/* ─── Modals ───────────────────────────────────────────────────── */
import ProfileSetupModal from "./components/modals/ProfileSetupModal";
import PinModal from "./components/modals/PinModal";
import AdvanceRequestModal from "./components/modals/AdvanceRequestModal";
import AdvanceHistoryModal from "./components/modals/AdvanceHistoryModal";
import ManualModal from "./components/modals/ManualModal";

/* ─── Page components ──────────────────────────────────────────── */
import TeamCalendar from "./components/home/TeamCalendar";
import LeaveTypeCard from "./components/home/LeaveTypeCard";
import AdminPanel from "./components/admin/AdminPanel";
import SalaryView from "./components/salary/SalaryView";

/* ─── Loading Screen ───────────────────────────────────────────── */
function LoadingScreen({ message = "กำลังโหลดข้อมูล..." }){
  return (
    <div style={{
      position:"fixed", inset:0,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      background:C.cream, fontFamily:"'Prompt',sans-serif",
    }}>
      <div style={{
        width:64, height:64, borderRadius:"50%",
        background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:`0 6px 20px ${C.gold}50`,
        animation:"pulse 1.5s ease-in-out infinite",
      }}>
        <Diamond size={32} color={C.maroon}/>
      </div>
      <div style={{ marginTop:18, fontSize:14, fontWeight:600, color:C.maroon }}>
        {message}
      </div>
      <div style={{ marginTop:6, fontSize:11, color:C.textSoft }}>
        ห้างเพชรทองมุกดา
      </div>
      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.08);opacity:0.85;}}
      `}</style>
    </div>
  );
}

/* ─── Main App ─────────────────────────────────────────────────── */
export default function LeaveApp(){
  /* ─── Auth — current user from Firebase Auth ────────────── */
  const { user: authUser, signOut: authSignOut } = useAuth();

  /* ─── Data layer — swap-able (in-memory ↔ Firebase) ───────── */
  const data = useAppData();
  const {
    allLeaves, empDir, salaryData, advanceRequests, roles, payrollConfirms,
    loading, error,
    setAllLeaves, setEmpDir, setSalaryData, setAdvanceRequests, setRoles, setPayrollConfirms,
    addLeave: addLeaveAction,
    deleteLeave: deleteLeaveAction,
    submitAdvance: submitAdvanceAction,
    approveAdvance: approveAdvanceAction,
    rejectAdvance: rejectAdvanceAction,
  } = data;

  // profile state — derived from auth user, fallback for demo mode
  const authDerivedProfile = useMemo(() => {
    if (!authUser) return null;
    const displayName = authUser.displayName || "พนักงาน";
    const initials = displayName.slice(0, 2);
    return {
      name: displayName,
      av: initials,
      avType: authUser.photoURL ? "img" : "text",
      img: authUser.photoURL || null,
      role: "-",
      bank: "",
      bankAcc: "",
    };
  }, [authUser]);

  const [profile, setProfile] = useState<any>(authDerivedProfile || { name:"พนักงาน", av:"พง", avType:"text", img:null, role:"-", bank:"", bankAcc:"" });
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Sync profile when auth user changes (e.g. after LINE login provides displayName)
  useEffect(() => {
    if (authDerivedProfile && profile.name === "พนักงาน") {
      setProfile(authDerivedProfile);
    }
  }, [authDerivedProfile]);

  const [tab,setTab]             = useState("home");
  const [form,setForm]           = useState({type:"",startDate:"",endDate:""});
  const [submitted,setSubmitted] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // === LINE Bot integration (via Cloud Functions) ===
  const notifyAdvanceRequestFn = httpsCallable(functions, "notifyAdvanceRequest");
  const notifyAdvanceApprovedFn = httpsCallable(functions, "notifyAdvanceApproved");
  const notifyAdvanceRejectedFn = httpsCallable(functions, "notifyAdvanceRejected");

  async function sendAdvanceRequestToLine(payload: Record<string, unknown>){
    try { await notifyAdvanceRequestFn(payload); } catch(e) { console.warn("LINE notify failed:", e); }
  }
  async function notifyEmployeeApproved(payload: Record<string, unknown>){
    try { await notifyAdvanceApprovedFn(payload); } catch(e) { console.warn("LINE notify failed:", e); }
  }
  async function notifyEmployeeRejected(payload: Record<string, unknown>){
    try { await notifyAdvanceRejectedFn(payload); } catch(e) { console.warn("LINE notify failed:", e); }
  }

  async function submitAdvanceRequest({amount, reason, month}){
    const reqData = {
      empId:"me", empName: profile?.name||"-",
      amount, reason, month,
    };
    const id = await submitAdvanceAction(reqData);

    // ส่ง LINE notification (best-effort)
    sendAdvanceRequestToLine({
      empName: reqData.empName,
      amount: reqData.amount,
      reason: reqData.reason,
      month: reqData.month,
      bank: empDir.find(e=>e.id==="me")?.bank,
      bankAcc: empDir.find(e=>e.id==="me")?.bankAcc,
      submittedAt: new Date().toISOString(),
      requestId: id,
    });
    setShowAdvanceModal(false);
    showToast("ส่งคำขอผ่าน LINE แล้ว — รอ Admin โอนเงิน");
  }

  async function adminUpdateAdvance(reqId, updates){
    // หา request ปัจจุบันเพื่อใช้ส่ง LINE
    const req = advanceRequests.find(r => r.id === reqId);
    if(!req) return;

    // เรียก action ที่เหมาะสม (รองรับทั้ง in-memory และ Firebase)
    if(updates.status === "approved"){
      await approveAdvanceAction(reqId, updates.slipImg || null);
    } else if(updates.status === "rejected"){
      await rejectAdvanceAction(reqId, updates.rejectReason || "");
    }

    // ส่ง LINE notification ไปหาพนักงาน
    const emp = empDir.find(e=>e.id===req.empId) || empDir.find(e=>e.name===req.empName);
    const empLineId = emp?.lineUserId;
    if(updates.status==="approved" && empLineId){
      notifyEmployeeApproved({
        empLineUserId: empLineId,
        empName: req.empName,
        amount: req.amount,
        reason: req.reason,
        month: req.month,
        slipImg: updates.slipImg || null,
        approvedAt: updates.approvedAt || new Date().toISOString(),
        requestId: reqId,
      });
    } else if(updates.status==="rejected" && empLineId){
      notifyEmployeeRejected({
        empLineUserId: empLineId,
        empName: req.empName,
        amount: req.amount,
        reason: req.reason,
        month: req.month,
        rejectedAt: updates.rejectedAt || new Date().toISOString(),
        requestId: reqId,
      });
    }
  }
  const [errors,setErrors]       = useState<Record<string, string>>({});
  const [histDetail,setHistDetail]= useState(null);
  const [toastMsg,setToastMsg]   = useState("");
  const [showPinModal,setShowPinModal] = useState(false);

  // Admin state — check Firebase custom claims
  const [isAdmin,setIsAdmin]     = useState(false);
  useEffect(() => {
    if (!authUser) { setIsAdmin(false); return; }
    authUser.getIdTokenResult().then(result => {
      if (result.claims.admin) setIsAdmin(true);
    }).catch(() => {});
  }, [authUser]);

  // long-press — ใช้ CSS animation แทน interval ให้แม่นยำ
  const holdTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding,  setHolding]  = useState(false);

  function startHold(){
    if(isAdmin) return;
    setHolding(true);
    holdTimer.current = setTimeout(()=>{ /* onAnimationEnd handles it */ }, 5500);
  }
  function endHold(){
    if(holdTimer.current) clearTimeout(holdTimer.current);
    setHolding(false);
  }
  function onRingComplete(){
    setHolding(false);
    setShowPinModal(true);
  }

  function handleProfileSave(data){
    const existing = empDir.find(e=>e.name===data.name);
    const role = existing?.role || "-";
    setProfile({...data, role});
    if(existing){
      // update bank info in empDir for the matching employee
      setEmpDir(d=>d.map(e=>e.name===data.name ? {...e, av:data.av, avType:data.avType, img:data.img, bank:data.bank, bankAcc:data.bankAcc} : e));
    } else {
      // new employee
      const newId = "e"+(Date.now());
      setEmpDir(d=>[...d,{id:newId,name:data.name,role:"-",av:data.av,avType:data.avType,img:data.img,
        bank:data.bank||"", bankAcc:data.bankAcc||"", lineUserId:"",
        balance:{personal:15,sick:15},used:{personal:0,sick:0},
        ratePerPieceNormal:0,ratePerPieceSpecial:0,ratePerPieceBuy:0,ratePerPieceInvite:0,ratePerPieceTransfer:0}]);
    }
    setShowEditProfile(false);
  }

  // keep profile.role in sync when admin updates roles
  useEffect(()=>{
    if(profile){
      const emp=empDir.find(e=>e.name===profile.name);
      if(emp && emp.role!==profile.role) setProfile(p=>({...p,role:emp.role}));
    }
  },[empDir]);

  const myLeaves = allLeaves.filter(lv=>profile && lv.empName===profile.name);
  const balance  = empDir.find(e=>profile && e.name===profile.name)?.balance || {personal:15,sick:15};
  const used     = empDir.find(e=>profile && e.name===profile.name)?.used    || {personal:0,sick:0};

  const selType  = LEAVE_TYPES.find(t=>t.id===form.type);
  const days     = countWorkdays(form.startDate,form.endDate);
  const remain   = form.type ? balance[form.type]-used[form.type] : null;
  const overLimit= remain!==null && days>remain;

  function validate(){
    const e: Record<string, string> ={};
    if(!form.type) e.type="กรุณาเลือกประเภทการลา";
    if(!form.startDate) e.startDate="กรุณาเลือกวันที่เริ่มลา";
    if(!form.endDate)   e.endDate="กรุณาเลือกวันที่สิ้นสุด";
    if(form.startDate&&form.endDate&&form.endDate<form.startDate) e.endDate="วันที่สิ้นสุดต้องไม่ก่อนวันเริ่มต้น";
    if(overLimit) e.over=`วันลาเกินสิทธิ์คงเหลือ (${remain} วัน)`;
    return e;
  }
  function submit(){
    const e=validate(); if(Object.keys(e).length){setErrors(e);return;} setErrors({});
    const id=Date.now();
    const now=new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
    setAllLeaves(prev=>[{id,empId:"me",empName:profile.name,av:profile.av,avType:profile.avType,type:form.type,start:form.startDate,end:form.endDate,days,reason:"",submitted:now},...prev]);
    setSubmitted(true);
  }
  function reset(){setForm({type:"",startDate:"",endDate:""});setSubmitted(false);setErrors({});}
  function goTab(id){setTab(id);setSubmitted(false);setErrors({});setHistDetail(null);}
  function handleDelete(id){setAllLeaves(prev=>prev.filter(lv=>lv.id!==id));showToast("ลบรายการลาเรียบร้อยแล้ว");}
  function handleUpdateRole(empId,field,value){ setEmpDir(d=>d.map(e=>e.id===empId?{...e,[field]:value}:e)); showToast("บันทึกข้อมูลแล้ว"); }
  function showToast(msg){setToastMsg(msg);setTimeout(()=>setToastMsg(""),2800);}

  // เช็คว่า profile (พนักงานคนนี้) ถูกปิดสิทธิ์เงินเดือนไหม
  const meEmp = empDir.find(e=>e.name===profile?.name);
  const salaryDisabled = !!meEmp?.salaryDisabled;

  // ถ้าอยู่ใน salary tab แต่ถูกปิดสิทธิ์ → กลับหน้าแรก
  useEffect(()=>{
    if(salaryDisabled && tab==="salary") setTab("home");
  },[salaryDisabled, tab]);

  const NAV=[
    {id:"home",    label:"หน้าแรก",    icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.5:2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill={a?C.gold+"30":"none"}/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:"request", label:"ยื่นคำขอลา", icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.5:2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill={a?C.gold+"30":"none"}/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>},
    ...(salaryDisabled?[]:[{id:"salary",  label:"เงินเดือน",  icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.5:2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" fill={a?C.gold+"30":"none"}/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5h.01M18 14.5h.01"/></svg>}]),
    ...(isAdmin?[{id:"admin",label:"Admin",icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.5:2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill={a?C.maroon+"40":"none"}/></svg>}]:[]),
  ];
  const pageTitle: Record<string, string | null>={home:null,request:"ยื่นคำขอลา",salary:"เงินเดือนของฉัน",admin:"จัดการรายการลา"};

  /* ─── Loading & Error states (Firebase mode) ──────────────── */
  if(loading){
    return <LoadingScreen message={USE_FIREBASE ? "เชื่อมต่อ Firebase..." : "กำลังโหลด..."}/>;
  }
  if(error){
    return (
      <div style={{
        position:"fixed", inset:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:24, background:C.cream, fontFamily:"'Prompt',sans-serif",
      }}>
        <div style={{
          maxWidth:400, padding:"24px 20px",
          background:C.white, borderRadius:18, border:`1px solid ${C.red}40`,
          textAlign:"center", boxShadow:`0 8px 24px ${C.red}20`,
        }}>
          <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.red, marginBottom:8 }}>
            เชื่อมต่อข้อมูลไม่สำเร็จ
          </div>
          <div style={{ fontSize:13, color:C.textMid, lineHeight:1.6 }}>
            {error.message || "ไม่ทราบสาเหตุ"}
          </div>
          <button onClick={()=>window.location.reload()} style={{
            marginTop:16, padding:"10px 20px", borderRadius:10, border:"none",
            background:C.maroon, color:C.white, fontWeight:700, cursor:"pointer",
            fontFamily:"inherit", fontSize:14,
          }}>โหลดใหม่</button>
        </div>
      </div>
    );
  }

  return(
    <>
      <link rel="stylesheet" href={FONT_LINK}/>
      <style>{`
        *{box-sizing:border-box;}body{margin:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:${C.gold}50;border-radius:2px;}
        select:focus{outline:none;}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        @keyframes ringFill{from{stroke-dashoffset:131.95;}to{stroke-dashoffset:0;}}
        @keyframes ringFillSide{from{stroke-dashoffset:119.38;}to{stroke-dashoffset:0;}}
        .leave-app-root{
          min-height:100vh;
          background:${C.cream};
          font-family:'Prompt','Sarabun','Noto Sans Thai',sans-serif;
          display:flex;
          flex-direction:column;
          max-width:430px;
          margin:0 auto;
          box-shadow:0 0 60px rgba(90,30,10,0.12);
        }
        @media(min-width:768px){
          body{ background:${C.creamDk}; }
          .leave-app-root{ max-width:100%; flex-direction:row; min-height:100vh; box-shadow:none; }
          .leave-sidebar{
            width:260px; min-width:260px; flex-shrink:0;
            background:linear-gradient(180deg,${C.maroonDk} 0%,${C.maroon} 60%,${C.maroonLt} 100%);
            display:flex; flex-direction:column;
            position:sticky; top:0; height:100vh; overflow:hidden;
          }
          .leave-main{ flex:1; display:flex; flex-direction:column; min-width:0; max-width:780px; }
          .leave-header-mobile{ display:none !important; }
          .leave-bottom-nav{ display:none !important; }
          .leave-content{ padding:24px 32px 40px !important; }
          .leave-sidebar-profile{ padding:28px 24px 20px; border-bottom:1px solid rgba(255,255,255,0.1); }
          .leave-sidebar-nav{ flex:1; padding:16px 12px; display:flex; flex-direction:column; gap:4px; }
          .leave-sidebar-nav-item{ display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; cursor:pointer; border:none; background:none; font-family:inherit; font-size:15px; font-weight:500; color:rgba(255,255,255,0.6); width:100%; text-align:left; transition:all 0.2s; }
          .leave-sidebar-nav-item:hover{ background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.9); }
          .leave-sidebar-nav-item.active{ background:linear-gradient(135deg,${C.gold}30,${C.gold}15); color:${C.goldLt}; font-weight:700; border:1px solid ${C.gold}40; }
          .leave-sidebar-footer{ padding:16px 24px; border-top:1px solid rgba(255,255,255,0.1); }
          .leave-desktop-header{ background:linear-gradient(160deg,${C.maroonDk} 0%,${C.maroon} 55%,${C.maroonLt} 100%); padding:20px 32px; position:relative; overflow:hidden; flex-shrink:0; }
        }
        @media(max-width:767px){
          .leave-sidebar{ display:none !important; }
          .leave-desktop-header{ display:none !important; }
          .leave-bottom-nav{
            display:flex !important;
            position:fixed !important;
            bottom:0;
            left:50%;
            transform:translateX(-50%);
            width:100%;
            max-width:430px;
            z-index:100;
          }
          .leave-content{ padding-bottom:90px !important; }
        }
      `}</style>

      <div className="leave-app-root">

        {/* ══ SIDEBAR (desktop only) ══ */}
        <div className="leave-sidebar">
          {/* Mosaic bg */}
          <svg style={{position:"absolute",top:0,right:0,height:"100%",width:"70%",pointerEvents:"none",opacity:0.6}} viewBox="0 0 220 500" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E8C87A" stopOpacity="0.18"/><stop offset="100%" stopColor="#C9973A" stopOpacity="0.04"/></linearGradient>
              <linearGradient id="sg2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#E8C87A" stopOpacity="0.22"/><stop offset="100%" stopColor="#9B3030" stopOpacity="0.06"/></linearGradient>
            </defs>
            {[0,80,160,240,320,400].map(y=>[
              <polygon key={`a${y}`} points={`80,${y} 140,${y} 110,${y+40}`} fill="url(#sg1)"/>,
              <polygon key={`b${y}`} points={`140,${y} 220,${y} 220,${y+55} 175,${y+30}`} fill="url(#sg2)"/>,
              <polygon key={`c${y}`} points={`110,${y+40} 175,${y+30} 160,${y+75} 95,${y+70}`} fill="url(#sg1)"/>,
            ])}
          </svg>

          {/* Brand */}
          <div className="leave-sidebar-profile" style={{position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              {/* Long-press target — same as mobile */}
              <div onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold}
                onTouchStart={startHold} onTouchEnd={endHold}
                style={{position:"relative",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"default",userSelect:"none",flexShrink:0}}>
                {holding&&(
                  <svg style={{position:"absolute",inset:-8,width:44,height:44,pointerEvents:"none"}} viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="19" fill="none" stroke={C.goldLt} strokeWidth="2.5" strokeOpacity="0.25"/>
                    <circle cx="22" cy="22" r="19" fill="none" stroke={C.goldLt} strokeWidth="2.5"
                      strokeLinecap="round" strokeDasharray="119.38" strokeDashoffset="119.38"
                      transform="rotate(-90 22 22)"
                      onAnimationEnd={onRingComplete}
                      style={{animation:"ringFillSide 5s linear forwards"}}/>
                  </svg>
                )}
                <Diamond size={18} color={holding?"#fff":C.goldLt}/>
              </div>
              <div>
                <div style={{color:C.goldLt,fontWeight:800,fontSize:16,lineHeight:1}}>ห้างเพชรทองมุกดา</div>
                <div style={{color:C.goldLt+"70",fontSize:11,marginTop:2}}>ระบบพนักงาน</div>
              </div>
            </div>
            {/* Profile */}
            {profile && (
              <button onClick={()=>setShowEditProfile(true)} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.08)",border:`1px solid ${C.goldLt}25`,borderRadius:14,padding:"10px 14px",width:"100%",cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
                <AvatarCircle av={profile.av} avType={profile.avType} img={profile.img} size={40} fontSize={14} border={`2px solid ${C.goldLt}50`}/>
                <div style={{textAlign:"left",flex:1,minWidth:0}}>
                  <div style={{color:C.white,fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{profile.name}</div>
                  <div style={{color:C.goldLt+"80",fontSize:12,marginTop:1}}>{profile.role}</div>
                </div>
                <div style={{flexShrink:0,width:36,height:36,borderRadius:9,background:`${C.goldLt}25`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
              </button>
            )}
            {!profile && (
              <button onClick={()=>setShowEditProfile(true)} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.08)",border:`1.5px dashed ${C.goldLt}50`,borderRadius:14,padding:"10px 14px",width:"100%",cursor:"pointer",fontFamily:"inherit"}}>
                <span style={{fontSize:22}}>👤</span>
                <span style={{color:C.goldLt,fontSize:14,fontWeight:600}}>ตั้งค่าโปรไฟล์</span>
              </button>
            )}
          </div>

          {/* Nav */}
          <div className="leave-sidebar-nav">
            {NAV.map(n=>{
              const active=tab===n.id, isAdminTab=n.id==="admin";
              return(
                <button key={n.id} onClick={()=>goTab(n.id)}
                  className={`leave-sidebar-nav-item${active?" active":""}`}
                  style={{color: active?(isAdminTab?C.goldLt:C.goldLt):"rgba(255,255,255,0.55)"}}>
                  <span>{n.icon(active)}</span>
                  <span>{n.label}</span>
                  {active && <div style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:C.gold}}/>}
                </button>
              );
            })}
          </div>

          {/* hold hint */}
          <div className="leave-sidebar-footer" style={{position:"relative"}}>
            <button onClick={authSignOut} style={{width:"100%",padding:"10px 16px",borderRadius:10,border:`1px solid rgba(255,255,255,0.15)`,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.2s",marginBottom:12}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.12)";e.currentTarget.style.color="rgba(255,255,255,0.8)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.5)"}}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              ออกจากระบบ
            </button>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",textAlign:"center"}}>
              Haangpetchthongmukda Co., Ltd
            </div>
          </div>
        </div>

        {/* ══ MAIN CONTENT ══ */}
        <div className="leave-main">

          {/* Desktop top bar */}
          <div className="leave-desktop-header" style={{position:"relative",overflow:"hidden"}}>
            <svg style={{position:"absolute",top:0,right:0,height:"100%",width:"54%",pointerEvents:"none"}} viewBox="0 0 220 160" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="dh1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E8C87A" stopOpacity="0.22"/><stop offset="100%" stopColor="#C9973A" stopOpacity="0.06"/></linearGradient>
                <linearGradient id="dh2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#E8C87A" stopOpacity="0.28"/><stop offset="100%" stopColor="#9B3030" stopOpacity="0.08"/></linearGradient>
              </defs>
              {[["110,0 140,0 125,22","dh2"],["140,0 175,0 175,28 155,14","dh1"],["175,0 220,0 220,35 195,18","dh2"],["110,0 125,22 100,38 85,18","dh1"],["125,22 155,14 160,40 130,50","dh2"],["155,14 175,28 170,52 145,44","dh1"],["175,28 195,18 210,48 185,58","dh2"],["195,18 220,35 220,62 205,55","dh1"]].map(([p,g],i)=>(
                <polygon key={i} points={p} fill={`url(#${g})`}/>
              ))}
            </svg>
            <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{color:C.white,fontWeight:700,fontSize:22}}>{tab==="home"?"หน้าแรก":pageTitle[tab]}</div>
                {tab==="home"&&profile&&<div style={{color:C.goldLt+"90",fontSize:14,marginTop:2}}>สวัสดีค่ะ คุณ{profile.name}</div>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>setShowManual(true)} title="กฏการคำนวณต่างๆ"
                  style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
                    borderRadius:10,border:`1px solid ${C.goldLt}40`,
                    background:"rgba(255,255,255,0.12)",cursor:"pointer",
                    color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:600,
                    flexShrink:0,whiteSpace:"nowrap"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  กฏการคำนวณต่างๆ
                </button>
                <div style={{fontSize:13,color:C.goldLt+"80"}}>
                  {new Date().toLocaleDateString("th-TH",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                </div>
              </div>
            </div>
          </div>

        {/* ── Mobile Header ── */}
        <div className="leave-header-mobile" style={{background:`linear-gradient(160deg,${C.maroonDk} 0%,${C.maroon} 55%,${C.maroonLt} 100%)`,padding:"20px 20px 0",flexShrink:0,position:"relative",overflow:"hidden"}}>

          {/* Mosaic decoration – right side */}
          <svg style={{position:"absolute",top:0,right:0,height:"100%",width:"54%",pointerEvents:"none",opacity:1}} viewBox="0 0 220 160" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="mg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E8C87A" stopOpacity="0.22"/><stop offset="100%" stopColor="#C9973A" stopOpacity="0.06"/></linearGradient>
              <linearGradient id="mg2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#E8C87A" stopOpacity="0.30"/><stop offset="100%" stopColor="#9B3030" stopOpacity="0.08"/></linearGradient>
              <linearGradient id="mg3" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#C9973A" stopOpacity="0.18"/><stop offset="100%" stopColor="#E8C87A" stopOpacity="0.35"/></linearGradient>
            </defs>
            {/* row 0 */}
            <polygon points="110,0 140,0 125,22" fill="url(#mg2)"/>
            <polygon points="140,0 175,0 175,28 155,14" fill="url(#mg1)"/>
            <polygon points="175,0 220,0 220,35 195,18" fill="url(#mg3)"/>
            <polygon points="195,18 220,35 220,0" fill="url(#mg2)" opacity="0.5"/>
            {/* row 1 */}
            <polygon points="110,0 125,22 100,38 85,18" fill="url(#mg1)"/>
            <polygon points="125,22 155,14 160,40 130,50" fill="url(#mg3)"/>
            <polygon points="155,14 175,28 170,52 145,44" fill="url(#mg2)"/>
            <polygon points="175,28 195,18 210,48 185,58" fill="url(#mg1)"/>
            <polygon points="195,18 220,35 220,62 205,55" fill="url(#mg3)"/>
            {/* row 2 */}
            <polygon points="85,18 100,38 80,56 65,38" fill="url(#mg3)"/>
            <polygon points="100,38 130,50 118,72 92,62" fill="url(#mg2)"/>
            <polygon points="130,50 145,44 158,68 138,78" fill="url(#mg1)"/>
            <polygon points="145,44 170,52 168,76 148,82" fill="url(#mg3)"/>
            <polygon points="170,52 185,58 188,82 168,76" fill="url(#mg2)"/>
            <polygon points="185,58 205,55 215,80 192,88" fill="url(#mg1)"/>
            <polygon points="205,55 220,62 220,90 210,84" fill="url(#mg3)"/>
            {/* row 3 */}
            <polygon points="65,38 80,56 68,76 52,58" fill="url(#mg2)"/>
            <polygon points="80,56 92,62 88,84 72,78" fill="url(#mg1)"/>
            <polygon points="92,62 118,72 110,96 88,84" fill="url(#mg3)"/>
            <polygon points="118,72 138,78 132,102 112,96" fill="url(#mg2)"/>
            <polygon points="138,78 148,82 150,106 134,102" fill="url(#mg1)"/>
            <polygon points="148,82 168,76 172,100 150,106" fill="url(#mg3)"/>
            <polygon points="168,76 188,82 188,108 170,104" fill="url(#mg2)"/>
            <polygon points="188,82 192,88 220,95 220,118 192,112" fill="url(#mg1)"/>
            {/* row 4 */}
            <polygon points="52,58 68,76 55,98 40,78" fill="url(#mg1)"/>
            <polygon points="68,76 72,78 75,102 58,98" fill="url(#mg3)"/>
            <polygon points="72,78 88,84 88,108 70,104" fill="url(#mg2)"/>
            <polygon points="88,84 110,96 105,120 85,110" fill="url(#mg1)"/>
            <polygon points="110,96 112,96 118,120 102,124" fill="url(#mg3)"/>
            <polygon points="112,96 132,102 128,126 112,124" fill="url(#mg2)"/>
            <polygon points="132,102 150,106 148,130 130,128" fill="url(#mg1)"/>
            <polygon points="150,106 170,104 172,128 150,130" fill="url(#mg3)"/>
            <polygon points="170,104 188,108 190,132 172,128" fill="url(#mg2)"/>
            <polygon points="188,108 220,118 220,142 192,136" fill="url(#mg1)"/>
            {/* row 5 – bottom fade */}
            <polygon points="40,78 55,98 45,118 30,100" fill="url(#mg3)" opacity="0.6"/>
            <polygon points="55,98 58,98 60,120 45,118" fill="url(#mg2)" opacity="0.6"/>
            <polygon points="58,98 70,104 68,128 52,120" fill="url(#mg1)" opacity="0.6"/>
            <polygon points="70,104 85,110 82,134 65,128" fill="url(#mg3)" opacity="0.55"/>
            <polygon points="85,110 102,124 98,148 80,138" fill="url(#mg2)" opacity="0.5"/>
            <polygon points="102,124 128,126 122,150 100,148" fill="url(#mg1)" opacity="0.45"/>
            <polygon points="128,126 148,130 144,154 126,150" fill="url(#mg3)" opacity="0.4"/>
            <polygon points="148,130 172,128 170,155 148,158" fill="url(#mg2)" opacity="0.35"/>
            <polygon points="172,128 192,136 190,158 170,160" fill="url(#mg1)" opacity="0.3"/>
            <polygon points="192,136 220,142 220,160 192,160" fill="url(#mg3)" opacity="0.25"/>
            {/* subtle edge shimmer */}
            <polygon points="200,0 220,0 220,20" fill="#E8C87A" opacity="0.12"/>
            <line x1="110" y1="0" x2="220" y2="80" stroke="#E8C87A" strokeWidth="0.4" opacity="0.15"/>
            <line x1="130" y1="0" x2="220" y2="60" stroke="#E8C87A" strokeWidth="0.3" opacity="0.10"/>
          </svg>

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {tab==="home"?(
                <div style={{display:"flex",alignItems:"center",gap:10,userSelect:"none",WebkitUserSelect:"none"}}>
                  {/* Long-press ONLY on diamond */}
                  <div onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold} onTouchStart={startHold} onTouchEnd={endHold}
                    style={{position:"relative",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                    {holding&&(
                      <svg style={{position:"absolute",inset:-8,width:48,height:48,pointerEvents:"none"}}
                        viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="21" fill="none"
                          stroke={C.goldLt} strokeWidth="3" strokeOpacity="0.2"/>
                        <circle cx="24" cy="24" r="21" fill="none"
                          stroke={C.goldLt} strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray="131.95"
                          strokeDashoffset="131.95"
                          transform="rotate(-90 24 24)"
                          onAnimationEnd={onRingComplete}
                          style={{animation:"ringFill 5s linear forwards"}}/>
                      </svg>
                    )}
                    <Diamond size={20} color={holding ? "#fff" : C.goldLt}/>
                  </div>
                  <div>
                    <div style={{color:C.goldLt,fontWeight:800,fontSize:18,lineHeight:1,letterSpacing:"0.01em"}}>ห้างเพชรทองมุกดา</div>
                    <div style={{color:C.goldLt+"80",fontSize:11,letterSpacing:"0.04em",marginTop:1}}>ระบบพนักงาน</div>
                  </div>
                </div>
              ):(<div style={{color:C.white,fontWeight:700,fontSize:19}}>{pageTitle[tab]}</div>)}
            </div>
            {tab==="home"&&(
              <button onClick={()=>setShowManual(true)} title="กฏการคำนวณต่างๆ"
                style={{display:"flex",alignItems:"center",gap:6,padding:"7px 11px",
                  borderRadius:10,border:`1px solid ${C.goldLt}40`,
                  background:"rgba(255,255,255,0.12)",cursor:"pointer",
                  color:"#fff",fontFamily:"inherit",fontSize:11,fontWeight:600,
                  flexShrink:0,whiteSpace:"nowrap"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                กฏการคำนวณ
              </button>
            )}
            {tab!=="home"&&<div style={{width:36,height:36}}/>}
          </div>

          {/* profile strip */}
          {tab==="home"&&(
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,position:"relative"}}>
              {profile ? (
                <button onClick={()=>setShowEditProfile(true)} style={{background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"center",gap:14,flex:1}}>
                  <AvatarCircle av={profile.av} avType={profile.avType} img={profile.img} size={56} fontSize={18} border={`2.5px solid ${C.goldLt}50`}/>
                  <div style={{textAlign:"left"}}>
                    <div style={{color:C.goldLt+"80",fontSize:13}}>สวัสดีค่ะ</div>
                    <div style={{color:C.white,fontWeight:700,fontSize:20,lineHeight:1.15}}>{profile.name}</div>
                    <div style={{color:C.goldLt+"90",fontSize:13,marginTop:2}}>{profile.role}</div>
                  </div>
                  <div style={{marginLeft:"auto",width:40,height:40,borderRadius:10,background:`${C.goldLt}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </div>
                </button>
              ):(
                <button onClick={()=>setShowEditProfile(true)} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.12)",border:`1.5px dashed ${C.goldLt}60`,borderRadius:14,padding:"12px 16px",cursor:"pointer",flex:1,fontFamily:"inherit"}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>👤</div>
                  <div style={{textAlign:"left"}}>
                    <div style={{color:C.goldLt,fontWeight:700,fontSize:15}}>ตั้งค่าโปรไฟล์ของคุณ</div>
                    <div style={{color:C.goldLt+"80",fontSize:12,marginTop:2}}>กรอกชื่อและเลือกรูปโปรไฟล์</div>
                  </div>
                </button>
              )}
            </div>
          )}
          {tab!=="home"&&<div style={{height:8}}/>}
          <div style={{height:2,background:`linear-gradient(90deg,transparent,${C.gold}80,transparent)`}}/>
        </div>

          {/* ── Scrollable Body ── */}
          <div className="leave-content" style={{flex:1,padding:"18px 16px 90px"}}>

          {/* HOME */}
          {tab==="home"&&(
            <>
              {/* Monthly quota card */}
              {(() => {
                const now = new Date();
                const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
                const usedThisMonth = profile
                  ? allLeaves.filter(lv => lv.empName===profile.name && lv.start.startsWith(ym)).length
                  : 0;
                const quota = 2;
                const remaining = quota - usedThisMonth;
                const overQ = remaining < 0;
                const pct = Math.min(100, (usedThisMonth/quota)*100);
                return (
                  <div style={{background:C.white,borderRadius:18,padding:"18px 20px",boxShadow:"0 2px 14px rgba(90,30,10,0.08)",border:`1.5px solid ${overQ?C.red+"50":C.border}`,marginBottom:12}}>
                    {/* title row */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                      <div>
                        <div style={{fontWeight:700,color:C.maroon,fontSize:16}}>โควต้าการลาเดือนนี้</div>
                        <div style={{fontSize:12,color:C.textSoft,marginTop:2}}>{now.toLocaleDateString("th-TH",{month:"long",year:"numeric"})}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:13,color:C.textSoft}}>ใช้ไปแล้ว</div>
                        <div style={{fontSize:26,fontWeight:800,color:overQ?C.red:usedThisMonth>=quota?C.amber:C.maroon,lineHeight:1}}>
                          {usedThisMonth}<span style={{fontSize:14,color:C.textSoft,fontWeight:500}}>/{quota} ครั้ง</span>
                        </div>
                      </div>
                    </div>

                    {/* progress dots */}
                    <div style={{display:"flex",gap:10,marginBottom:14}}>
                      {Array.from({length:quota}).map((_,i)=>{
                        const filled = i < usedThisMonth;
                        const overFill = usedThisMonth > quota && i < usedThisMonth;
                        return(
                          <div key={i} style={{flex:1,height:10,borderRadius:6,
                            background: filled ? (overQ?C.red:`linear-gradient(90deg,${C.gold},${C.goldLt})`) : C.creamDk,
                            boxShadow: filled ? `0 2px 6px ${overQ?C.red:C.gold}50` : "none",
                            transition:"all 0.3s"}}/>
                        );
                      })}
                    </div>

                    {/* status chips */}
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {remaining > 0 && (
                        <div style={{background:C.greenLt,borderRadius:20,padding:"5px 14px",display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>✅</span>
                          <span style={{fontSize:13,fontWeight:600,color:C.green}}>ลาได้อีก {remaining} ครั้ง</span>
                        </div>
                      )}
                      {usedThisMonth === quota && (
                        <div style={{background:C.amberLt,borderRadius:20,padding:"5px 14px",display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>⚠️</span>
                          <span style={{fontSize:13,fontWeight:600,color:C.amber}}>ใช้ครบโควต้าแล้ว</span>
                        </div>
                      )}
                      {usedThisMonth > quota && (
                        <div style={{background:C.redLt,borderRadius:20,padding:"5px 14px",display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>🚨</span>
                          <span style={{fontSize:13,fontWeight:600,color:C.red}}>เกินโควต้า {usedThisMonth - quota} ครั้ง</span>
                        </div>
                      )}
                      <div style={{background:C.cream,borderRadius:20,padding:"5px 14px",display:"flex",alignItems:"center",gap:6,border:`1px solid ${C.border}`}}>
                        <span style={{fontSize:14}}>📋</span>
                        <span style={{fontSize:12,color:C.textMid}}>ลากิจ + ลาป่วย รวม 2 ครั้ง/เดือน</span>
                      </div>
                    </div>

                    {/* banner – แสดงตั้งแต่ครั้งที่ 2 เป็นต้นไป */}
                    {usedThisMonth >= quota && (
                      <div style={{marginTop:12,background:`linear-gradient(135deg,${C.red}10,${C.red}18)`,borderRadius:12,padding:"10px 14px",border:`1px solid ${C.red}30`,display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:20,flexShrink:0}}>💰</div>
                        <div style={{fontSize:13,color:C.red,fontWeight:600,lineHeight:1.5}}>
                          การลาต่อจากนี้ไป ‼️<br/>
                          <span style={{fontWeight:700}}>จะกระทบต่อเงินเดือน</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* leave type mini stats */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:6}}>
                {LEAVE_TYPES.map(lt=>{
                  const now2 = new Date();
                  const ym2 = `${now2.getFullYear()}-${String(now2.getMonth()+1).padStart(2,"0")}`;
                  const usedType = profile ? allLeaves.filter(lv=>lv.empName===profile.name&&lv.type===lt.id&&lv.start.startsWith(ym2)).length : 0;
                  return(
                    <div key={lt.id} style={{background:C.white,borderRadius:14,padding:"14px",boxShadow:"0 1px 6px rgba(90,30,10,0.06)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:36,height:36,borderRadius:10,background:lt.colorLt,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{lt.icon}</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:C.text}}>{lt.label}</div>
                        <div style={{fontSize:13,color:C.textSoft,marginTop:1}}>เดือนนี้ <b style={{color:lt.color}}>{usedType}</b> ครั้ง</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:12,color:C.textSoft,textAlign:"right",marginBottom:14}}>ข้อมูล ณ วันที่ {new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"})}</div>
              <TeamCalendar allLeaves={allLeaves} empDir={[...empDir, ...(profile&&!empDir.find(e=>e.name===profile.name)?[{id:"me",name:profile.name,av:profile.av,avType:profile.avType,img:profile.img}]:[])]}/>
            </>
          )}

          {/* REQUEST */}
          {tab==="request"&&!submitted&&(
            <div>
              <div style={{textAlign:"center",marginBottom:2}}><Diamond size={14}/></div>
              <GoldDivider/>

              {/* quota status in form — แสดงเสมอ แต่เปลี่ยน style ตามสถานะ */}
              {(() => {
                const now = new Date();
                const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
                const usedThisMonth = profile ? allLeaves.filter(lv=>lv.empName===profile.name&&lv.start.startsWith(ym)).length : 0;
                const rem = 2 - usedThisMonth;
                const overQuota = usedThisMonth >= 2;
                return (
                  <div style={{background: overQuota?"#FEF2F2":C.goldPale, borderRadius:12, padding:"12px 16px", marginBottom:20,
                    border:`1.5px solid ${overQuota?C.red+"50":C.gold+"50"}`, display:"flex", alignItems:"center", gap:12}}>
                    <div style={{fontSize:22}}>{overQuota?"⚠️":"📋"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14,color:overQuota?C.red:C.maroon}}>
                        {overQuota
                          ? "หมดโควต้าแล้ว - การลาครั้งต่อไปจะกระทบต่อเงินเดือน"
                          : `โควต้าเดือนนี้เหลือ ${rem} ครั้ง`}
                      </div>
                      <div style={{fontSize:12,color:C.textSoft,marginTop:2}}>ลากิจ + ลาป่วย รวม 2 ครั้ง/เดือน</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:20,fontWeight:800,color:overQuota?C.red:C.gold}}>{usedThisMonth}</div>
                      <div style={{fontSize:11,color:C.textSoft}}>/ 2 ครั้ง</div>
                    </div>
                  </div>
                );
              })()}

              <div style={{marginBottom:22}}>
                <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:12}}>ประเภทการลา</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {LEAVE_TYPES.map(lt=>(<LeaveTypeCard key={lt.id} lt={lt} selected={form.type} onClick={()=>setForm({...form,type:lt.id})} balance={balance[lt.id]||15} used={used[lt.id]||0}/>))}
                </div>
                {errors.type&&<div style={{color:C.red,fontSize:13,marginTop:8}}>⚠ {errors.type}</div>}
              </div>
              <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>วันที่เริ่มลา</div>
              <CalendarPicker value={form.startDate} onChange={v=>setForm(f=>({...f,startDate:v,endDate:f.endDate&&f.endDate<v?"":f.endDate}))} minDate={TODAY} error={errors.startDate}/>
              <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8,marginTop:4}}>วันที่สิ้นสุด</div>
              <CalendarPicker value={form.endDate} onChange={v=>setForm(f=>({...f,endDate:v}))} minDate={form.startDate||TODAY} error={errors.endDate}/>
              {days>0&&(
                <div style={{background:overLimit?C.redLt:C.goldPale,borderRadius:16,padding:"18px",border:`1.5px solid ${overLimit?C.red+"40":C.gold+"60"}`,margin:"14px 0",display:"flex",alignItems:"center",gap:16}}>
                  <div style={{width:50,height:50,borderRadius:14,flexShrink:0,background:overLimit?C.red+"18":`linear-gradient(135deg,${C.gold},${C.goldLt})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {overLimit?<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>:<Diamond size={22} color="#fff"/>}
                  </div>
                  <div>
                    <div style={{fontSize:14,color:C.textMid,marginBottom:2}}>รวมจำนวนวันทำการ</div>
                    <div style={{fontSize:28,fontWeight:800,color:overLimit?C.red:C.maroon,lineHeight:1.1}}>{days}<span style={{fontSize:16,fontWeight:600}}> วัน</span></div>
                    <div style={{fontSize:13,color:overLimit?C.red:C.textSoft,marginTop:2}}>{overLimit?`⚠ เกินสิทธิ์! คงเหลือ ${remain} วัน`:"(ไม่รวมวันเสาร์)"}</div>
                  </div>
                </div>
              )}
              {errors.over&&<div style={{color:C.red,fontSize:13,margin:"4px 0 10px"}}>⚠ {errors.over}</div>}

              <button onClick={submit} style={{width:"100%",padding:"17px",marginTop:6,background:`linear-gradient(135deg,${C.gold} 0%,${C.goldLt} 50%,${C.gold} 100%)`,color:C.maroonDk,border:"none",borderRadius:16,fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:`0 6px 20px ${C.gold}50`}}>
                <Diamond size={18} color={C.maroonDk}/>ยื่นคำขอลา
              </button>

              {/* ── ประวัติการลาของฉัน ── */}
              <div style={{marginTop:32}}>
                <div style={{textAlign:"center",marginBottom:2}}><Diamond size={14}/></div>
                <GoldDivider/>
                <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                  📋 ประวัติการลาของฉัน
                  <span style={{fontSize:12,color:C.textSoft,fontWeight:500,marginLeft:"auto"}}>{myLeaves.length} รายการ</span>
                </div>
                {myLeaves.length===0 && (
                  <div style={{textAlign:"center",color:C.textSoft,padding:"30px 0",fontSize:14,background:C.cream,borderRadius:14,border:`1px dashed ${C.border}`}}>
                    ยังไม่มีประวัติการลา
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[...myLeaves].sort((a,b)=>b.start.localeCompare(a.start)).map(h=>{
                    const lt=LEAVE_TYPES.find(t=>t.id===h.type);
                    return(
                      <div key={h.id} onClick={()=>setHistDetail(histDetail===h.id?null:h.id)}
                        style={{background:C.white,borderRadius:14,padding:"14px",
                          boxShadow:"0 2px 10px rgba(90,30,10,0.06)",border:`1px solid ${C.border}`,
                          display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer"}}>
                        <div style={{width:40,height:40,borderRadius:10,background:lt?.colorLt||C.creamDk,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                          {lt?.icon}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:3}}>{lt?.label}</div>
                          <div style={{fontSize:13,color:C.textMid}}>
                            {fmtDate(h.start)}{h.start!==h.end?` – ${fmtDate(h.end)}`:""} ({h.days} วันทำการ)
                          </div>
                          {histDetail===h.id&&(
                            <div style={{fontSize:12,color:C.textSoft,marginTop:6,paddingTop:6,borderTop:`1px dashed ${C.border}`}}>
                              📅 วันที่ยื่น: {h.submitted}
                            </div>
                          )}
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textSoft} strokeWidth="2" strokeLinecap="round"
                          style={{flexShrink:0,marginTop:4,transform:histDetail===h.id?"rotate(90deg)":"rotate(0)",transition:"transform 0.2s"}}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {tab==="request"&&submitted&&(
            <div style={{textAlign:"center",padding:"40px 0 20px"}}>
              <div style={{width:80,height:80,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:`0 8px 28px ${C.gold}45`}}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style={{color:C.maroon,fontWeight:800,fontSize:22,margin:"0 0 8px"}}>ส่งคำขอสำเร็จ!</h2>
              <p style={{color:C.textMid,fontSize:16,margin:"0 0 22px"}}>บันทึกรายการลาของคุณเรียบร้อยแล้ว</p>
              <div style={{background:C.goldPale,border:`1px solid ${C.gold}50`,borderRadius:16,padding:"16px 20px",margin:"0 auto 26px",display:"inline-block"}}>
                <div style={{fontSize:16,color:C.text,fontWeight:700}}>{LEAVE_TYPES.find(t=>t.id===form.type)?.label} · {fmtDate(form.startDate)}{form.startDate!==form.endDate?` – ${fmtDate(form.endDate)}`:""}</div>
                <div style={{fontSize:14,color:C.textMid,marginTop:4}}>{days} วันทำการ</div>
              </div><br/>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={reset} style={{padding:"13px 24px",background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,border:"none",borderRadius:14,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 14px ${C.gold}40`}}>+ ยื่นคำขอใหม่</button>
                <button onClick={()=>goTab("request")} style={{padding:"13px 24px",background:C.white,color:C.maroon,border:`1.5px solid ${C.gold}60`,borderRadius:14,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>ดูประวัติ</button>
              </div>
            </div>
          )}

          {/* HISTORY */}
          {/* SALARY (employee view) */}
          {tab==="salary"&&!salaryDisabled&&(
            <div style={{minHeight:"100%"}}>
              <SalaryView profile={profile} salaryData={salaryData} allLeaves={allLeaves} empDir={empDir}
                advanceRequests={advanceRequests.filter(r=>r.empId==="me")}
                onOpenAdvance={()=>setShowAdvanceModal(true)}
                onOpenHistory={()=>setShowHistoryModal(true)}
                roles={roles}/>
            </div>
          )}

          {/* ADMIN */}
          {tab==="admin"&&isAdmin&&(
            <AdminPanel allLeaves={allLeaves} empDir={empDir} onDelete={handleDelete}
              onLogout={()=>{setIsAdmin(false);goTab("home");showToast("ออกจากโหมด Admin แล้ว");}}
              onUpdateRole={handleUpdateRole}
              salaryData={salaryData} setSalaryData={setSalaryData}
              advanceRequests={advanceRequests} onUpdateAdvance={adminUpdateAdvance}
              roles={roles} setRoles={setRoles}
              payrollConfirms={payrollConfirms} setPayrollConfirms={setPayrollConfirms}
              showToast={showToast}/>
          )}
        </div>

        {/* ── Bottom nav (mobile only) ── */}
        <div className="leave-bottom-nav" style={{background:C.white,borderTop:`1px solid ${C.border}`,boxShadow:"0 -4px 20px rgba(90,30,10,0.10)",zIndex:100}}>
          {NAV.map(n=>{
            const active=tab===n.id, isAdminTab=n.id==="admin";
            return(
              <button key={n.id} onClick={()=>goTab(n.id)} style={{flex:1,padding:"10px 0 12px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:4,color:active?(isAdminTab?C.maroon:C.gold):C.textSoft,transition:"color 0.2s",position:"relative"}}>
                {active&&(<div style={{position:"absolute",top:0,width:36,height:2,background:isAdminTab?`linear-gradient(90deg,${C.maroon},${C.maroonLt})`:`linear-gradient(90deg,${C.gold},${C.goldLt})`,borderRadius:"0 0 4px 4px"}}/>)}
                <span style={{transition:"transform 0.15s",transform:active?"translateY(-1px)":"none"}}>{n.icon(active)}</span>
                <span style={{fontSize:11,fontWeight:active?700:500}}>{n.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modals */}
        {(showEditProfile||!profile)&&<ProfileSetupModal initial={profile} onSave={handleProfileSave} onClose={profile ? ()=>setShowEditProfile(false) : undefined}/>}
        {showPinModal&&<PinModal onSuccess={()=>{setShowPinModal(false);setIsAdmin(true);setTab("admin");showToast("เข้าสู่โหมดผู้ดูแลระบบแล้ว");}} onClose={()=>{setShowPinModal(false);setHolding(false);}}/>}

        {showAdvanceModal&&(
          <AdvanceRequestModal
            profile={profile}
            salaryData={salaryData}
            advanceRequests={advanceRequests.filter(r=>r.empId==="me")}
            onSubmit={submitAdvanceRequest}
            onClose={()=>setShowAdvanceModal(false)}
          />
        )}

        {showHistoryModal&&(
          <AdvanceHistoryModal
            advanceRequests={advanceRequests.filter(r=>r.empId==="me")}
            onClose={()=>setShowHistoryModal(false)}
          />
        )}

        {showManual&&<ManualModal onClose={()=>setShowManual(false)}/>}

        {/* Toast */}
        {toastMsg&&(<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:C.maroon,color:C.white,padding:"12px 22px",borderRadius:30,fontSize:14,fontWeight:600,fontFamily:"inherit",boxShadow:`0 6px 20px ${C.maroon}60`,zIndex:500,animation:"toastIn 0.25s ease",whiteSpace:"nowrap"}}>✓ {toastMsg}</div>)}
        </div>{/* end leave-main */}
      </div>{/* end leave-app-root */}
    </>
  );
}
