import { useState } from "react";
import { C } from "../../constants";
import { Section, Card, Box } from "../shared/Layout";

/* ─── Manual / User Guide Modal ────────────────────────────────── */
export default function ManualModal({ onClose }) {
  const [tab, setTab] = useState("leave");
  return (
    <div style={{position:"fixed",inset:0,zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center",
      background:"rgba(45,26,14,0.65)",backdropFilter:"blur(6px)"}}>
      <div style={{background:C.white,borderRadius:"24px 24px 0 0",padding:"24px 22px 28px",width:"100%",maxWidth:560,
        boxShadow:"0 -12px 40px rgba(45,26,14,0.25)",animation:"slideUp 0.3s cubic-bezier(.22,.68,0,1.1)",
        maxHeight:"92vh",overflowY:"auto"}}>

        <div style={{width:40,height:4,borderRadius:2,background:C.border,margin:"0 auto 16px"}}/>

        {/* header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
          <div style={{width:46,height:46,borderRadius:12,background:`linear-gradient(135deg,${C.gold},${C.goldLt})`,
            display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 14px ${C.gold}40`}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:18,color:C.text}}>คู่มือการใช้งาน</div>
            <div style={{fontSize:12,color:C.textSoft,marginTop:2}}>ห้างเพชรทองมุกดา · ระบบพนักงาน</div>
          </div>
        </div>

        {/* tabs */}
        <div style={{display:"flex",background:C.creamDk,borderRadius:11,padding:4,marginBottom:14,gap:3}}>
          {[
            {id:"leave",   label:"📅 กฎการลา"},
            {id:"comm",    label:"💎 กฎค่าคอม"},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{flex:1,padding:"10px 8px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"inherit",
                fontSize:13,fontWeight:600,
                background:tab===t.id?C.white:"transparent",
                color:tab===t.id?C.maroon:C.textSoft,
                boxShadow:tab===t.id?"0 1px 6px rgba(90,30,10,0.10)":"none"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* content */}
        {tab==="leave" && (
          <div style={{fontSize:14,color:C.textMid,lineHeight:1.8}}>
            <Section title="📋 โควต้าการลา" color={C.maroon}>
              <p>พนักงานทุกคนมีโควต้า <b>ลากิจ + ลาป่วย รวม 2 ครั้ง/เดือน</b></p>
            </Section>

            <Section title="📅 วันลาแบ่งเป็น 2 ประเภท" color={C.maroon}>
              <Card title="📅 วันธรรมดา (จันทร์-ศุกร์)" color={C.text}>
                <ul>
                  <li>มี <b>โควต้า 2 ครั้ง/เดือน</b></li>
                  <li>ลาเกินโควต้า → <b style={{color:C.red}}>หักจากเงินเดือน</b></li>
                  <li>หัก = <b>(เงินเดือน ÷ 30) × จำนวนวันที่เกิน</b></li>
                </ul>
              </Card>
              <Card title="🌅 วันอาทิตย์" color={C.text}>
                <ul>
                  <li><b style={{color:C.red}}>หักทุกครั้ง</b> ไม่อยู่ในโควต้า</li>
                  <li>หัก = <b>(เงินเดือน ÷ 30) × 1.5 × จำนวนวันที่ลา</b></li>
                </ul>
              </Card>
            </Section>

            <Section title="🌟 โบนัสแห่งความขยัน(ไม่หยุด)" color={C.green}>
              <p>คำนวณ <b>เฉพาะวันธรรมดา</b> (วันอาทิตย์ไม่นับ)</p>
              <ul>
                <li>ลา 0 วัน → ได้ <b>2 × (เงินเดือน ÷ 30)</b></li>
                <li>ลา 1 วัน → ได้ <b>1 × (เงินเดือน ÷ 30)</b></li>
                <li>ลา 2+ วัน → <b style={{color:C.red}}>ไม่ได้รับโบนัส</b></li>
              </ul>
            </Section>

            <Box bg={C.goldPale} border={C.gold+"40"}>
              <b style={{color:C.maroon}}>💡 ตัวอย่าง:</b> เงินเดือน ฿18,000 ลาวันธรรมดา 1 + วันอาทิตย์ 1<br/>
              เรท/วัน = 18,000 ÷ 30 = <b>฿600</b><br/>
              <span style={{color:C.green}}>✓ ได้โบนัสแห่งความขยัน</span> 1 × 600 = <b>฿600</b><br/>
              <span style={{color:C.red}}>✗ หักวันอาทิตย์</span> 600 × 1.5 = <b>฿900</b>
            </Box>
          </div>
        )}

        {tab==="comm" && (
          <div style={{fontSize:14,color:C.textMid,lineHeight:1.8}}>
            <Section title="🤝 ระบบ Pool ค่าคอม" color={C.maroon}>
              <p>พนักงานในตำแหน่งเดียวกันที่อยู่ใน "Pool" จะแชร์ค่าคอมกันตามสูตร</p>
            </Section>

            <Section title="📐 สูตรการแบ่ง Pool" color={C.maroon}>
              <Card title="ขั้นตอน 6 ข้อ" color={C.text}>
                <ol style={{paddingLeft:18,margin:0}}>
                  <li><b>N</b> = จำนวนคนใน Pool (หลังตัดสิทธิ์)</li>
                  <li><b>Base</b> = 100 ÷ N (เปอร์เซ็นต์เริ่มต้น)</li>
                  <li><b>K</b> = Base ÷ 30 (ตัวคูณการหัก)</li>
                  <li><b>% หัก</b> = วันหยุดรวม × K × (N−1)</li>
                  <li><b>% แบ่งเพื่อน</b> = % หัก ÷ (N−1)</li>
                  <li><b>% ที่ได้</b> = Base − % หัก + Σ(% แบ่งเพื่อนของคนอื่น)</li>
                </ol>
                <p style={{marginTop:8}}>
                  <b>ชิ้นที่ได้</b> = (% ที่ได้ ÷ 100) × Pool รวม<br/>
                  <b>เงิน</b> = ชิ้น × Rate ของแต่ละคน
                </p>
              </Card>
            </Section>

            <Section title="✨ ขายพิเศษ" color={C.gold}>
              <p><b>ไม่เข้า Pool</b> — ใครขายใครได้ คูณ Rate ของตัวเอง</p>
            </Section>

            <Section title="🛍 รับซื้อ" color={C.maroon}>
              <p>คำนวณแบบ Pool <b>แยกฝั่ง</b> จากการขาย (ใช้สูตรเดียวกัน)</p>
            </Section>

            <Section title="⚠ กฎตัดสิทธิ์ Pool" color={C.red}>
              <Card title="🔻 กฎ 80%" color={C.text}>
                <p>คนที่ <b>ชิ้น &lt; 80% ของ Top</b> ในฝั่งนั้น → <b style={{color:C.red}}>ตัดออกจาก Pool</b> ฝั่งนั้น (N ลดลง → Base และ K เปลี่ยนตาม)</p>
              </Card>
              <Card title="🚫 Admin ปิดสิทธิ์" color={C.text}>
                <ul>
                  <li><b>ปิดฝั่งขาย</b> — ไม่ได้ Pool ฝั่งขาย (ฝั่งซื้อยังใช้กฎ 80%)</li>
                  <li><b>ปิดฝั่งรับซื้อ</b> — ไม่ได้ Pool ฝั่งรับซื้อ (ฝั่งขายยังใช้กฎ 80%)</li>
                  <li><b>ปิดทั้งคู่</b> — ไม่ได้ Pool ทั้ง 2 ฝั่ง<br/>
                    + ถ้าขาย &lt; 50% ของ Top → <b style={{color:C.red}}>ไม่ได้เงินเดือนพื้นฐาน</b></li>
                </ul>
              </Card>
            </Section>

            <Box bg={C.goldPale} border={C.gold+"40"}>
              <b style={{color:C.maroon}}>💡 ตัวอย่าง Pool ขาย 5 คน · 1,064 ชิ้น</b><br/>
              N=5, Base=20%, K=0.667<br/>
              <ul style={{paddingLeft:18,margin:"6px 0"}}>
                <li>ลา 2 วัน → % หัก 2.67 → % ได้ <b>20.67%</b> = 219.93 ชิ้น</li>
                <li>ลา 3 วัน → % หัก 4.00 → % ได้ <b>17.33%</b> = 184.43 ชิ้น</li>
              </ul>
              ใครหยุดน้อยได้มาก ใครหยุดมากได้น้อย
            </Box>

            <Section title="🎫 บัตรสมาชิก" color={C.maroon}>
              <p>คิดตาม <b>Rate ของตัวเอง</b> × จำนวนใบ (ไม่เข้า Pool)</p>
              <ul>
                <li>🎫 เชิญชวนสมัครบัตร — ใบละ X บาท</li>
                <li>🔄 ย้ายข้อมูลบัตร — ใบละ Y บาท</li>
              </ul>
            </Section>
          </div>
        )}

        {/* close */}
        <button onClick={onClose} style={{width:"100%",padding:"13px",marginTop:14,borderRadius:12,border:`1.5px solid ${C.border}`,
          background:C.white,color:C.textMid,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          ปิด
        </button>
      </div>
    </div>
  );
}
