// frontend/src/components/WorkOrderSyncTrackerModal.js
//
// Dedicated "Work Order Status Tracker" modal — a live view of the IBM
// Maximo sync log (WONUM, STATUS, CREATED_DATE, PRIORITY, raw request/
// response payload) per each outbound/inbound sync attempt. Distinct from
// the inline sync summary in WorkOrdersView.js: this is the drill-down /
// debugging view an IT admin reaches for when a specific WO's Maximo state
// looks wrong and they need to see exactly what was sent and what came back.
import React, { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

function authHeaders() {
    const token = localStorage.getItem("token");
    return { Authorization: token ? "Bearer " + token : "", "Content-Type": "application/json" };
}

const SYNC_STATUS_STYLE = {
    SENT:    { label: "Sent",    bg: "#E8F8F2", color: "#0E9370", border: "#A8E6CC", icon: "✅" },
    PENDING: { label: "Pending", bg: "#FDF3E2", color: "#B4791F", border: "#F5D48A", icon: "⏳" },
    FAILED:  { label: "Failed",  bg: "#FBEAEA", color: "#B23A3D", border: "#F3B7B8", icon: "❌" },
};

const PRIORITY_STYLE = {
    1: { label: "P1 — Emergency", color: "#B23A3D" },
    2: { label: "P2 — High",      color: "#c2410c" },
    3: { label: "P3 — Medium",    color: "#B4791F" },
    4: { label: "P4 — Low",       color: "#4b5563" },
    5: { label: "P5 — Planning",  color: "#6b7280" },
};

function fmtDate(v) {
    if (!v) return "—";
    try {
        return new Date(v).toLocaleString();
    } catch {
        return String(v);
    }
}

function prettyPayload(raw) {
    if (!raw) return null;
    try {
        return JSON.stringify(typeof raw === "string" ? JSON.parse(raw) : raw, null, 2);
    } catch {
        return String(raw);
    }
}

export default function WorkOrderSyncTrackerModal({ open, onClose, onToast }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const [retryingId, setRetryingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/maximo/sync/recent?limit=200`, { headers: authHeaders() });
            const json = await res.json();
            setRows(Array.isArray(json) ? json : []);
        } catch (err) {
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        load();
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, [open, load]);

    const filtered = useMemo(() => {
        return rows.filter(r => {
            if (statusFilter !== "ALL" && r.syncStatus !== statusFilter) return false;
            if (!search) return true;
            const q = search.toLowerCase();
            return (r.wonum || "").toLowerCase().includes(q) ||
                   (r.assetnum || "").toLowerCase().includes(q) ||
                   (r.assetId || "").toLowerCase().includes(q);
        });
    }, [rows, statusFilter, search]);

    async function retry(logId) {
        setRetryingId(logId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/maximo/sync/${logId}/retry`, {
                method: "POST",
                headers: authHeaders(),
            });
            const json = await res.json();
            if (json?.error) {
                onToast?.(`Retry failed: ${json.error}`, "error");
            } else {
                onToast?.("Retry triggered", "success");
            }
            await load();
        } catch (err) {
            onToast?.(`Retry failed: ${err.message}`, "error");
        } finally {
            setRetryingId(null);
        }
    }

    if (!open) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <div>
                        <div style={styles.title}>Work Order Status Tracker</div>
                        <div style={styles.subtitle}>Live IBM Maximo sync log — every outbound/inbound attempt, with raw payloads</div>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div style={styles.toolbar}>
                    <input
                        style={styles.search}
                        placeholder="Search WONUM, asset number, or asset ID…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <select style={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="ALL">All statuses</option>
                        <option value="SENT">Sent</option>
                        <option value="PENDING">Pending</option>
                        <option value="FAILED">Failed</option>
                    </select>
                    <button style={styles.refreshBtn} onClick={load} disabled={loading}>
                        {loading ? "Refreshing…" : "↻ Refresh"}
                    </button>
                </div>

                <div style={styles.tableWrap}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>WONUM</th>
                                <th style={styles.th}>Sync Status</th>
                                <th style={styles.th}>WO Status</th>
                                <th style={styles.th}>Priority</th>
                                <th style={styles.th}>Asset</th>
                                <th style={styles.th}>Direction</th>
                                <th style={styles.th}>Created Date</th>
                                <th style={styles.th}>Last Attempt</th>
                                <th style={styles.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && !loading && (
                                <tr><td colSpan={9} style={styles.emptyCell}>No sync log entries match this filter.</td></tr>
                            )}
                            {filtered.map(row => {
                                const s = SYNC_STATUS_STYLE[row.syncStatus] || SYNC_STATUS_STYLE.PENDING;
                                const p = PRIORITY_STYLE[row.priority] || null;
                                const isExpanded = expandedId === row.id;
                                const reqPretty = prettyPayload(row.requestPayload);
                                const resPretty = prettyPayload(row.responsePayload);
                                return (
                                    <React.Fragment key={row.id}>
                                        <tr style={styles.row} onClick={() => setExpandedId(isExpanded ? null : row.id)}>
                                            <td style={styles.tdMono}>{row.wonum || "—"}</td>
                                            <td style={styles.td}>
                                                <span style={{ ...styles.badge, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                                                    {s.icon} {s.label}
                                                </span>
                                            </td>
                                            <td style={styles.td}>{row.wonumStatus || "—"}</td>
                                            <td style={{ ...styles.td, color: p?.color || "#374151", fontWeight: 600 }}>
                                                {p ? p.label : (row.priority ?? "—")}
                                            </td>
                                            <td style={styles.td}>{row.assetnum || row.assetId || "—"}</td>
                                            <td style={styles.td}>{row.direction}</td>
                                            <td style={styles.td}>{fmtDate(row.wonumCreatedAt)}</td>
                                            <td style={styles.td}>{fmtDate(row.attemptedAt)}</td>
                                            <td style={styles.td}>
                                                {row.syncStatus === "FAILED" && (
                                                    <button
                                                        style={styles.retryBtn}
                                                        disabled={retryingId === row.id}
                                                        onClick={e => { e.stopPropagation(); retry(row.id); }}
                                                    >
                                                        {retryingId === row.id ? "…" : "↻ Retry"}
                                                    </button>
                                                )}
                                                <span style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</span>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={9} style={styles.detailCell}>
                                                    {row.errorMessage && (
                                                        <div style={styles.errorBox}>⚠ {row.errorMessage}</div>
                                                    )}
                                                    <div style={styles.payloadGrid}>
                                                        <div>
                                                            <div style={styles.payloadLabel}>Request payload</div>
                                                            <pre style={styles.payloadBox}>{reqPretty || "— none —"}</pre>
                                                        </div>
                                                        <div>
                                                            <div style={styles.payloadLabel}>Response payload</div>
                                                            <pre style={styles.payloadBox}>{resPretty || "— none —"}</pre>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
    },
    modal: {
        background: "#fff", borderRadius: 12, width: "min(1100px, 100%)", maxHeight: "88vh",
        display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
    },
    header: {
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        padding: "20px 24px", borderBottom: "1px solid #e5e7eb",
    },
    title: { fontSize: 17, fontWeight: 700, color: "#0f172a" },
    subtitle: { fontSize: 12.5, color: "#6b7280", marginTop: 4 },
    closeBtn: {
        border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30,
        cursor: "pointer", fontSize: 14, color: "#4b5563",
    },
    toolbar: { display: "flex", gap: 10, padding: "14px 24px", borderBottom: "1px solid #f1f5f9" },
    search: {
        flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13,
    },
    select: { padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 },
    refreshBtn: {
        padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff",
        cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
    },
    tableWrap: { overflow: "auto", padding: "0 24px 20px" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: {
        textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #f1f5f9",
        color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, position: "sticky", top: 0, background: "#fff",
    },
    td: { padding: "10px 8px", borderBottom: "1px solid #F5F7FA", color: "#1f2937" },
    tdMono: { padding: "10px 8px", borderBottom: "1px solid #F5F7FA", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "#0f172a" },
    row: { cursor: "pointer" },
    badge: { padding: "3px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" },
    expandIcon: { marginLeft: 8, color: "#9ca3af", fontSize: 10 },
    retryBtn: {
        padding: "4px 10px", borderRadius: 6, border: "1px solid #F3B7B8", background: "#FBEAEA",
        color: "#B23A3D", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
    },
    detailCell: { padding: "12px 16px 18px", background: "#F5F7FA" },
    errorBox: {
        marginBottom: 10, padding: "8px 12px", background: "#FBEAEA", border: "1px solid #F3B7B8",
        borderRadius: 8, color: "#B23A3D", fontSize: 12.5,
    },
    payloadGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
    payloadLabel: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 },
    payloadBox: {
        margin: 0, padding: 12, background: "#0f172a", color: "#e2e8f0", borderRadius: 8,
        fontSize: 11.5, lineHeight: 1.5, overflow: "auto", maxHeight: 260, whiteSpace: "pre-wrap", wordBreak: "break-word",
    },
    emptyCell: { padding: "28px 8px", textAlign: "center", color: "#9ca3af" },
};
