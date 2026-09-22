/* ─── เปิดรอบสอบ + QR ให้พนักงานสแกนทำจากมือถือตัวเอง ─────────────────
   ADMIN กดเปิดรอบ → ได้ QR + ลิงก์ + รหัสรอบ · พนักงานสแกนแล้วทำข้อสอบได้
   **โดยไม่ต้อง login** (เขียนใบสอบผ่าน Cloud Function — ดู
   `functions/src/quiz/guestExam.ts`)

   **รอบมีอายุและปิดได้** เพราะรหัสรอบคือสิ่งเดียวที่กั้นคนนอกอยู่ — เปิดค้าง
   ไว้ = ใครก็เข้ามาเริ่มจับเวลาเล่นได้ตลอด · ปิดรอบแล้วคนที่เริ่มไปแล้วยัง
   ทำต่อจนหมดเวลาของใบตัวเองได้ (นาฬิกาอิง `startedAt` ของใบนั้น)         */

import {
  Copy as IconCopy,
  QrCode as IconQrCode,
  Square as IconSquare,
  Timer as IconTimer,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import {
  closeQuizRound,
  openQuizRound,
  subscribeQuizRound,
} from "../../firebase/quizRound";
import { formatCountdown } from "../../utils/quizAttempt";
import {
  EMPTY_QUIZ_ROUND,
  examLink,
  isRoundOpen,
  type QuizRound,
  ROUND_DURATION_OPTIONS,
  roundRemainingMs,
} from "../../utils/quizRound";

interface Props {
  /** ชุดที่จะผูกกับรอบ — ต้องเป็นชุดที่เผยแพร่ใน Firestore แล้ว */
  quizId: string;
  quizTitle: string;
  /** ชุดที่ใช้สอบตอนนี้ยังเป็นชุดที่ฝังมากับโค้ด (ยังไม่มีใน Firestore) */
  builtInOnly: boolean;
  openedBy: string;
  showToast?: (msg: string) => void;
}

export default function QuizRoundCard({
  quizId,
  quizTitle,
  builtInOnly,
  openedBy,
  showToast,
}: Props) {
  const [round, setRound] = useState<QuizRound>(EMPTY_QUIZ_ROUND);
  const [hours, setHours] = useState<number>(ROUND_DURATION_OPTIONS[0].hours);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeQuizRound(setRound), []);
  // นับถอยหลังเวลาปิดรอบ — เดินทุกวินาทีเฉพาะตอนรอบเปิดอยู่
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const open = isRoundOpen(round, now);
  const link = examLink(window.location.origin, round.code);

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      showToast?.(label);
    } catch (err) {
      showToast?.(err instanceof Error ? `ไม่สำเร็จ: ${err.message}` : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      showToast?.("คัดลอกลิงก์แล้ว");
    } catch {
      showToast?.("คัดลอกไม่ได้ — กดค้างที่ลิงก์เพื่อคัดลอกเอง");
    }
  }

  return (
    <div className="rounded-[12px] border border-bdr bg-white p-3.5 mb-4">
      <div className="text-base font-extrabold text-maroon mb-1.5 flex items-center gap-1.5">
        <IconQrCode size={18} strokeWidth={2.4} />
        ให้พนักงานสแกนทำข้อสอบจากมือถือตัวเอง
      </div>

      {builtInOnly ? (
        /* ชุดที่ฝังมากับโค้ดอยู่ฝั่ง frontend — server หยิบโจทย์ส่งให้คนที่
           สแกนไม่ได้ จึงต้องมีชุดที่เผยแพร่ใน Firestore ก่อน */
        <p className="text-xs text-txt-mid leading-relaxed">
          ยังใช้<b>ชุดตั้งต้นที่ฝังมากับระบบ</b>อยู่ — เปิดรอบสอบยังไม่ได้ · ไปที่{" "}
          <b>ตั้งค่าข้อสอบ</b> แล้วกด "คัดลอกชุดตั้งต้นมาเป็นร่าง" → เผยแพร่ 1 ครั้งก่อน
        </p>
      ) : open ? (
        <>
          <div className="text-xs text-txt-mid mb-3">
            ชุดที่ใช้ในรอบนี้: <b className="text-txt">{round.quizTitle}</b>
          </div>

          {/* QR ตัวจริง — ขาวล้วนรอบๆ ให้กล้องจับง่าย แม้จอสว่างน้อย */}
          <div className="flex flex-col items-center gap-2.5 mb-3">
            <div className="p-3 rounded-[12px] bg-white border border-bdr">
              <QRCodeSVG value={link} size={190} level="M" />
            </div>
            <div className="text-center">
              <div className="text-xs text-txt-soft mb-0.5">
                สแกนไม่ติด? เปิดลิงก์แล้วพิมพ์รหัสนี้
              </div>
              <div className="text-xl font-black text-maroon font-[Prompt,monospace] tracking-[0.25em]">
                {round.code}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-txt-mid mb-2 justify-center">
            <IconTimer size={13} strokeWidth={2.4} />
            รอบนี้ปิดเองในอีก{" "}
            <b className="text-txt font-mono tabular-nums">
              {formatCountdown(roundRemainingMs(round, now))}
            </b>
          </div>

          <div className="px-2.5 py-2 rounded-[8px] bg-cream/70 border border-bdr text-[11px] text-txt-mid break-all text-center mb-2.5">
            {link}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="flex-1 py-2 rounded-[8px] border border-bdr bg-white text-sm font-bold text-txt font-[inherit] cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <IconCopy size={15} strokeWidth={2.4} />
              คัดลอกลิงก์
            </button>
            <button
              type="button"
              onClick={() => void run("ปิดรอบสอบแล้ว", closeQuizRound)}
              disabled={busy}
              className="px-3 py-2 rounded-[8px] bg-red text-white text-sm font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              <IconSquare size={14} strokeWidth={2.6} />
              ปิดรอบ
            </button>
          </div>
          <div className="text-[11px] text-txt-soft mt-2 text-center leading-relaxed">
            ปิดรอบแล้ว<b>สแกนเข้ามาเริ่มใหม่ไม่ได้</b> ·
            คนที่เริ่มไปแล้วยังทำต่อจนหมดเวลาของตัวเอง
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-txt-mid leading-relaxed mb-3">
            เปิดรอบแล้วจะได้ <b>QR + รหัสรอบ</b> ให้พนักงานสแกนทำข้อสอบจากมือถือ
            ตัวเองได้ทันที ไม่ต้อง login · ชุดที่ใช้คือ{" "}
            <b className="text-txt">{quizTitle}</b>
            {round.code && " · รอบก่อนหน้าปิดไปแล้ว"}
          </p>

          <div className="text-xs font-bold text-txt mb-1.5">
            เปิดรอบไว้นานแค่ไหน
          </div>
          <div className="flex gap-2 mb-3">
            {ROUND_DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                type="button"
                onClick={() => setHours(opt.hours)}
                className={`flex-1 py-2 rounded-[8px] text-sm font-bold font-[inherit] cursor-pointer border ${
                  hours === opt.hours
                    ? "bg-maroon text-white border-maroon"
                    : "bg-white text-txt border-bdr"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              void run("เปิดรอบสอบแล้ว — ให้พนักงานสแกน QR ได้เลย", async () => {
                await openQuizRound({ quizId, quizTitle, hours, openedBy });
              })
            }
            disabled={busy}
            className="w-full py-2.5 rounded-[10px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
          >
            <IconQrCode size={16} strokeWidth={2.4} />
            เปิดรอบสอบ + สร้าง QR
          </button>
        </>
      )}
    </div>
  );
}
