/* ─── FreeExchangeHelper — ตัวช่วยคำนวณการเปลี่ยนฟรี ─────────────
   1. เลือกน้ำหนัก 2 ฝั่ง (เพิ่งซื้อ vs ขอเปลี่ยน) — ต้องตรงกันจึงจะ
      เปลี่ยนฟรีได้ (ทองรูปพรรณ 96.5%)
   2. ใส่ MD ทั้ง 2 ฝั่ง — ถ้า MD ขอเปลี่ยน > MD เพิ่งซื้อ → ต้องเพิ่มเงิน
      = (diff) × 100                                                   */

import {
  AlertTriangle as IconAlert,
  ArrowLeftRight as IconExchange,
  CheckCircle2 as IconCheck,
  HandCoins as IconCoins,
} from "lucide-react";
import { useMemo, useState } from "react";
import MathText from "./MathText";

const WEIGHT_OPTIONS = [
  "½ สลึง",
  "1 สลึง",
  "2 สลึง",
  "3 สลึง",
  "1 บาท",
  "6 สลึง",
  "2 บาท",
  "3 บาท",
  "4 บาท",
  "5 บาท",
  "6 บาท",
  "7 บาท",
  "8 บาท",
  "9 บาท",
  "10 บาท",
];

const MD_PER_UNIT_BAHT = 100;

function parseMd(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function FreeExchangeHelper() {
  const [weightBought, setWeightBought] = useState<string>("");
  const [weightExchange, setWeightExchange] = useState<string>("");
  const [mdBought, setMdBought] = useState<string>("");
  const [mdExchange, setMdExchange] = useState<string>("");

  const weightsMatch =
    weightBought !== "" &&
    weightExchange !== "" &&
    weightBought === weightExchange;
  const weightsMismatch =
    weightBought !== "" &&
    weightExchange !== "" &&
    weightBought !== weightExchange;

  const mdBoughtNum = useMemo(() => parseMd(mdBought), [mdBought]);
  const mdExchangeNum = useMemo(() => parseMd(mdExchange), [mdExchange]);

  const result = useMemo(() => {
    if (!weightsMatch) return null;
    if (mdBoughtNum === null || mdExchangeNum === null) return null;
    const diff = mdExchangeNum - mdBoughtNum;
    if (diff <= 0) {
      return { needToPay: false, amount: 0, diff };
    }
    return { needToPay: true, amount: diff * MD_PER_UNIT_BAHT, diff };
  }, [weightsMatch, mdBoughtNum, mdExchangeNum]);

  function renderSelect(
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
  ) {
    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full cursor-pointer pl-3 pr-8 py-2 rounded-[8px] border-[1.5px] border-bdr text-sm font-bold text-maroon bg-white font-[inherit] outline-none focus:border-maroon"
        >
          <option value="">{placeholder}</option>
          {WEIGHT_OPTIONS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft text-xs">
          ▼
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
        <IconExchange size={13} strokeWidth={2.5} />
        ตัวช่วยคำนวณ — เปลี่ยนฟรี (ทองรูปพรรณ 96.5%)
      </div>

      <div className="p-3 space-y-3">
        {/* น้ำหนัก 2 ฝั่ง */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="fe-weight-bought"
              className="block text-[11px] font-bold text-txt-mid mb-1"
            >
              น้ำหนักสินค้าที่เพิ่งซื้อ
            </label>
            {renderSelect(weightBought, setWeightBought, "เลือก…")}
          </div>
          <div>
            <label
              htmlFor="fe-weight-exchange"
              className="block text-[11px] font-bold text-txt-mid mb-1"
            >
              น้ำหนักสินค้าที่ขอเปลี่ยน
            </label>
            {renderSelect(weightExchange, setWeightExchange, "เลือก…")}
          </div>
        </div>

        {/* ผลของน้ำหนัก */}
        {weightsMismatch && (
          <div className="rounded-[10px] border-[1.5px] border-red/40 bg-red-lt/40 px-3 py-2.5 flex items-start gap-2">
            <IconAlert
              size={16}
              strokeWidth={2.5}
              className="text-red shrink-0 mt-0.5"
            />
            <div className="text-sm text-red font-bold leading-relaxed">
              ไม่สามารถเปลี่ยนฟรีได้ — น้ำหนักไม่ตรงกัน
              <div className="text-[11px] font-semibold text-red/80 mt-0.5">
                ทองรูปพรรณ 96.5% ต้องเปลี่ยน{" "}
                <b>น้ำหนักที่เท่ากัน</b> เท่านั้น
              </div>
            </div>
          </div>
        )}

        {/* MD inputs + ผล (เฉพาะเมื่อ weight ตรง) */}
        {weightsMatch && (
          <>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-bdr/40">
              <div>
                <label
                  htmlFor="fe-md-bought"
                  className="block text-[11px] font-bold text-txt-mid mb-1 mt-2"
                >
                  MD เส้นที่เพิ่งซื้อ
                </label>
                <input
                  id="fe-md-bought"
                  type="text"
                  inputMode="numeric"
                  value={mdBought}
                  onChange={(e) => setMdBought(e.target.value)}
                  placeholder="เช่น 3"
                  className="w-full px-3 py-2 rounded-[8px] border-[1.5px] border-bdr text-sm font-bold text-maroon text-center font-[inherit] outline-none bg-white focus:border-maroon"
                />
              </div>
              <div>
                <label
                  htmlFor="fe-md-exchange"
                  className="block text-[11px] font-bold text-txt-mid mb-1 mt-2"
                >
                  MD เส้นที่ขอเปลี่ยน
                </label>
                <input
                  id="fe-md-exchange"
                  type="text"
                  inputMode="numeric"
                  value={mdExchange}
                  onChange={(e) => setMdExchange(e.target.value)}
                  placeholder="เช่น 10"
                  className="w-full px-3 py-2 rounded-[8px] border-[1.5px] border-bdr text-sm font-bold text-maroon text-center font-[inherit] outline-none bg-white focus:border-maroon"
                />
              </div>
            </div>

            {/* ผล MD */}
            {result === null && (
              <div className="text-[11px] text-txt-soft italic text-center py-1">
                ใส่ MD ทั้งสองช่องเพื่อคำนวณ
              </div>
            )}
            {result?.needToPay === false && (
              <div className="rounded-[10px] border-[1.5px] border-green/40 bg-green-lt/40 px-3 py-2.5 flex items-start gap-2">
                <IconCheck
                  size={16}
                  strokeWidth={2.6}
                  className="text-green shrink-0 mt-0.5"
                />
                <div className="text-sm text-green font-extrabold leading-relaxed">
                  ไม่ต้องเพิ่มเงิน
                  <div className="text-[11px] font-semibold text-green/80 mt-0.5">
                    <MathText>{`MD ${mdExchangeNum} ≤ MD ${mdBoughtNum} → เปลี่ยนได้เลย`}</MathText>
                  </div>
                </div>
              </div>
            )}
            {result?.needToPay === true && (
              <div className="rounded-[10px] border-[1.5px] border-maroon/40 bg-gold-pale/60 px-3 py-2.5 flex items-start gap-2">
                <IconCoins
                  size={16}
                  strokeWidth={2.6}
                  className="text-maroon shrink-0 mt-0.5"
                />
                <div className="text-sm text-maroon leading-relaxed flex-1">
                  <div className="font-extrabold">
                    ต้องเพิ่มเงิน{" "}
                    <span className="text-base">
                      {result.amount.toLocaleString("th-TH")} ฿
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-maroon/80 mt-0.5">
                    <MathText>{`(MD ${mdExchangeNum} − MD ${mdBoughtNum}) × 100 = ${result.amount.toLocaleString("th-TH")} ฿`}</MathText>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* hint ตอนยังไม่เลือก */}
        {weightBought === "" && weightExchange === "" && (
          <div className="text-[11px] text-txt-soft italic text-center pb-0.5">
            เลือกน้ำหนักทั้งสองฝั่งเพื่อเริ่มคำนวณ
          </div>
        )}
      </div>
    </div>
  );
}
