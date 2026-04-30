import React from "react";
import ReactDOM from "react-dom/client";
import LeaveApp from "./App";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/auth/LoginScreen";
import { C, FONT_LINK } from "./constants";
import Diamond from "./components/shared/Diamond";

/* ─── Loading Screen (Firebase auth initializing) ────────── */
function AuthLoadingScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(160deg, ${C.maroonDk} 0%, ${C.maroon} 55%, ${C.maroonLt} 100%)`,
        fontFamily: "'Prompt',sans-serif",
      }}
    >
      <link rel="stylesheet" href={FONT_LINK} />
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: `linear-gradient(135deg,${C.gold},${C.goldLt})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 6px 20px ${C.gold}50`,
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      >
        <Diamond size={32} color={C.maroonDk} />
      </div>
      <div style={{ marginTop: 18, fontSize: 14, fontWeight: 600, color: C.goldLt }}>
        กำลังตรวจสอบสิทธิ์...
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.08);opacity:0.85;}}`}</style>
    </div>
  );
}

/* ─── Auth Gate — show login or app based on auth state ──── */
function AuthGate() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <LoginScreen loading={false} error={error} />;
  }

  return <LeaveApp />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
