import { IconBook } from "@tabler/icons-react";
import { useState } from "react";
import { COLORS } from "../../constants";
import BaseModal from "../shared/BaseModal";
import { Box, Card, Section } from "../shared/Layout";

/* ─── Manual / User Guide Modal ────────────────────────────────── */
export default function ManualModal({ onClose }) {
  const [tab, setTab] = useState("leave");
  return (
    <BaseModal
      onClose={onClose}
      maxWidthClass="max-w-[560px]"
      contentClassName="px-5.5 pt-6 pb-7"
    >
      {/* header */}
      <div className="flex items-center gap-3 mb-4.5">
        <div className="w-[46px] h-[46px] rounded-xl bg-linear-135 from-gold to-gold-lt flex items-center justify-center shadow-[0_4px_14px_rgba(201,151,58,0.25)]">
          <IconBook size={22} color="#fff" stroke={2.2} />
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-lg text-txt">คู่มือการใช้งาน</div>
          <div className="text-sm text-txt-soft mt-0.5">
            ห้างเพชรทองมุกดา · ระบบพนักงาน
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex bg-cream-dk rounded-[11px] p-1 mb-3.5 gap-0.5">
        {[
          { id: "leave", label: "📅 กฎการลา" },
          { id: "commission", label: "💎 กฎค่าคอม" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-2.5 rounded-[9px] border-none cursor-pointer font-[inherit] text-sm font-semibold transition-all
              ${tab === t.id ? "bg-white text-maroon shadow-[0_1px_6px_rgba(90,30,10,0.10)]" : "bg-transparent text-txt-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* content */}
      {tab === "leave" && (
        <div className="text-sm text-txt-mid leading-[1.8]">
          <Section title="📋 โควต้าการลา" color={COLORS.maroon}>
            <p>
              พนักงานทุกคนมีโควต้า <b>ลากิจ + ลาป่วย รวม 2 ครั้ง/เดือน</b>
            </p>
          </Section>

          <Section title="📅 วันลาแบ่งเป็น 2 ประเภท" color={COLORS.maroon}>
            <Card title="📅 วันธรรมดา (จันทร์-ศุกร์)" color={COLORS.text}>
              <ul>
                <li>
                  มี <b>โควต้า 2 ครั้ง/เดือน</b>
                </li>
                <li>
                  ลาเกินโควต้า → <b className="text-red">หักจากเงินเดือน</b>
                </li>
                <li>
                  หัก = <b>(เงินเดือน ÷ 30) × จำนวนวันที่เกิน</b>
                </li>
              </ul>
            </Card>
            <Card title="🌅 วันอาทิตย์" color={COLORS.text}>
              <ul>
                <li>
                  <b className="text-red">หักทุกครั้ง</b> ไม่อยู่ในโควต้า
                </li>
                <li>
                  หัก = <b>(เงินเดือน ÷ 30) × 1.5 × จำนวนวันที่ลา</b>
                </li>
              </ul>
            </Card>
          </Section>

          <Section title="🌟 โบนัสแห่งความขยัน(ไม่หยุด)" color={COLORS.green}>
            <p>
              คำนวณ <b>เฉพาะวันธรรมดา</b> (วันอาทิตย์ไม่นับ)
            </p>
            <ul>
              <li>
                ลา 0 วัน → ได้ <b>2 × (เงินเดือน ÷ 30)</b>
              </li>
              <li>
                ลา 1 วัน → ได้ <b>1 × (เงินเดือน ÷ 30)</b>
              </li>
              <li>
                ลา 2+ วัน → <b className="text-red">ไม่ได้รับโบนัส</b>
              </li>
            </ul>
          </Section>

          <Box bg={COLORS.goldPale} border={`${COLORS.gold}40`}>
            <b className="text-maroon">💡 ตัวอย่าง:</b> เงินเดือน ฿18,000 ลาวันธรรมดา
            1 + วันอาทิตย์ 1<br />
            เรท/วัน = 18,000 ÷ 30 = <b>฿600</b>
            <br />
            <span className="text-green">✓ ได้โบนัสแห่งความขยัน</span> 1 × 600 ={" "}
            <b>฿600</b>
            <br />
            <span className="text-red">✗ หักวันอาทิตย์</span> 600 × 1.5 ={" "}
            <b>฿900</b>
          </Box>
        </div>
      )}

      {tab === "commission" && (
        <div className="text-sm text-txt-mid leading-[1.8]">
          <Section title="🤝 ระบบ Pool ค่าคอม" color={COLORS.maroon}>
            <p>พนักงานในตำแหน่งเดียวกันที่อยู่ใน "Pool" จะแชร์ค่าคอมกันตามสูตร</p>
          </Section>

          <Section title="📐 สูตรการแบ่ง Pool" color={COLORS.maroon}>
            <Card title="ขั้นตอน 6 ข้อ" color={COLORS.text}>
              <ol className="pl-[18px] m-0">
                <li>
                  <b>จำนวนคนที่มีสิทธิ์</b> = จำนวนคนใน Pool หลังตัดสิทธิ์
                </li>
                <li>
                  <b>เปอร์เซ็นต์ฐาน</b> = 100 ÷ จำนวนคนที่มีสิทธิ์
                </li>
                <li>
                  <b>ตัวคูณหักวันลา</b> = เปอร์เซ็นต์ฐาน ÷ 30
                </li>
                <li>
                  <b>% หัก</b> = วันหยุดรวม × ตัวคูณหักวันลา × (จำนวนคนที่มีสิทธิ์ − 1)
                </li>
                <li>
                  <b>% แบ่งเพื่อน</b> = % หัก ÷ (จำนวนคนที่มีสิทธิ์ − 1)
                </li>
                <li>
                  <b>% ที่ได้</b> = เปอร์เซ็นต์ฐาน − % หัก + Σ(% แบ่งเพื่อนของคนอื่น)
                </li>
              </ol>
              <p className="mt-2">
                <b>ชิ้นที่ได้</b> = (% ที่ได้ ÷ 100) × Pool รวม
                <br />
                <b>เงิน</b> = ชิ้น × Rate ของแต่ละคน
              </p>
            </Card>
          </Section>

          <Section title="✨ ขายพิเศษ" color={COLORS.gold}>
            <p>
              <b>ไม่เข้า Pool</b> — ใครขายใครได้ คูณ Rate ของตัวเอง
            </p>
          </Section>

          <Section title="🛍 รับซื้อ" color={COLORS.maroon}>
            <p>
              คำนวณแบบ Pool <b>แยกฝั่ง</b> จากการขาย (ใช้สูตรเดียวกัน)
            </p>
          </Section>

          <Section title="⚠ กฎตัดสิทธิ์ Pool" color={COLORS.red}>
            <Card title="🔻 กฎ 80%" color={COLORS.text}>
              <p>
                คนที่ <b>ชิ้น &lt; 80% ของ Top</b> ในฝั่งนั้น →{" "}
                <b className="text-red">ตัดออกจาก Pool</b> ฝั่งนั้น (จำนวนคนที่มีสิทธิ์ลดลง
                → เปอร์เซ็นต์ฐานและตัวคูณหักวันลาเปลี่ยนตาม)
              </p>
            </Card>
            <Card title="🚫 Admin ปิดสิทธิ์" color={COLORS.text}>
              <ul>
                <li>
                  <b>ปิดฝั่งขาย</b> — ไม่ได้ Pool ฝั่งขาย (ฝั่งซื้อยังใช้กฎ 80%)
                </li>
                <li>
                  <b>ปิดฝั่งรับซื้อ</b> — ไม่ได้ Pool ฝั่งรับซื้อ (ฝั่งขายยังใช้กฎ 80%)
                </li>
                <li>
                  <b>ปิดทั้งคู่</b> — ไม่ได้ Pool ทั้ง 2 ฝั่ง
                  <br />+ ถ้าขาย &lt; 50% ของ Top →{" "}
                  <b className="text-red">ไม่ได้เงินเดือนพื้นฐาน</b>
                </li>
              </ul>
            </Card>
          </Section>

          <Box bg={COLORS.goldPale} border={`${COLORS.gold}40`}>
            <b className="text-maroon">💡 ตัวอย่าง Pool ขาย 5 คน · 1,064 ชิ้น</b>
            <br />
            จำนวนคนที่มีสิทธิ์ = 5, เปอร์เซ็นต์ฐาน = 20%, ตัวคูณหักวันลา = 0.667
            <br />
            <ul className="pl-[18px] my-1.5 mx-0">
              <li>
                ลา 2 วัน → % หัก 2.67 → % ได้ <b>20.67%</b> = 219.93 ชิ้น
              </li>
              <li>
                ลา 3 วัน → % หัก 4.00 → % ได้ <b>17.33%</b> = 184.43 ชิ้น
              </li>
            </ul>
            ใครหยุดน้อยได้มาก ใครหยุดมากได้น้อย
          </Box>

          <Section title="🎫 บัตรสมาชิก" color={COLORS.maroon}>
            <p>
              คิดตาม <b>Rate ของตัวเอง</b> × จำนวนใบ (ไม่เข้า Pool)
            </p>
            <ul>
              <li>🎫 เชิญชวนสมัครบัตร — ใบละ X บาท</li>
              <li>🔄 ย้ายข้อมูลบัตร — ใบละ Y บาท</li>
            </ul>
          </Section>
        </div>
      )}

      {/* close */}
      <button
        onClick={onClose}
        className="w-full p-3.5 mt-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit]"
      >
        ปิด
      </button>
    </BaseModal>
  );
}
