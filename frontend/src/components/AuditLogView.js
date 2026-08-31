import React, { useState, useEffect, useCallback } from "react";
import {
    Unlock, Lock, AlertTriangle, ShieldCheck, RotateCw, Smartphone, UserPlus, Pencil,
    Trash2, Ban, CheckCircle2, ClipboardList, Check, Wrench, Settings, FileText, RefreshCw,
    ChevronDown, ChevronRight,
} from "lucide-react";

const ACTION_TONE = {
    LOGIN_SUCCESS:      { tone: "normal", icon: Unlock },
    LOGIN_FAILED:       { tone: "critical", icon: Lock },
    TOTP_FAILED:        { tone: "critical", icon: AlertTriangle },
    TOTP_ENABLED:       { tone: "normal", icon: ShieldCheck },
    TOTP_RESET:         { tone: "elevated", icon: RotateCw },
    QR_LOGIN:           { tone: "normal", icon: Smartphone },
    USER_CREATED:       { tone: "info", icon: UserPlus },
    USER_UPDATED:       { tone: "info", icon: Pencil },
    USER_DELETED:       { tone: "critical", icon: Trash2 },
    USER_DEACTIVATED:   { tone: "elevated", icon: Ban },
    USER_REACTIVATED:   { tone: "normal", icon: CheckCircle2 },
    USER_AUTO_DELETED:  { tone: "critical", icon: Trash2 },
    BULK_MARK_INACTIVE: { tone: "elevated", icon: ClipboardList },
    ALERT_ACKNOWLEDGED: { tone: "normal", icon: Check },
    WORKORDER_CREATED:  { tone: "info", icon: Wrench },
    THRESHOLD_SET:      { tone: "purple", icon: Settings },
};

const TONE_CLASSES = {
    normal:   { bg: "bg-status-normal/10", text: "text-status-normal", border: "border-status-normal/30" },
    elevated: { bg: "bg-status-elevated/10", text: "text-status-elevated", border: "border-status-elevated/30" },
    critical: { bg: "bg-status-critical/10", text: "text-status-critical", border: "border-status-critical/30" },
    info:     { bg: "bg-status-info/10", text: "text-status-info", border: "border-status-info/30" },
    purple:   { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/30" },
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
    if (!details) return <span className="text-[11px] text-ink-dim/70">—</span>;
    let parsed;
    try { parsed = JSON.parse(details); } catch { return <span className="text-[11px] text-ink-dim/70">{details}</span>; }

    const summary = Object.entries(parsed).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ");
    return (
        <div>
            <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-[11px] text-status-info text-left">
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {summary}{Object.keys(parsed).length > 2 ? " …" : ""}
            </button>
            {open && (
                <pre className="mt-1 text-[11px] text-ink bg-surface border border-surface-line rounded-md px-2.5 py-1.5 whitespace-pre-wrap break-all font-mono">
                    {JSON.stringify(parsed, null, 2)}
                </pre>
            )}
        </div>
    );
}

export default function AuditLogView() {
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
            <div className="flex gap-2.5 mb-4.5 flex-wrap items-center">
                <input
                    placeholder="Search user or action…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-surface-line rounded-lg text-ink w-[220px] outline-none bg-surface-panel"
                />
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
                    className="px-3 py-1.5 text-sm border border-surface-line rounded-lg text-ink bg-surface-panel outline-none">
                    <option value="">All actions</option>
                    {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button onClick={() => fetchLogs(page, filter)} className="flex items-center gap-1 px-4 py-1.5 text-sm bg-surface border border-surface-line rounded-lg text-ink-dim">
                    <RefreshCw size={13} /> Refresh
                </button>
                <span className="text-xs text-ink-dim/70 ml-auto font-mono">{displayed.length} entries shown</span>
            </div>

            {loading ? (
                <div className="flex flex-col gap-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-surface-panel border border-surface-line rounded-lg h-[52px] animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                </div>
            ) : displayed.length === 0 ? (
                <div className="bg-surface border border-surface-line rounded-xl p-5 text-ink-dim text-sm text-center">
                    No audit log entries found.
                </div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {displayed.map(log => {
                        const meta = ACTION_TONE[log.action] || { tone: "info", icon: FileText };
                        const c = TONE_CLASSES[meta.tone];
                        const Icon = meta.icon;
                        return (
                            <div key={log.id}
                                className={`${c.bg} border ${c.border} border-l-4 rounded-lg px-3.5 py-2.5 grid gap-3 items-start`}
                                style={{ gridTemplateColumns: "160px 1fr 1fr 1fr", borderLeftColor: "currentColor" }}
                            >
                                <div className="text-[11px] text-ink-dim font-mono">{formatDate(log.created_at)}</div>
                                <div className="flex items-center gap-1.5">
                                    <Icon size={14} className={c.text} />
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>{log.action}</span>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-ink">{log.user_name || "System"}</div>
                                    <div className="text-[11px] text-ink-dim/70">{log.user_email || "AUTO"}</div>
                                </div>
                                <DetailPill details={log.details} />
                            </div>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex gap-1.5 mt-4 justify-end items-center">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className={`px-3 py-1 text-xs border border-surface-line rounded-md bg-surface-panel ${page === 1 ? "text-ink-dim/40 cursor-not-allowed" : "text-ink-dim"}`}>‹ Prev</button>
                    <span className="text-xs text-ink-dim">Page {page}</span>
                    <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE}
                        className={`px-3 py-1 text-xs border border-surface-line rounded-md bg-surface-panel ${logs.length < PAGE_SIZE ? "text-ink-dim/40 cursor-not-allowed" : "text-ink-dim"}`}>Next ›</button>
                </div>
            )}
        </div>
    );
}
