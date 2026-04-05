// AlertsPanel.js — Alerts tab
//
// Sprint S2 Week 2 — Journal de Bord, March 30 – April 3
//
// March 30 (Mon):
//   "Built an Alert Panel that shows warnings per asset — things like high
//    temperature, low remaining useful life, or an energy spike. Alerts
//    need severity levels, otherwise operators don't know what to deal
//    with first. That seems obvious in hindsight."
//   Problem: "The panel was showing everything at once which was
//    overwhelming. Added a filter so only unresolved alerts show by default."
//
// March 31 (Tue):
//   "Styled the alert cards with colour coding — red for critical, orange
//    for warning, blue for informational. Added icons and text labels
//    alongside the colour so there's no ambiguity."
//   Problem: "Cards were overlapping on smaller screens. Flexbox wrap sorted
//    it out quickly."
//
// April 3 (Fri):
//   "The panel wasn't refreshing automatically after new rows were inserted.
//    Added 10-second polling as a short-term fix. WebSockets are next."
//
// Key concept — optimistic UI update:
//   When the user clicks Acknowledge, we update the local React state
//   IMMEDIATELY (the card moves to the Acknowledged list at once).
//   Then we fire the PATCH request to the backend in the background.
//   This makes the UI feel instant even if the server takes 200ms to respond.
//   If the request fails, we could roll back the state (not implemented here).

import React, { useState } from "react";
import { useApi } from "../hooks/useApi";

const SEVERITY = {
  critical: {
    bg:     "#3d1a1a",
    color:  "#f85149",
    border: "#6e2929",
    label:  "Critical",
    icon:   "🔴",
  },
  caution: {
    bg:     "#2d2208",
    color:  "#d29922",
    border: "#78490040",
    label:  "Caution",
    icon:   "🟡",
  },
  info: {
    bg:     "#0d2137",
    color:  "#58a6ff",
    border: "#1f6feb40",
    label:  "Info",
    icon:   "🔵",
  },
};

function AlertCard({ alert, canAcknowledge, onAcknowledge }) {
  const s = SEVERITY[alert.severity] || SEVERITY.info;

  return (
    <div style={{
      backgroundColor: s.bg,
      border:          `1px solid ${s.border}`,
      borderLeft:      `4px solid ${s.color}`,
      borderRadius:    7,
      padding:         "14px 16px",
      display:         "flex",
      justifyContent:  "space-between",
      alignItems:      "flex-start",
      gap:             12,
    }}>
      <div style={{ flex: 1 }}>
        {/* Top row: severity badge + asset name + timestamp */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{
            backgroundColor: s.color + "22",
            color:           s.color,
            border:          `1px solid ${s.color}44`,
            fontSize:        10,
            fontWeight:      700,
            padding:         "2px 8px",
            borderRadius:    10,
            textTransform:   "uppercase",
            letterSpacing:   0.6,
          }}>
            {s.icon} {s.label}
          </span>
          <strong style={{ fontSize: 13, color: "#e6edf3" }}>{alert.asset}</strong>
          <span style={{
            fontSize:    10,
            color:       "#484f58",
            marginLeft:  "auto",
            fontFamily:  "'JetBrains Mono', monospace",
          }}>
            {alert.time}
          </span>
        </div>

        {/* Alert message */}
        <p style={{ margin: 0, fontSize: 13, color: "#8b949e", lineHeight: 1.5 }}>
          {alert.message}
        </p>

        {/* Metadata */}
        <p style={{ margin: "6px 0 0", fontSize: 10, color: "#484f58", fontFamily: "'JetBrains Mono', monospace" }}>
          ID #{alert.id} · {alert.assetId}
        </p>
      </div>

      {/* Acknowledge button — maintenance_engineer only */}
      {canAcknowledge && (
        <button
          onClick={() => onAcknowledge(alert.id)}
          style={{
            padding:         "6px 12px",
            fontSize:        11,
            fontWeight:      500,
            backgroundColor: "transparent",
            border:          `1px solid ${s.color}`,
            color:           s.color,
            borderRadius:    5,
            cursor:          "pointer",
            whiteSpace:      "nowrap",
            flexShrink:      0,
            fontFamily:      "inherit",
          }}
        >
          Acknowledge
        </button>
      )}
    </div>
  );
}

export default function AlertsPanel({ userRole }) {
  const { data, loading, error } = useApi("/alerts", 10000);

  // localAcked tracks IDs acknowledged THIS session.
  // Combined with the DB acknowledged flag, this gives instant UI feedback.
  // Journal note: "Track locally acknowledged IDs so UI updates instantly.
  // The real acknowledge is also persisted to SQL Server via PATCH."
  const [localAcked, setLocalAcked] = useState([]);

  if (loading) return <SkeletonList />;
  if (error)   return <p style={{ color: "#f85149", fontSize: 13 }}>Error: {error}</p>;
  if (!data)   return <SkeletonList />;

  const active = data.filter(a => !a.acknowledged && !localAcked.includes(a.id));
  const done   = data.filter(a =>  a.acknowledged ||  localAcked.includes(a.id));

  const canAck = userRole === "maintenance_engineer";

  async function handleAcknowledge(id) {
    // Optimistic update — move card instantly without waiting for server
    setLocalAcked(prev => [...prev, id]);

    // Persist to SQL Server in the background
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/alerts/${id}/acknowledge`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Failed to acknowledge on server:", err);
      // Could roll back here: setLocalAcked(prev => prev.filter(x => x !== id));
    }
  }

  return (
    <div>
      {/* Active alerts */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={sectionLabel}>Active</span>
        <span style={{
          backgroundColor: active.length > 0 ? "#3d1a1a" : "#1a3a2a",
          color:           active.length > 0 ? "#f85149" : "#3fb950",
          border:          `1px solid ${active.length > 0 ? "#6e292940" : "#2ea04340"}`,
          fontSize:        11,
          fontWeight:      700,
          padding:         "2px 8px",
          borderRadius:    10,
          fontFamily:      "'JetBrains Mono', monospace",
        }}>
          {active.length}
        </span>
      </div>

      {active.length === 0 ? (
        <div style={{
          backgroundColor: "#1a3a2a",
          border:          "1px solid #2ea04340",
          borderRadius:    7,
          padding:         "16px 20px",
          fontSize:        13,
          color:           "#3fb950",
          marginBottom:    24,
        }}>
          ✓ All clear — no active alerts
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {active.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              canAcknowledge={canAck}
              onAcknowledge={handleAcknowledge}
            />
          ))}
        </div>
      )}

      {/* Acknowledged alerts */}
      {done.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ ...sectionLabel, color: "#484f58" }}>Acknowledged</span>
            <span style={{
              backgroundColor: "#21262d",
              color:           "#484f58",
              fontSize:        11,
              fontWeight:      700,
              padding:         "2px 8px",
              borderRadius:    10,
              fontFamily:      "'JetBrains Mono', monospace",
            }}>
              {done.length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {done.map(alert => (
              <div key={alert.id} style={{
                backgroundColor: "#161b22",
                border:          "1px solid #21262d",
                borderRadius:    7,
                padding:         "10px 16px",
                display:         "flex",
                alignItems:      "center",
                gap:             12,
                opacity:         0.55,
              }}>
                <span style={{ color: "#3fb950", fontSize: 14 }}>✓</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 12, color: "#8b949e" }}>{alert.asset}</strong>
                  <span style={{ fontSize: 12, color: "#484f58", marginLeft: 8 }}>— {alert.message}</span>
                </div>
                <span style={{ fontSize: 10, color: "#484f58", fontFamily: "'JetBrains Mono', monospace" }}>
                  {alert.time}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          backgroundColor: "#161b22", border: "1px solid #30363d",
          borderRadius: 7, height: 80,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.12}s`,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  );
}

const sectionLabel = {
  fontSize:      11,
  fontWeight:    600,
  color:         "#8b949e",
  textTransform: "uppercase",
  letterSpacing: 0.8,
};
