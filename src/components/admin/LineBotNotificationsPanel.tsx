/* ─── LINE Bot Notifications Panel ─────────────────────────────
   Admin toggle เปิด-ปิดการแจ้งเตือนรายประเภท

   3 toggle:
   - dailySummaryEnabled    — สรุปประจำวัน 07:30 push เข้ากลุ่ม
   - advanceRequestEnabled  — แจ้งเตือน admin เมื่อพนักงานยื่นเบิกเงิน
   - advanceApprovalEnabled — แจ้งเตือนพนักงานเมื่ออนุมัติ/ปฏิเสธ

   Default semantic: missing field / true = enabled (backward compat).      */

import {
  Banknote as IconBanknote,
  Bell as IconBell,
  CheckCircle2 as IconCheckCircle,
  Clock as IconClock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  type NotificationSettings,
  subscribeNotificationSettings,
  updateNotificationSettings,
} from "../../firebase/notificationSettings";

interface LineBotNotificationsPanelProps {
  showToast?: (message: string) => void;
}

export default function LineBotNotificationsPanel({
  showToast,
}: LineBotNotificationsPanelProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

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

  // Default semantic: ไม่ใช่ false → enabled
  const isOn = (field: keyof NotificationSettings) => settings[field] !== false;

  async function toggle(
    field:
      | "dailySummaryEnabled"
      | "advanceRequestEnabled"
      | "advanceApprovalEnabled",
  ) {
    const next = !isOn(field);
    setSaving(field);
    try {
      await updateNotificationSettings(
        { [field]: next },
        user?.uid || "anonymous",
      );
      showToast?.(`${next ? "เปิด" : "ปิด"}การแจ้งเตือนเรียบร้อย`);
    } catch (err) {
      console.error("[LineBotNotificationsPanel] toggle error:", err);
      showToast?.("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(null);
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
          description="bot push ภารกิจ + คนหยุด + เคล็ดลับ เข้ากลุ่ม we r mukda ทุกเช้า"
          enabled={isOn("dailySummaryEnabled")}
          saving={saving === "dailySummaryEnabled"}
          disabled={loading}
          onToggle={() => toggle("dailySummaryEnabled")}
        />
        <ToggleRow
          icon={IconBanknote}
          title="คำขอเบิกเงินล่วงหน้า"
          description="แจ้ง admin เมื่อพนักงานยื่นเบิกเงินใหม่"
          enabled={isOn("advanceRequestEnabled")}
          saving={saving === "advanceRequestEnabled"}
          disabled={loading}
          onToggle={() => toggle("advanceRequestEnabled")}
        />
        <ToggleRow
          icon={IconCheckCircle}
          title="ผลอนุมัติคำขอเบิกเงิน"
          description="แจ้งพนักงานเมื่อ admin อนุมัติหรือปฏิเสธคำขอ"
          enabled={isOn("advanceApprovalEnabled")}
          saving={saving === "advanceApprovalEnabled"}
          disabled={loading}
          onToggle={() => toggle("advanceApprovalEnabled")}
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
  saving,
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
  saving: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || saving}
      className={`w-full text-left px-3.5 py-3 rounded-[12px] border-[1.5px] transition-colors cursor-pointer font-[inherit] ${
        enabled ? "bg-cream border-gold/40" : "bg-white border-bdr opacity-70"
      } ${disabled || saving ? "cursor-wait" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center ${
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
        <ToggleSwitch enabled={enabled} disabled={disabled || saving} />
      </div>
    </button>
  );
}

function ToggleSwitch({
  enabled,
  disabled,
}: {
  enabled: boolean;
  disabled: boolean;
}) {
  return (
    <div
      className={`shrink-0 mt-1 w-11 h-6 rounded-full transition-colors ${
        enabled ? "bg-green" : "bg-bdr"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${
          enabled ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </div>
  );
}
