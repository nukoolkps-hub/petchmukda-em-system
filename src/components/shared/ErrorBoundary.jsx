import React from "react";
import { C } from "../../constants";

/* ─── Error Boundary ───────────────────────────────────────────────
   ดักจับ errors ทั้งหมดในระดับ React tree
   - แสดงหน้า fallback แทนที่จะ crash ทั้งแอป
   - log error ไป console (อนาคต: ส่งไป Sentry/LogRocket)             */
export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { hasError:false, error:null, errorInfo:null };
  }

  static getDerivedStateFromError(error){
    return { hasError:true, error };
  }

  componentDidCatch(error, errorInfo){
    // Log สำหรับ debug — production สามารถส่งไป error tracking service ได้
    console.error("[ErrorBoundary]", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError:false, error:null, errorInfo:null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render(){
    if(!this.state.hasError) return this.props.children;

    return (
      <div style={{
        position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
        background:C.cream, padding:"20px", fontFamily:"'Prompt',sans-serif",
      }}>
        <div style={{
          maxWidth:480, width:"100%", background:C.white, borderRadius:20, padding:"32px 28px",
          boxShadow:"0 12px 40px rgba(45,26,14,0.15)", border:`1px solid ${C.border}`,
        }}>
          {/* icon */}
          <div style={{
            width:72, height:72, borderRadius:"50%", margin:"0 auto 20px",
            background:`linear-gradient(135deg,${C.red},${C.maroon})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 6px 18px ${C.red}40`,
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>

          {/* heading */}
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}>เกิดข้อผิดพลาดในระบบ</h2>
            <p style={{ margin:"8px 0 0", fontSize:14, color:C.textMid, lineHeight:1.6 }}>
              ขออภัย ระบบเกิดปัญหาบางอย่าง<br/>
              ลองโหลดหน้าใหม่ หรือกลับสู่หน้าหลัก
            </p>
          </div>

          {/* error details (dev only) */}
          {this.state.error && (
            <details style={{
              background:C.redLt, border:`1px solid ${C.red}30`, borderRadius:10,
              padding:"12px 14px", marginBottom:20, fontSize:12,
            }}>
              <summary style={{ cursor:"pointer", fontWeight:600, color:C.red, marginBottom:6 }}>
                🔍 รายละเอียดข้อผิดพลาด (สำหรับ dev)
              </summary>
              <div style={{
                marginTop:8, fontFamily:"monospace", color:C.maroonDk,
                whiteSpace:"pre-wrap", wordBreak:"break-word", lineHeight:1.5,
              }}>
                <b>{this.state.error.toString()}</b>
                {this.state.errorInfo?.componentStack && (
                  <div style={{ marginTop:8, opacity:0.8, fontSize:11 }}>
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* actions */}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={this.handleReset} style={{
              flex:1, padding:"13px", borderRadius:12, border:`1.5px solid ${C.border}`,
              background:C.white, color:C.textMid, fontSize:15, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit",
            }}>
              ลองใหม่
            </button>
            <button onClick={this.handleReload} style={{
              flex:1, padding:"13px", borderRadius:12, border:"none",
              background:`linear-gradient(135deg,${C.maroon},${C.maroonLt})`,
              color:C.white, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              boxShadow:`0 4px 14px ${C.maroon}50`,
            }}>
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }
}
