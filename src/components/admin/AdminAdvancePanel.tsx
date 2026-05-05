import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { C } from "../../constants";
import { uploadAdvanceSlip } from "../../firebase/storage";
import { TH_NUMBER } from "../../utils/format";
import { resizeSlip } from "../../utils/imageUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Admin: Advance Requests Panel ────────────────────────────── */
export default function AdminAdvancePanel({
  advanceRequests,
  empDir,
  onUpdate,
}) {
  const [filter, setFilter] = useState("all");
  const [confirmReject, setConfirmReject] = useState<any>(null);
  const [copiedAcc, setCopiedAcc] = useState<string | null>(null); // request.id ที่เพิ่งกด copy
  const [uploadingSlip, setUploadingSlip] = useState<string | number | null>(
    null,
  );

  function copyToClipboard(text, reqId) {
    if (!text) return;
    const cleaned = String(text).replace(/[-\s]/g, "");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(cleaned)
        .then(() => {
          setCopiedAcc(reqId);
          setTimeout(() => setCopiedAcc(null), 1500);
        })
        .catch(() => {});
    } else {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = cleaned;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedAcc(reqId);
        setTimeout(() => setCopiedAcc(null), 1500);
      } catch (_e) {}
      document.body.removeChild(ta);
    }
  }

  const filtered = advanceRequests
    .filter((r) => (filter === "all" ? true : r.status === filter))
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );

  async function handleApproveSlip(reqId, file) {
    setUploadingSlip(reqId);
    try {
      const dataUrl = await resizeSlip(file);
      const slipUrl = await uploadAdvanceSlip(reqId, dataUrl);
      await onUpdate(reqId, {
        status: "approved",
        slipUrl,
        approvedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[AdminAdvancePanel] upload slip failed:", err);
      alert((err as Error).message || "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setUploadingSlip(null);
    }
  }

  function handleReject(reqId) {
    onUpdate(reqId, {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
    });
    setConfirmReject(null);
  }

  return (
    <div>
      {/* filter chips */}
      <div className="flex gap-1.5 mb-3.5 overflow-x-auto">
        {[
          { id: "all", label: "ทั้งหมด" },
          {
            id: "pending",
            label: "⏳ รออนุมัติ",
            count: advanceRequests.filter((r) => r.status === "pending").length,
          },
          { id: "approved", label: "✅ อนุมัติแล้ว" },
          { id: "rejected", label: "❌ ไม่อนุมัติ" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-[7px] rounded-[20px] cursor-pointer font-[inherit] text-sm font-semibold whitespace-nowrap border
              ${filter === f.id ? "bg-maroon text-gold-lt border-maroon" : "bg-cream text-txt-mid border-bdr"}`}
          >
            {f.label}
            {f.count > 0 && ` (${f.count})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-txt-soft py-[50px] text-base">
          <div className="text-5xl mb-3">💸</div>
          ไม่มีคำขอเบิก
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.map((req) => {
          const slipPreview = req.slipUrl || req.slipImg;
          const empInfo =
            empDir.find((e) => e.id === req.empId) ||
            empDir.find((e) => e.name === req.empName);
          const sMap = {
            pending: { bg: C.amberLt, color: C.amber, label: "รออนุมัติ" },
            approved: { bg: C.greenLt, color: C.green, label: "โอนแล้ว" },
            rejected: { bg: C.redLt, color: C.red, label: "ไม่อนุมัติ" },
          };
          const s = sMap[req.status] || sMap.pending;
          const dt = new Date(req.submittedAt);
          return (
            <div
              key={req.id}
              className="bg-white rounded-[14px] px-4 py-3.5 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr"
            >
              <div className="flex items-center gap-3 mb-2.5">
                {empInfo ? (
                  <AvatarCircle
                    av={empInfo.av}
                    avType={empInfo.avType}
                    img={empInfo.img}
                    size={40}
                    fontSize={13}
                    border={`2px solid ${C.gold}40`}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-white font-bold text-sm">
                    ?
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-txt text-sm">
                    {req.empName}
                  </div>
                  <div className="text-xs text-txt-soft">
                    {dt.toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-[3px] rounded-[20px] whitespace-nowrap"
                  style={{ background: s.bg, color: s.color }}
                >
                  {s.label}
                </span>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5 bg-gold-pale rounded-[10px] mb-2.5 border border-[#C9973A30]">
                <span className="text-sm text-txt-mid">จำนวนเงินที่ขอเบิก</span>
                <span className="text-xl font-extrabold text-maroon">
                  ฿{TH_NUMBER(req.amount)}
                </span>
              </div>

              <div className="text-sm text-txt-mid mb-2.5 leading-normal">
                <span className="text-txt-soft">เหตุผล:</span> {req.reason}
              </div>

              {empInfo && (empInfo.bank || empInfo.bankAcc) && (
                <button
                  onClick={() => copyToClipboard(empInfo.bankAcc, req.id)}
                  className={`w-full text-sm mb-2.5 px-3 py-2.5 bg-cream rounded-lg cursor-pointer font-[inherit] flex items-center gap-2.5 transition-all
                    ${copiedAcc === req.id ? "border border-green" : "border border-bdr"}`}
                >
                  <span className="text-sm">🏦</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-xs text-txt-soft mb-px">
                      {empInfo.bank || "-"}
                    </div>
                    <div className="text-sm font-bold text-txt tracking-[0.04em]">
                      {empInfo.bankAcc || "-"}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-[5px] px-2.5 py-[5px] rounded-[7px] text-xs font-bold whitespace-nowrap transition-all
                    ${copiedAcc === req.id ? "bg-green-lt text-green" : "bg-gold-pale text-maroon"}`}
                  >
                    {copiedAcc === req.id ? (
                      <>
                        <IconCheck size={13} stroke={3} />
                        คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <IconCopy size={13} stroke={2.2} />
                        คัดลอก
                      </>
                    )}
                  </div>
                </button>
              )}

              {/* slip preview */}
              {slipPreview && (
                <div className="mb-2.5">
                  <div className="text-xs text-txt-soft mb-[5px] font-semibold">
                    📄 สลิปการโอน
                  </div>
                  <img
                    src={slipPreview}
                    alt="slip"
                    onClick={() => {
                      const w = window.open("", "_blank");
                      if (w) {
                        w.document.write(
                          `<img src="${slipPreview}" style="max-width:100%"/>`,
                        );
                      }
                    }}
                    className="max-w-full max-h-[200px] rounded-[10px] border border-bdr cursor-pointer"
                  />
                </div>
              )}

              {/* actions */}
              {req.status === "pending" && (
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => setConfirmReject(req)}
                    className="px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-red/25 bg-red-lt text-red text-sm font-semibold cursor-pointer font-[inherit]"
                  >
                    ❌ ปฏิเสธ
                  </button>
                  <label className="flex-1 px-3.5 py-2.5 rounded-[10px] border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5 shadow-[0_3px_10px_var(--color-gold)/0.25]">
                    {uploadingSlip === req.id
                      ? "กำลังอัปโหลด..."
                      : "📤 อัปโหลดสลิป (อนุมัติ)"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingSlip === req.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleApproveSlip(req.id, f);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {req.status === "approved" && !slipPreview && (
                <label className="block px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-gold/40 bg-gold-pale text-maroon text-sm font-semibold cursor-pointer font-[inherit] text-center">
                  {uploadingSlip === req.id
                    ? "กำลังอัปโหลด..."
                    : "📤 อัปโหลดสลิปย้อนหลัง"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingSlip === req.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleApproveSlip(req.id, f);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {confirmReject && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-[rgba(45,26,14,0.55)] backdrop-blur-xs px-6">
          <div className="bg-white rounded-[20px] px-6 py-7 w-full max-w-[340px]">
            <div className="text-center text-4xl mb-2">❌</div>
            <div className="font-bold text-lg text-txt text-center mb-1.5">
              ปฏิเสธคำขอนี้?
            </div>
            <div className="text-sm text-txt-mid text-center mb-5">
              {confirmReject.empName} · ฿{TH_NUMBER(confirmReject.amount)}
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmReject(null)}
                className="flex-1 p-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleReject(confirmReject.id)}
                className="flex-1 p-3 rounded-xl border-none bg-red text-white text-sm font-bold cursor-pointer font-[inherit]"
              >
                ปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
