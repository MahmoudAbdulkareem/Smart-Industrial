// HealthView.js — Asset Health tab
//
// Sprint S1 Week 2 — Journal de Bord, March 17
//   "Completed first Health View component, including asset health cards
//    with placeholder information for RUL and MTBF. Simplicity is a
//    necessity; color-coded icons communicate information more effectively
//    than tables."
//
// Sprint S2 Week 2 — Journal de Bord, April 2
//   "Swapped out all the mock data with real API calls to SQL Server.
//    Real data immediately exposed a mismatch between the column names in
//    the database and what the front end was expecting. Fixed by adding
//    aliases in the SQL queries."
//
// Layout:
//   Summary banner (critical / caution / healthy counts)
//   ↓
//   Card grid — one card per asset, sorted worst first
//   Each card shows:
//     - Asset name, ID, location
//     - Status badge (color-coded)
//     - Health score progress bar
//     - RUL (days) and MTBF (hours)
//     - Live sensor readings (vibration, temperature, pressure)
//     - "Create Work Order" button (maintenance_engineer only, non-healthy assets)
//
// Work Order Modal:
//   Appears over the dashboard when the button is clicked.
//   POSTs to /api/workorders (requireRole: maintenance_engineer).
//   Shows the Maximo work order number (WO-timestamp) on success.

import React, { useState } from "react";
import { useApi } from "../hooks/useApi";

// ── Status colour helpers ──────────────────────────────────────
const STATUS = {
  healthy:  { bg: "#1a3a2a", color: "#3fb950", border: "#2ea04340" },
  caution:  { bg: "#2d2208", color: "#d29922", border: "#9e640040" },
  critical: { bg: "#3d1a1a", color: "#f85149", border: "#f8514940" },
};
function bar(status) {
  return STATUS[status]?.color || "#58a6ff";
}

// ── WorkOrderModal ─────────────────────────────────────────────
function WorkOrderModal({ asset, onClose }) {
  const [desc,    setDesc]   = useState(`Maintenance required — Health Score: ${asset.healthScore}/100`);
  const [status,  setStatus] = useState("idle");   // idle | loading | success | error
  const [result,  setResult] = useState(null);

  async function submit() {
    setStatus("loading");
    const token = localStorage.getItem("token");
    try {
      const res  = await fetch("/api/workorders", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ assetId: asset.id, description: desc }),
      });
      const json = await res.json();
      if (!res.ok) { setStatus("error"); return; }
      setResult(json);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    // Clicking the dark overlay closes the modal (e.target check prevents
    // clicks inside the white card from also closing it)
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e6edf3" }}>Create Work Order</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        <div style={{ backgroundColor: "#0d1117", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: "#8b949e" }}>Asset: </span>
          <strong style={{ color: "#e6edf3" }}>{asset.name}</strong>
          <span style={{ color: "#484f58", marginLeft: 8 }}>{asset.id} · {asset.location}</span>
        </div>

        {status === "success" ? (
          <div>
            <div style={{ backgroundColor: "#1a3a2a", border: "1px solid #2ea04340", borderRadius: 6, padding: "12px 14px", fontSize: 13, color: "#3fb950", marginBottom: 16 }}>
              ✓ Work Order <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{result.wonum}</strong> created · Status: {result.status} (Waiting for Approval)
            </div>
            <button onClick={onClose} style={btnPrimary}>Close</button>
          </div>
        ) : (
          <>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#8b949e", display: "block", marginBottom: 6 }}>Description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13,
                backgroundColor: "#0d1117", border: "1px solid #30363d",
                borderRadius: 6, color: "#e6edf3", fontFamily: "inherit",
                resize: "vertical", marginBottom: 14,
              }}
            />
            {status === "error" && (
              <p style={{ color: "#f85149", fontSize: 13, marginBottom: 12 }}>
                ⚠ Failed to create. Check the backend is running and your role is maintenance_engineer.
              </p>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={btnSecondary}>Cancel</button>
              <button onClick={submit} style={btnPrimary} disabled={status === "loading"}>
                {status === "loading" ? "Submitting…" : "Submit to Maximo"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── AssetCard ──────────────────────────────────────────────────
function AssetCard({ asset, canCreateWO }) {
  const [showModal, setShowModal] = useState(false);
  const s = STATUS[asset.status] || STATUS.healthy;

  return (
    <div style={{
      backgroundColor: "#161b22",
      border:          `1px solid #30363d`,
      borderLeft:      `3px solid ${s.color}`,
      borderRadius:    8,
      padding:         20,
      display:         "flex",
      flexDirection:   "column",
      gap:             14,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#e6edf3" }}>{asset.name}</div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
            {asset.id} · {asset.location}
          </div>
        </div>
        <span style={{
          backgroundColor: s.bg,
          color:           s.color,
          border:          `1px solid ${s.border}`,
          padding:         "3px 10px",
          borderRadius:    20,
          fontSize:        11,
          fontWeight:      600,
          textTransform:   "uppercase",
          letterSpacing:   0.5,
        }}>
          {asset.status}
        </span>
      </div>

      {/* Health score bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#8b949e" }}>Health Score</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>
            {asset.healthScore} / 100
          </span>
        </div>
        <div style={{ height: 6, backgroundColor: "#21262d", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height:          "100%",
            width:           `${asset.healthScore}%`,
            backgroundColor: bar(asset.status),
            borderRadius:    3,
            transition:      "width 0.6s ease",
          }} />
        </div>
      </div>

      {/* RUL + MTBF */}
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { label: "RUL", value: `${asset.rul} days`,  title: "Remaining Useful Life" },
          { label: "MTBF", value: `${asset.mtbf} hrs`, title: "Mean Time Between Failures" },
        ].map(k => (
          <div key={k.label} title={k.title}>
            <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#cdd9e5", fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Sensor readings */}
      <div style={{
        backgroundColor: "#0d1117",
        borderRadius:    6,
        padding:         "8px 12px",
        display:         "flex",
        gap:             16,
        flexWrap:        "wrap",
      }}>
        {[
          { label: "Vibration",   value: `${asset.sensors.vibration} mm/s` },
          { label: "Temp",        value: `${asset.sensors.temperature} °C` },
          { label: "Pressure",    value: `${asset.sensors.pressure} bar`   },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 9, color: "#484f58", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: "#8b949e", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Work Order button — only for non-healthy assets + maintenance role */}
      {canCreateWO && asset.status !== "healthy" && (
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding:         "7px 12px",
            fontSize:        12,
            fontWeight:      500,
            backgroundColor: "transparent",
            border:          "1px solid #f85149",
            color:           "#f85149",
            borderRadius:    5,
            cursor:          "pointer",
            alignSelf:       "flex-start",
            fontFamily:      "inherit",
          }}
        >
          + Create Work Order
        </button>
      )}

      {showModal && <WorkOrderModal asset={asset} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── Main HealthView export ─────────────────────────────────────
export default function HealthView({ userRole }) {
  const { data, loading, error } = useApi("/assets/health", 6000);

  if (loading) return <SkeletonGrid />;
  if (error)   return <p style={{ color: "#f85149", fontSize: 13 }}>Error: {error}</p>;
  if (!Array.isArray(data)) return <SkeletonGrid />;

  const sorted     = [...data].sort((a, b) => a.healthScore - b.healthScore);
  const canCreateWO = userRole === "maintenance_engineer";

  const counts = {
    critical: data.filter(a => a.status === "critical").length,
    caution:  data.filter(a => a.status === "caution").length,
    healthy:  data.filter(a => a.status === "healthy").length,
  };

  return (
    <div>
      {/* Summary banner */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Critical", count: counts.critical, ...STATUS.critical },
          { label: "Caution",  count: counts.caution,  ...STATUS.caution  },
          { label: "Healthy",  count: counts.healthy,  ...STATUS.healthy  },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: s.bg,
            border:          `1px solid ${s.border}`,
            borderRadius:    6,
            padding:         "8px 16px",
            display:         "flex",
            alignItems:      "center",
            gap:             8,
          }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.count}</span>
            <span style={{ fontSize: 13, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Cards grid */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
        gap:                 14,
      }}>
        {sorted.map(asset => (
          <AssetCard key={asset.id} asset={asset} canCreateWO={canCreateWO} />
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          backgroundColor: "#161b22", border: "1px solid #30363d",
          borderRadius: 8, height: 220,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} } @keyframes spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// Shared modal styles
const overlay = {
  position:        "fixed",
  inset:           0,
  backgroundColor: "rgba(0,0,0,0.7)",
  display:         "flex",
  alignItems:      "center",
  justifyContent:  "center",
  zIndex:          100,
  backdropFilter:  "blur(2px)",
};
const modal = {
  backgroundColor: "#161b22",
  border:          "1px solid #30363d",
  borderRadius:    10,
  padding:         24,
  width:           "100%",
  maxWidth:        460,
  boxShadow:       "0 24px 64px rgba(0,0,0,0.6)",
};
const btnPrimary = {
  padding:         "8px 18px",
  fontSize:        13,
  fontWeight:      600,
  borderRadius:    5,
  border:          "none",
  cursor:          "pointer",
  backgroundColor: "#238636",
  color:           "#fff",
  fontFamily:      "inherit",
};
const btnSecondary = {
  ...btnPrimary,
  backgroundColor: "transparent",
  border:          "1px solid #30363d",
  color:           "#8b949e",
};
