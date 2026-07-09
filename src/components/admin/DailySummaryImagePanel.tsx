/* ─── Daily Summary Image Panel ────────────────────────────────
   Admin อัปโหลดรูป + กำหนดวันส่ง → Cloud Function (sendDailySummary)
   แนบรูปเข้าข้อความสรุปเช้า 07:30 ของกลุ่ม "we r mukda" ในวันนั้น
   (ส่งครั้งเดียว · หลังส่งแล้วขึ้นสถานะ "ส่งแล้ว")

   หมายเหตุ: วันเสาร์ปกติ (ร้านปิด) bot ไม่ส่งสรุปเช้า → รูปที่ตั้งไว้วันนั้น
   จะไม่ถูกส่ง เว้นแต่เป็นเสาร์เปิดพิเศษ                                    */

import {
  CalendarClock as IconCalendarClock,
  CheckCircle2 as IconCheck,
  ImagePlus as IconImagePlus,
  Trash2 as IconTrash,
  Upload as IconUpload,
  X as IconX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  addDailySummaryImage,
  type DailySummaryImage,
  deleteDailySummaryImage,
  subscribeDailySummaryImages,
} from "../../firebase/dailySummaryImages";
import { fmtDateWithWeekday, todayYmd } from "../../utils/dateUtils";
import { resizeImage } from "../../utils/imageUtils";
import BaseModal from "../shared/BaseModal";
import CalendarPicker from "../shared/CalendarPicker";
import { SkeletonRow } from "../shared/Skeleton";
import Spinner from "../shared/Spinner";

interface Props {
  showToast?: (message: string) => void;
}

/** resize รูปให้พอเหมาะกับ LINE (preview ต้อง ≤ 1MB) */
function resizeSummaryImage(file: File): Promise<string> {
  return resizeImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.88,
    maxBytes: 850 * 1024,
  });
}

export default function DailySummaryImagePanel({ showToast }: Props) {
  const { user } = useAuth();
  const [images, setImages] = useState<DailySummaryImage[]>([]);
  const [loading, setLoading] = useState(true);

  // draft form
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeDailySummaryImages(
      (list) => {
        setImages(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  async function pickImage(file: File) {
    setErr("");
    setResizing(true);
    try {
      setDataUrl(await resizeSummaryImage(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อ่านรูปไม่สำเร็จ");
    } finally {
      setResizing(false);
    }
  }

  async function submit() {
    if (!dataUrl) return setErr("กรุณาเลือกรูป");
    if (!date) return setErr("กรุณาเลือกวันที่จะส่ง");
    setErr("");
    setSaving(true);
    try {
      await addDailySummaryImage(
        { date, imageDataUrl: dataUrl, note },
        user?.uid || "admin",
      );
      setDate("");
      setNote("");
      setDataUrl(null);
      showToast?.("ตั้งเวลาส่งรูปเรียบร้อย");
    } catch (e) {
      console.error("[DailySummaryImagePanel] submit error:", e);
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteDailySummaryImage(id);
      setConfirmDeleteId(null);
      showToast?.("ลบรูปเรียบร้อย");
    } catch (e) {
      console.error("[DailySummaryImagePanel] delete error:", e);
      showToast?.("ลบไม่สำเร็จ");
    }
  }

  const today = todayYmd();

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <IconImagePlus size={18} strokeWidth={2.4} className="text-maroon" />
        <h2 className="text-lg font-extrabold text-txt">รูปแนบสรุปเช้า</h2>
      </div>
      <p className="text-sm text-txt-soft mb-4 leading-relaxed">
        อัปโหลดรูป + เลือกวันที่จะส่ง — บอทจะแนบรูปเข้าข้อความสรุปเช้า 07:30 ของกลุ่ม{" "}
        <b className="text-maroon">we r mukda</b> ในวันนั้น (ส่งครั้งเดียว) ·
        รูปจะถูกลบอัตโนมัติในวันถัดไปหลังพ้นวันส่ง
      </p>

      {/* ── ฟอร์มเพิ่มรูป ── */}
      <div className="bg-cream rounded-[14px] border border-gold/30 p-3.5 mb-5">
        {dataUrl ? (
          <div className="relative mb-3">
            <img
              src={dataUrl}
              alt="รูปที่จะส่ง"
              className="block w-full max-h-64 object-contain rounded-[10px] border border-bdr bg-white"
            />
            <button
              type="button"
              onClick={() => setDataUrl(null)}
              aria-label="ลบรูป"
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white border border-bdr flex items-center justify-center cursor-pointer shadow"
            >
              <IconX size={14} className="text-txt-mid" strokeWidth={2.4} />
            </button>
          </div>
        ) : (
          <label className="block px-3.5 py-4 mb-3 rounded-[10px] border-[1.5px] border-dashed border-gold/40 bg-gold-pale text-maroon text-sm font-semibold cursor-pointer font-[inherit] text-center">
            {resizing ? (
              "กำลังย่อรูป..."
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <IconUpload size={14} strokeWidth={2.4} />
                เลือกรูป
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={resizing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickImage(f);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
        )}

        <div className="mb-3">
          <div className="text-xs font-bold text-txt-mid mb-1.5">วันที่จะส่ง</div>
          <CalendarPicker
            value={date}
            onChange={setDate}
            minDate={today}
            disableSaturdays={false}
          />
        </div>

        <div className="mb-3">
          <div className="text-xs font-bold text-txt-mid mb-1.5">
            หมายเหตุ (ไม่บังคับ · เห็นเฉพาะ admin)
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="เช่น โปสเตอร์โปรโมชั่นเดือนนี้"
            className="w-full px-3 py-2.5 rounded-[10px] border-[1.5px] border-bdr bg-white text-sm text-txt font-[inherit] outline-none focus:border-gold"
          />
        </div>

        {err && (
          <div className="text-red text-sm mb-3 font-semibold">{err}</div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={saving || resizing}
          className={`w-full p-3 rounded-xl border-none text-base font-bold font-[inherit] inline-flex items-center justify-center gap-2 ${
            saving || resizing
              ? "bg-bdr text-txt-soft cursor-not-allowed"
              : "bg-maroon text-white shadow-[0_4px_14px_rgba(123,28,28,0.25)] cursor-pointer active:scale-[0.99]"
          }`}
        >
          {saving ? <Spinner size={16} /> : <IconCalendarClock size={16} />}
          {saving ? "กำลังบันทึก..." : "ตั้งเวลาส่งรูป"}
        </button>
      </div>

      {/* ── รายการรูปที่ตั้งเวลาไว้ ── */}
      <div className="text-sm font-bold text-txt mb-2">
        รูปที่ตั้งเวลาไว้ {images.length > 0 && `(${images.length})`}
      </div>
      {loading ? (
        <SkeletonRow />
      ) : images.length === 0 ? (
        <div className="bg-cream-dk rounded-[12px] px-4 py-6 text-center text-sm text-txt-soft">
          ยังไม่มีรูปที่ตั้งเวลาไว้
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {images.map((img) => {
            const sent = !!img.sentAt;
            return (
              <div
                key={img.id}
                className="flex items-center gap-3 bg-white rounded-[12px] border border-bdr p-2.5"
              >
                <button
                  type="button"
                  onClick={() => setViewingUrl(img.imageUrl)}
                  className="shrink-0 cursor-pointer border-none bg-transparent p-0"
                  aria-label="ดูรูป"
                >
                  <img
                    src={img.imageUrl}
                    alt={img.note || "รูปแนบ"}
                    className="w-14 h-14 object-cover rounded-[8px] border border-bdr"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-txt truncate">
                    {fmtDateWithWeekday(img.date)}
                  </div>
                  {img.note && (
                    <div className="text-xs text-txt-soft truncate mt-0.5">
                      {img.note}
                    </div>
                  )}
                  <div className="mt-1">
                    {sent ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green">
                        <IconCheck size={12} strokeWidth={2.6} />
                        ส่งแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-gold">
                        <IconCalendarClock size={12} strokeWidth={2.6} />
                        รอส่ง
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(img.id)}
                  aria-label="ลบ"
                  className="shrink-0 w-9 h-9 rounded-[10px] border border-bdr bg-white flex items-center justify-center cursor-pointer text-red active:scale-95"
                >
                  <IconTrash size={16} strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {viewingUrl && (
        <BaseModal
          onClose={() => setViewingUrl(null)}
          maxWidthClass="max-w-[500px]"
          contentClassName="px-4 pt-4 pb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <IconImagePlus
              size={18}
              strokeWidth={2.2}
              className="text-maroon"
            />
            <div className="font-bold text-base text-txt">รูปแนบสรุปเช้า</div>
          </div>
          <img
            src={viewingUrl}
            alt="รูปแนบ"
            className="block w-full rounded-[10px] border border-bdr"
          />
        </BaseModal>
      )}

      {confirmDeleteId && (
        <BaseModal
          onClose={() => setConfirmDeleteId(null)}
          maxWidthClass="max-w-[380px]"
          contentClassName="px-5 pt-5 pb-5"
        >
          <div className="font-bold text-base text-txt mb-2">ลบรูปนี้?</div>
          <p className="text-sm text-txt-soft mb-4 leading-relaxed">
            รูปที่ตั้งเวลาไว้จะถูกลบ — ถ้ายังไม่ได้ส่งก็จะไม่ถูกส่งอีก
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="flex-1 p-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit]"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => remove(confirmDeleteId)}
              className="flex-1 p-3 rounded-xl border-none bg-red text-white text-base font-bold cursor-pointer font-[inherit]"
            >
              ลบ
            </button>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
