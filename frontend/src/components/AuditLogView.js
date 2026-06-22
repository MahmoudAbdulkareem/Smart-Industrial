import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "../context/LanguageContext";

const ACTION_COLORS = {
    LOGIN_SUCCESS:      { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    LOGIN_FAILED:       { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    TOTP_FAILED:        { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    TOTP_ENABLED:       { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    TOTP_RESET:         { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    QR_LOGIN:           { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    USER_CREATED:       { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
    USER_UPDATED:       { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
    USER_DELETED:       { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    USER_DEACTIVATED:   { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    USER_REACTIVATED:   { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    USER_AUTO_DELETED:  { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    BULK_MARK_INACTIVE: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    ALERT_ACKNOWLEDGED: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    WORKORDER_CREATED:  { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
    THRESHOLD_SET:      { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" },
};

const ACTION_ICONS = {
    LOGIN_SUCCESS: "🔓", LOGIN_FAILED: "🔒", TOTP_FAILED: "⚠️", TOTP_ENABLED: "🔐",
    TOTP_RESET: "🔄", QR_LOGIN: "📱", USER_CREATED: "👤", USER_UPDATED: "✏️",
    USER_DELETED: "🗑️", USER_DEACTIVATED: "⛔", USER_REACTIVATED: "✅",
    USER_AUTO_DELETED: "🗑️", BULK_MARK_INACTIVE: "📋",
    ALERT_ACKNOWLEDGED: "✓", WORKORDER_CREATED: "🔧", THRESHOLD_SET: "⚙️",
};

const PAGE_SIZE = 20;

function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function DetailPill({ details }) {
    const [open, setOpen] = useState(false);
    if (!details) return <span style={{ fontSize: 11, color: "#9aa5b4" }}>—</span>;
    let parsed;
    try { parsed = JSON.parse(details); } catch { return <span style={{ fontSize: 11, color: "#9aa5b4" }}>{details}</span>; }

    const summary = Object.entries(parsed).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ");
    return (
        <div>
            <button onClick={() => setOpen(o => !o)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11, color: "#1d6fcc", textAlign: "left", fontFamily: "inherit" }}>
                {open ? "▾ " : "▸ "}{summary}{Object.keys(parsed).length > 2 ? " …" : ""}
            </button>
            {open && (
                <pre style={{ margin: "4px 0 0", fontSize: 11, color: "#374151", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {JSON.stringify(parsed, null, 2)}
                </pre>
            )}
        </div>
    );
}

export default function AuditLogView() {
    const { t } = useLanguage();
    const [logs,    setLogs]    = useState([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(true);
    const [filter,  setFilter]  = useState("");
    const [search,  setSearch]  = useState("");

    const fetchLogs = useCallback(async (pg = 1, actionFilter = "") => {
        setLoading(true);
        try {
            const offset = (pg - 1) * PAGE_SIZE;
            const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
            const res  = await fetch(`/api/audit-logs?${params}`, {
                headers: { Authorization: "Bearer " + localStorage.getItem("token") },
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            const filtered = actionFilter ? data.filter(l => l.action === actionFilter) : data;
            setLogs(filtered);
            setTotal(data.length < PAGE_SIZE ? offset + data.length : offset + PAGE_SIZE + 1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(page, filter); }, [page, filter, fetchLogs]);

    const displayed = search
        ? logs.filter(l =>
            (l.user_email || "").toLowerCase().includes(search.toLowerCase()) ||
            (l.user_name  || "").toLowerCase().includes(search.toLowerCase()) ||
            l.action.toLowerCase().includes(search.toLowerCase())
          )
        : logs;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const actionTypes = [...new Set([
        "LOGIN_SUCCESS","LOGIN_FAILED","TOTP_FAILED","TOTP_ENABLED","TOTP_RESET","QR_LOGIN",
        "USER_CREATED","USER_UPDATED","USER_DELETED","USER_DEACTIVATED","USER_REACTIVATED",
        "USER_AUTO_DELETED","BULK_MARK_INACTIVE","ALERT_ACKNOWLEDGED","WORKORDER_CREATED","THRESHOLD_SET",
    ])];

    return (
        <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
                <input
                    placeholder="Search user or action…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ padding: "7px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 8,
                        fontFamily: "inherit", color: "#1a2332", width: 220, outline: "none" }}
                />
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
                    style={{ padding: "7px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 8,
                        fontFamily: "inherit", color: "#1a2332", background: "#fff", outline: "none" }}>
                    <option value="">All actions</option>
                    {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button onClick={() => fetchLogs(page, filter)}
                    style={{ padding: "7px 16px", fontSize: 13, background: "#f8faff", border: "1px solid #d1d9e6",
                        borderRadius: 8, cursor: "pointer", fontFamily: "inherit", color: "#374151" }}>
                    ⟳ Refresh
                </button>
                <span style={{ fontSize: 12, color: "#9aa5b4", marginLeft: "auto" }}>{displayed.length} entries shown</span>
            </div>

            {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
                            height: 52, animation: `pulse 1.4s ease-in-out ${i * 0.1}s infinite` }} />
                    ))}
                </div>
            ) : displayed.length === 0 ? (
                <div style={{ background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "20px", color: "#6b7a99", fontSize: 13, textAlign: "center" }}>
                    No audit log entries found.
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {displayed.map(log => {
                        const style = ACTION_COLORS[log.action] || { bg: "#f8faff", color: "#374151", border: "#e2e8f0" };
                        const icon  = ACTION_ICONS[log.action]  || "📝";
                        return (
                            <div key={log.id} style={{
                                background: style.bg, border: "1px solid " + style.border,
                                borderLeft: "4px solid " + style.color,
                                borderRadius: 8, padding: "10px 14px",
                                display: "grid", gridTemplateColumns: "160px 1fr 1fr 1fr",
                                gap: 12, alignItems: "start",
                            }}>
                                <div>
                                    <div style={{ fontSize: 11, color: "#6b7a99" }}>{formatDate(log.created_at)}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 14 }}>{icon}</span>
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                                        background: style.color + "20", color: style.color,
                                        border: "1px solid " + style.border,
                                    }}>{log.action}</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1a2332" }}>{log.user_name || "System"}</div>
                                    <div style={{ fontSize: 11, color: "#9aa5b4" }}>{log.user_email || "AUTO"}</div>
                                </div>
                                <DetailPill details={log.details} />
                            </div>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && (
                <div style={{ display: "flex", gap: 6, marginTop: 16, justifyContent: "flex-end", alignItems: "center" }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ padding: "5px 12px", fontSize: 12, border: "1px solid #d1d9e6", borderRadius: 6,
                            background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer",
                            color: page === 1 ? "#c9d3df" : "#374151" }}>‹ Prev</button>
                    <span style={{ fontSize: 12, color: "#6b7a99" }}>Page {page}</span>
                    <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE}
                        style={{ padding: "5px 12px", fontSize: 12, border: "1px solid #d1d9e6", borderRadius: 6,
                            background: "#fff", cursor: logs.length < PAGE_SIZE ? "not-allowed" : "pointer",
                            color: logs.length < PAGE_SIZE ? "#c9d3df" : "#374151" }}>Next ›</button>
                </div>
            )}
        </div>
    );
}
