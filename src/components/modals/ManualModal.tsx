import {
  AlertTriangle as IconAlertTriangle,
  Ban as IconBan,
  Banknote as IconBanknote,
  Book as IconBook,
  CalendarDays as IconCalendar,
  CalendarClock as IconCalendarClock,
  CalendarRange as IconCalendarRange,
  Check as IconCheck,
  ClipboardList as IconClipboardList,
  Diamond as IconDiamond,
  FileText as IconFileText,
  HandCoins as IconHandCoins,
  Handshake as IconHandshake,
  Lightbulb as IconLightbulb,
  Lock as IconLock,
  Minus as IconMinus,
  Plus as IconPlus,
  RefreshCw as IconRefresh,
  RotateCw as IconRotate,
  Ruler as IconRuler,
  Scale as IconScale,
  Settings as IconSettings,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Star as IconStar,
  Store as IconStore,
  Sun as IconSun,
  Ticket as IconTicket,
  TrendingDown as IconTrendingDown,
  UserCheck as IconUserCheck,
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
      <div className="grid grid-cols-2 bg-cream-dk rounded-[11px] p-1 mb-3.5 gap-0.5">
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
          {
            id: "money",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <IconHandCoins size={14} strokeWidth={2.4} />
                เบิก / กู้
              </span>
            ),
          },
          {
            id: "docs",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <IconFileText size={14} strokeWidth={2.4} />
                เอกสาร
              </span>
            ),
          },
          {
            id: "lock",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <IconLock size={14} strokeWidth={2.4} />
                ปิดรอบ 7 วัน
              </span>
            ),
          },
          {
            id: "duty",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <IconCalendarClock size={14} strokeWidth={2.4} />
                หน้าที่
              </span>
            ),
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-2.5 rounded-[9px] border-none cursor-pointer font-[inherit] text-sm font-semibold transition-all
              ${"wide" in t && t.wide ? "col-span-2" : ""}
              ${tab === t.id ? "bg-white text-maroon shadow-[0_1px_6px_rgba(90,30,10,0.10)]" : "bg-transparent text-txt-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* content */}
      {tab === "leave" && (
        <div className="text-sm text-txt-mid leading-[1.8] animate-[fadeIn_0.18s_ease-out]">
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
              ทุกคนได้โควต้า <b>ลากิจ + ลาป่วย รวม 2 วัน/เดือน</b>
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
                <li className="text-xs text-txt-soft">
                  ยกเว้น <b>อาทิตย์ที่ ADMIN ปิดพิเศษ</b> → ร้านปิด · ลาไม่นับ ไม่หัก
                  (ดูหัวข้อด้านล่าง)
                </li>
              </ul>
            </Card>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconStore size={16} strokeWidth={2.4} />
                วันเสาร์ — ร้านปกติหยุด
              </span>
            }
            color={COLORS.maroon}
          >
            <ul>
              <li>
                ร้าน <b>หยุดวันเสาร์</b> เป็นค่าเริ่มต้น — <b>ลาเสาร์ปกติไม่นับ</b>{" "}
                (ร้านปิดอยู่แล้ว)
              </li>
              <li>
                ถ้า ADMIN กำหนด "เสาร์เปิดพิเศษ" → <b>ลาเสาร์นั้นนับเหมือนวันธรรมดา</b>{" "}
                (เข้าโควต้า 2 วัน/เดือน · เกินหัก × 1)
              </li>
              <li>
                ถ้า ADMIN กำหนด "วันธรรมดาปิดพิเศษ" (อบรม, หยุดยาว ฯลฯ) →{" "}
                <b>ลาวันนั้นไม่นับ</b>
              </li>
              <li>
                ถ้า ADMIN กำหนด "อาทิตย์ปิดพิเศษ" → อาทิตย์นั้นกลายเป็นวันร้านปิด ·{" "}
                <b>ลาวันนั้นไม่นับ · ไม่หัก × 1.5</b> (ปกติอาทิตย์เปิด × 1.5)
              </li>
            </ul>

            <Box bg={COLORS.creamDark} border={`${COLORS.gold}40`}>
              <div className="flex items-center gap-1.5 text-maroon font-bold mb-1.5">
                <IconAlertTriangle size={14} strokeWidth={2.4} />
                ADMIN: ลบวันเปิด/ปิดพิเศษที่มีคนลา
              </div>
              <p>
                ถ้า ADMIN จะลบ "เสาร์เปิดพิเศษ" หรือ "วันธรรมดาปิดพิเศษ"{" "}
                <b>ที่มีคนลาในวันนั้นอยู่</b> ระบบจะ{" "}
                <b>ลบใบลาในวันนั้นออกให้ก่อนอัตโนมัติ</b> แล้วค่อยลบวันออกจากปฏิทิน
                (ทำในขั้นตอนเดียว)
              </p>
              <p className="mt-1.5 text-xs text-txt-soft">
                · กล่องยืนยันจะโชว์รายชื่อ + ช่วงวันของทุกใบลาก่อน — ใบที่ครอบหลายวัน
                จะถูกลบทั้งใบ (ไม่ใช่แค่วันเดียว)
                <br />· เหตุผล: กันใบลาค้างอยู่ในวันที่เปลี่ยนสถานะแล้ว — ทำให้ยอดวันลา
                ในสรุปกับสลิปตรงกันเสมอ
              </p>
            </Box>
          </Section>

          {/* แยก section: เสาร์เปิดพิเศษมี 2 แบบ */}
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconBanknote size={16} strokeWidth={2.4} />
                เสาร์เปิดพิเศษ — มี 2 แบบ
              </span>
            }
            color={COLORS.green}
          >
            <Card title="แบบที่ 1: เปิดเฉยๆ" color={COLORS.text}>
              <p>ADMIN กำหนดเฉพาะ "เปิด" — มาทำงานนับชั่วโมงปกติ · ไม่มีเงินเพิ่มในสลิป</p>
            </Card>
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconBanknote size={14} strokeWidth={2.4} />
                  แบบที่ 2: เปิด + จ่ายเพิ่ม
                </span>
              }
              color={COLORS.text}
            >
              <p>
                ADMIN ติ๊ก <b>"จ่ายเพิ่ม"</b> ในเสาร์นั้น → ถ้ามาทำงาน (ไม่ลา) ได้เงิน{" "}
                <b>+1 dailyRate</b> เข้าสลิป ในบรรทัด <b>"เสาร์เปิดพิเศษ"</b>
              </p>
              <p className="mt-1.5 text-xs text-txt-soft">
                ลาวันนั้น → ไม่ได้เงินเพิ่ม + วันลานับเข้าโควต้าเหมือนวันธรรมดา
              </p>
            </Card>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconCalendarClock size={16} strokeWidth={2.4} />
                กฎการยื่นลา
              </span>
            }
            color={COLORS.maroon}
          >
            <ul>
              <li>
                <b>ลาวันเดิมซ้ำไม่ได้</b> — วันที่เลือกห้ามทับกับใบลาที่ยื่นไว้แล้ว
              </li>
              <li>
                <b>ลาป่วยล่วงหน้าได้ไม่เกิน 2 อาทิตย์</b> — เลือกวันได้ไม่เกิน 14 วันนับจากวันนี้
              </li>
              <li>
                <b>ลากิจ</b> — ลาล่วงหน้าได้ ไม่ติดเพดาน 2 อาทิตย์เหมือนลาป่วย
                (ยังอยู่ในโควต้า 2 วัน/เดือนเหมือนเดิม)
              </li>
            </ul>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconCalendarRange size={16} strokeWidth={2.4} />
                ปฏิทินทีม (หน้าแรก)
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              หน้าแรกมี <b>ปฏิทินทีม</b> — เห็นภาพรวมทั้งเดือนว่าใครลาวันไหน +
              วันไหนร้านเปิด/ปิด
            </p>
            <ul>
              <li>
                <b>จุดสี</b> = ใบลาของแต่ละคน (สีตามประเภทลา) · แตะวันเพื่อดูรายชื่อ
              </li>
              <li>
                <b>วันเทา + "ปิด"</b> = ร้านปิด (เสาร์ปกติ · จ-ศ/อาทิตย์ ปิดพิเศษ) —
                ลาวันนั้นไม่นับ
              </li>
              <li>
                <b>วันเขียว + "เปิด"</b> = เสาร์เปิดพิเศษ (มาทำงานเหมือนวันธรรมดา)
              </li>
              <li>
                <b>"+1 วัน"</b> = เสาร์เปิดพิเศษแบบจ่ายเพิ่ม — มาทำงาน (ไม่ลา) ได้เงินเพิ่ม
                1 วัน
              </li>
            </ul>
            <p className="mt-1.5 text-xs text-txt-soft">
              ใช้กันลาทับวันเพื่อนร่วมงานมากเกินไป + วางแผนวันหยุดของทีมได้
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconStar size={16} strokeWidth={2.4} />
                โบนัสแห่งความขยัน (ไม่หยุด)
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
            <div className="flex items-center gap-1 text-maroon font-bold mb-2">
              <IconLightbulb size={14} strokeWidth={2.4} />
              ตัวอย่าง: เงินเดือน ฿18,000
            </div>

            <div className="mb-2.5 leading-relaxed">
              ลาวันธรรมดา 1 วัน + ลาวันอาทิตย์ 1 วัน
            </div>

            <div className="mb-2 pb-2 border-b border-[#C9973A40]">
              เรทต่อวัน = 18,000 ÷ 30 = <b>฿600</b>
            </div>

            <div className="flex flex-col gap-1.5">
              <div>
                <span className="text-green font-bold">+ โบนัสขยัน</span>
                <br />
                600 × 1 = <b className="text-green">฿600</b>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <span className="text-red font-bold">− หักวันอาทิตย์</span>
                <br />
                600 × 1.5 = <b className="text-red">฿900</b>
              </div>
            </div>
          </Box>
        </div>
      )}

      {tab === "commission" && (
        <div className="text-sm text-txt-mid leading-[1.8] animate-[fadeIn_0.18s_ease-out]">
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconHandshake size={16} strokeWidth={2.4} />
                ระบบค่าคอมกองกลาง
              </span>
            }
            color={COLORS.maroon}
          >
            <p>คนตำแหน่งเดียวกันที่อยู่ใน "กองกลาง" จะแชร์ค่าคอมกันตามสูตร</p>
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
                  <b>% แบ่งให้เพื่อนร่วมงาน</b> = % หัก ÷ (จำนวนคนที่มีสิทธิ์ − 1)
                </li>
                <li>
                  <b>% ที่ได้</b> = เปอร์เซ็นต์ฐาน − % หัก + Σ(% ที่เพื่อนร่วมงานแบ่งให้)
                </li>
              </ol>
              <p className="mt-2">
                <b>ชิ้นที่ได้</b> = (% ที่ได้ ÷ 100) × กองกลางของรายการนั้น
                <br />
                <b>เงิน</b> = ชิ้น × Rate ของแต่ละคน
              </p>
              <p className="mt-2 text-xs text-txt-soft inline-flex items-start gap-1">
                <IconSettings
                  size={12}
                  strokeWidth={2.4}
                  className="mt-0.5 shrink-0 text-gold"
                />
                <span>
                  ตัวอย่างข้างล่างคือ <b>3 รายการเริ่มต้น</b> (ขายทั่วไป · ขายพิเศษ · รับซื้อ)
                  · ADMIN เพิ่มหรือแก้รายการเองได้ในตำแหน่งงาน · แต่ละรายการ{" "}
                  <b>แยกกันคิด</b> เกณฑ์และกองของมันเอง
                </span>
              </p>
            </Card>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconDiamond size={16} strokeWidth={2.4} />
                ขายทั่วไป{" "}
                <span className="text-xs font-normal">
                  (รายการ "แชร์กองกลาง")
                </span>
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              รายการประเภท <b>"แชร์กองกลาง"</b> — ยอดของทุกคนรวมกันเป็นกอง
              แล้วแบ่งคืนตามสูตร 7 ข้อข้างบน
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconSparkles size={16} strokeWidth={2.4} />
                ขายพิเศษ{" "}
                <span className="text-xs font-normal">(รายการ "ส่วนตัว")</span>
              </span>
            }
            color={COLORS.gold}
          >
            <p>
              รายการประเภท <b>"ส่วนตัว"</b> — ไม่ต้องแบ่งใคร · ขายกี่ชิ้น{" "}
              <b>คูณกับ Rate ของตัวเอง</b> ได้เลย · ลาก็ไม่กระทบเงินตรงนี้
            </p>
            <p className="mt-2 text-xs text-txt-soft inline-flex items-start gap-1">
              <IconSettings
                size={12}
                strokeWidth={2.4}
                className="mt-0.5 shrink-0 text-gold"
              />
              <span>
                ADMIN สร้างรายการ "ส่วนตัว" อื่นๆ ได้ในตำแหน่งงาน — เช่น "โบนัสจุดขาย" หรือ
                "ค่าคอมพิเศษ" ฯลฯ · ทุกรายการ "ส่วนตัว" ใช้กฎเดียวกัน
              </span>
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconShoppingBag size={16} strokeWidth={2.4} />
                รับซื้อ{" "}
                <span className="text-xs font-normal">
                  (รายการ "แชร์กองกลาง")
                </span>
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              อีกรายการประเภท <b>"แชร์กองกลาง"</b> — แต่ <b>แยกกองของตัวเอง</b>{" "}
              ออกจากกองขาย · มีกอง · มีคนสูงสุด · มีเกณฑ์ของตัวเอง · ใช้สูตรเดียวกับขายทั่วไป
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconMinus size={16} strokeWidth={2.4} />
                รายการยกเว้นค่าคอม (สินค้าโปรโมชั่น / ทองแท่ง MD)
              </span>
            }
            color={COLORS.red}
          >
            <p>
              สินค้าบางอย่าง เช่น <b>สินค้าโปรโมชั่น</b> หรือ <b>ทองแท่ง MD</b> จะ{" "}
              <b>ไม่นับเข้าค่าคอม</b> — ADMIN จะมาใส่ <b>"ของที่ยกเว้น"</b> ในแต่ละเดือน
              (ใส่ได้แยกตามรายการขาย เช่น "ขายทั่วไป" / "รับซื้อ" / "ขายมือสอง")
            </p>
            <ul>
              <li>
                <b>กองกลางที่เอามาแบ่ง</b> จะ <b>เล็กลง</b> (เพราะหักของที่ยกเว้นออก)
              </li>
              <li>
                <b>แต่ยอดของแต่ละคนยังนับครบ</b> — ถ้าขายโปรโมชั่นหรือรับซื้อทองแท่งเยอะ{" "}
                <b>ยังมีสิทธิ์เข้ากองกลางอยู่</b> ไม่ถูกตัดออก
              </li>
            </ul>
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
                  เกณฑ์ขั้นต่ำ (เริ่มต้น 80% · ADMIN ตั้งใหม่ได้)
                </span>
              }
              color={COLORS.text}
            >
              <p>
                <b>แต่ละรายการ</b> (ขายทั่วไป / รับซื้อ / ฯลฯ) มี{" "}
                <b>เกณฑ์ขั้นต่ำของตัวเอง</b> — ถ้ายอดของเรา{" "}
                <b>น้อยกว่า 80% ของคนที่ทำได้สูงสุด</b> ในรายการนั้น →{" "}
                <b className="text-red">ไม่ได้แบ่งกองกลาง</b> รายการนั้น
                (รายการอื่นยังได้)
              </p>
              <div className="mt-2.5 rounded-[10px] bg-cream/70 border border-bdr p-2.5 text-xs leading-relaxed">
                <div className="flex items-center gap-1 text-maroon font-bold mb-1">
                  <IconLightbulb size={12} strokeWidth={2.4} />
                  สำคัญ: แต่ละรายการคิดแยก — ไม่เอามารวมกัน
                </div>
                <div className="text-txt-mid">
                  <b>ขายทั่วไป</b> มีคน top ของตัวเอง · เช็ค 80%
                  เทียบกับยอดขายทั่วไปอย่างเดียว
                  <br />
                  <b>รับซื้อ</b> มีคน top ของตัวเอง · เช็ค 80% เทียบกับยอดรับซื้ออย่างเดียว
                  <br />
                  รายการที่ ADMIN เพิ่มเอง ก็คิดแยกเหมือนกัน · ไม่นำยอดของคนละ
                  รายการมาบวกรวมกันเพื่อเช็คเกณฑ์
                </div>
                <div className="text-txt-mid mt-1.5 pt-1.5 border-t border-bdr/60">
                  <b>ตัวอย่าง:</b> A ขายทั่วไป 100 ชิ้น · รับซื้อ 5 ชิ้น
                  <br />
                  คน top ขายทั่วไป = 120 ชิ้น → A ได้ 100/120 ={" "}
                  <b className="text-green">83%</b> ✓ เข้ากองขายทั่วไป
                  <br />
                  คน top รับซื้อ = 50 ชิ้น → A ได้ 5/50 ={" "}
                  <b className="text-red">10%</b> ✗ ไม่เข้ากองรับซื้อ
                </div>
              </div>
              <p className="mt-2">
                <b className="text-green">ข้อยกเว้น:</b> ถ้าทำ <b>หน้าที่รายเดือน</b> ที่
                ADMIN ตั้งให้ "ได้สิทธิ์กองกลางอัตโนมัติ" → เข้ากองได้ทุกรายการแม้ยอดไม่ถึง 80%
                (เพราะติดงานทั้งเดือน ขายไม่ทันเพื่อนร่วมงาน)
              </p>
            </Card>
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconBan size={14} strokeWidth={2.4} />
                  ADMIN ปิดสิทธิ์กองกลาง
                </span>
              }
              color={COLORS.text}
            >
              <ul>
                <li>
                  <b>ไม่ปิด</b> — เข้าทุกรายการตามเกณฑ์ขั้นต่ำ 80% ปกติ
                </li>
                <li>
                  <b>ปิดเฉพาะบางรายการ</b> — รายการที่ถูกปิด ไม่ได้แบ่งกอง ·
                  รายการที่เหลือใช้เกณฑ์ 80% ปกติ
                </li>
                <li>
                  <b>ปิดทั้งหมด</b> — ไม่ได้แบ่งกองในทุกรายการ
                  <br />+ ถ้ายอด <b>รายการหลัก</b> (ADMIN เลือกไว้ในตำแหน่ง){" "}
                  <b>น้อยกว่า 50%</b> ของคนที่ทำได้สูงสุด{" "}
                  <i className="text-txt-soft">ในรายการหลัก</i> →{" "}
                  <b className="text-red">ไม่ได้เงินเดือนพื้นฐาน</b>
                </li>
              </ul>
            </Card>
          </Section>

          <Box bg={COLORS.goldPale} border={`${COLORS.gold}40`}>
            <div className="flex items-center gap-1 text-maroon font-bold mb-2">
              <IconLightbulb size={14} strokeWidth={2.4} />
              ตัวอย่าง: กองกลางขาย 5 คน
            </div>

            <div className="mb-2 leading-relaxed">
              ขายคนละ 200 ชิ้น · <b>กองรวม 1,000 ชิ้น</b>
            </div>

            <div className="mb-2.5 pb-2 border-b border-[#C9973A40] leading-relaxed">
              <div>
                ทุกคนได้ฐาน <b>20%</b> เท่ากัน
                <span className="text-txt-soft text-xs"> (100 ÷ 5)</span>
              </div>
              <div>
                หักวันลาวันละ <b>0.667%</b>
                <span className="text-txt-soft text-xs"> (20 ÷ 30)</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    <b>พนักงาน A</b> · ลา 0 วัน
                  </span>
                  <span className="whitespace-nowrap">
                    ได้ <b className="text-green">25.33%</b> = 253.3 ชิ้น
                  </span>
                </div>
                <span className="text-txt-soft text-xs">
                  → ไม่ถูกหัก + ได้แบ่งของคนลา
                </span>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    <b>พนักงาน B</b> · ลา 1 วัน
                  </span>
                  <span className="whitespace-nowrap">
                    ได้ <b className="text-green">25.33%</b> = 253.3 ชิ้น
                  </span>
                </div>
                <span className="text-txt-soft text-xs">
                  → ยังอยู่ใน "2 วันฟรี" ไม่ถูกหัก
                </span>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    <b>พนักงาน C</b> · ลา 2 วัน
                  </span>
                  <span className="whitespace-nowrap">
                    ได้ <b className="text-green">25.33%</b> = 253.3 ชิ้น
                  </span>
                </div>
                <span className="text-txt-soft text-xs">
                  → ยังอยู่ใน "2 วันฟรี" ไม่ถูกหัก
                </span>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    <b>พนักงาน D</b> · ลา 5 วัน
                  </span>
                  <span className="whitespace-nowrap">
                    ได้ <b className="text-red">15.33%</b> = 153.3 ชิ้น
                  </span>
                </div>
                <span className="text-txt-soft text-xs">
                  → เกิน 2 วันมา 3 วัน → ถูกหัก 8%
                </span>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    <b>พนักงาน E</b> · ลา 7 วัน
                  </span>
                  <span className="whitespace-nowrap">
                    ได้ <b className="text-red">8.67%</b> = 86.7 ชิ้น
                  </span>
                </div>
                <span className="text-txt-soft text-xs">
                  → เกิน 2 วันมา 5 วัน → ถูกหัก 13.33%
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#C9973A40] text-xs text-txt-soft leading-relaxed inline-flex items-start gap-1">
              <IconLightbulb
                size={12}
                strokeWidth={2.4}
                className="mt-0.5 shrink-0 text-gold"
              />
              <span>ลาไม่เกิน 2 วัน = ไม่กระทบเงิน · ลาเกินจะถูกหักไปแบ่งให้เพื่อนร่วมงานที่ไม่ลา</span>
            </div>
          </Box>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconStar size={16} strokeWidth={2.4} />
                โบนัสอื่นๆ
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              รายการเสริมที่ ADMIN ตั้งเองในแต่ละตำแหน่ง — <b>ไม่แบ่งกองกลาง</b> ·
              ใครทำคนนั้นได้
            </p>
            <p className="mt-2">
              <b>สูตร:</b> Rate ของตัวเอง × จำนวนที่ทำได้ในเดือนนั้น
            </p>

            <div className="mt-3 rounded-lg bg-cream/60 border border-bdr px-3 py-2.5">
              <div className="text-xs text-txt-soft mb-1.5">
                ตัวอย่างที่เริ่มต้นมาให้:
              </div>
              <ul className="m-0">
                <li className="inline-flex items-center gap-1.5">
                  <IconTicket size={14} strokeWidth={2.4} />
                  เชิญชวนสมัครบัตรสมาชิก — ใบละ X บาท
                </li>
                <br />
                <li className="inline-flex items-center gap-1.5">
                  <IconRefresh size={14} strokeWidth={2.4} />
                  ย้ายข้อมูลบัตรสมาชิก — ใบละ Y บาท
                </li>
              </ul>
            </div>

            <p className="mt-2.5 text-xs text-txt-soft inline-flex items-start gap-1">
              <IconSettings
                size={12}
                strokeWidth={2.4}
                className="mt-0.5 shrink-0 text-gold"
              />
              <span>
                ADMIN สามารถ <b>เพิ่ม / แก้ / ลบ</b> รายการได้เอง (เช่น "ขายของแถม",
                "ชวนเพื่อนสมัคร LINE" ฯลฯ) — แต่ละรายการตั้ง Rate ของแต่ละคนได้
              </span>
            </p>
          </Section>

          {/* ปิดระบบเงินเดือน — กรณีพิเศษ */}
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconBan size={16} strokeWidth={2.4} />
                ปิดระบบเงินเดือน (กรณีพิเศษ)
              </span>
            }
            color={COLORS.text}
          >
            <p>
              บางตำแหน่ง (เช่น <b>ฝึกงาน / Part-time / นอกระบบ</b>) ADMIN ตั้ง
              <b> "ปิดระบบเงินเดือน"</b> ได้
            </p>
            <ul>
              <li>ไม่อยู่ในระบบสลิป · ไม่อยู่ในกองกลาง · ไม่มีค่าคอม</li>
              <li>ใช้ได้แค่ระบบลา + ปฏิทินทีม</li>
              <li>เห็นบน HomeTab แค่ส่วนปฏิทิน · ไม่มีแท็บเงินเดือน</li>
            </ul>
          </Section>
        </div>
      )}

      {tab === "money" && (
        <div className="text-sm text-txt-mid leading-[1.8] animate-[fadeIn_0.18s_ease-out]">
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconBanknote size={16} strokeWidth={2.4} />
                เบิกเงินล่วงหน้า
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              <b>พนักงานขอเอง</b> ในแอป — ADMIN <b>อนุมัติ/ปฏิเสธในแอป</b>{" "}
              (ระบบส่งผลกลับให้พนักงานใน LINE)
            </p>
            <ul>
              <li>
                <b>เพดาน % ของเงินเดือนพื้นฐาน</b> — ขึ้นตามอายุงาน:
                <div className="mt-1.5 rounded-[8px] border border-bdr bg-cream/50 overflow-hidden text-xs">
                  <div className="grid grid-cols-2 gap-px bg-bdr/50">
                    <div className="bg-cream/70 px-2 py-1 font-bold text-maroon">
                      อายุงาน
                    </div>
                    <div className="bg-cream/70 px-2 py-1 font-bold text-maroon text-right">
                      เพดาน
                    </div>
                    <div className="bg-white px-2 py-1">เริ่มงาน – &lt; 3 ปี</div>
                    <div className="bg-white px-2 py-1 text-right font-bold">50%</div>
                    <div className="bg-white px-2 py-1">ครบ 3 ปี</div>
                    <div className="bg-white px-2 py-1 text-right font-bold">60%</div>
                    <div className="bg-white px-2 py-1">ครบ 4 ปี</div>
                    <div className="bg-white px-2 py-1 text-right font-bold">70%</div>
                    <div className="bg-white px-2 py-1">ครบ 5 ปี</div>
                    <div className="bg-white px-2 py-1 text-right font-bold">80%</div>
                    <div className="bg-white px-2 py-1">ครบ 6 ปี ขึ้นไป</div>
                    <div className="bg-white px-2 py-1 text-right font-bold text-green">
                      100%
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <b>เบิกได้ครั้งเดียวต่อเดือน</b> — ยื่นแล้วต้องรอเดือนถัดไป
                (รวมทั้งกรณีรออนุมัติและอนุมัติแล้ว · ปฏิเสธเท่านั้นที่ยื่นใหม่ได้)
              </li>
              <li>
                ADMIN กดอนุมัติ + <b>แนบสลิปการโอน</b> → ระบบส่งให้พนักงานเห็นในแอปและ
                LINE
              </li>
              <li>
                เดือนถัดไป → <b>หักจากเงินเดือนเต็มก้อน</b> รอบเดียวจบ
              </li>
              <li>
                <b className="text-red">บล็อกในวันสุดท้ายของเดือน</b> (วันทำเงินเดือน)
              </li>
            </ul>
          </Section>

          {/* รายการประจำเดือน */}
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconRefresh size={16} strokeWidth={2.4} />
                รายการประจำเดือน
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              ADMIN ตั้ง <b>รายรับ/รายจ่ายประจำเดือน</b> ในข้อมูลพนักงานได้ —
              จะถูกใช้ทุกเดือนจนกว่าจะลบ
            </p>
            <ul>
              <li>
                <b>รายรับ:</b> เช่น ค่าเดินทาง · เบี้ยขยัน → บวกเพิ่มในสลิป ทุกเดือน
              </li>
              <li>
                <b>รายจ่าย:</b> เช่น ค่าชุด · ค่าอาหาร → หักทุกเดือน
              </li>
              <li>แสดงในสลิปแยกบรรทัด · ชื่อรายการตามที่ ADMIN ตั้ง</li>
            </ul>
          </Section>

          {/* รายการพิเศษเฉพาะเดือน */}
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconPlus size={16} strokeWidth={2.4} />
                รายการพิเศษเฉพาะเดือน
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              ADMIN เพิ่ม <b>รายการพิเศษเฉพาะเดือนนั้น</b> ได้ในหน้าค่าคอม — ใช้ครั้งเดียว
              ไม่ต่อเนื่อง
            </p>
            <ul>
              <li>
                <b>รายรับพิเศษ:</b> เช่น โบนัสพิเศษ · ของขวัญปีใหม่ · เงินรางวัลแข่งขัน
              </li>
              <li>
                <b>หักพิเศษ:</b> เช่น ค่าของหาย · ค่าปรับลืมเก็บของ
              </li>
              <li>เห็นในสลิปเดือนนั้นๆ · ตามชื่อที่ ADMIN ตั้ง</li>
            </ul>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconHandCoins size={16} strokeWidth={2.4} />
                เงินกู้ผ่อนคืน
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              <b>ADMIN สร้างให้</b> — กำหนดเงินต้น + ผ่อนเดือนละ X บาท →
              ระบบหักจากเงินเดือนอัตโนมัติทุกเดือนจนครบ
            </p>
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconRuler size={14} strokeWidth={2.4} />
                  สูตรหักผ่อน
                </span>
              }
              color={COLORS.text}
            >
              <ul>
                <li>
                  <b>เรียงตามเดือนเริ่ม</b> — ก้อนเก่ากู้ก่อนหักก่อน · ก้อนใหม่หักทีหลัง
                </li>
                <li>
                  <b>หักเท่าที่มี</b> — ถ้าเงินเดือนไม่พอ หักได้แค่ที่เหลือ ·
                  ส่วนที่ขาดยกไปเดือนถัดไป
                </li>
                <li>
                  ผ่อนครบ → สถานะเปลี่ยนเป็น <b>"ผ่อนครบแล้ว"</b> อัตโนมัติ
                </li>
              </ul>
              <p className="mt-2 text-xs text-txt-soft">
                ระบบ <b>เก็บประวัติทุกครั้งที่หัก</b> — ดูย้อนหลังได้ · เดือนไหนหักไม่ครบ
                ก็ยกยอดเหลือไปเดือนถัดไปอัตโนมัติ
              </p>
            </Card>
          </Section>

          <Box bg={COLORS.goldPale} border={`${COLORS.gold}40`}>
            <div className="flex items-center gap-1 text-maroon font-bold mb-2">
              <IconLightbulb size={14} strokeWidth={2.4} />
              ตัวอย่าง: กู้ ฿30,000 ผ่อนเดือนละ ฿5,000
            </div>

            <div className="mb-2.5 text-xs text-txt-soft">
              เริ่มผ่อนเดือน มิถุนายน
            </div>

            <div className="flex flex-col gap-1.5">
              <div>
                <b>มิ.ย.</b> · เงินเดือนเหลือ ฿20,000
                <br />→ หัก <b>฿5,000</b>
                <span className="text-txt-soft text-xs"> (คงเหลือ 25,000)</span>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <b>ก.ค.</b> · เงินเดือนเหลือ ฿3,200{" "}
                <span className="text-amber text-xs">(ไม่พอ)</span>
                <br />→ หัก <b>฿3,200</b>{" "}
                <span className="text-txt-soft text-xs">
                  (เท่าที่มี · คงเหลือ 21,800)
                </span>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <b>ส.ค. – ต.ค.</b> · หักครบเดือนละ ฿5,000
                <br />
                <span className="text-txt-soft text-xs">→ คงเหลือ 6,800</span>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <b>พ.ย.</b> · หัก ฿5,000{" "}
                <span className="text-txt-soft text-xs">(คงเหลือ 1,800)</span>
              </div>

              <div className="pt-1.5 border-t border-[#C9973A30]">
                <b>ธ.ค.</b> · หัก <b>฿1,800</b> (เดือนสุดท้าย){" "}
                <span className="text-green font-bold inline-flex items-center gap-1">
                  → ผ่อนครบ
                  <IconCheck size={13} strokeWidth={2.8} />
                </span>
              </div>
            </div>
          </Box>
        </div>
      )}

      {tab === "lock" && (
        <div className="text-sm text-txt-mid leading-[1.8] animate-[fadeIn_0.18s_ease-out]">
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconLock size={16} strokeWidth={2.4} />
                ปิดรอบ 7 วันหลังยืนยันยอด
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              หลัง ADMIN กด "ยืนยันยอด" เดือนหนึ่งๆ — แก้ไขได้อีก <b>7 วัน</b> นับจากยืนยัน{" "}
              <b>ครั้งแรก</b> (ไม่รีเซ็ตเมื่อยืนยันใหม่). พ้นกำหนด ⇒{" "}
              <b className="text-red">ล็อกถาวร</b>
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconBan size={16} strokeWidth={2.4} />
                สิ่งที่ทำไม่ได้หลังปิดรอบ
              </span>
            }
            color={COLORS.red}
          >
            <Card title="ของเดือนที่ปิดรอบแล้ว" color={COLORS.text}>
              <ul>
                <li>แก้ค่าคอม / เงินเดือน</li>
                <li>ยื่นใบลา / ลบใบลา</li>
                <li>เบิกเงินล่วงหน้า / อนุมัติ-ปฏิเสธคำขอ</li>
                <li>ยืนยันยอดใหม่</li>
                <li>เพิ่ม/แก้รายการยกเว้นค่าคอม</li>
              </ul>
              <p className="mt-2 text-xs text-txt-soft">
                ระบบ <b>ล็อก 2 ชั้น</b> — ปุ่มในแอปจะกดไม่ได้ + เซิร์ฟเวอร์ปฏิเสธการบันทึก
                เพื่อป้องกันการแก้ย้อนหลัง
              </p>
            </Card>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconCheck size={16} strokeWidth={2.4} />
                ระหว่าง 7 วันแรก
              </span>
            }
            color={COLORS.green}
          >
            <p>
              ยังแก้/ยืนยันใหม่ได้ตามปกติ — เหมาะกับการ <b>ฟิกซ์ตัวเลข</b> ทีหลัง
              ถ้าพนักงานยื่นลาเพิ่ม หรือ ADMIN เพิ่งคิดเพิ่ม. ปุ่ม "ยืนยันยอดใหม่"
              จะเด้งขึ้นมาให้กดทันทีที่ข้อมูลเปลี่ยน
            </p>
          </Section>

          <Box bg={COLORS.goldPale} border={`${COLORS.gold}40`}>
            <b className="text-maroon inline-flex items-center gap-1">
              <IconLightbulb size={14} strokeWidth={2.4} />
              ทำไม 7 วัน?
            </b>
            <br />
            ให้เวลา ADMIN ปรับแก้ตัวเลขหลังจ่ายเงินจริง (พนักงานทักท้วง, พบลาเพิ่ม, คำนวณผิด
            ฯลฯ) — พอครบกำหนดล็อกถาวร เพื่อกัน ข้อมูลในอดีตเปลี่ยนแปลงโดยไม่ตั้งใจ
          </Box>
        </div>
      )}

      {tab === "docs" && (
        <div className="text-sm text-txt-mid leading-[1.8] animate-[fadeIn_0.18s_ease-out]">
          {/* สลิปเงินเดือน */}
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconClipboardList size={16} strokeWidth={2.4} />
                สลิปเงินเดือน
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              พิมพ์/บันทึก PDF สลิปประจำเดือนได้เองจากหน้า "เงินเดือน" — ปุ่ม <b>"พิมพ์"</b>{" "}
              ในการ์ดสลิปขวามือ
            </p>
            <ul>
              <li>
                เปิดได้หลัง ADMIN กด <b>"ยืนยันยอด"</b> ของเดือนนั้น · ก่อนนั้นปุ่มจะเป็นสีเทา
              </li>
              <li>
                สลิปมีรายละเอียดครบ: เงินเดือนพื้นฐานปัจจุบัน · ค่าคอม · โบนัส ·
                รายการหัก · เงินสุทธิ
              </li>
              <li>
                เลือก <b>"Save as PDF"</b> ในหน้าต่างพิมพ์ → ได้ไฟล์ PDF ค้นข้อความได้ ·
                ฟอนต์ไทย Sarabun
              </li>
            </ul>
          </Section>

          {/* หนังสือรับรองเงินเดือน */}
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconFileText size={16} strokeWidth={2.4} />
                หนังสือรับรองเงินเดือน
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              ออกหนังสือรับรองเงินเดือนได้เอง — ปุ่ม <b>"ใบรับรอง"</b> บน header
              ด้านบนของหน้าเงินเดือน
            </p>
            <ul>
              <li>
                <b>ใช้ได้ทันที</b> — ไม่ต้องรอ ADMIN ยืนยันยอด
                (อ้างเงินเดือนพื้นฐานปัจจุบันจากข้อมูลพนักงาน)
              </li>
              <li>
                เลือก <b>วัตถุประสงค์</b> (ค้ำประกัน, สมัครบัตรเครดิต ฯลฯ) หรือพิมพ์เอง —
                ข้อความจะถูกใส่ในหนังสือ
              </li>
              <li>
                <b>เลขที่อ้างอิง</b> รันอัตโนมัติ (เช่น พทม. 045/2569)
                เพื่อให้ตรวจสอบกลับมาที่ห้างได้
              </li>
              <li>
                มีอายุ <b>30 วัน</b> นับจากวันออก
              </li>
            </ul>
          </Section>

          {/* เงินเดือนขึ้นรายปี */}
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconTrendingDown
                  size={16}
                  strokeWidth={2.4}
                  className="rotate-180"
                />
                เงินเดือนขึ้นรายปี
              </span>
            }
            color={COLORS.green}
          >
            <p>
              <b>1 มกราคม ของทุกปี</b> เงินเดือนพื้นฐานจะถูกบวกอัตโนมัติ ตามที่ ADMIN ตั้งไว้
            </p>
            <ul>
              <li>
                เกณฑ์: ต้องทำงาน <b>ครบ 1 ปี</b> ก่อนถึงจะได้ขึ้น
              </li>
              <li>จำนวนที่ขึ้น = ADMIN ตั้งในหน้า "ข้อมูลพนักงาน"</li>
              <li>
                ADMIN <b>override</b> เฉพาะปีได้ (เช่น ปีนี้ขึ้นพิเศษ หรือไม่ขึ้นปีหนึ่ง)
              </li>
            </ul>
            <p className="mt-2 text-xs text-txt-soft">
              เห็นในสลิปเดือน ม.ค. ของปีถัดไป · ค้นหาในประวัติเงินเดือน ในหน้า "ข้อมูลพนักงาน"
            </p>
          </Section>
        </div>
      )}

      {tab === "duty" && (
        <div className="text-sm text-txt-mid leading-[1.8] animate-[fadeIn_0.18s_ease-out]">
          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconCalendarClock size={16} strokeWidth={2.4} />
                ตารางหน้าที่รับผิดชอบ
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              ADMIN กำหนดว่า <b>ตำแหน่งไหนทำหน้าที่อะไร</b> (เช่น ทำความสะอาด,
              จัดของแถม, Online) ระบบ <b>หมุนเวียนคนอัตโนมัติ</b> ตามลำดับ —
              ไม่ต้องแก้ทุกสัปดาห์/เดือน
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconRotate size={16} strokeWidth={2.4} />2 ประเภทหน้าที่
              </span>
            }
            color={COLORS.maroon}
          >
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconRotate size={14} strokeWidth={2.4} />
                  หมุนเวียน
                </span>
              }
              color={COLORS.text}
            >
              <ul>
                <li>
                  <b>รายสัปดาห์</b> — สลับคนทุก 7 วัน
                </li>
                <li>
                  <b>รายเดือน</b> — สลับคนทุกเดือน (เช่น Online)
                </li>
                <li>วนเป็นรอบ — ครบรอบหนึ่ง ทุกคนได้ทำหน้าที่นั้นคนละ 1 ครั้ง เท่ากันเสมอ</li>
              </ul>
            </Card>
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  <IconUserCheck size={14} strokeWidth={2.4} />
                  แทนคนลา
                </span>
              }
              color={COLORS.text}
            >
              <p>
                สำหรับตำแหน่งที่ไม่มีรอบหมุน (เช่น บัญชี) — เมื่อคนในตำแหน่งลา
                ระบบเลือกคนแทนจากรายชื่อที่ ADMIN ตั้งไว้ โดยเลือก{" "}
                <b>คนที่เคยแทนน้อยสุดก่อน</b> ให้ยุติธรรม
              </p>
            </Card>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconBanknote size={16} strokeWidth={2.4} />
                เงินค่าแทน
              </span>
            }
            color={COLORS.green}
          >
            <p>
              หน้าที่ <b>"แทนคนลา"</b> ตั้ง <b>"เงินตอบแทนต่อครั้งที่แทน"</b> ได้ —
              คนแทนได้เงินตามจำนวนวันที่ถูกเลือกในเดือนนั้น
            </p>
            <ul>
              <li>
                <b>สูตร:</b> เงินค่าแทน = อัตราต่อครั้ง × จำนวนวันที่แทนในเดือน
              </li>
              <li>
                ระบบนับอัตโนมัติตอน ADMIN <b>บันทึกเงินเดือน</b> — แสดงในสลิปแยกบรรทัด{" "}
                <b>"เงินค่าแทน"</b> +<b>รายละเอียดแยกหน้าที่</b>
              </li>
              <li>ไม่ตั้งอัตรา (หรือใส่ 0) → ไม่จ่าย (ทำหน้าที่แทนตามปกติ ไม่มีเงินเพิ่ม)</li>
            </ul>
            <p className="text-xs text-txt-soft mt-1.5">
              <b>ตัวอย่าง:</b> หน้าที่ "แทนบัญชี" ตั้ง ฿100/ครั้ง · พนักงาน A
              ถูกเลือกแทนบัญชีเดือนนี้ 3 วัน → ได้ <b className="text-green">฿300</b>{" "}
              เพิ่มในสลิป
            </p>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconHandshake size={16} strokeWidth={2.4} />
                คนลา → หาคนแทนอัตโนมัติ
              </span>
            }
            color={COLORS.maroon}
          >
            <ul>
              <li>คนที่ถึงคิวลา → ระบบเลื่อนหาคนถัดไปที่ว่าง</li>
              <li>
                <b>ไม่ทับหน้าที่อื่น</b> — ข้ามคนที่มีหน้าที่อื่นในวันนั้นก่อน
              </li>
              <li>
                <b>คนทำหน้าที่ประจำเดือนได้พัก</b> — ไม่ถูกเลือกเป็นคนแทน
                เพราะติดงานประจำเดือนของตัวเองอยู่แล้ว
              </li>
              <li>คนทำรายเดือนลา → ดึงคนที่ว่างมาคลุมให้</li>
            </ul>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconScale size={16} strokeWidth={2.4} />
                กติกาความยุติธรรม
              </span>
            }
            color={COLORS.green}
          >
            <ul>
              <li>
                <b>1 วัน 1 คน 1 หน้าที่</b> — ระบบกระจายหน้าที่ให้คนละคนเสมอ ไม่มีใครโดน 2
                หน้าที่พร้อมกัน (ยกเว้นคนน้อยกว่าหน้าที่ หรือมีคนลา)
              </li>
              <li>
                <b>ครบรอบ = เท่ากันเป๊ะ</b> — ถ้าทีมไม่เปลี่ยน ทุกคนได้แต่ละหน้าที่
                จำนวนครั้งเท่ากันทุกปี · มีคนน้อยกว่าหน้าที่ → คิว "พัก" ก็หมุนเวียนเท่ากัน
              </li>
              <li>
                <b>คนใหม่ต่อท้ายคิว</b> — พนักงานเข้าใหม่ไม่เบียดคิวใคร
                รอเข้ารอบหมุนถัดไปตามลำดับ
              </li>
            </ul>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconLock size={16} strokeWidth={2.4} />
                ตารางนิ่ง ไม่สะเทือนง่าย
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              คนที่ได้รับหน้าที่ของสัปดาห์/เดือนนี้แล้ว จะ<b>ถูกล็อกไว้จนจบรอบ</b> —
              ระหว่างรอบมีอะไรเปลี่ยน ตารางของคุณไม่เด้งไปมา:
            </p>
            <ul>
              <li>มีคนเข้า/ออกจากทีมกลางรอบ → คนทำหน้าที่รอบนี้คงเดิม</li>
              <li>ADMIN เพิ่ม/ลบหน้าที่อื่น → คิวหน้าที่ของคุณไม่ขยับ</li>
              <li>
                ยกเว้นคนที่ถูกล็อกไว้<b>ลาหรือออกจากทีม</b> → ระบบหาคนแทนทันที
              </li>
              <li>ขึ้นรอบใหม่ (สัปดาห์/เดือนถัดไป) → หมุนไปคนถัดไปตามปกติ</li>
            </ul>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1.5">
                <IconDiamond size={16} strokeWidth={2.4} />
                หน้าที่รายเดือน + สิทธิ์กองกลาง
              </span>
            }
            color={COLORS.maroon}
          >
            <p>
              หน้าที่ <b>รายเดือน</b> สามารถเปิดตัวเลือก <b>"ได้สิทธิ์กองกลางอัตโนมัติ"</b> ได้
              — เพราะคนทำติดงานทั้งเดือน ขายไม่ทันเพื่อนร่วมงาน · จึงได้แบ่งกองทุกรายการแม้ยอดไม่ถึง
              80%
            </p>
            <ul>
              <li>
                แต่ถ้า ADMIN ปิดสิทธิ์ไว้ (ปิดเฉพาะรายการ / ปิดทั้งหมด){" "}
                <b>ยังถูกตัดตามที่ ADMIN ตั้ง</b>
              </li>
              <li>เกณฑ์ "ได้เงินเดือนพื้นฐาน 50%" ก็ยังใช้ปกติ ไม่ยกเว้น</li>
              <li>
                คนที่ ADMIN ปิดสิทธิ์ <b>ทั้งหมด</b> → ไม่ควรไปทำหน้าที่รายเดือน
                (เสี่ยงยอดรายการหลักไม่ถึง 50% → หลุดเงินเดือนพื้นฐาน)
              </li>
            </ul>
          </Section>

          <Box bg={COLORS.goldPale} border={`${COLORS.gold}40`}>
            <b className="text-maroon inline-flex items-center gap-1">
              <IconCalendarRange size={14} strokeWidth={2.4} />
              ปฏิทินหน้าที่ล่วงหน้า
            </b>
            <br />
            กดปุ่ม "ดูล่วงหน้า" เพื่อดูตารางหมุนเวียนไปจนถึงสิ้นปี — วางแผนเตรียมตัวได้ (พนักงานดู
            "เฉพาะของคุณ" ได้)
          </Box>
        </div>
      )}

      {/* close */}
      <button
        onClick={onClose}
        className="w-full p-3.5 mt-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
      >
        ปิด
      </button>
    </BaseModal>
  );
}
