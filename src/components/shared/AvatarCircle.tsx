import { C } from "../../constants";

/* ─── Avatar renderer ──────────────────────────────────────────── */
export default function AvatarCircle({av, avType, img, size=56, fontSize=18, border, style={}}){
  const base = {
    width:size, height:size, borderRadius:"50%", flexShrink:0,
    display:"flex", alignItems:"center", justifyContent:"center",
    overflow:"hidden", border: border||`2px solid ${C.goldLt}50`,
    ...style,
  };
  if(avType==="image" && img){
    return <div style={base}><img src={img} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>;
  }
  if(avType==="emoji"){
    return <div style={{...base, background:C.goldPale, fontSize:size*0.5}}>{av}</div>;
  }
  // text (initials)
  return (
    <div style={{...base, background:`linear-gradient(135deg,${C.gold},${C.goldLt})`}}>
      <span style={{color:C.white, fontWeight:700, fontSize, fontFamily:"inherit"}}>{av}</span>
    </div>
  );
}
