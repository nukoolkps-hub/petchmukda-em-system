import { C } from "../../constants";

/* ─── Layout primitives used by ManualModal etc. ───────────────── */

export function Section({title,color,children}){
  return (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color,marginBottom:8,paddingLeft:10,borderLeft:`3px solid ${color}`}}>{title}</div>
      <div style={{paddingLeft:13}}>{children}</div>
    </div>
  );
}

export function Card({title,color,children}){
  return (
    <div style={{background:C.cream,borderRadius:10,padding:"12px 14px",marginBottom:8,border:`1px solid ${C.border}`}}>
      <div style={{fontSize:13,fontWeight:700,color,marginBottom:6}}>{title}</div>
      <div style={{fontSize:13,color:C.textMid,lineHeight:1.7}}>{children}</div>
    </div>
  );
}

export function Box({bg,border,children}){
  return (
    <div style={{background:bg,borderRadius:10,padding:"12px 14px",marginTop:10,border:`1px solid ${border}`,fontSize:13,color:C.textMid,lineHeight:1.7}}>
      {children}
    </div>
  );
}
