/* ─── กลุ่มที่รับสรุปเช้า (07:30) ────────────────────────────────────
   ADMIN เพิ่ม/ลบ/ตั้งค่ากลุ่ม LINE เองได้ — เดิม hardcode ใน
   `functions/src/dailySummary/config.ts` ต้องแก้โค้ด + deploy ทุกครั้ง

   เก็บที่ `config/notifications.dailySummaryGroups`
   · ยังไม่เคยตั้ง (field หาย) → Cloud Function ใช้ค่าเดิมในโค้ด แล้ว
     seed ลง Firestore ให้ครั้งแรก → กลุ่มจริงจะโผล่มาในหน้านี้เอง
   · ลบจนหมด (array ว่าง) = ตั้งใจไม่ส่ง — การ์ดจะเตือนให้เห็นชัด          */

import {
  CalendarDays as IconCalendar,
  DownloadCloud as IconDownload,
  Image as IconImage,
  Lightbulb as IconLightbulb,
  Plus as IconPlus,
  Trash2 as IconTrash,
  UserMinus as IconUserMinus,
  Users as IconUsers,
} from "lucide-react";
import { useState } from "react";
import {
  type DailySummaryGroupConfig,
  isValidLineTargetId,
} from "../../utils/dailySummaryGroups";
import ToggleSwitch from "../shared/ToggleSwitch";

interface Props {
  /** undefined = ยังไม่เคยตั้งค่า (ระบบใช้ค่าเดิมในโค้ดอยู่) */
  groups: DailySummaryGroupConfig[] | undefined;
  loading?: boolean;
  onSave: (groups: DailySummaryGroupConfig[]) => Promise<void>;
  /** ดึงกลุ่มเริ่มต้นที่ฝังไว้ในโค้ดฝั่ง server ลง Firestore ทันที */
  onLoadDefaults: () => Promise<void>;
}

const FIELD_CLASS =
  "w-full py-2 px-3 rounded-[9px] text-sm leading-normal outline-none font-[inherit] text-txt border-[1.5px] border-bdr bg-white";

export default function DailySummaryGroupsCard({
  groups,
  loading = false,
  onSave,
  onLoadDefaults,
}: Props) {
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const list = groups ?? [];
  const notConfigured = groups === undefined;

  async function commit(next: DailySummaryGroupConfig[]) {
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  function add() {
    const id = newId.trim();
    if (!isValidLineTargetId(id)) {
      setErr("Group ID ไม่ถูกต้อง — ต้องขึ้นต้นด้วย C / R / U แล้วตามด้วยตัวอักษร 32 ตัว");
      return;
    }
    if (list.some((g) => g.lineTargetId === id)) {
      setErr("กลุ่มนี้อยู่ในรายการแล้ว");
      return;
    }
    setErr("");
    commit([
      ...list,
      {
        lineTargetId: id,
        name: newName.trim() || id.slice(0, 8),
        sendAiTip: false,
        includeLeaves: false,
        sendScheduledImage: false,
      },
    ]);
    setNewId("");
    setNewName("");
  }

  function patch(id: string, fields: Partial<DailySummaryGroupConfig>) {
    commit(list.map((g) => (g.lineTargetId === id ? { ...g, ...fields } : g)));
  }

  return (
    <div className="bg-white rounded-[14px] border border-bdr p-3.5 mt-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="font-bold text-sm text-txt inline-flex items-center gap-1.5">
          <IconUsers size={16} strokeWidth={2.4} className="text-maroon" />
          กลุ่มที่รับสรุปเช้า
        </div>
        <span className="text-xs text-txt-soft">
          {loading ? "กำลังโหลด..." : `${list.length} กลุ่ม`}
        </span>
      </div>

      {!loading && notConfigured && (
        <div className="rounded-[10px] bg-gold-pale/50 border border-gold/30 px-3 py-2.5 mb-3 text-xs text-txt-mid leading-relaxed">
          ยังไม่เคยตั้งกลุ่มในหน้านี้ — ระบบยังส่งตาม<b>ค่าเดิมที่ตั้งไว้ในโค้ด</b> ·
          กดปุ่มด้านล่างเพื่อดึงกลุ่มจริงลงมาแก้ที่นี่
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onLoadDefaults();
              } finally {
                setSaving(false);
              }
            }}
            className={`mt-2 w-full py-2 rounded-[9px] text-xs font-bold text-white cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${
              saving ? "bg-bdr cursor-wait" : "bg-maroon"
            }`}
          >
            <IconDownload size={13} strokeWidth={2.6} />
            {saving ? "กำลังโหลด..." : "โหลดกลุ่มเริ่มต้นจากระบบ"}
          </button>
        </div>
      )}
      {!loading && !notConfigured && list.length === 0 && (
        <div className="rounded-[10px] bg-red-lt border border-red/25 px-3 py-2.5 mb-3 text-xs text-txt-mid leading-relaxed">
          <b className="text-red">ไม่มีกลุ่มปลายทาง — สรุปเช้าจะไม่ถูกส่ง</b>
          <br />
          เชิญบอทเข้ากลุ่ม แล้วพิมพ์ "ไอดีกลุ่ม" ในกลุ่มนั้นเพื่อดู ID
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {list.map((g) => (
          <div
            key={g.lineTargetId}
            className="rounded-[11px] border border-bdr bg-cream p-3"
          >
            <div className="flex items-start gap-2 mb-2">
              <input
                type="text"
                value={g.name}
                onChange={(e) =>
                  patch(g.lineTargetId, { name: e.target.value })
                }
                placeholder="ชื่อกลุ่ม"
                className={`${FIELD_CLASS} font-bold flex-1`}
              />
              <button
                type="button"
                aria-label="ลบกลุ่ม"
                disabled={saving}
                onClick={() =>
                  commit(list.filter((x) => x.lineTargetId !== g.lineTargetId))
                }
                className="shrink-0 w-9 h-9 rounded-[9px] bg-red-lt border-[1.5px] border-[#C0392B30] flex items-center justify-center cursor-pointer active:scale-[0.92] transition-transform"
              >
                <IconTrash size={14} className="text-red" strokeWidth={2.2} />
              </button>
            </div>

            <div className="text-[11px] text-txt-soft font-[Prompt,monospace] break-all mb-2">
              {g.lineTargetId}
            </div>

            <label className="text-[11px] text-txt-mid font-semibold mb-1 flex items-center gap-1">
              <IconCalendar size={12} strokeWidth={2.4} />
              Google Calendar ID (ถ้ามี)
            </label>
            <input
              type="text"
              value={g.calendarId || ""}
              onChange={(e) =>
                patch(g.lineTargetId, { calendarId: e.target.value })
              }
              placeholder="เว้นว่าง = ไม่ดึงภารกิจจากปฏิทิน"
              className={`${FIELD_CLASS} mb-2.5 text-xs`}
            />

            <div className="flex flex-col gap-1.5">
              <GroupToggle
                on={!!g.includeLeaves}
                Icon={IconUserMinus}
                label="พนักงานหยุดวันนี้"
                hint="ใช้กับกลุ่มพนักงานเท่านั้น"
                disabled={saving}
                onClick={() =>
                  patch(g.lineTargetId, { includeLeaves: !g.includeLeaves })
                }
              />
              <GroupToggle
                on={!!g.sendAiTip}
                Icon={IconLightbulb}
                label="เคล็ดลับมืออาชีพ (AI)"
                hint="ใช้ ANTHROPIC_API_KEY"
                disabled={saving}
                onClick={() =>
                  patch(g.lineTargetId, { sendAiTip: !g.sendAiTip })
                }
              />
              <GroupToggle
                on={!!g.sendScheduledImage}
                Icon={IconImage}
                label="แนบรูปที่ตั้งวันไว้"
                hint="จาก LINE BOT → รูปแนบสรุปเช้า"
                disabled={saving}
                onClick={() =>
                  patch(g.lineTargetId, {
                    sendScheduledImage: !g.sendScheduledImage,
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>

      {/* เพิ่มกลุ่มใหม่ */}
      <div className="mt-3 pt-3 border-t border-bdr">
        <div className="text-[11px] text-txt-soft mb-1.5 leading-relaxed">
          เชิญบอทเข้ากลุ่ม แล้วพิมพ์ <b>"ไอดีกลุ่ม"</b> ในกลุ่มนั้นเพื่อดู ID
        </div>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ชื่อกลุ่ม (ไม่ใส่ก็ได้)"
          className={`${FIELD_CLASS} mb-2`}
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newId}
            onChange={(e) => {
              setNewId(e.target.value);
              if (err) setErr("");
            }}
            placeholder="วาง Group ID ที่นี่ (ขึ้นต้นด้วย C หรือ U)"
            className={`${FIELD_CLASS} flex-1 font-[Prompt,monospace] ${err ? "border-red" : ""}`}
          />
          <button
            type="button"
            disabled={saving || !newId.trim()}
            onClick={add}
            className={`shrink-0 px-3.5 rounded-[9px] text-sm font-bold text-white cursor-pointer font-[inherit] inline-flex items-center gap-1 active:scale-[0.97] transition-transform ${
              saving || !newId.trim()
                ? "bg-bdr cursor-not-allowed"
                : "bg-maroon"
            }`}
          >
            <IconPlus size={14} strokeWidth={2.6} />
            เพิ่ม
          </button>
        </div>
        {err && <div className="text-red text-xs mt-1.5">{err}</div>}
      </div>
    </div>
  );
}

function GroupToggle({
  on,
  Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  on: boolean;
  Icon: typeof IconUsers;
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-[9px] bg-white border border-bdr cursor-pointer font-[inherit] active:scale-[0.99] transition-transform"
    >
      <ToggleSwitch enabled={on} />
      <Icon size={13} strokeWidth={2.3} className="text-maroon shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-txt">{label}</span>
        <span className="block text-[10px] text-txt-soft">{hint}</span>
      </span>
    </button>
  );
}
