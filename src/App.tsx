import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "./contexts/AuthContext";

/* ─── Constants & seed data ────────────────────────────────────── */
import {
  C, TODAY,
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
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-cream font-sans">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-gold-lt flex items-center justify-center shadow-[0_6px_20px_rgba(201,151,58,0.31)] animate-[pulse_1.5s_ease-in-out_infinite]">
        <Diamond size={32} color={C.maroon}/>
      </div>
      <div className="mt-4.5 text-sm font-semibold text-maroon">
        {message}
      </div>
      <div className="mt-1.5 text-[11px] text-txt-soft">
        ห้างเพชรทองมุกดา
      </div>
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
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-cream font-sans">
        <div className="max-w-[400px] px-5 py-6 bg-white rounded-[18px] border border-red/25 text-center shadow-[0_8px_24px_rgba(192,57,43,0.12)]">
          <div className="text-[32px] mb-2">⚠️</div>
          <div className="text-base font-bold text-red mb-2">
            เชื่อมต่อข้อมูลไม่สำเร็จ
          </div>
          <div className="text-[13px] text-txt-mid leading-relaxed">
            {error.message || "ไม่ทราบสาเหตุ"}
          </div>
          <button onClick={()=>window.location.reload()} className="mt-4 px-5 py-2.5 rounded-[10px] border-none bg-maroon text-white font-bold cursor-pointer font-[inherit] text-sm">โหลดใหม่</button>
        </div>
      </div>
    );
  }

  return(
    <>
      {/* Styles moved to index.css — layout shell, keyframes, media queries */}

      <div className="leave-app-root">

        {/* ══ SIDEBAR (desktop only) ══ */}
        <div className="leave-sidebar">
          {/* Mosaic bg */}
          <svg className="absolute top-0 right-0 h-full w-[70%] pointer-events-none opacity-60" viewBox="0 0 220 500" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg">
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
          <div className="leave-sidebar-profile relative">
            <div className="flex items-center gap-2.5 mb-4">
              {/* Long-press target — same as mobile */}
              <div onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold}
                onTouchStart={startHold} onTouchEnd={endHold}
                className="relative w-7 h-7 flex items-center justify-center cursor-default select-none shrink-0">
                {holding&&(
                  <svg className="absolute -inset-2 w-11 h-11 pointer-events-none" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="19" fill="none" stroke={C.goldLt} strokeWidth="2.5" strokeOpacity="0.25"/>
                    <circle cx="22" cy="22" r="19" fill="none" stroke={C.goldLt} strokeWidth="2.5"
                      strokeLinecap="round" strokeDasharray="119.38" strokeDashoffset="119.38"
                      transform="rotate(-90 22 22)"
                      onAnimationEnd={onRingComplete}
                      className="animate-[ringFillSide_5s_linear_forwards]"/>
                  </svg>
                )}
                <Diamond size={18} color={holding?"#fff":C.goldLt}/>
              </div>
              <div>
                <div className="text-gold-lt font-extrabold text-base leading-none">ห้างเพชรทองมุกดา</div>
                <div className="text-gold-lt/45 text-[11px] mt-0.5">ระบบพนักงาน</div>
              </div>
            </div>
            {/* Profile */}
            {profile && (
              <button onClick={()=>setShowEditProfile(true)} className="flex items-center gap-3 bg-white/8 border border-gold-lt/15 rounded-[14px] px-3.5 py-2.5 w-full cursor-pointer font-[inherit] transition-all duration-200">
                <AvatarCircle av={profile.av} avType={profile.avType} img={profile.img} size={40} fontSize={14} border={`2px solid ${C.goldLt}50`}/>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate">{profile.name}</div>
                  <div className="text-gold-lt/50 text-xs mt-px">{profile.role}</div>
                </div>
                <div className="shrink-0 w-9 h-9 rounded-[9px] bg-gold-lt/15 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
              </button>
            )}
            {!profile && (
              <button onClick={()=>setShowEditProfile(true)} className="flex items-center gap-2.5 bg-white/8 border-[1.5px] border-dashed border-gold-lt/30 rounded-[14px] px-3.5 py-2.5 w-full cursor-pointer font-[inherit]">
                <span className="text-[22px]">👤</span>
                <span className="text-gold-lt text-sm font-semibold">ตั้งค่าโปรไฟล์</span>
              </button>
            )}
          </div>

          {/* Nav */}
          <div className="leave-sidebar-nav">
            {NAV.map(n=>{
              const active=tab===n.id, isAdminTab=n.id==="admin";
              return(
                <button key={n.id} onClick={()=>goTab(n.id)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 relative ${active ? "bg-white/12" : "bg-transparent"} ${active ? "text-gold-lt" : "text-white/55"}`}>
                  <span>{n.icon(active)}</span>
                  <span>{n.label}</span>
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold"/>}
                </button>
              );
            })}
          </div>

          {/* hold hint */}
          <div className="leave-sidebar-footer relative">
            <button onClick={authSignOut} className="w-full px-4 py-2.5 rounded-[10px] border border-white/15 bg-white/6 text-white/50 cursor-pointer font-[inherit] text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-200 mb-3 hover:bg-white/12 hover:text-white/80">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              ออกจากระบบ
            </button>
            <div className="text-[11px] text-white/25 text-center">
              Haangpetchthongmukda Co., Ltd
            </div>
          </div>
        </div>

        {/* ══ MAIN CONTENT ══ */}
        <div className="leave-main">

          {/* Desktop top bar */}
          <div className="leave-desktop-header relative overflow-hidden">
            <svg className="absolute top-0 right-0 h-full w-[54%] pointer-events-none" viewBox="0 0 220 160" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="dh1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E8C87A" stopOpacity="0.22"/><stop offset="100%" stopColor="#C9973A" stopOpacity="0.06"/></linearGradient>
                <linearGradient id="dh2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#E8C87A" stopOpacity="0.28"/><stop offset="100%" stopColor="#9B3030" stopOpacity="0.08"/></linearGradient>
              </defs>
              {[["110,0 140,0 125,22","dh2"],["140,0 175,0 175,28 155,14","dh1"],["175,0 220,0 220,35 195,18","dh2"],["110,0 125,22 100,38 85,18","dh1"],["125,22 155,14 160,40 130,50","dh2"],["155,14 175,28 170,52 145,44","dh1"],["175,28 195,18 210,48 185,58","dh2"],["195,18 220,35 220,62 205,55","dh1"]].map(([p,g],i)=>(
                <polygon key={i} points={p} fill={`url(#${g})`}/>
              ))}
            </svg>
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-white font-bold text-[22px]">{tab==="home"?"หน้าแรก":pageTitle[tab]}</div>
                {tab==="home"&&profile&&<div className="text-gold-lt/55 text-sm mt-0.5">สวัสดีค่ะ คุณ{profile.name}</div>}
              </div>
              <div className="flex items-center gap-2.5">
                <button onClick={()=>setShowManual(true)} title="กฏการคำนวณต่างๆ"
                  className="flex items-center gap-2 px-3 py-[7px] rounded-[10px] border border-gold-lt/25 bg-white/12 cursor-pointer text-white font-[inherit] text-xs font-semibold shrink-0 whitespace-nowrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  กฏการคำนวณต่างๆ
                </button>
                <div className="text-[13px] text-gold-lt/50">
                  {new Date().toLocaleDateString("th-TH",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                </div>
              </div>
            </div>
          </div>

        {/* ── Mobile Header ── */}
        <div className="leave-header-mobile bg-gradient-to-br from-maroon-dk via-maroon to-maroon-lt pt-5 px-5 pb-0 shrink-0 relative overflow-hidden">

          {/* Mosaic decoration – right side */}
          <svg className="absolute top-0 right-0 h-full w-[54%] pointer-events-none" viewBox="0 0 220 160" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg">
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

          <div className="flex items-center justify-between mb-4 relative">
            <div className="flex items-center gap-2.5">
              {tab==="home"?(
                <div className="flex items-center gap-2.5 select-none">
                  {/* Long-press ONLY on diamond */}
                  <div onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold} onTouchStart={startHold} onTouchEnd={endHold}
                    className="relative w-8 h-8 flex items-center justify-center cursor-pointer shrink-0">
                    {holding&&(
                      <svg className="absolute -inset-2 w-12 h-12 pointer-events-none"
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
                          className="animate-[ringFill_5s_linear_forwards]"/>
                      </svg>
                    )}
                    <Diamond size={20} color={holding ? "#fff" : C.goldLt}/>
                  </div>
                  <div>
                    <div className="text-gold-lt font-extrabold text-lg leading-none tracking-tight">ห้างเพชรทองมุกดา</div>
                    <div className="text-gold-lt/50 text-[11px] tracking-wider mt-px">ระบบพนักงาน</div>
                  </div>
                </div>
              ):(<div className="text-white font-bold text-[19px]">{pageTitle[tab]}</div>)}
            </div>
            {tab==="home"&&(
              <button onClick={()=>setShowManual(true)} title="กฏการคำนวณต่างๆ"
                className="flex items-center gap-1.5 px-[11px] py-[7px] rounded-[10px] border border-gold-lt/25 bg-white/12 cursor-pointer text-white font-[inherit] text-[11px] font-semibold shrink-0 whitespace-nowrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                กฏการคำนวณ
              </button>
            )}
            {tab!=="home"&&<div className="w-9 h-9"/>}
          </div>

          {/* profile strip */}
          {tab==="home"&&(
            <div className="flex items-center gap-3.5 mb-4.5 relative">
              {profile ? (
                <button onClick={()=>setShowEditProfile(true)} className="bg-transparent border-none p-0 cursor-pointer flex items-center gap-3.5 flex-1">
                  <AvatarCircle av={profile.av} avType={profile.avType} img={profile.img} size={56} fontSize={18} border={`2.5px solid ${C.goldLt}50`}/>
                  <div className="text-left">
                    <div className="text-gold-lt/50 text-[13px]">สวัสดีค่ะ</div>
                    <div className="text-white font-bold text-xl leading-[1.15]">{profile.name}</div>
                    <div className="text-gold-lt/55 text-[13px] mt-0.5">{profile.role}</div>
                  </div>
                  <div className="ml-auto w-10 h-10 rounded-[10px] bg-gold-lt/13 flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </div>
                </button>
              ):(
                <button onClick={()=>setShowEditProfile(true)} className="flex items-center gap-3 bg-white/12 border-[1.5px] border-dashed border-gold-lt/37 rounded-[14px] px-4 py-3 cursor-pointer flex-1 font-[inherit]">
                  <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-[22px]">👤</div>
                  <div className="text-left">
                    <div className="text-gold-lt font-bold text-[15px]">ตั้งค่าโปรไฟล์ของคุณ</div>
                    <div className="text-gold-lt/50 text-xs mt-0.5">กรอกชื่อและเลือกรูปโปรไฟล์</div>
                  </div>
                </button>
              )}
            </div>
          )}
          {tab!=="home"&&<div className="h-2"/>}
          <div className="h-0.5 bg-gold-divider"/>
        </div>

          {/* ── Scrollable Body ── */}
          <div className="leave-content flex-1 px-4 pt-4.5 pb-[90px]">

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
                  <div className={`bg-white rounded-[18px] px-5 py-4.5 shadow-[0_2px_14px_rgba(90,30,10,0.08)] mb-3 border-[1.5px] ${overQ ? "border-[#C0392B50]" : "border-bdr"}`}>
                    {/* title row */}
                    <div className="flex items-center justify-between mb-3.5">
                      <div>
                        <div className="font-bold text-maroon text-base">โควต้าการลาเดือนนี้</div>
                        <div className="text-xs text-txt-soft mt-0.5">{now.toLocaleDateString("th-TH",{month:"long",year:"numeric"})}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] text-txt-soft">ใช้ไปแล้ว</div>
                        <div className={`text-[26px] font-extrabold leading-none ${overQ ? "text-red" : usedThisMonth>=quota ? "text-amber" : "text-maroon"}`}>
                          {usedThisMonth}<span className="text-sm text-txt-soft font-medium">/{quota} ครั้ง</span>
                        </div>
                      </div>
                    </div>

                    {/* progress dots */}
                    <div className="flex gap-2.5 mb-3.5">
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
                    <div className="flex gap-2 flex-wrap">
                      {remaining > 0 && (
                        <div className="bg-green-lt rounded-[20px] px-3.5 py-[5px] flex items-center gap-1.5">
                          <span className="text-sm">✅</span>
                          <span className="text-[13px] font-semibold text-green">ลาได้อีก {remaining} ครั้ง</span>
                        </div>
                      )}
                      {usedThisMonth === quota && (
                        <div className="bg-amber-lt rounded-[20px] px-3.5 py-[5px] flex items-center gap-1.5">
                          <span className="text-sm">⚠️</span>
                          <span className="text-[13px] font-semibold text-amber">ใช้ครบโควต้าแล้ว</span>
                        </div>
                      )}
                      {usedThisMonth > quota && (
                        <div className="bg-red-lt rounded-[20px] px-3.5 py-[5px] flex items-center gap-1.5">
                          <span className="text-sm">🚨</span>
                          <span className="text-[13px] font-semibold text-red">เกินโควต้า {usedThisMonth - quota} ครั้ง</span>
                        </div>
                      )}
                      <div className="bg-cream rounded-[20px] px-3.5 py-[5px] flex items-center gap-1.5 border border-bdr">
                        <span className="text-sm">📋</span>
                        <span className="text-xs text-txt-mid">ลากิจ + ลาป่วย รวม 2 ครั้ง/เดือน</span>
                      </div>
                    </div>

                    {/* banner – แสดงตั้งแต่ครั้งที่ 2 เป็นต้นไป */}
                    {usedThisMonth >= quota && (
                      <div className="mt-3 bg-gradient-to-br from-red/6 to-red/9 rounded-xl px-3.5 py-2.5 border border-red/19 flex items-center gap-2.5">
                        <div className="text-xl shrink-0">💰</div>
                        <div className="text-[13px] text-red font-semibold leading-relaxed">
                          การลาต่อจากนี้ไป ‼️<br/>
                          <span className="font-bold">จะกระทบต่อเงินเดือน</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* leave type mini stats */}
              <div className="grid grid-cols-2 gap-2.5 mb-1.5">
                {LEAVE_TYPES.map(lt=>{
                  const now2 = new Date();
                  const ym2 = `${now2.getFullYear()}-${String(now2.getMonth()+1).padStart(2,"0")}`;
                  const usedType = profile ? allLeaves.filter(lv=>lv.empName===profile.name&&lv.type===lt.id&&lv.start.startsWith(ym2)).length : 0;
                  return(
                    <div className="bg-white rounded-[14px] p-3.5 shadow-[0_1px_6px_rgba(90,30,10,0.06)] border border-bdr flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[19px] shrink-0" style={{background:lt.colorLt}}>{lt.icon}</div>
                      <div>
                        <div className="text-sm font-semibold text-txt">{lt.label}</div>
                        <div className="text-[13px] text-txt-soft mt-px">เดือนนี้ <b style={{color:lt.color}}>{usedType}</b> ครั้ง</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-txt-soft text-right mb-3.5">ข้อมูล ณ วันที่ {new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"})}</div>
              <TeamCalendar allLeaves={allLeaves} empDir={[...empDir, ...(profile&&!empDir.find(e=>e.name===profile.name)?[{id:"me",name:profile.name,av:profile.av,avType:profile.avType,img:profile.img}]:[])]}/>
            </>
          )}

          {/* REQUEST */}
          {tab==="request"&&!submitted&&(
            <div>
              <div className="text-center mb-0.5"><Diamond size={14}/></div>
              <GoldDivider/>

              {/* quota status in form — แสดงเสมอ แต่เปลี่ยน style ตามสถานะ */}
              {(() => {
                const now = new Date();
                const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
                const usedThisMonth = profile ? allLeaves.filter(lv=>lv.empName===profile.name&&lv.start.startsWith(ym)).length : 0;
                const rem = 2 - usedThisMonth;
                const overQuota = usedThisMonth >= 2;
                return (
                  <div className={`rounded-xl px-4 py-3 mb-5 flex items-center gap-3 border-[1.5px] ${overQuota ? "bg-[#FEF2F2] border-[#C0392B50]" : "bg-gold-pale border-[#C9973A50]"}`}>
                    <div className="text-[22px]">{overQuota?"⚠️":"📋"}</div>
                    <div className="flex-1">
                      <div className={`font-bold text-sm ${overQuota ? "text-red" : "text-maroon"}`}>
                        {overQuota
                          ? "หมดโควต้าแล้ว - การลาครั้งต่อไปจะกระทบต่อเงินเดือน"
                          : `โควต้าเดือนนี้เหลือ ${rem} ครั้ง`}
                      </div>
                      <div className="text-xs text-txt-soft mt-0.5">ลากิจ + ลาป่วย รวม 2 ครั้ง/เดือน</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xl font-extrabold ${overQuota ? "text-red" : "text-gold"}`}>{usedThisMonth}</div>
                      <div className="text-[11px] text-txt-soft">/ 2 ครั้ง</div>
                    </div>
                  </div>
                );
              })()}

              <div className="mb-5.5">
                <div className="text-base font-bold text-txt mb-3">ประเภทการลา</div>
                <div className="grid grid-cols-2 gap-3">
                  {LEAVE_TYPES.map(lt=>(<LeaveTypeCard key={lt.id} lt={lt} selected={form.type} onClick={()=>setForm({...form,type:lt.id})} balance={balance[lt.id]||15} used={used[lt.id]||0}/>))}
                </div>
                {errors.type&&<div className="text-red text-[13px] mt-2">⚠ {errors.type}</div>}
              </div>
              <div className="text-base font-bold text-txt mb-2">วันที่เริ่มลา</div>
              <CalendarPicker value={form.startDate} onChange={v=>setForm(f=>({...f,startDate:v,endDate:f.endDate&&f.endDate<v?"":f.endDate}))} minDate={TODAY} error={errors.startDate}/>
              <div className="text-base font-bold text-txt mb-2 mt-1">วันที่สิ้นสุด</div>
              <CalendarPicker value={form.endDate} onChange={v=>setForm(f=>({...f,endDate:v}))} minDate={form.startDate||TODAY} error={errors.endDate}/>
              {days>0&&(
                <div className={`rounded-2xl p-4.5 my-3.5 flex items-center gap-4 border-[1.5px] ${overLimit ? "bg-red-lt border-[#C0392B40]" : "bg-gold-pale border-[#C9973A60]"}`}>
                  <div className={`w-[50px] h-[50px] rounded-[14px] shrink-0 flex items-center justify-center ${overLimit ? "bg-[#C0392B18]" : "bg-linear-135 from-gold to-gold-lt"}`}>
                    {overLimit?<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>:<Diamond size={22} color="#fff"/>}
                  </div>
                  <div>
                    <div className="text-sm text-txt-mid mb-0.5">รวมจำนวนวันทำการ</div>
                    <div className={`text-[28px] font-extrabold leading-[1.1] ${overLimit ? "text-red" : "text-maroon"}`}>{days}<span className="text-base font-semibold"> วัน</span></div>
                    <div className={`text-[13px] mt-0.5 ${overLimit ? "text-red" : "text-txt-soft"}`}>{overLimit?`⚠ เกินสิทธิ์! คงเหลือ ${remain} วัน`:"(ไม่รวมวันเสาร์)"}</div>
                  </div>
                </div>
              )}
              {errors.over&&<div className="text-red text-[13px] mx-0 mt-1 mb-2.5">⚠ {errors.over}</div>}

              <button onClick={submit} className="w-full p-[17px] mt-1.5 border-none rounded-2xl text-lg font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-2.5 bg-gradient-to-br from-gold via-gold-lt to-gold text-maroon-dk shadow-[0_6px_20px_rgba(201,151,58,0.31)]">
                <Diamond size={18} color={C.maroonDk}/>ยื่นคำขอลา
              </button>

              {/* ── ประวัติการลาของฉัน ── */}
              <div className="mt-8">
                <div className="text-center mb-0.5"><Diamond size={14}/></div>
                <GoldDivider/>
                <div className="text-base font-bold text-txt mb-3.5 flex items-center gap-2">
                  📋 ประวัติการลาของฉัน
                  <span className="text-xs text-txt-soft font-medium ml-auto">{myLeaves.length} รายการ</span>
                </div>
                {myLeaves.length===0 && (
                  <div className="text-center text-txt-soft py-7.5 text-sm bg-cream rounded-[14px] border border-dashed border-bdr">
                    ยังไม่มีประวัติการลา
                  </div>
                )}
                <div className="flex flex-col gap-2.5">
                  {[...myLeaves].sort((a,b)=>b.start.localeCompare(a.start)).map(h=>{
                    const lt=LEAVE_TYPES.find(t=>t.id===h.type);
                    return(
                      <div key={h.id} onClick={()=>setHistDetail(histDetail===h.id?null:h.id)}
                        className="bg-white rounded-[14px] p-3.5 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr flex items-start gap-3 cursor-pointer">
                        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-xl shrink-0" style={{background:lt?.colorLt||C.creamDk}}>
                          {lt?.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-txt text-[15px] mb-0.5">{lt?.label}</div>
                          <div className="text-[13px] text-txt-mid">
                            {fmtDate(h.start)}{h.start!==h.end?` – ${fmtDate(h.end)}`:""} ({h.days} วันทำการ)
                          </div>
                          {histDetail===h.id&&(
                            <div className="text-xs text-txt-soft mt-1.5 pt-1.5 border-t border-dashed border-bdr">
                              📅 วันที่ยื่น: {h.submitted}
                            </div>
                          )}
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textSoft} strokeWidth="2" strokeLinecap="round"
                          className={`shrink-0 mt-1 transition-transform duration-200 ${histDetail===h.id ? "rotate-90" : "rotate-0"}`}>
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
            <div className="text-center pt-10 pb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold to-gold-lt flex items-center justify-center mx-auto mb-5 shadow-[0_8px_28px_rgba(201,151,58,0.27)]">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-maroon font-extrabold text-[22px] m-0 mb-2">ส่งคำขอสำเร็จ!</h2>
              <p className="text-txt-mid text-base m-0 mb-5.5">บันทึกรายการลาของคุณเรียบร้อยแล้ว</p>
              <div className="bg-gold-pale border border-gold/30 rounded-2xl px-5 py-4 mx-auto mb-6.5 inline-block">
                <div className="text-base text-txt font-bold">{LEAVE_TYPES.find(t=>t.id===form.type)?.label} · {fmtDate(form.startDate)}{form.startDate!==form.endDate?` – ${fmtDate(form.endDate)}`:""}</div>
                <div className="text-sm text-txt-mid mt-1">{days} วันทำการ</div>
              </div><br/>
              <div className="flex gap-2.5 justify-center flex-wrap">
                <button onClick={reset} className="px-6 py-3.5 bg-gradient-to-br from-gold to-gold-lt text-maroon-dk border-none rounded-[14px] text-base font-bold cursor-pointer font-[inherit] shadow-[0_4px_14px_rgba(201,151,58,0.25)]">+ ยื่นคำขอใหม่</button>
                <button onClick={()=>goTab("request")} className="px-6 py-3.5 bg-white text-maroon border-[1.5px] border-gold/37 rounded-[14px] text-base font-bold cursor-pointer font-[inherit]">ดูประวัติ</button>
              </div>
            </div>
          )}

          {/* HISTORY */}
          {/* SALARY (employee view) */}
          {tab==="salary"&&!salaryDisabled&&(
            <div className="min-h-full">
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
        <div className="leave-bottom-nav bg-white border-t border-bdr shadow-[0_-4px_20px_rgba(90,30,10,0.10)] z-[100]">
          {NAV.map(n=>{
            const active=tab===n.id, isAdminTab=n.id==="admin";
            return(
              <button key={n.id} onClick={()=>goTab(n.id)} className={`flex-1 pt-2.5 pb-3 bg-transparent border-none cursor-pointer font-[inherit] flex flex-col items-center gap-1 transition-colors duration-200 relative ${active ? (isAdminTab ? "text-maroon" : "text-gold") : "text-txt-soft"}`}>
                {active&&(<div className={`absolute top-0 w-9 h-0.5 rounded-b ${isAdminTab ? "bg-linear-to-r from-maroon to-maroon-lt" : "bg-linear-to-r from-gold to-gold-lt"}`}/>)}
                <span className={`transition-transform duration-150 ${active ? "-translate-y-px" : ""}`}>{n.icon(active)}</span>
                <span className={`text-[11px] ${active?"font-bold":"font-medium"}`}>{n.label}</span>
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
        {toastMsg&&(<div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-maroon text-white px-5.5 py-3 rounded-[30px] text-sm font-semibold font-[inherit] shadow-[0_6px_20px_rgba(123,28,28,0.37)] z-[500] animate-[toastIn_0.25s_ease] whitespace-nowrap">✓ {toastMsg}</div>)}
        </div>{/* end leave-main */}
      </div>{/* end leave-app-root */}
    </>
  );
}
