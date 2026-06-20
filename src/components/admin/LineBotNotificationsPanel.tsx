/* ─── LINE Bot Notifications Panel ─────────────────────────────
   Admin toggle เปิด-ปิดการแจ้งเตือนรายประเภท

   4 toggles:
   - dailySummaryEnabled    — สรุปประจำวัน 07:30 push เข้ากลุ่ม (3 กลุ่ม ·
                              we r mukda ได้ครบ · อีก 2 ส่งเฉพาะมี event ·
                              เสาร์ปกติข้าม)
   - advanceRequestEnabled  — แจ้ง ADMIN เมื่อพนักงานยื่นเบิกเงิน + clipboard
                              copy เลขบัญชี
   - advanceApprovalEnabled — แจ้งพนักงานเมื่อ admin อนุมัติ/ปฏิเสธ ·
                              approve → แนบสลิปการโอน · reject → เหตุผล
   - loanCreatedEnabled     — แจ้งพนักงานเมื่อ admin สร้างเงินกู้ใหม่ +
                              สลิปการโอน (ถ้าแนบไว้)

   Default semantic: missing field / true = enabled (backward compat).      */

import {
  Banknote as IconBanknote,
  Bell as IconBell,
  CheckCircle2 as IconCheckCircle,
  Clock as IconClock,
  HandCoins as IconHandCoins,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  type NotificationSettings,
  subscribeNotificationSettings,
  updateNotificationSettings,
} from "../../firebase/notificationSettings";
import ToggleSwitch from "../shared/ToggleSwitch";

interface LineBotNotificationsPanelProps {
  showToast?: (message: string) => void;
}

export default function LineBotNotificationsPanel({
  showToast,
}: LineBotNotificationsPanelProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({});
  const [loading, setLoading] = useState(true);
  // Optimistic overrides — flip toggle ทันทีโดยไม่รอ Firestore round-trip
  // Subscription return → settings มี value ใหม่ → merge เป็น authoritative
  const [optimistic, setOptimistic] = useState<NotificationSettings>({});

  useEffect(() => {
    const unsub = subscribeNotificationSettings(
      (s) => {
        setSettings(s);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  // View = settings + optimistic overrides (optimistic ชนะ)
  // Default semantic: ไม่ใช่ false → enabled
  const isOn = (field: keyof NotificationSettings) => {
    if (field in optimistic) return optimistic[field] !== false;
    return settings[field] !== false;
  };

  async function toggle(
    field:
      | "dailySummaryEnabled"
      | "advanceRequestEnabled"
      | "advanceApprovalEnabled"
      | "loanCreatedEnabled",
  ) {
    const next = !isOn(field);
    // Flip ทันที (optimistic) — switch เคลื่อนทันที ผู้ใช้ไม่รู้สึกหน่วง
    setOptimistic((prev) => ({ ...prev, [field]: next }));
    try {
      await updateNotificationSettings(
        { [field]: next },
        user?.uid || "anonymous",
      );
      showToast?.(`${next ? "เปิด" : "ปิด"}การแจ้งเตือนเรียบร้อย`);
    } catch (err) {
      // Rollback: ลบ override ของ field นี้ → กลับไปแสดง value จาก Firestore
      console.error("[LineBotNotificationsPanel] toggle error:", err);
      setOptimistic((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
      showToast?.("บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <IconBell size={18} strokeWidth={2.4} className="text-maroon" />
        <h2 className="text-lg font-extrabold text-txt">การแจ้งเตือน LINE</h2>
      </div>
      <p className="text-sm text-txt-soft mb-4 leading-relaxed">
        เปิด-ปิดการแจ้งเตือนรายประเภทได้ตามต้องการ — เปลี่ยนแล้วมีผลทันที ไม่ต้องรอ deploy
      </p>

      <div className="flex flex-col gap-2.5">
        <ToggleRow
          icon={IconClock}
          title="สรุปประจำวัน 07:30"
          description="Bot push เข้า 3 กลุ่ม LINE · we r mukda ได้ครบชุด (ภารกิจ + คนหยุดวันนี้ + เคล็ดลับมืออาชีพจาก Claude) ทุกเช้า · Various Tasks + KS Apartment ส่งเฉพาะวันที่มี event ใน Google Calendar · ข้ามวันเสาร์ปกติ (ส่งเฉพาะเสาร์เปิดพิเศษ)"
          enabled={isOn("dailySummaryEnabled")}
          disabled={loading}
          onToggle={() => toggle("dailySummaryEnabled")}
        />
        <ToggleRow
          icon={IconBanknote}
          title="คำขอเบิกเงินใหม่ → ADMIN"
          description="แจ้ง ADMIN ทันทีเมื่อพนักงานยื่นคำขอ · แสดงจำนวนเงิน · เหตุผล · เดือน · ชื่อธนาคาร + เลขบัญชี · มีปุ่มคัดลอกเลขบัญชีในแชท"
          enabled={isOn("advanceRequestEnabled")}
          disabled={loading}
          onToggle={() => toggle("advanceRequestEnabled")}
        />
        <ToggleRow
          icon={IconCheckCircle}
          title="ผลอนุมัติเบิกเงิน → พนักงาน"
          description="แจ้งพนักงานเมื่อ ADMIN อนุมัติ/ปฏิเสธคำขอ · อนุมัติ → แนบสลิปการโอนที่ ADMIN อัปโหลด · ปฏิเสธ → แนบเหตุผลปฏิเสธ · worker ตรวจทุกนาที"
          enabled={isOn("advanceApprovalEnabled")}
          disabled={loading}
          onToggle={() => toggle("advanceApprovalEnabled")}
        />
        <ToggleRow
          icon={IconHandCoins}
          title="เงินกู้ใหม่ → พนักงาน"
          description="แจ้งพนักงานเมื่อ ADMIN สร้างเงินกู้ผ่อนคืน · แสดงเงินต้น · ผ่อนเดือนละ · เริ่มหัก · จำนวนเดือน + แนบสลิปการโอน (ถ้า ADMIN อัปโหลดไว้) · worker ตรวจทุกนาที"
          enabled={isOn("loanCreatedEnabled")}
          disabled={loading}
          onToggle={() => toggle("loanCreatedEnabled")}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  title: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-full text-left px-3.5 py-3 rounded-[12px] border-[1.5px] transition-all duration-150 cursor-pointer font-[inherit] active:scale-[0.99] ${
        enabled ? "bg-cream border-gold/40" : "bg-white border-bdr opacity-70"
      } ${disabled ? "cursor-wait" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center transition-colors ${
            enabled ? "bg-gold-pale" : "bg-bdr"
          }`}
        >
          <Icon
            size={16}
            strokeWidth={2.4}
            className={enabled ? "text-maroon" : "text-txt-soft"}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-txt">{title}</div>
          <div className="text-xs text-txt-soft mt-0.5 leading-relaxed">
            {description}
          </div>
        </div>
        <div className="shrink-0 mt-1">
          <ToggleSwitch enabled={enabled} disabled={disabled} />
        </div>
      </div>
    </button>
  );
}
