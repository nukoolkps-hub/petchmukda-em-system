import { Check as IconCheck, Copy as IconCopy } from "lucide-react";
import { useState } from "react";
import { formatBankAccount } from "../../utils/bankFormat";
import BankLogo from "../shared/BankLogo";

/** บัญชีปลายทาง + ปุ่มคัดลอกเลขบัญชี (คัดลอกเฉพาะตัวเลข ไม่มีขีด/ช่องว่าง —
 *  วางในแอปธนาคารได้เลย) · ใช้ในหน้าต่างอนุมัติเบิก + เบิกฉุกเฉิน */
export default function BankAccountCopyRow({
  bank,
  accountNumber,
}: {
  bank?: string | null;
  accountNumber?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  if (!bank && !accountNumber) return null;
  const digits = String(accountNumber ?? "").replace(/[-\s]/g, "");

  async function copy() {
    if (!digits) return;
    try {
      await navigator.clipboard.writeText(digits);
    } catch {
      // fallback — LINE in-app browser บางรุ่นไม่มี clipboard API
      const ta = document.createElement("textarea");
      ta.value = digits;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2.5 mt-2 px-2.5 py-2 bg-white rounded-[10px] border border-bdr">
      <BankLogo bank={bank ?? undefined} size={28} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-txt-soft">{bank || "-"}</div>
        <div className="text-sm font-bold text-txt tracking-wide">
          {formatBankAccount(accountNumber) || "-"}
        </div>
      </div>
      {digits && (
        <button
          type="button"
          onClick={copy}
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-none text-xs font-semibold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform ${copied ? "bg-green-lt text-green" : "bg-gold-pale text-maroon"}`}
        >
          {copied ? (
            <IconCheck size={13} strokeWidth={2.6} />
          ) : (
            <IconCopy size={13} strokeWidth={2.4} />
          )}
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
      )}
    </div>
  );
}
