/* ─── Leave counting helpers ───────────────────────────────────── */
import { BUSINESS_RULES } from "../constants";

const { WEEKDAY_LEAVE_QUOTA } = BUSINESS_RULES;

/* นับเฉพาะ "วันธรรมดา" ที่ลา (ใช้กับโบนัสหยุดน้อย) */
export function countWeekdayLeaves(monthLeaves) {
  let n = 0;
  monthLeaves.forEach(lv=>{
    const s = new Date(lv.start+"T00:00:00"), e = new Date(lv.end+"T00:00:00"), c = new Date(s);
    while(c<=e){
      const dow = c.getDay();
      if(dow!==0 && dow!==6) n++; // ข้ามอาทิตย์และเสาร์
      c.setDate(c.getDate()+1);
    }
  });
  return n;
}

/* ─── Helper: นับวันลาที่ "ถูกหัก" ────────────────────────────────
   กฎ:
   - วันอาทิตย์ทุกวันที่ลา → ถูกหักทันที (ไม่ใช้โควต้า)
   - วันธรรมดา → 2 ครั้งแรก (เรียงตามวัน) ไม่หัก, เกินจากนั้นค่อยหัก   */
export function getOverQuotaDays(monthLeaves) {
  // เรียงตามวันที่
  const sorted = [...monthLeaves].sort((a,b)=>a.start.localeCompare(b.start));

  let sundays = 0;            // อาทิตย์ — หักทุกครั้ง
  let weekdays = 0;           // วันธรรมดาที่ "เกิน" โควต้า 2 ครั้ง
  let weekdayLeaveCount = 0;  // นับ "ครั้ง" ลาที่มีวันธรรมดาอยู่ในนั้น

  sorted.forEach(lv=>{
    const s = new Date(lv.start+"T00:00:00"), e = new Date(lv.end+"T00:00:00"), c = new Date(s);
    let entryHasWeekday = false;
    let entryWeekdays = 0;
    while(c<=e){
      const dow = c.getDay();
      if(dow===0) sundays++;             // อาทิตย์ — หักทันที
      else if(dow!==6){                  // วันธรรมดา (ข้ามเสาร์)
        entryWeekdays++;
        entryHasWeekday = true;
      }
      c.setDate(c.getDate()+1);
    }
    if(entryHasWeekday){
      weekdayLeaveCount++;
      // ถ้าเกินโควต้า → นับวันธรรมดาในครั้งนี้เป็น over
      if(weekdayLeaveCount > WEEKDAY_LEAVE_QUOTA) weekdays += entryWeekdays;
    }
  });
  return { weekdays, sundays };
}
