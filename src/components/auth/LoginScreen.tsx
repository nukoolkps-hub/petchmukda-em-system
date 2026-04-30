/* ─── LoginScreen ─────────────────────────────────────────────
   Beautiful, on-brand login page with:
   - Mukda gold shop branding (diamond, maroon/gold theme)
   - "Login ด้วย LINE" button (LINE green)
   - "Dev Login" button (emulator mode only)
   - Error display with retry
   - Handles LINE callback loading state                     */

import { useState } from "react";
import { C, FONT_LINK } from "../../constants";
import Diamond from "../shared/Diamond";
import { startLineLogin } from "../../firebase/auth";
import { auth } from "../../firebase/config";

const LINE_GREEN = "#06C755";
const LINE_GREEN_HOVER = "#05B04C";

const LINE_CHANNEL_ID = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID || "";
const USE_EMULATORS =
  import.meta.env.VITE_USE_EMULATORS === "true" ||
  (import.meta.env.VITE_USE_EMULATORS !== "false" && import.meta.env.DEV);

interface LoginScreenProps {
  loading?: boolean;
  error?: string | null;
}

export default function LoginScreen({ loading, error }: LoginScreenProps) {
  const [devLoading, setDevLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = error || localError;

  function handleLineLogin() {
    if (!LINE_CHANNEL_ID) {
      setLocalError("ยังไม่ได้ตั้งค่า VITE_LINE_LOGIN_CHANNEL_ID ใน .env.local");
      return;
    }
    try {
      startLineLogin({
        channelId: LINE_CHANNEL_ID,
        redirectUri: window.location.origin + "/callback",
        state: crypto.randomUUID(),
      });
    } catch (err: unknown) {
      setLocalError((err as Error).message || "ไม่สามารถเปิด LINE Login ได้");
    }
  }

  /* ─── Dev Login (emulator only) ──────────────────────────── */
  async function handleDevLogin() {
    setDevLoading(true);
    setLocalError(null);
    try {
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
    } catch (err: unknown) {
      console.error("[Dev Login] error:", err);
      setLocalError("Dev Login ไม่สำเร็จ: " + (err as Error).message);
    } finally {
      setDevLoading(false);
    }
  }

  return (
    <>
      <link rel="stylesheet" href={FONT_LINK} />
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.88; } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .login-line-btn:hover { background: ${LINE_GREEN_HOVER} !important; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(6,199,85,0.35) !important; }
        .login-line-btn:active { transform: translateY(0); }
        .login-dev-btn:hover { background: rgba(255,255,255,0.15) !important; }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(160deg, ${C.maroonDk} 0%, ${C.maroon} 55%, ${C.maroonLt} 100%)`,
          fontFamily: "'Prompt','Sarabun','Noto Sans Thai',sans-serif",
          padding: 20,
          overflow: "hidden",
        }}
      >
        {/* Background mosaic pattern */}
        <svg
          style={{
            position: "absolute",
            top: 0, right: 0,
            height: "100%", width: "60%",
            pointerEvents: "none",
            opacity: 0.5,
          }}
          viewBox="0 0 220 500"
          preserveAspectRatio="xMaxYMid slice"
        >
          <defs>
            <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E8C87A" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#C9973A" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="lg2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E8C87A" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#9B3030" stopOpacity="0.06" />
            </linearGradient>
          </defs>
          {[0, 80, 160, 240, 320, 400].map((y) => [
            <polygon key={`a${y}`} points={`80,${y} 140,${y} 110,${y + 40}`} fill="url(#lg1)" />,
            <polygon key={`b${y}`} points={`140,${y} 220,${y} 220,${y + 55} 175,${y + 30}`} fill="url(#lg2)" />,
            <polygon key={`c${y}`} points={`110,${y + 40} 175,${y + 30} 160,${y + 75} 95,${y + 70}`} fill="url(#lg1)" />,
          ])}
        </svg>

        {/* Login card */}
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 380,
            animation: "fadeIn 0.5s ease-out",
          }}
        >
          {/* Logo & brand */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: `0 8px 32px ${C.gold}50`,
              }}
            >
              <Diamond size={36} color={C.maroonDk} />
            </div>
            <div
              style={{
                color: C.goldLt,
                fontWeight: 800,
                fontSize: 22,
                lineHeight: 1.2,
                letterSpacing: "0.01em",
              }}
            >
              ห้างเพชรทองมุกดา
            </div>
            <div
              style={{
                color: `${C.goldLt}80`,
                fontSize: 14,
                marginTop: 4,
                letterSpacing: "0.04em",
              }}
            >
              ระบบพนักงาน
            </div>
          </div>

          {/* Card */}
          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 24,
              border: `1px solid ${C.goldLt}20`,
              padding: "32px 24px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                textAlign: "center",
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  color: C.white,
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 6,
                }}
              >
                ยินดีต้อนรับ
              </div>
              <div
                style={{
                  color: `${C.goldLt}90`,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                กรุณาลงชื่อเข้าใช้ด้วยบัญชี LINE ของคุณ
              </div>
            </div>

            {/* Error display */}
            {displayError && (
              <div
                style={{
                  background: `${C.red}20`,
                  border: `1px solid ${C.red}40`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ color: "#ffaaaa", fontWeight: 600, fontSize: 14 }}>
                    เข้าสู่ระบบไม่สำเร็จ
                  </div>
                  <div style={{ color: "#ff9999", fontSize: 13, marginTop: 2 }}>
                    {displayError}
                  </div>
                </div>
              </div>
            )}

            {/* Loading state (handling LINE callback) */}
            {loading && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                >
                  <Diamond size={22} color={C.maroonDk} />
                </div>
                <div style={{ color: C.goldLt, fontSize: 14, fontWeight: 600 }}>
                  กำลังเข้าสู่ระบบ...
                </div>
                <div style={{ color: `${C.goldLt}60`, fontSize: 12, marginTop: 4 }}>
                  รอสักครู่
                </div>
              </div>
            )}

            {/* Login buttons (only when not loading) */}
            {!loading && (
              <>
                {/* LINE Login button */}
                <button
                  className="login-line-btn"
                  onClick={handleLineLogin}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: LINE_GREEN,
                    color: "#fff",
                    border: "none",
                    borderRadius: 14,
                    fontSize: 17,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    boxShadow: `0 6px 20px rgba(6,199,85,0.25)`,
                    transition: "all 0.2s ease",
                    marginBottom: 12,
                  }}
                >
                  {/* LINE icon */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                    <path d="M12 2C6.48 2 2 5.73 2 10.25c0 4.07 3.58 7.49 8.42 8.14.33.07.77.22.88.5.1.26.07.66.03.92l-.14.85c-.04.26-.2 1.01.88.55.94-.4 5.08-2.99 6.93-5.12C20.89 13.89 22 12.17 22 10.25 22 5.73 17.52 2 12 2zm-3.37 10.75H6.88a.62.62 0 01-.62-.63V8.38c0-.35.28-.63.63-.63.34 0 .62.28.62.63v3.12h1.13c.34 0 .62.28.62.63 0 .34-.28.62-.63.62zm1.87-.63a.62.62 0 01-1.25 0V8.38a.62.62 0 011.25 0v3.74zm4.13 0c0 .26-.16.5-.4.6a.63.63 0 01-.72-.14l-1.6-2.18v1.72a.62.62 0 01-1.24 0V8.38c0-.26.16-.5.4-.6a.63.63 0 01.72.14l1.6 2.18V8.38a.62.62 0 011.25 0v3.74zm2.87-2.5a.62.62 0 010 1.25h-1.12v.63h1.12a.62.62 0 010 1.25H16.38a.62.62 0 01-.63-.63V8.38c0-.35.28-.63.63-.63H17.5a.62.62 0 010 1.25h-1.12v.62h1.12z" />
                  </svg>
                  Login ด้วย LINE
                </button>

                {/* Dev Login (emulator mode only) */}
                {USE_EMULATORS && (
                  <button
                    className="login-dev-btn"
                    onClick={handleDevLogin}
                    disabled={devLoading}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: "rgba(255,255,255,0.08)",
                      color: `${C.goldLt}90`,
                      border: `1px dashed ${C.goldLt}30`,
                      borderRadius: 14,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: devLoading ? "wait" : "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s ease",
                      opacity: devLoading ? 0.6 : 1,
                    }}
                  >
                    🔧 {devLoading ? "กำลังเข้าสู่ระบบ..." : "Dev Login (Emulator)"}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              marginTop: 24,
              color: `${C.goldLt}40`,
              fontSize: 12,
            }}
          >
            Haangpetchthongmukda Co., Ltd
          </div>
        </div>
      </div>
    </>
  );
}
