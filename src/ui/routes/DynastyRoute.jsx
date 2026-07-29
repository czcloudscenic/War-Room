// Dynasty — the Cloud Scenic control surface for the Dynasty Employer
// Pipeline, embedded in Vantus. Same four pages as the standalone control
// center (which stays deployed at cloudscenic-ops-center.netlify.app); both
// talk to the same Dynasty API, so state is always consistent between them.
// Admin-only: the nav entry and render are gated in App.jsx, and the
// /api/dynasty proxy enforces it server-side regardless.

import React, { useState } from "react";
import "../../styles/dynasty.css";
import { Capture } from "../dynasty/Capture.jsx";
import { OpsManagerPage } from "../dynasty/OpsManager.jsx";
import { SuppressionPage } from "../dynasty/Suppression.jsx";
import { DataPage } from "../dynasty/Data.jsx";

const TABS = [
  { k: "capture", label: "Lead Capture" },
  { k: "opsmanager", label: "Ops Manager" },
  { k: "suppression", label: "Suppression" },
  { k: "data", label: "Data & Audit" },
];

export default function DynastyRoute() {
  const [tab, setTab] = useState("capture");
  return (
    <div className="dynops">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--dim)" }}>
          Software OPS · Dynasty Employer Pipeline
        </div>
        <a href="https://cloudscenic-ops-center.netlify.app" target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--dim2)" }}>
          standalone center ↗
        </a>
      </div>
      <div className="dyn-tabs">
        {TABS.map((t) => (
          <button key={t.k} className={"dyn-tab" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>{t.label}</button>
        ))}
      </div>
      {tab === "capture" && <Capture />}
      {tab === "opsmanager" && <OpsManagerPage />}
      {tab === "suppression" && <SuppressionPage />}
      {tab === "data" && <DataPage />}
    </div>
  );
}
