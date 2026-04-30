import { useState } from "react";
import { C } from "../../constants";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Admin: Roles Management Panel ────────────────────────────── */
export default function RolesAdminPanel({ roles, setRoles, empDir, onUpdateEmpRole }) {
  const [editing, setEditing] = useState({}); // {roleId: {name, poolGroup, icon}}
  const [newRole, setNewRole] = useState({ name:"", poolGroup:"", icon:"" });
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  function saveEdit(roleId){
    const e = editing[roleId];
    if(!e) return;
    setRoles(r=>r.map(rl=>rl.id===roleId?{...rl, name:e.name||rl.name, poolGroup:e.poolGroup||null, icon:e.icon||rl.icon}:rl));
    setEditing(prev=>{const n={...prev};delete n[roleId];return n;});
  }

  function addRole(){
    if(!newRole.name.trim()) return;
    const id = "r_"+Date.now();
    setRoles(r=>[...r,{id, name:newRole.name.trim(), poolGroup:newRole.poolGroup.trim()||null, icon:newRole.icon||"💼"}]);
    setNewRole({name:"",poolGroup:"",icon:""});
    setShowAdd(false);
  }

  function deleteRole(roleId){
    setRoles(r=>r.filter(rl=>rl.id!==roleId));
    setConfirmDel(null);
  }

  // group roles by poolGroup
  const groups = {};
  roles.forEach(r=>{
    const k = r.poolGroup || "_individual_";
    if(!groups[k]) groups[k] = [];
    groups[k].push(r);
  });

  function changeEmpRole(empId, roleId, roleName){
    onUpdateEmpRole(empId, "roleId", roleId);
    onUpdateEmpRole(empId, "role", roleName);
  }

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{fontSize:13,color:C.textSoft}}>กำหนดตำแหน่งและกลุ่ม Pool ค่าคอม</div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{padding:"7px 14px",borderRadius:9,border:"none",
          background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,fontSize:13,fontWeight:700,
          cursor:"pointer",fontFamily:"inherit",boxShadow:`0 2px 8px ${C.gold}40`,display:"flex",alignItems:"center",gap:5}}>
          {showAdd?"✕":"+"} เพิ่มตำแหน่ง
        </button>
      </div>

      {/* Add new role form */}
      {showAdd&&(
        <div style={{background:C.goldPale,borderRadius:12,padding:"14px",marginBottom:14,border:`1.5px dashed ${C.gold}60`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.maroon,marginBottom:10}}>🆕 ตำแหน่งใหม่</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={newRole.icon} onChange={e=>setNewRole({...newRole,icon:e.target.value.slice(0,2)})}
              placeholder="🎯" maxLength={2}
              style={{width:50,padding:"9px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:18,outline:"none",fontFamily:"inherit",textAlign:"center",boxSizing:"border-box"}}/>
            <input value={newRole.name} onChange={e=>setNewRole({...newRole,name:e.target.value})}
              placeholder="ชื่อตำแหน่ง"
              style={{flex:1,padding:"9px 12px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <input value={newRole.poolGroup} onChange={e=>setNewRole({...newRole,poolGroup:e.target.value})}
            placeholder='Pool Group (ทิ้งว่างถ้าไม่แชร์ค่าคอม) เช่น "sales"'
            style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${C.border}`,fontSize:13,outline:"none",fontFamily:"'Prompt',monospace",boxSizing:"border-box",marginBottom:10}}/>
          <button onClick={addRole} disabled={!newRole.name.trim()}
            style={{width:"100%",padding:"10px",borderRadius:9,border:"none",
              background: newRole.name.trim() ? `linear-gradient(135deg,${C.gold},${C.goldLt})` : C.border,
              color: newRole.name.trim() ? C.maroonDk : C.textSoft,
              fontSize:13,fontWeight:700,cursor: newRole.name.trim() ? "pointer" : "not-allowed",fontFamily:"inherit"}}>
            บันทึกตำแหน่ง
          </button>
        </div>
      )}

      {/* roles by group */}
      {Object.keys(groups).map(groupKey=>{
        const isPool = groupKey!=="_individual_";
        const groupRoles = groups[groupKey];
        return (
          <div key={groupKey} style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              {isPool ? (
                <>
                  <span style={{fontSize:14}}>🤝</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.maroon}}>Pool: <code style={{background:C.goldPale,padding:"1px 8px",borderRadius:6,fontSize:12}}>{groupKey}</code></span>
                  <span style={{fontSize:11,color:C.textSoft,marginLeft:"auto"}}>แชร์ค่าคอม</span>
                </>
              ):(
                <>
                  <span style={{fontSize:14}}>👤</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.text}}>ค่าคอมแยก (Rate ต่อชิ้นเดียว)</span>
                  <span style={{fontSize:10,color:C.textSoft,marginLeft:"auto"}}>ใครขายใครได้</span>
                </>
              )}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {groupRoles.map(rl=>{
                const e = editing[rl.id];
                const dirty = !!e;
                const empCount = empDir.filter(emp=>emp.roleId===rl.id).length;
                return(
                  <div key={rl.id} style={{background:C.white,borderRadius:12,padding:"12px 14px",border:`1px solid ${C.border}`,boxShadow:"0 1px 6px rgba(90,30,10,0.05)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom: dirty?10:0}}>
                      <input value={e?.icon!==undefined ? e.icon : rl.icon}
                        onChange={ev=>setEditing(p=>({...p,[rl.id]:{...(p[rl.id]||rl), icon:ev.target.value.slice(0,2)}}))}
                        maxLength={2}
                        style={{width:42,padding:"8px",borderRadius:8,border:`1px solid ${dirty?C.gold:C.border}`,fontSize:18,outline:"none",fontFamily:"inherit",textAlign:"center",boxSizing:"border-box",background:dirty?C.goldPale+"50":C.cream}}/>
                      <input value={e?.name!==undefined ? e.name : rl.name}
                        onChange={ev=>setEditing(p=>({...p,[rl.id]:{...(p[rl.id]||rl), name:ev.target.value}}))}
                        style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${dirty?C.gold:C.border}`,fontSize:14,fontWeight:600,outline:"none",fontFamily:"inherit",boxSizing:"border-box",background:dirty?C.goldPale+"50":C.cream,color:C.text}}/>
                      <span style={{fontSize:11,color:C.textSoft,padding:"2px 8px",borderRadius:8,background:C.cream,border:`1px solid ${C.border}`,fontWeight:600,whiteSpace:"nowrap"}}>{empCount} คน</span>
                    </div>
                    {dirty&&(
                      <div style={{marginBottom:10}}>
                        <label style={{fontSize:11,color:C.textSoft,fontWeight:600,marginBottom:4,display:"block"}}>Pool Group (ทิ้งว่างถ้าไม่แชร์)</label>
                        <input value={e?.poolGroup!==undefined ? e.poolGroup : (rl.poolGroup||"")}
                          onChange={ev=>setEditing(p=>({...p,[rl.id]:{...(p[rl.id]||rl), poolGroup:ev.target.value}}))}
                          placeholder="เช่น sales"
                          style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1.5px solid ${C.gold}`,fontSize:13,outline:"none",fontFamily:"'Prompt',monospace",boxSizing:"border-box",background:C.goldPale+"50"}}/>
                      </div>
                    )}
                    {dirty&&(
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setEditing(p=>{const n={...p};delete n[rl.id];return n;})}
                          style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
                        <button onClick={()=>saveEdit(rl.id)}
                          style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,color:C.maroonDk,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>บันทึก</button>
                      </div>
                    )}
                    {!dirty&&(
                      <div style={{display:"flex",gap:6,marginTop:8}}>
                        <button onClick={()=>setEditing(p=>({...p,[rl.id]:{name:rl.name,poolGroup:rl.poolGroup||"",icon:rl.icon}}))}
                          style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,color:C.maroon,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✎ แก้ไข</button>
                        <button onClick={()=>setConfirmDel(rl)} disabled={empCount>0}
                          style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${empCount>0?C.border:C.red+"40"}`,
                            background:empCount>0?C.cream:C.redLt,color:empCount>0?C.textSoft:C.red,
                            fontSize:12,fontWeight:600,cursor:empCount>0?"not-allowed":"pointer",fontFamily:"inherit"}}>
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Assign roles to employees */}
      <div style={{marginTop:24,paddingTop:16,borderTop:`1px dashed ${C.border}`}}>
        <div style={{fontSize:13,fontWeight:700,color:C.maroon,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
          🎯 กำหนดตำแหน่งให้พนักงาน
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {empDir.map(emp=>(
            <div key={emp.id} style={{background:C.white,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
              <AvatarCircle av={emp.av} avType={emp.avType} img={emp.img} size={34} fontSize={11} border={`1.5px solid ${C.gold}30`}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{emp.name}</div>
              </div>
              <select value={emp.roleId||""}
                onChange={ev=>{
                  const rl = roles.find(r=>r.id===ev.target.value);
                  if(rl) changeEmpRole(emp.id, rl.id, rl.name);
                }}
                style={{padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,fontWeight:600,outline:"none",fontFamily:"inherit",background:C.cream,color:C.text,cursor:"pointer",minWidth:130}}>
                <option value="">— เลือก —</option>
                {roles.map(r=><option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDel&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(45,26,14,0.55)",backdropFilter:"blur(4px)",padding:"0 24px"}}>
          <div style={{background:C.white,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:340}}>
            <div style={{textAlign:"center",fontSize:38,marginBottom:8}}>🗑</div>
            <div style={{fontWeight:700,fontSize:17,color:C.text,textAlign:"center",marginBottom:8}}>ลบตำแหน่งนี้?</div>
            <div style={{fontSize:13,color:C.textMid,textAlign:"center",marginBottom:20}}>
              {confirmDel.icon} {confirmDel.name}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDel(null)} style={{flex:1,padding:"12px",borderRadius:12,border:`1.5px solid ${C.border}`,background:C.white,color:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
              <button onClick={()=>deleteRole(confirmDel.id)} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:C.red,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

