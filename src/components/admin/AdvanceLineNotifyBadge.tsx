import {
  TriangleAlert as IconAlert,
  LoaderCircle as IconLoader,
  RefreshCw as IconRefresh,
} from "lucide-react";
import { useState } from "react";
import { retryAdvanceAdminNotify } from "../../firebase/advanceNotify";
import type { AdvanceRequest } from "../../types";
import { diagnoseLineNotifyError } from "../../utils/lineNotifyError";

/**
 * ป้ายแดง "LINE แจ้งเตือนแอดมินไม่สำเร็จ" บนการ์ดคำขอเบิก — LINE คือช่องที่พัง
 * จึงแจ้ง admin ในแอปแทน · บอกสาเหตุเป็นไทย (แปลจาก `lineNotifyError`) +
 * ปุ่มส่งซ้ำ · ส่งสำเร็จ server ล้างธง → ป้ายหายเองผ่าน realtime subscription
 */
export default function AdvanceLineNotifyBadge({
  request,
  showToast,
}: {
  request: AdvanceRequest;
  showToast?: (message: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const diag = diagnoseLineNotifyError(request.lineNotifyError);
  const sentCount = request.lineNotifySentCount;
  const adminCount = request.lineNotifyAdminCount;
  const partial =
    typeof sentCount === "number" &&
    typeof adminCount === "number" &&
    sentCount > 0 &&
    sentCount < adminCount;

  async function handleRetry() {
    if (sending) return;
    setSending(true);
    try {
      const res = await retryAdvanceAdminNotify(String(request.id));
      if (res.ok) {
        showToast?.("ส่งแจ้งเตือนเข้า LINE แอดมินแล้ว");
      } else {
        showToast?.(`ส่งไม่สำเร็จ: ${diagnoseLineNotifyError(res.error).title}`);
      }
    } catch (e) {
      console.error("retryAdvanceAdminNotify failed:", e);
      showToast?.("ส่งไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-start gap-2 mb-2.5 px-3 py-2.5 bg-[#FEF2F2] border border-[#FCA5A5] rounded-[10px]">
      <IconAlert
        size={16}
        strokeWidth={2.2}
        className="text-[#DC2626] shrink-0 mt-px"
      />
      <div className="flex-1 min-w-0 text-xs text-[#B91C1C] leading-snug">
        <div className="font-bold">
          {partial
            ? `LINE แจ้งเตือนแอดมินได้ไม่ครบ (${sentCount}/${adminCount} คน)`
            : "LINE แจ้งเตือนแอดมินไม่สำเร็จ"}
        </div>
        <div className="mt-0.5">
          <span className="font-semibold">สาเหตุ:</span> {diag.title}
        </div>
        <div className="text-[#DC2626]/80 mt-px">{diag.hint}</div>
        {request.lineNotifyError && (
          <div
            className="text-[#DC2626]/60 mt-1 break-all line-clamp-2"
            title={request.lineNotifyError}
          >
            {request.lineNotifyError}
          </div>
        )}
        <button
          type="button"
          onClick={handleRetry}
          disabled={sending}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FCA5A5] bg-white text-[#B91C1C] font-semibold font-[inherit] cursor-pointer disabled:opacity-60 disabled:cursor-default"
        >
          {sending ? (
            <IconLoader size={14} className="animate-spin" />
          ) : (
            <IconRefresh size={14} strokeWidth={2.2} />
          )}
          {sending ? "กำลังส่ง..." : "ส่งแจ้งเตือนอีกครั้ง"}
        </button>
      </div>
    </div>
  );
}
