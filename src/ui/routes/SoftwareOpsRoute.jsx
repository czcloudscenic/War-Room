// Software OPS — the client-agent control floor. One badge per client whose
// software Cloud Scenic runs; clicking a live client opens its ops center
// inside Vantus. Client 1 (Dynasty) is live; empty slots fill in as more
// client tools come online. Registry-driven so adding a client is one entry.

import React, { useState } from "react";
import "../../styles/dynasty.css";
import DynastyRoute from "./DynastyRoute.jsx";

const CLIENTS = [
  {
    key: "dynasty",
    n: 1,
    name: "Dynasty Employment Solutions",
    desc: "Employer pipeline · lead engine · 12 reps",
    live: true,
  },
  { key: "slot2", n: 2, name: "Open slot", desc: "No ops center connected yet", live: false },
  { key: "slot3", n: 3, name: "Open slot", desc: "No ops center connected yet", live: false },
];

export default function SoftwareOpsRoute() {
  const [client, setClient] = useState(null);

  if (client === "dynasty") return <DynastyRoute onBack={() => setClient(null)} />;

  return (
    <div className="dynops">
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--dim)" }}>
        Software OPS
      </div>
      <div className="sub" style={{ marginTop: 4 }}>
        Client software Cloud Scenic runs. Tap a client to open its ops center.
      </div>
      <div className="ops-clients">
        {CLIENTS.map((c) => (
          <button
            key={c.key}
            className={"ops-client" + (c.live ? "" : " off")}
            disabled={!c.live}
            onClick={() => c.live && setClient(c.key)}
          >
            <span className="ops-client-name">{c.name}</span>
            <span className="ops-client-desc">{c.desc}</span>
            <span className={"ops-client-status" + (c.live ? " live" : "")}>
              {c.live ? "● live — open ops center" : "○ standby"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
