import React, { useState } from "react";
import { useApi } from "../hooks/useApi";

// Returns a background color based on status
function statusBg(status) {
  if (status === "healthy")  return "#d4edda";
  if (status === "caution")  return "#fff3cd";
  return "#f8d7da";
}

function statusText(status) {
  if (status === "healthy")  return "#155724";
  if (status === "caution")  return "#856404";
  return "#721c24";
}

function AssetCard({ asset, onCreateWO }) {
  const bg   = statusBg(asset.status);
  const text = statusText(asset.status);

  return (
    <div style={{
      border: "1px solid #ccc",
      borderRadius: 6,
      padding: 16,
      backgroundColor: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{asset.name}</strong>
          <div style={{ fontSize: 12, color: "#666" }}>{asset.id} · {asset.location}</div>
        </div>
        <span style={{
          backgroundColor: bg, color: text,
          padding: "3px 10px", borderRadius: 12,
          fontSize: 12, fontWeight: 600,
          textTransform: "capitalize",
        }}>
          {asset.status}
        </span>
      </div>

      {/* Health Score */}
      <div>
        <div style={{ fontSize: 13, color: "#444", marginBottom: 4 }}>Health Score</div>
        <div style={{ height: 12, backgroundColor: "#e9ecef", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${asset.healthScore}%`,
            backgroundColor: asset.status === "healthy" ? "#28a745" : asset.status === "caution" ? "#ffc107" : "#dc3545",
            borderRadius: 6,
            transition: "width 0.5s",
          }} />
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{asset.healthScore} / 100</div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
        <div><span style={{ color: "#666" }}>RUL: </span><strong>{asset.rul} days</strong></div>
        <div><span style={{ color: "#666" }}>MTBF: </span><strong>{asset.mtbf} hrs</strong></div>
      </div>

      {/* Sensors */}
      <div style={{ fontSize: 12, color: "#555", borderTop: "1px solid #eee", paddingTop: 8 }}>
        Vibration: {asset.sensors.vibration} mm/s &nbsp;|&nbsp;
        Temp: {asset.sensors.temperature}°C &nbsp;|&nbsp;
        Pressure: {asset.sensors.pressure} bar
      </div>

      {/* Work Order button for non-healthy assets */}
      {asset.status !== "healthy" && (
        <button
          onClick={() => onCreateWO(asset)}
          style={{
            padding: "6px 12px", fontSize: 12,
            backgroundColor: "#fff", border: "1px solid #dc3545",
            color: "#dc3545", borderRadius: 4, cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          + Create Work Order
        </button>
      )}
    </div>
  );
}

function WorkOrderModal({ asset, onClose }) {
  const [desc, setDesc]     = useState(`Maintenance required — Health Score: ${asset.healthScore}`);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  async function submit() {
    setStatus("loading");
    try {
      const res  = await fetch("/api/workorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, description: desc }),
      });
      const json = await res.json();
      setResult(json);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        backgroundColor: "#fff", borderRadius: 6, padding: 24,
        width: 440, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
      }}>
        <h3 style={{ margin: "0 0 16px" }}>Create Work Order</h3>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#555" }}>
          Asset: <strong>{asset.name} ({asset.id})</strong>
        </p>

        {status === "success" ? (
          <div>
            <p style={{ color: "#155724", backgroundColor: "#d4edda", padding: 10, borderRadius: 4 }}>
              ✓ Work Order <strong>{result.wonum}</strong> created (Status: {result.status})
            </p>
            <button onClick={onClose} style={btnStyle}>Close</button>
          </div>
        ) : (
          <>
            <label style={{ fontSize: 13 }}>Description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 8, marginTop: 4, marginBottom: 12, fontSize: 13, boxSizing: "border-box", borderRadius: 4, border: "1px solid #ccc" }}
            />
            {status === "error" && <p style={{ color: "red", fontSize: 13 }}>Failed. Is the backend running?</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose}  style={{ ...btnStyle, backgroundColor: "#fff", color: "#333", border: "1px solid #ccc" }}>Cancel</button>
              <button onClick={submit}   style={{ ...btnStyle, backgroundColor: "#0069d9" }} disabled={status === "loading"}>
                {status === "loading" ? "Submitting…" : "Submit to Maximo"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "8px 16px", fontSize: 13, borderRadius: 4,
  border: "none", cursor: "pointer", backgroundColor: "#007bff", color: "#fff",
};

export default function HealthView() {
  const { data, loading, error } = useApi("/assets/health", 6000);
  const [woAsset, setWoAsset]   = useState(null);

  if (loading) return <p>Loading…</p>;
  if (error)   return <p style={{ color: "red" }}>Error: {error}</p>;

  const sorted = [...data].sort((a, b) => a.healthScore - b.healthScore);

  // Summary counts
  const critical = data.filter(a => a.status === "critical").length;
  const caution  = data.filter(a => a.status === "caution").length;
  const healthy  = data.filter(a => a.status === "healthy").length;

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Critical", count: critical, color: "#f8d7da", text: "#721c24" },
          { label: "Caution",  count: caution,  color: "#fff3cd", text: "#856404" },
          { label: "Healthy",  count: healthy,  color: "#d4edda", text: "#155724" },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: s.color, color: s.text,
            padding: "8px 16px", borderRadius: 4, fontSize: 14,
          }}>
            <strong>{s.count}</strong> {s.label}
          </div>
        ))}
      </div>

      {/* Asset cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}>
        {sorted.map(asset => (
          <AssetCard key={asset.id} asset={asset} onCreateWO={setWoAsset} />
        ))}
      </div>

      {woAsset && <WorkOrderModal asset={woAsset} onClose={() => setWoAsset(null)} />}
    </div>
  );
}
