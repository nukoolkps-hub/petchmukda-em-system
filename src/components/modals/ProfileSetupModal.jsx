import { useState, useRef, useEffect } from "react";
import { C, EMOJI_LIST, TH_BANKS } from "../../constants";
import { validateBankAccount, validateRequired } from "../../utils/validators";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Profile Setup Modal (first run / edit) ───────────────────── */
export default function ProfileSetupModal({ initial, onSave, onClose }) {
  const [name,    setName]    = useState(initial?.name    || "");
  const [avType,  setAvType]  = useState(initial?.avType  || "text");
  const [av,      setAv]      = useState(initial?.av      || "");
  const [img,     setImg]     = useState(initial?.img     || null);
  const [bank,    setBank]    = useState(initial?.bank    || "");
  const [bankAcc, setBankAcc] = useState(initial?.bankAcc || "");
  const [nameErr, setNameErr] = useState("");
  const [avErr,   setAvErr]   = useState("");
  const [bankErr, setBankErr] = useState("");
  const fileRef = useRef(null);

  // auto initials from name
  useEffect(()=>{
    if(avType==="text" && name.trim()){
      const parts = name.trim().split(" ");
      const initials = parts.map(p=>p.charAt(0)).join("").slice(0,2);
      setAv(initials);
    }
  },[name, avType]);

  function handleFile(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setImg(ev.target.result); setAvType("image"); };
    reader.readAsDataURL(file);
  }

  function save(){
    let ok = true;

    // Name validation
    const nameError = validateRequired(name, "ชื่อ-นามสกุล");
    if(nameError){ setNameErr(nameError); ok=false; } else setNameErr("");

    // Avatar validation
    if(avType==="text" && !av.trim()){ setAvErr("กรุณาระบุตัวย่อ (2-3 ตัวอักษร)"); ok=false; }
    else if(avType==="emoji" && !av){ setAvErr("กรุณาเลือก Emoji"); ok=false; }
    else if(avType==="image" && !img){ setAvErr("กรุณาอัปโหลดรูปภาพ"); ok=false; }
    else setAvErr("");

    // Bank validation: optional field, but if either filled, both required + format check
    if((bank && !bankAcc.trim()) || (!bank && bankAcc.trim())){
      setBankErr("กรุณาเลือกธนาคารและกรอกเลขบัญชีให้ครบ");
      ok=false;
    } else if(bankAcc.trim()){
      const accError = validateBankAccount(bankAcc);
      if(accError){ setBankErr(accError); ok=false; } else setBankErr("");
    } else setBankErr("");

    if(!ok) return;
    onSave({ name:name.trim(), av, avType, img, bank, bankAcc:bankAcc.trim() });
  }

  return(
    <div style={{position:"fixed",inset:0,zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center",
      background:"rgba(45,26,14,0.65)",backdropFilter:"blur(6px)"}}>
      <div style={{background:C.white,borderRadius:"24px 24px 0 0",padding:"28px 24px 36px",width:"100%",maxWidth:430,
        boxShadow:"0 -12px 40px rgba(45,26,14,0.25)",animation:"slideUp 0.3s cubic-bezier(.22,.68,0,1.1)",maxHeight:"92vh",overflowY:"auto"}}>

        {/* handle */}
        <div style={{width:40,height:4,borderRadius:2,background:C.border,margin:"0 auto 20px"}}/>

        {/* preview */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:24}}>
          <AvatarCircle av={av||"?"} avType={avType} img={img} size={80} fontSize={24}
            style={{boxShadow:`0 6px 20px ${C.gold}40`,marginBottom:10}}/>
          <div style={{fontSize:16,fontWeight:700,color:C.text}}>{name||"ชื่อของคุณ"}</div>
          <div style={{fontSize:13,color:C.textSoft,marginTop:2}}>ตำแหน่งกำหนดโดย Admin</div>
        </div>

        <div style={{width:"100%",height:1,background:C.border,marginBottom:20}}/>

        {/* name */}
        <div style={{marginBottom:18}}>
          <label style={{display:"block",fontSize:14,fontWeight:600,color:C.textMid,marginBottom:8}}>ชื่อ-นามสกุล</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="กรอกชื่อ-นามสกุล"
            style={{width:"100%",padding:"13px 16px",borderRadius:12,border:`1.5px solid ${nameErr?C.red:C.border}`,
              fontSize:15,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white}}/>
          {nameErr&&<div style={{color:C.red,fontSize:12,marginTop:5}}>⚠ {nameErr}</div>}
        </div>

        {/* avatar type tabs */}
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:14,fontWeight:600,color:C.textMid,marginBottom:10}}>รูปโปรไฟล์</label>
          <div style={{display:"flex",background:C.creamDk,borderRadius:12,padding:4,gap:2,marginBottom:16}}>
            {[{id:"text",label:"✏️ ตัวอักษร"},{id:"emoji",label:"😊 Emoji"},{id:"image",label:"📷 รูปภาพ"}].map(t=>(
              <button key={t.id} onClick={()=>setAvType(t.id)}
                style={{flex:1,padding:"9px 4px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"inherit",
                  fontSize:12,fontWeight:600,transition:"all 0.2s",
                  background:avType===t.id?C.white:"transparent",
                  color:avType===t.id?C.maroon:C.textSoft,
                  boxShadow:avType===t.id?"0 1px 6px rgba(90,30,10,0.10)":"none"}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* text initials – auto generated, show preview only */}
          {avType==="text"&&(
            <div style={{background:C.cream,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{color:C.white,fontWeight:800,fontSize:16,letterSpacing:"0.05em"}}>{av||"?"}</span>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>ตัวย่อ: <b>{av||"—"}</b></div>
                <div style={{fontSize:12,color:C.textSoft,marginTop:2}}>ระบบสร้างอัตโนมัติจากชื่อ</div>
              </div>
            </div>
          )}

          {/* emoji grid */}
          {avType==="emoji"&&(
            <div>
              <div style={{fontSize:13,color:C.textSoft,marginBottom:8}}>เลือก Emoji</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7,maxHeight:240,overflowY:"auto",paddingRight:2}}>
                {EMOJI_LIST.map(e=>(
                  <button key={e} onClick={()=>setAv(e)}
                    style={{height:50,borderRadius:12,border:`2px solid ${av===e?C.gold:C.border}`,
                      background:av===e?C.goldPale:C.white,fontSize:24,cursor:"pointer",
                      boxShadow:av===e?`0 2px 8px ${C.gold}40`:"none",transition:"all 0.15s"}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* image upload */}
          {avType==="image"&&(
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
              {img?(
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <img src={img} alt="preview" style={{width:70,height:70,borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.gold}`}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,color:C.green,fontWeight:600,marginBottom:6}}>✓ อัปโหลดสำเร็จ</div>
                    <button onClick={()=>fileRef.current.click()}
                      style={{padding:"8px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.cream,
                        color:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      เปลี่ยนรูป
                    </button>
                  </div>
                </div>
              ):(
                <button onClick={()=>fileRef.current.click()}
                  style={{width:"100%",padding:"20px",borderRadius:14,border:`2px dashed ${C.border}`,
                    background:C.cream,cursor:"pointer",fontFamily:"inherit",display:"flex",
                    flexDirection:"column",alignItems:"center",gap:8}}>
                  <span style={{fontSize:32}}>📷</span>
                  <span style={{fontSize:14,fontWeight:600,color:C.textMid}}>แตะเพื่ออัปโหลดรูปภาพ</span>
                  <span style={{fontSize:12,color:C.textSoft}}>JPG, PNG รองรับ</span>
                </button>
              )}
            </div>
          )}
          {avErr&&<div style={{color:C.red,fontSize:12,marginTop:8}}>⚠ {avErr}</div>}
        </div>

        {/* ── Bank info section ── */}
        <div style={{marginBottom:16,paddingTop:16,borderTop:`1px dashed ${C.border}`}}>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:14,fontWeight:600,color:C.textMid,marginBottom:10}}>
            🏦 บัญชีธนาคารสำหรับรับเงินเดือน
            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:C.cream,color:C.textSoft,marginLeft:"auto",border:`1px solid ${C.border}`}}>ไม่บังคับ</span>
          </label>

          {/* bank dropdown */}
          <label style={{display:"block",fontSize:12,color:C.textSoft,fontWeight:600,marginBottom:5}}>ธนาคาร</label>
          <div style={{position:"relative",marginBottom:10}}>
            <select value={bank} onChange={e=>setBank(e.target.value)}
              style={{width:"100%",padding:"12px 38px 12px 16px",borderRadius:12,border:`1.5px solid ${bankErr?C.red:C.border}`,
                fontSize:15,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:bank?C.text:C.textSoft,
                background:bank?C.goldPale+"50":C.white,appearance:"none",cursor:"pointer",
                fontWeight:bank?600:400}}>
              <option value="">— เลือกธนาคาร —</option>
              {TH_BANKS.map(b=>(
                <option key={b.name} value={b.name}>{b.emoji} {b.name}{b.short?`  (${b.short})`:""}</option>
              ))}
            </select>
            <svg style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textSoft} strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {/* account number */}
          <label style={{display:"block",fontSize:12,color:C.textSoft,fontWeight:600,marginBottom:5}}>เลขที่บัญชี</label>
          <input value={bankAcc} onChange={e=>setBankAcc(e.target.value)} placeholder="เช่น 123-4-56789-0"
            style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1.5px solid ${bankErr?C.red:C.border}`,
              fontSize:15,outline:"none",fontFamily:"inherit",boxSizing:"border-box",color:C.text,background:C.white,
              letterSpacing:"0.04em"}}/>

          {bankErr&&<div style={{color:C.red,fontSize:12,marginTop:6}}>⚠ {bankErr}</div>}
        </div>

        <button onClick={save} style={{width:"100%",padding:"16px",marginTop:8,
          background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,
          color:C.maroonDk,border:"none",borderRadius:14,fontSize:17,fontWeight:700,
          cursor:"pointer",fontFamily:"inherit",boxShadow:`0 6px 20px ${C.gold}40`,
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Diamond size={16} color={C.maroonDk}/>
          {initial ? "บันทึกการเปลี่ยนแปลง" : "เริ่มใช้งาน"}
        </button>
        {initial && onClose && (
          <button onClick={onClose} style={{width:"100%",padding:"13px",marginTop:10,
            background:"none",border:`1.5px solid ${C.border}`,borderRadius:14,
            fontSize:15,fontWeight:600,color:C.textSoft,cursor:"pointer",fontFamily:"inherit"}}>
            ยกเลิก
          </button>
        )}
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}`}</style>
    </div>
  );
}

