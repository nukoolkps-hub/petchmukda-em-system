import React from "react";

/* ─── Error Boundary ───────────────────────────────────────────────
   ดักจับ errors ทั้งหมดในระดับ React tree
   - แสดงหน้า fallback แทนที่จะ crash ทั้งแอป
   - log error ไป console (อนาคต: ส่งไป Sentry/LogRocket)             */
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log สำหรับ debug — production สามารถส่งไป error tracking service ได้
    console.error("[ErrorBoundary]", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-cream p-5 font-sans">
        <div className="max-w-[480px] w-full bg-white rounded-[20px] px-7 py-8 shadow-[0_12px_40px_rgba(45,26,14,0.15)] border border-bdr">
          {/* icon */}
          <div className="w-[72px] h-[72px] rounded-full mx-auto mb-5 bg-linear-135 from-red to-maroon flex items-center justify-center shadow-[0_6px_18px_rgba(192,57,43,0.25)]">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* heading */}
          <div className="text-center mb-5">
            <h2 className="m-0 text-[22px] font-extrabold text-txt">
              เกิดข้อผิดพลาดในระบบ
            </h2>
            <p className="mt-2 mb-0 text-sm text-txt-mid leading-relaxed">
              ขออภัย ระบบเกิดปัญหาบางอย่าง
              <br />
              ลองโหลดหน้าใหม่ หรือกลับสู่หน้าหลัก
            </p>
          </div>

          {/* error details (dev only) */}
          {this.state.error && (
            <details className="bg-red-lt border border-red/20 rounded-[10px] px-3.5 py-3 mb-5 text-xs">
              <summary className="cursor-pointer font-semibold text-red mb-1.5">
                🔍 รายละเอียดข้อผิดพลาด (สำหรับ dev)
              </summary>
              <div className="mt-2 font-mono text-maroon-dk whitespace-pre-wrap break-words leading-normal">
                <b>{this.state.error.toString()}</b>
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-2 opacity-80 text-[11px]">
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* actions */}
          <div className="flex gap-2.5">
            <button
              onClick={this.handleReset}
              className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-[15px] font-semibold cursor-pointer font-[inherit]"
            >
              ลองใหม่
            </button>
            <button
              onClick={this.handleReload}
              className="flex-1 p-3.5 rounded-xl border-none bg-linear-135 from-maroon to-maroon-lt text-white text-[15px] font-bold cursor-pointer font-[inherit] shadow-[0_4px_14px_rgba(123,28,28,0.31)]"
            >
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }
}
