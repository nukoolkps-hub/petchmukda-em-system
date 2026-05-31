import {
  AlertTriangle as IconAlertTriangle,
  Ban as IconBan,
  Book as IconBook,
  CalendarDays as IconCalendar,
  Check as IconCheck,
  ClipboardList as IconClipboardList,
  Diamond as IconDiamond,
  Handshake as IconHandshake,
  Lightbulb as IconLightbulb,
  RefreshCw as IconRefresh,
  Ruler as IconRuler,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Star as IconStar,
  Sun as IconSun,
  Ticket as IconTicket,
  TrendingDown as IconTrendingDown,
  X as IconX,
} from "lucide-react";
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
          <IconBook size={22} color="#fff" strokeWidth={2.2} />
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
          {
            id: "leave",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <IconCalendar size={14} strokeWidth={2.4} />
                กฎการลา
              </span>
            ),
          },
          {
            id: "commission",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <IconDiamond size={14} strokeWidth={2.4} />
                กฎค่าคอม
              </span>
            ),
          },
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
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconClipboardList size={16} strokeWidth={2.4} />
                โควต้าการลา
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              พนักงานทุกคนมีโควต้า <b>ลากิจ + ลาป่วย รวม 2 วัน/เดือน</b>
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconCalendar size={16} strokeWidth={2.4} />
                วันลาแบ่งเป็น 2 ประเภท
              </span>
            }
            color={COLORS.maroon}
          >
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconCalendar size={14} strokeWidth={2.4} />
                  วันธรรมดา (จันทร์-ศุกร์)
                </span>
              }
              color={COLORS.text}
            >
              <ul>
                <li>
                  มี <b>โควต้า 2 วัน/เดือน</b>
                </li>
                <li>
                  ลาเกินโควต้า → <b className="text-red">หักจากเงินเดือน</b>
                </li>
                <li>
                  หัก = <b>(เงินเดือน ÷ 30) × จำนวนวันที่เกิน</b>
                </li>
              </ul>
            </Card>
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconSun size={14} strokeWidth={2.4} />
                  วันอาทิตย์
                </span>
              }
              color={COLORS.text}
            >
              <ul>
                <li>
                  <b className="text-red">หักทุกวัน</b> ไม่อยู่ในโควต้า
                </li>
                <li>
                  หัก = <b>(เงินเดือน ÷ 30) × 1.5 × จำนวนวันที่ลา</b>
                </li>
              </ul>
            </Card>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconStar size={16} strokeWidth={2.4} />
                โบนัสแห่งความขยัน(ไม่หยุด)
              </span>
            }
            color={COLORS.green}
          >
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
            <b className="text-maroon inline-flex items-center gap-1">
              <IconLightbulb size={14} strokeWidth={2.4} />
              ตัวอย่าง:
            </b>{" "}
            เงินเดือน ฿18,000 ลาวันธรรมดา 1 + วันอาทิตย์ 1<br />
            เรท/วัน = 18,000 ÷ 30 = <b>฿600</b>
            <br />
            <span className="text-green inline-flex items-center gap-1">
              <IconCheck size={14} strokeWidth={3} />
              ได้โบนัสแห่งความขยัน
            </span>{" "}
            1 × 600 = <b>฿600</b>
            <br />
            <span className="text-red inline-flex items-center gap-1">
              <IconX size={14} strokeWidth={3} />
              หักวันอาทิตย์
            </span>{" "}
            600 × 1.5 = <b>฿900</b>
          </Box>
        </div>
      )}

      {tab === "commission" && (
        <div className="text-sm text-txt-mid leading-[1.8]">
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconHandshake size={16} strokeWidth={2.4} />
                ระบบค่าคอมกองกลาง
              </span>
            }
            color={COLORS.maroon}
          >
            <p>พนักงานในตำแหน่งเดียวกันที่อยู่ใน "กองกลาง" จะแชร์ค่าคอมกันตามสูตร</p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconRuler size={16} strokeWidth={2.4} />
                สูตรการแบ่งกองกลาง
              </span>
            }
            color={COLORS.maroon}
          >
            <Card title="ขั้นตอน 7 ข้อ" color={COLORS.text}>
              <ol className="pl-[18px] m-0">
                <li>
                  <b>จำนวนคนที่มีสิทธิ์</b> = จำนวนคนในกองกลางหลังตัดสิทธิ์
                </li>
                <li>
                  <b>เปอร์เซ็นต์ฐาน</b> = 100 ÷ จำนวนคนที่มีสิทธิ์
                </li>
                <li>
                  <b>ตัวคูณหักวันลา</b> = เปอร์เซ็นต์ฐาน ÷ 30
                </li>
                <li>
                  <b>วันลาที่ใช้คำนวณ</b> = วันหยุดรวม − 2 (อย่างต่ำ 0)
                  <br />
                  <span className="text-xs text-txt-soft">
                    → 2 วันแรก "ฟรี" ไม่ถูกหัก · ลา 0–2 วัน = 0 · ลา 5 วัน = 3
                  </span>
                </li>
                <li>
                  <b>% หัก</b> = วันลาที่ใช้คำนวณ × ตัวคูณหักวันลา × (จำนวนคนที่มีสิทธิ์ − 1)
                </li>
                <li>
                  <b>% แบ่งเพื่อน</b> = % หัก ÷ (จำนวนคนที่มีสิทธิ์ − 1)
                </li>
                <li>
                  <b>% ที่ได้</b> = เปอร์เซ็นต์ฐาน − % หัก + Σ(% แบ่งเพื่อนของคนอื่น)
                </li>
              </ol>
              <p className="mt-2">
                <b>ชิ้นที่ได้</b> = (% ที่ได้ ÷ 100) × กองกลางรวม
                <br />
                <b>เงิน</b> = ชิ้น × Rate ของแต่ละคน
              </p>
            </Card>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconSparkles size={16} strokeWidth={2.4} />
                ขายพิเศษ
              </span>
            }
            color={COLORS.gold}
          >
            <p>
              <b>ไม่เข้ากองกลาง</b> — ใครขายใครได้ คูณ Rate ของตัวเอง
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconShoppingBag size={16} strokeWidth={2.4} />
                รับซื้อ
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              คำนวณแบบกองกลาง <b>แยกฝั่ง</b> จากการขาย (ใช้สูตรเดียวกัน)
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconAlertTriangle size={16} strokeWidth={2.4} />
                กฎตัดสิทธิ์กองกลาง
              </span>
            }
            color={COLORS.red}
          >
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconTrendingDown size={14} strokeWidth={2.4} />
                  กฎ 80%
                </span>
              }
              color={COLORS.text}
            >
              <p>
                คนที่ <b>ชิ้น &lt; 80% ของ Top</b> ในฝั่งนั้น →{" "}
                <b className="text-red">ตัดออกจากกองกลาง</b> ฝั่งนั้น
                (จำนวนคนที่มีสิทธิ์ลดลง → เปอร์เซ็นต์ฐานและตัวคูณหักวันลาเปลี่ยนตาม)
              </p>
            </Card>
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconBan size={14} strokeWidth={2.4} />
                  Admin ปิดสิทธิ์
                </span>
              }
              color={COLORS.text}
            >
              <ul>
                <li>
                  <b>ปิดฝั่งขาย</b> — ไม่ได้กองกลางฝั่งขาย (ฝั่งซื้อยังใช้กฎ 80%)
                </li>
                <li>
                  <b>ปิดฝั่งรับซื้อ</b> — ไม่ได้กองกลางฝั่งรับซื้อ (ฝั่งขายยังใช้กฎ 80%)
                </li>
                <li>
                  <b>ปิดทั้งคู่</b> — ไม่ได้กองกลางทั้ง 2 ฝั่ง
                  <br />+ ถ้าขาย &lt; 50% ของ Top →{" "}
                  <b className="text-red">ไม่ได้เงินเดือนพื้นฐาน</b>
                </li>
              </ul>
            </Card>
          </Section>

          <Box bg={COLORS.goldPale} border={`${COLORS.gold}40`}>
            <b className="text-maroon inline-flex items-center gap-1">
              <IconLightbulb size={14} strokeWidth={2.4} />
              ตัวอย่างกองกลางขาย 5 คน · ขายคนละ 200 ชิ้น · กองรวม 1,000 ชิ้น
            </b>
            <br />
            เปอร์เซ็นต์ฐาน = 100 ÷ 5 = <b>20%</b> ต่อคน · ตัวคูณหักวันลา = 20 ÷ 30 ={" "}
            <b>0.667</b>
            <br />
            <ul className="pl-[18px] my-1.5 mx-0">
              <li>
                ลา 0 วัน → ใช้คำนวณ 0 → ไม่ถูกหัก → % ได้ <b>25.33%</b> = 253.3 ชิ้น
              </li>
              <li>
                ลา 2 วัน → ใช้คำนวณ 0 → ไม่ถูกหัก → % ได้ <b>25.33%</b> = 253.3 ชิ้น
              </li>
              <li>
                ลา 5 วัน → ใช้คำนวณ 3 → % หัก 8% → % ได้ <b>15.33%</b> = 153.3 ชิ้น
              </li>
              <li>
                ลา 7 วัน → ใช้คำนวณ 5 → % หัก 13.33% → % ได้ <b>8.67%</b> = 86.7 ชิ้น
              </li>
            </ul>
            ลาไม่เกิน 2 วัน = ไม่กระทบ · เกินจากนั้นค่อยถูกหักไปแบ่งเพื่อน
          </Box>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconTicket size={16} strokeWidth={2.4} />
                บัตรสมาชิก
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              คิดตาม <b>Rate ของตัวเอง</b> × จำนวนใบ (ไม่เข้ากองกลาง)
            </p>
            <ul>
              <li className="inline-flex items-center gap-1.5">
                <IconTicket size={14} strokeWidth={2.4} />
                เชิญชวนสมัครบัตร — ใบละ X บาท
              </li>
              <br />
              <li className="inline-flex items-center gap-1.5">
                <IconRefresh size={14} strokeWidth={2.4} />
                ย้ายข้อมูลบัตร — ใบละ Y บาท
              </li>
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
