import { C } from "../../constants";
import Diamond from "./Diamond";

/* ─── Decorative gold divider ──────────────────────────────────── */
export default function GoldDivider(){
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,margin:"6px 0 20px"}}>
      <div style={{flex:1,height:1,background:`linear-gradient(to right,transparent,${C.gold}50)`}}/>
      <Diamond size={10}/>
      <div style={{flex:1,height:1,background:`linear-gradient(to left,transparent,${C.gold}50)`}}/>
    </div>
  );
}
