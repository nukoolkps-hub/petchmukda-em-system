/* ─── QuizReview — ADMIN อ่านคำตอบแล้วให้คะแนน ────────────────────────
   ข้อสอบเป็นอัตนัยล้วน (คำนวณ + อธิบาย) ระบบตรวจเองไม่ได้ → ADMIN กด
   ผ่าน/ไม่ผ่านรายข้อ แล้วระบบคิด % + ตัดสินเกณฑ์ให้

   ตรวจค้างไว้ได้ — กดบันทึกตอนตรวจไม่ครบก็เก็บผลเท่าที่ตรวจ แล้ว
   `scoreAttempt` จะคืน passed = null (ยังไม่ตัดสิน) จนกว่าจะครบทุกข้อ    */

import {
  Check as IconCheck,
  ChevronLeft as IconChevronLeft,
  Clock as IconClock,
  Save as IconSave,
  X as IconX,
} from "lucide-react";
import { useState } from "react";
import type { QuizSet } from "../../content/quiz/basicExam";
import { gradeQuizAttempt } from "../../firebase/quizAttempts";
import { fmtThaiDateTime } from "../../utils/dateUtils";
import { type QuizAttempt, scoreAttempt } from "../../utils/quizAttempt";

interface Props {
  quiz: QuizSet;
  attempt: QuizAttempt;
  gradedBy: string;
  onBack: () => void;
  showToast?: (msg: string) => void;
}

export default function QuizReview({
  quiz,
  attempt,
  gradedBy,
  onBack,
  showToast,
}: Props) {
  const [grades, setGrades] = useState<Record<string, boolean>>(
    attempt.grades ?? {},
  );
  const [note, setNote] = useState(attempt.note ?? "");
  const [saving, setSaving] = useState(false);

  const score = scoreAttempt({ grades }, quiz);

  async function handleSave() {
    setSaving(true);
    try {
      await gradeQuizAttempt(attempt.id, grades, note, gradedBy);
      showToast?.(
        score.passed === null
          ? `บันทึกแล้ว · ตรวจไป ${score.graded}/${score.total} ข้อ`
          : `บันทึกแล้ว · ${score.percent}% (${score.passed ? "ผ่าน" : "ไม่ผ่าน"})`,
      );
    } catch (err) {
      showToast?.(
        err instanceof Error ? `บันทึกไม่สำเร็จ: ${err.message}` : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  function mark(qid: string, pass: boolean) {
    setGrades((prev) => {
      // กดซ้ำที่ปุ่มเดิม = ยกเลิกผลตรวจข้อนั้น (กลับไปยังไม่ตรวจ)
      if (prev[qid] === pass) {
        const next = { ...prev };
        delete next[qid];
        return next;
      }
      return { ...prev, [qid]: pass };
    });
  }

  return (
    <div className="font-sans">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-maroon font-[inherit] cursor-pointer"
      >
        <IconChevronLeft size={16} strokeWidth={2.4} />
        กลับ
      </button>

      {/* ── หัว: ใครทำ · เมื่อไหร่ · คะแนน ── */}
      <div className="rounded-[12px] border border-bdr bg-white p-3.5 mb-3">
        <div className="text-lg font-extrabold text-txt">
          {attempt.employeeName || "(ไม่ทราบชื่อ)"}
        </div>
        <div className="text-sm text-txt-soft mt-0.5 flex items-center gap-1">
          <IconClock size={14} strokeWidth={2.4} />
          เริ่ม {fmtThaiDateTime(attempt.startedAt)}
          {attempt.submittedAt
            ? ` · ส่ง ${fmtThaiDateTime(attempt.submittedAt)}`
            : attempt.cancelledAt
              ? ` · ยกเลิก ${fmtThaiDateTime(attempt.cancelledAt)}`
              : " · ยังทำอยู่"}
          {attempt.autoSubmitted && " (หมดเวลา)"}
        </div>

        {attempt.cancelledAt && (
          <div className="mt-2 px-3 py-2 rounded-[8px] bg-cream-dk/70 text-sm text-txt-mid font-semibold">
            ชุดนี้ถูกยกเลิกกลางคัน — ไม่นับเป็นผลสอบ (คำตอบที่พิมพ์ไว้ยังอยู่ให้ดูได้)
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-bdr/60 flex items-center justify-between">
          <div className="text-base text-txt-mid">
            ตรวจแล้ว <b className="text-txt">{score.graded}</b>/{score.total} ·
            ผ่าน <b className="text-green">{score.correct}</b> ข้อ
          </div>
          {score.passed === null ? (
            <span className="text-xs px-2 py-1 rounded-lg bg-cream-dk text-txt-soft font-bold">
              ยังตรวจไม่ครบ
            </span>
          ) : (
            <span
              className={`text-xs px-2 py-1 rounded-lg font-bold ${
                score.passed
                  ? "bg-green-lt/70 text-green"
                  : "bg-[#FDECEA] text-red"
              }`}
            >
              {score.percent}% · {score.passed ? "ผ่าน" : "ไม่ผ่าน"}
            </span>
          )}
        </div>
      </div>

      {/* ── รายข้อ ── */}
      {[
        {
          label: `ข้อสอบ (${quiz.main.length} ข้อ)`,
          items: quiz.main,
          graded: true,
        },
        {
          label: `ความรู้รอบตัว (${quiz.general.length} ข้อ · ไม่นับเกณฑ์)`,
          items: quiz.general,
          graded: false,
        },
      ].map((group) => (
        <div key={group.label} className="mb-4">
          <div className="text-base font-extrabold text-maroon mb-2">
            {group.label}
          </div>
          {group.items.map((q, i) => {
            const answer = (attempt.answers?.[q.id] ?? "").trim();
            const g = grades[q.id];
            return (
              <div
                key={q.id}
                className="rounded-[10px] border border-bdr bg-white p-3 mb-2"
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="shrink-0 mt-[2px] w-6 h-6 rounded-full bg-maroon text-white text-xs font-extrabold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-base text-txt-mid leading-relaxed">
                    {q.text}
                  </p>
                </div>

                <div
                  className={`rounded-[8px] px-3.5 py-2.5 text-lg leading-relaxed whitespace-pre-wrap ${
                    answer
                      ? "bg-cream/60 text-txt"
                      : "bg-cream-dk/60 text-txt-soft italic"
                  }`}
                >
                  {answer || "— ไม่ได้ตอบ —"}
                </div>

                {group.graded && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => mark(q.id, true)}
                      className={`flex-1 py-2 rounded-[8px] text-sm font-bold font-[inherit] cursor-pointer border inline-flex items-center justify-center gap-1 ${
                        g === true
                          ? "bg-green text-white border-green"
                          : "bg-white text-txt-soft border-bdr"
                      }`}
                    >
                      <IconCheck size={15} strokeWidth={3} />
                      ผ่าน
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(q.id, false)}
                      className={`flex-1 py-2 rounded-[8px] text-sm font-bold font-[inherit] cursor-pointer border inline-flex items-center justify-center gap-1 ${
                        g === false
                          ? "bg-red text-white border-red"
                          : "bg-white text-txt-soft border-bdr"
                      }`}
                    >
                      <IconX size={15} strokeWidth={3} />
                      ไม่ผ่าน
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* ── โน้ต + บันทึก ── */}
      <div className="rounded-[12px] border border-bdr bg-white p-3.5">
        <div className="text-sm font-bold text-txt mb-1.5">หมายเหตุถึงผู้สอบ</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="จุดที่ควรทบทวน / คำแนะนำ (ไม่บังคับ)"
          className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-cream/40 text-sm text-txt font-[inherit] outline-none focus:border-maroon transition-colors resize-y mb-3"
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="w-full py-2.5 rounded-[10px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
        >
          <IconSave size={16} strokeWidth={2.4} />
          {saving ? "กำลังบันทึก…" : "บันทึกผลตรวจ"}
        </button>
      </div>
    </div>
  );
}
