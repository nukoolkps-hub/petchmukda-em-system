/* ─── QuizRunner — หน้าทำข้อสอบ (จับเวลา + บันทึกอัตโนมัติ) ────────────
   - นาฬิกาถอยหลังอิง `startedAt` ที่เก็บใน Firestore ไม่ใช่ตัวนับใน state
     → รีเฟรช/ปิดแท็บแล้วกลับมา เวลาเดินต่อจากเดิม ไม่ได้เวลาเพิ่ม
   - พิมพ์คำตอบแล้วบันทึกเองทุก ~2 วิ (debounce) — เน็ตหลุดกลางคันไม่เสียทั้งชุด
   - หมดเวลา → ส่งอัตโนมัติทันที ไม่ต้องรอผู้ใช้กด                         */

import {
  AlertTriangle as IconAlertTriangle,
  Check as IconCheck,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  Clock as IconClock,
  Send as IconSend,
  Trash2 as IconTrash,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QuizSet } from "../../content/quiz/basicExam";
import {
  cancelQuizAttempt,
  saveQuizAnswers,
  submitQuizAttempt,
} from "../../firebase/quizAttempts";
import {
  answeredCount,
  formatCountdown,
  isAnswered,
  isExpired,
  type QuizAttempt,
  remainingMs,
} from "../../utils/quizAttempt";

/** ถี่แค่ไหนก็ได้ที่ไม่กิน Firestore write — 2 วิหลังหยุดพิมพ์ */
const SAVE_DEBOUNCE_MS = 2000;
/** เหลือน้อยกว่านี้ = นาฬิกาเปลี่ยนเป็นสีแดง (5 นาที) */
const WARN_MS = 5 * 60_000;

/** ราคาบนแถบ — ใส่ comma ให้อ่านเลขหลักหมื่นได้เร็ว ไม่เอาทศนิยม */
function fmtBaht(n: number): string {
  return Math.round(n || 0).toLocaleString("en-US");
}

interface Props {
  quiz: QuizSet;
  attempt: QuizAttempt;
  onFinished: () => void;
  showToast?: (msg: string) => void;
}

export default function QuizRunner({
  quiz,
  attempt,
  onFinished,
  showToast,
}: Props) {
  const questions = [...quiz.main, ...quiz.general];
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(
    attempt.answers ?? {},
  );
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // เก็บตัวล่าสุดไว้ให้ timer/auto-submit อ่าน โดยไม่ต้องผูกเป็น dep
  // (ผูกแล้ว effect จะ re-run ทุกตัวอักษรที่พิมพ์ → ตั้ง interval ใหม่รัว)
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const price = attempt.priceSnapshot ?? null;
  const left = remainingMs(attempt, now);
  const expired = isExpired(attempt, now);
  const mainDone = answeredCount(
    answers,
    quiz.main.map((q) => q.id),
  );
  const allDone = answeredCount(
    answers,
    questions.map((q) => q.id),
  );

  const finish = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      try {
        await submitQuizAttempt(attempt.id, answersRef.current, auto);
        showToast?.(auto ? "หมดเวลา — ส่งคำตอบให้อัตโนมัติแล้ว" : "ส่งข้อสอบแล้ว");
        onFinished();
      } catch (err) {
        submittedRef.current = false;
        setSubmitting(false);
        showToast?.(
          err instanceof Error ? `ส่งไม่สำเร็จ: ${err.message}` : "ส่งไม่สำเร็จ",
        );
      }
    },
    [attempt.id, onFinished, showToast],
  );

  // ยกเลิกการทำข้อสอบ — ใช้ `submittedRef` ตัวเดียวกับการส่ง เพื่อปิด
  // autosave/auto-submit ที่ค้างอยู่ ไม่ให้เขียนทับ doc ที่เพิ่งยกเลิกไป
  const cancel = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await cancelQuizAttempt(attempt.id);
      showToast?.("ยกเลิกการทำข้อสอบแล้ว");
      onFinished();
    } catch (err) {
      submittedRef.current = false;
      showToast?.(
        err instanceof Error ? `ยกเลิกไม่สำเร็จ: ${err.message}` : "ยกเลิกไม่สำเร็จ",
      );
    }
  }, [attempt.id, onFinished, showToast]);

  // นาฬิกา — เดินทุกวินาที แล้วคำนวณเวลาที่เหลือจาก startedAt ใหม่ทุกครั้ง
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // หมดเวลา → ส่งเอง (เช็คแยกจาก interval เพื่อให้ยิงครั้งเดียว)
  useEffect(() => {
    if (expired && !submittedRef.current) void finish(true);
  }, [expired, finish]);

  // บันทึกคำตอบแบบ debounce
  const queueSave = useCallback(
    (next: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (submittedRef.current) return;
        setSaving(true);
        saveQuizAnswers(attempt.id, next)
          .catch((err) => {
            console.error("[quiz] save error:", err);
            showToast?.("บันทึกคำตอบไม่สำเร็จ — ตรวจสัญญาณเน็ต");
          })
          .finally(() => setSaving(false));
      }, SAVE_DEBOUNCE_MS);
    },
    [attempt.id, showToast],
  );

  // ออกจากหน้าโดยยังมีคำตอบค้างใน debounce → เขียนทันที
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!submittedRef.current) {
        void saveQuizAnswers(attempt.id, answersRef.current).catch(() => {});
      }
    };
  }, [attempt.id]);

  function setAnswer(qid: string, value: string) {
    const next = { ...answersRef.current, [qid]: value };
    setAnswers(next);
    queueSave(next);
  }

  const q = questions[idx];
  const isGeneral = idx >= quiz.main.length;
  const numberInGroup = isGeneral ? idx - quiz.main.length + 1 : idx + 1;

  return (
    <div className="font-sans">
      {/* ── แถบนาฬิกา + ราคาทอง — ติดบนสุดไว้ ให้เห็นตลอดเวลาที่เลื่อนอ่าน
           โจทย์ยาวๆ · ราคาต้องอยู่ตรงนี้เพราะ "ทุกข้ออ้างอิงราคาทองคำแท่ง
           ณ วันที่ทำข้อสอบ" — ต้องหยิบมาใช้ได้ทุกข้อโดยไม่ต้องเลื่อนหา ── */}
      <div className="sticky top-0 z-10 -mx-1 mb-3">
        <div className="px-3 py-2.5 rounded-t-[12px] bg-maroon text-white flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <IconClock size={22} strokeWidth={2.4} />
            <span
              className={`font-mono text-3xl font-black tabular-nums ${
                left <= WARN_MS ? "text-red-300" : "text-white"
              }`}
            >
              {formatCountdown(left)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <span className="text-white/85 font-semibold">
              ตอบแล้ว {allDone}/{questions.length}
            </span>
            {saving && <span className="text-gold-lt">กำลังบันทึก…</span>}
          </div>
        </div>

        {/* ราคาที่ตรึงไว้ตอนกดเริ่ม — ไม่ขยับตามราคาสดระหว่างทำข้อสอบ
            (ไม่งั้นคนที่เริ่มคิดตั้งแต่ข้อแรกจะเจอราคาคนละชุดกับข้อท้าย) */}
        {price ? (
          <div className="px-3 py-2 rounded-b-[12px] bg-gold-pale border-x border-b border-[#C9973A50] shadow-md flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-sm font-bold text-maroon">ราคาทองวันที่สอบ</span>
            <span className="text-base font-extrabold text-txt tabular-nums">
              ขาย{" "}
              <span className="text-green">
                {fmtBaht(price.goldSellPerBaht)}
              </span>
            </span>
            <span className="text-base font-extrabold text-txt tabular-nums">
              รับซื้อ{" "}
              <span className="text-red">{fmtBaht(price.goldBuyPerBaht)}</span>
            </span>
            {price.silverSellPerGram > 0 && (
              <span className="text-sm font-semibold text-txt-mid tabular-nums">
                เงิน ขาย {fmtBaht(price.silverSellPerGram)} / รับซื้อ{" "}
                {fmtBaht(price.silverBuyPerGram)} ต่อกรัม
              </span>
            )}
          </div>
        ) : (
          <div className="px-3 py-2 rounded-b-[12px] bg-cream-dk border-x border-b border-bdr shadow-md text-sm text-txt-soft font-semibold">
            ชุดนี้ไม่ได้บันทึกราคาทองไว้ — ดูราคาจากจอหน้าร้าน
          </div>
        )}
      </div>

      {left <= WARN_MS && !expired && (
        <div className="mb-3 px-3 py-2.5 rounded-[10px] bg-[#FDECEA] border border-[#C0392B50] text-sm text-red font-semibold flex items-center gap-1.5">
          <IconAlertTriangle size={16} strokeWidth={2.4} className="shrink-0" />
          เหลือเวลาน้อยกว่า 5 นาที — หมดเวลาระบบจะส่งให้อัตโนมัติ
        </div>
      )}

      {/* ── ตารางเลขข้อ — กดข้ามไปข้อไหนก็ได้ · ข้อที่ตอบแล้วเป็นสีทอง ── */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {questions.map((item, i) => {
          const done = isAnswered(answers, item.id);
          const active = i === idx;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setIdx(i)}
              className={`w-9 h-9 rounded-[8px] text-sm font-bold cursor-pointer border transition-colors ${
                active
                  ? "bg-maroon text-white border-maroon"
                  : done
                    ? "bg-gold-pale text-maroon border-[#C9973A60]"
                    : "bg-white text-txt-soft border-bdr"
              }`}
            >
              {i < quiz.main.length ? i + 1 : `ร${i - quiz.main.length + 1}`}
            </button>
          );
        })}
      </div>

      {/* ── โจทย์ + ช่องตอบ ── */}
      <div className="rounded-[12px] border border-bdr bg-white p-3.5 mb-3">
        <div className="text-sm font-bold text-txt-soft mb-2">
          {isGeneral
            ? `ความรู้รอบตัว ข้อ ${numberInGroup}/${quiz.general.length} · ไม่นับในเกณฑ์ผ่าน`
            : `ข้อ ${numberInGroup}/${quiz.main.length}`}
        </div>
        <p className="text-xl text-txt leading-relaxed font-semibold mb-3.5">
          {q.text}
        </p>
        <textarea
          value={answers[q.id] ?? ""}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          placeholder="พิมพ์คำตอบ + แสดงวิธีคิดคำนวณให้ชัดเจน"
          rows={8}
          className="w-full px-3.5 py-3 rounded-[9px] border border-bdr bg-cream/40 text-xl text-txt leading-relaxed font-[inherit] outline-none focus:border-maroon transition-colors resize-y"
        />
      </div>

      {/* ── เลื่อนข้อ ── */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="flex-1 py-3 rounded-[10px] border border-bdr bg-white text-base font-bold text-txt font-[inherit] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
        >
          <IconChevronLeft size={18} strokeWidth={2.4} />
          ก่อนหน้า
        </button>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
          disabled={idx === questions.length - 1}
          className="flex-1 py-3 rounded-[10px] border border-bdr bg-white text-base font-bold text-txt font-[inherit] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
        >
          ถัดไป
          <IconChevronRight size={18} strokeWidth={2.4} />
        </button>
      </div>

      {/* ── ส่งข้อสอบ / ยกเลิก ── */}
      {cancelling ? (
        <div className="rounded-[12px] border-[1.5px] border-[#C0392B50] bg-[#FDECEA] p-3.5">
          <div className="text-base font-bold text-red mb-1.5 flex items-center gap-1.5">
            <IconAlertTriangle size={17} strokeWidth={2.4} />
            ยกเลิกการทำข้อสอบ
          </div>
          <p className="text-sm text-txt-mid leading-relaxed mb-3">
            ชุดนี้จะ<b>ไม่ถูกนับเป็นผลสอบ</b> และกลับมาทำต่อไม่ได้ ·
            ถ้าจะทำใหม่ต้องกดเริ่มใหม่ทั้งชุด (จับเวลาใหม่ตั้งแต่ต้น)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCancelling(false)}
              className="flex-1 py-3 rounded-[10px] border border-bdr bg-white text-base font-bold text-txt font-[inherit] cursor-pointer"
            >
              ทำต่อ
            </button>
            <button
              type="button"
              onClick={() => void cancel()}
              className="flex-1 py-3 rounded-[10px] bg-red text-white text-base font-bold font-[inherit] cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <IconTrash size={17} strokeWidth={2.4} />
              ยืนยันยกเลิก
            </button>
          </div>
        </div>
      ) : confirming ? (
        <div className="rounded-[12px] border-[1.5px] border-amber/45 bg-amber-lt/50 p-3.5">
          <div className="text-base font-bold text-txt mb-1.5 flex items-center gap-1.5">
            <IconAlertTriangle
              size={17}
              strokeWidth={2.4}
              className="text-amber"
            />
            ส่งข้อสอบเลยไหม
          </div>
          <p className="text-sm text-txt-mid leading-relaxed mb-3">
            ตอบแล้ว {mainDone}/{quiz.main.length} ข้อหลัก
            {mainDone < quiz.main.length && " (ยังไม่ครบ)"} ·{" "}
            <b>ส่งแล้วกลับมาแก้ไม่ได้อีก</b>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 py-3 rounded-[10px] border border-bdr bg-white text-base font-bold text-txt font-[inherit] cursor-pointer"
            >
              ทำต่อ
            </button>
            <button
              type="button"
              onClick={() => void finish(false)}
              disabled={submitting}
              className="flex-1 py-3 rounded-[10px] bg-maroon text-white text-base font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
            >
              <IconCheck size={18} strokeWidth={2.4} />
              {submitting ? "กำลังส่ง…" : "ยืนยันส่ง"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={submitting || expired}
          className="w-full py-3.5 rounded-[12px] bg-maroon text-white text-base font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
        >
          <IconSend size={18} strokeWidth={2.4} />
          ส่งข้อสอบ
        </button>
      )}

      {/* ── ทางออกฉุกเฉิน: เริ่มผิดคน/ผิดจังหวะแล้วติดอยู่ 100 นาที ──
           วางไว้ท้ายสุด สีจาง + ต้องยืนยันอีกชั้น เพราะกดพลาด = งานหายทั้งชุด */}
      {!cancelling && !confirming && (
        <button
          type="button"
          onClick={() => setCancelling(true)}
          disabled={submitting}
          className="w-full mt-2.5 py-2.5 rounded-[10px] text-sm font-bold text-txt-soft font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5 hover:text-red transition-colors"
        >
          <IconTrash size={15} strokeWidth={2.4} />
          ยกเลิกการทำข้อสอบ
        </button>
      )}
    </div>
  );
}
