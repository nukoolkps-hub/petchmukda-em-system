import React from "react";
import ReactDOM from "react-dom/client";
import LeaveApp from "./App";
import ErrorBoundary from "./components/shared/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LeaveApp />
    </ErrorBoundary>
  </React.StrictMode>
);
