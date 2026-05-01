import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import LeaveApp from "./App";
import LoginScreen from "./components/auth/LoginScreen";
import Diamond from "./components/shared/Diamond";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

/* ─── Loading Screen (Firebase auth initializing) ────────── */
function AuthLoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-linear-160 from-maroon-dk via-maroon to-maroon-lt font-sans">
      <div className="w-16 h-16 rounded-full bg-linear-135 from-gold to-gold-lt flex items-center justify-center shadow-[0_6px_20px_rgba(201,151,58,0.31)] animate-[pulse_1.5s_ease-in-out_infinite]">
        <Diamond size={32} color="#5C1212" />
      </div>
      <div className="mt-4.5 text-sm font-semibold text-gold-lt">
        กำลังตรวจสอบสิทธิ์...
      </div>
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
  </React.StrictMode>,
);
