import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "../context/LanguageContext";

const PAGE_SIZE = 8;

const ROLE_BADGE = {
    maintenance_engineer: { bg: "#dbeafe", color: "#1d4ed8" },
    energy_manager:       { bg: "#dcfce7", color: "#166534" },
    it_admin:             { bg: "#ede9fe", color: "#6d28d9" },
};

function getToken() { return localStorage.getItem("token"); }
function getCurrentUser() { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } }
function authHeaders() { return { "Content-Type": "application/json", Authorization: "Bearer " + getToken() }; }
function validateEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function isInactiveSixMonths(lastLogin) {
    if (!lastLogin) return true;
    return (Date.now() - new Date(lastLogin).getTime()) > 6 * 30 * 24 * 60 * 60 * 1000;
}

function hoursUntilDeletion(deactivatedAt) {
    if (!deactivatedAt) return null;
    const ms = 24 * 60 * 60 * 1000 - (Date.now() - new Date(deactivatedAt).getTime());
    if (ms <= 0) return 0;
    return Math.ceil(ms / (60 * 60 * 1000));
}

function Toast({ message, type, onDone }) {
    useEffect(() => { const id = setTimeout(onDone, 3200); return () => clearTimeout(id); }, [onDone]);
    return (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, background: type === "success" ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (type === "success" ? "#bbf7d0" : "#fecaca"), borderRadius: 10, padding: "14px 20px", fontSize: 13, color: type === "success" ? "#15803d" : "#b91c1c", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 8, animation: "slideInToast 0.25s ease" }}>
            {type === "success" ? "✓" : "⚠"} {message}
        </div>
    );
}

function Modal({ children, onClose }) {
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16, animation: "fadeModal 0.18s ease" }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", animation: "slideUpModal 0.2s ease", maxHeight: "90vh", overflowY: "auto" }}>
                {children}
            </div>
        </div>
    );
}

function Field({ label, error, children }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>{label}</label>
            {children}
            {error && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#dc2626" }}>{error}</p>}
        </div>
    );
}

function UserFormModal({ user, onClose, onSaved }) {
    const { t } = useLanguage();
    const isEdit = !!user;
    const [form,   setForm]   = useState({ name: user?.name || "", email: user?.email || "", role: user?.role || "", password: "" });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [apiErr, setApiErr] = useState(null);

    function set(k, v) { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: null })); }

    function validate() {
        const e = {};
        if (!form.name.trim())       e.name     = t("fieldName") + " is required.";
        if (!validateEmail(form.email)) e.email  = "Valid email required.";
        if (!form.role)              e.role     = t("fieldRole") + " is required.";
        if (!isEdit && form.password.length < 8) e.password = "Min. 8 characters.";
        if (isEdit && form.password && form.password.length < 8) e.password = "Min. 8 characters.";
        return e;
    }

    async function handleSave() {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setSaving(true); setApiErr(null);
        const body = { name: form.name, email: form.email, role: form.role };
        if (form.password) body.password = form.password;
        try {
            const res = await fetch(isEdit ? `/api/users/${user.id}` : "/api/users", {
                method: isEdit ? "PUT" : "POST",
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) { setApiErr(json.error || "Failed."); setSaving(false); return; }
            onSaved(isEdit ? t("successEdit") : t("successAdd"));
        } catch { setApiErr("Cannot connect to server."); }
        setSaving(false);
    }

    const inp = { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 8, color: "#1a2332", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

    return (
        <Modal onClose={onClose}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332" }}>{isEdit ? t("modalEditTitle") : t("modalAddTitle")}</h3>
                <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9aa5b4", cursor: "pointer" }}>×</button>
            </div>
            <Field label={t("fieldName")} error={errors.name}>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder={t("placeholderName")} style={{ ...inp, borderColor: errors.name ? "#fca5a5" : "#d1d9e6" }} />
            </Field>
            <Field label={t("fieldEmail")} error={errors.email}>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder={t("placeholderEmail")} style={{ ...inp, borderColor: errors.email ? "#fca5a5" : "#d1d9e6" }} />
            </Field>
            <Field label={t("fieldRole")} error={errors.role}>
                <select value={form.role} onChange={e => set("role", e.target.value)} style={{ ...inp, borderColor: errors.role ? "#fca5a5" : "#d1d9e6" }}>
                    <option value="">— {t("fieldRole")} —</option>
                    {Object.entries(t("roles")).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </Field>
            <Field label={isEdit ? t("fieldPasswordEdit") : t("fieldPassword")} error={errors.password}>
                <input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder={t("placeholderPassword")} style={{ ...inp, borderColor: errors.password ? "#fca5a5" : "#d1d9e6" }} />
            </Field>
            {apiErr && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>⚠ {apiErr}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={onClose} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#fff", border: "1px solid #d1d9e6", color: "#374151", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>{t("cancel")}</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.75 : 1 }}>
                    {saving ? "…" : t("save")}
                </button>
            </div>
        </Modal>
    );
}

function ConfirmDeleteModal({ user, onClose, onConfirm }) {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    async function handleConfirm() { setLoading(true); await onConfirm(); setLoading(false); }
    return (
        <Modal onClose={onClose}>
            <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332", marginBottom: 8 }}>{t("confirmDelete")}</h3>
                <p style={{ fontSize: 13, color: "#6b7a99", marginBottom: 4 }}>{user.name} — {user.email}</p>
                <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 24 }}>{t("confirmDeleteSub")}</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button onClick={onClose} style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, background: "#fff", border: "1px solid #d1d9e6", color: "#374151", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>{t("cancel")}</button>
                    <button onClick={handleConfirm} disabled={loading} style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.75 : 1 }}>
                        {loading ? "…" : t("delete")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function DetailModal({ user, onClose }) {
    const { t } = useLanguage();
    const stale = isInactiveSixMonths(user.last_login);
    const badge = ROLE_BADGE[user.role] || { bg: "#f3f4f6", color: "#374151" };
    function Row({ label, children }) {
        return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f4f8" }}>
                <span style={{ fontSize: 12, color: "#6b7a99", fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 13, color: "#1a2332", fontWeight: 500 }}>{children}</span>
            </div>
        );
    }
    return (
        <Modal onClose={onClose}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332" }}>{t("detailTitle")}</h3>
                <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9aa5b4", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 0 20px", borderBottom: "1px solid #f0f4f8", marginBottom: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: user.is_active ? "linear-gradient(135deg,#1d6fcc,#3b9eff)" : "#c4ccd8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2332" }}>{user.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7a99" }}>{user.email}</div>
                </div>
            </div>
            <Row label="ID">#{user.id}</Row>
            <Row label={t("fieldRole")}><span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: badge.bg, color: badge.color }}>{t("roles")[user.role] || user.role}</span></Row>
            <Row label={t("statusCol")}><span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: user.is_active ? "#dcfce7" : "#fef2f2", color: user.is_active ? "#166534" : "#b91c1c" }}>{user.is_active ? t("activeStatus") : t("inactiveStatus")}</span></Row>
            <Row label={t("createdAt")}>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</Row>
            <Row label={t("lastLogin")}>
                <span style={{ color: stale && user.is_active ? "#dc2626" : "#1a2332" }}>
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : "—"}
                    {stale && user.is_active && <span style={{ marginLeft: 6, fontSize: 10, color: "#dc2626", fontWeight: 600 }}>⚠ {t("inactiveWarning")}</span>}
                </span>
            </Row>
            <div style={{ marginTop: 20, textAlign: "right" }}>
                <button onClick={onClose} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>{t("close")}</button>
            </div>
        </Modal>
    );
}

function SkeletonRow() {
    return (
        <tr>
            {[...Array(7)].map((_, i) => (
                <td key={i} style={{ padding: "13px 16px" }}>
                    <div style={{ height: 14, background: "#f0f4f8", borderRadius: 4, width: i === 0 ? 24 : i === 6 ? 80 : "80%", animation: "pulse 1.4s ease-in-out infinite" }} />
                </td>
            ))}
        </tr>
    );
}

function ActionBtn({ title, onClick, color, bg, disabled, children }) {
    return (
        <button title={title} onClick={onClick} disabled={disabled}
            style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid " + color + "33", background: bg, color, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s", opacity: disabled ? 0.4 : 1 }}>
            {children}
        </button>
    );
}

export default function UserManagement() {
    const { t, language, setLanguage } = useLanguage();
    const currentUser = getCurrentUser();

    const [users,   setUsers]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const [markingInactive, setMarkingInactive] = useState(false);

    const [search,       setSearch]       = useState("");
    const [roleFilter,   setRoleFilter]   = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page,         setPage]         = useState(1);
    const [modal,        setModal]        = useState(null);
    const [toast,        setToast]        = useState(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch("/api/users", { headers: { Authorization: "Bearer " + getToken() } });
            if (!res.ok) throw new Error("fetch failed");
            setUsers(await res.json());
        } catch { setError(t("errorLoad")); }
        finally { setLoading(false); }
    }, [t]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    async function handleDelete(user) {
        try {
            const res  = await fetch(`/api/users/${user.id}`, { method: "DELETE", headers: authHeaders() });
            const json = await res.json();
            if (!res.ok) { showToast(json.error || t("errorDelete"), "error"); setModal(null); return; }
            showToast(t("successDelete"), "success"); setModal(null); fetchUsers();
        } catch { showToast(t("errorDelete"), "error"); setModal(null); }
    }

    async function handleToggleActive(user) {
        try {
            const res  = await fetch(`/api/users/${user.id}/toggle-active`, { method: "PATCH", headers: authHeaders() });
            const json = await res.json();
            if (!res.ok) { showToast(json.error || t("errorToggle"), "error"); return; }
            showToast(t("successToggle"), "success"); fetchUsers();
        } catch { showToast(t("errorToggle"), "error"); }
    }

    async function handleMarkInactive() {
        setMarkingInactive(true);
        try {
            const res  = await fetch("/api/users/mark-inactive", { method: "POST", headers: authHeaders() });
            const json = await res.json();
            if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
            showToast(t("successMarkInactive"), "success"); fetchUsers();
        } catch { showToast("Failed to mark inactive users", "error"); }
        setMarkingInactive(false);
    }

    function handleSaved(msg) { showToast(msg, "success"); setModal(null); fetchUsers(); }
    function showToast(message, type) { setToast({ message, type }); }

    const filtered = users.filter(u => {
        const ms = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
        const mr = roleFilter === "all" || u.role === roleFilter;
        const mst = statusFilter === "all" || (statusFilter === "active" && u.is_active) || (statusFilter === "inactive" && !u.is_active);
        return ms && mr && mst;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const staleCount = users.filter(u => u.role !== "it_admin" && u.is_active && isInactiveSixMonths(u.last_login)).length;

    useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

    const inp = { padding: "8px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 8, color: "#1a2332", fontFamily: "inherit", outline: "none", background: "#fff" };
    const btnP = { padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", background: "#1d6fcc", color: "#fff", fontFamily: "inherit" };
    const btnS = { ...btnP, background: "#fff", border: "1px solid #d1d9e6", color: "#374151" };

    return (
        <div style={{ fontFamily: "'Inter', Arial, sans-serif", maxWidth: 1200 }}>
            <style>{`
                @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
                @keyframes fadeModal { from{opacity:0}to{opacity:1} }
                @keyframes slideUpModal { from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1} }
                @keyframes slideInToast { from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1} }
                tr:hover td { background: #f8faff !important; }
                button:hover:not(:disabled) { opacity: 0.88; }
            `}</style>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: "#1d6fcc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <circle cx="7" cy="5" r="3.2" stroke="white" strokeWidth="1.5" />
                            <path d="M1 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                            <circle cx="14" cy="10" r="2.5" stroke="white" strokeWidth="1.4" />
                            <path d="M12 14.5c0-1.1.9-2 2-2s2 .9 2 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332", margin: 0 }}>{t("userMgmtTitle")}</h2>
                        <p style={{ fontSize: 11, color: "#9aa5b4", margin: 0 }}>{t("userMgmtDesc")}</p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={() => setLanguage(language === "en" ? "fr" : "en")}
                        style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, border: "1px solid #d1d9e6", borderRadius: 7, background: "#f8faff", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
                        🌐 {t("lang")}
                    </button>
                    {staleCount > 0 && (
                        <button onClick={handleMarkInactive} disabled={markingInactive} title={t("markInactiveDesc")}
                            style={{ ...btnS, display: "flex", alignItems: "center", gap: 6, borderColor: "#fde68a", color: "#92400e", background: "#fef9ec", fontSize: 12, opacity: markingInactive ? 0.6 : 1 }}>
                            ⏰ {t("markInactiveBtn")}
                            <span style={{ background: "#f59e0b", color: "#fff", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{staleCount}</span>
                        </button>
                    )}
                    <button onClick={() => setModal({ type: "add" })} style={{ ...btnP, display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 16 }}>+</span> {t("addUser")}
                    </button>
                </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: "1 1 220px" }}>
                    <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", fontSize: 14 }}>🔍</span>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("searchPlaceholder")}
                        style={{ ...inp, paddingLeft: 32, width: "100%", maxWidth: 320, boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                        { val: "all",                  label: t("filterAllRoles") },
                        { val: "maintenance_engineer", label: t("filterMaint") },
                        { val: "energy_manager",       label: t("filterEnergy") },
                        { val: "it_admin",             label: t("filterAdmin") },
                    ].map(({ val, label }) => (
                        <button key={val} onClick={() => setRoleFilter(val)}
                            style={{ padding: "6px 13px", fontSize: 12, fontWeight: roleFilter === val ? 600 : 400, borderRadius: 7, border: "1px solid " + (roleFilter === val ? "#1d6fcc" : "#d1d9e6"), background: roleFilter === val ? "#eff6ff" : "#fff", color: roleFilter === val ? "#1d6fcc" : "#6b7a99", cursor: "pointer", fontFamily: "inherit" }}>
                            {label}
                        </button>
                    ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    {[
                        { val: "all",      label: t("filterAllStatus") },
                        { val: "active",   label: t("filterActive") },
                        { val: "inactive", label: t("filterInactive") },
                    ].map(({ val, label }) => (
                        <button key={val} onClick={() => setStatusFilter(val)}
                            style={{ padding: "6px 13px", fontSize: 12, fontWeight: statusFilter === val ? 600 : 400, borderRadius: 7, border: "1px solid " + (statusFilter === val ? "#059669" : "#d1d9e6"), background: statusFilter === val ? "#ecfdf5" : "#fff", color: statusFilter === val ? "#059669" : "#6b7a99", cursor: "pointer", fontFamily: "inherit" }}>
                            {label}
                        </button>
                    ))}
                </div>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#9aa5b4", whiteSpace: "nowrap" }}>
                    {t("total")} <strong style={{ color: "#1a2332" }}>{filtered.length}</strong> {t("usersLabel")}
                </span>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "#f8faff", borderBottom: "1px solid #e2e8f0" }}>
                                {["#", t("name"), t("email"), t("role"), t("statusCol"), t("lastLogin"), t("actions")].map((col, i) => (
                                    <th key={i} style={{ padding: "11px 16px", textAlign: i === 6 ? "right" : "left", fontSize: 11, fontWeight: 600, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                            ) : error ? (
                                <tr><td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "#dc2626", fontSize: 13 }}>⚠ {error}</td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "#9aa5b4", fontSize: 13 }}>{t("noUsers")}</td></tr>
                            ) : paginated.map((u, idx) => {
                                const badge   = ROLE_BADGE[u.role] || { bg: "#f3f4f6", color: "#374151" };
                                const initials = u.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                                const stale   = isInactiveSixMonths(u.last_login);
                                const isAdmin = u.role === "it_admin";
                                const isSelf  = currentUser && currentUser.id === u.id;
                                const canDel  = !isAdmin && !isSelf;
                                const hrs     = !u.is_active ? hoursUntilDeletion(u.deactivated_at) : null;

                                return (
                                    <tr key={u.id} style={{ borderBottom: "1px solid #f0f4f8", transition: "background 0.1s", opacity: u.is_active ? 1 : 0.7 }}>
                                        <td style={{ padding: "13px 16px", color: "#9aa5b4", fontSize: 12 }}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td style={{ padding: "13px 16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: u.is_active ? "linear-gradient(135deg,#1d6fcc,#3b9eff)" : "#c4ccd8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                                    {initials}
                                                </div>
                                                <span style={{ fontWeight: 500, color: "#1a2332" }}>{u.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "13px 16px", color: "#6b7a99" }}>{u.email}</td>
                                        <td style={{ padding: "13px 16px" }}>
                                            <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: badge.bg, color: badge.color, whiteSpace: "nowrap" }}>
                                                {t("roles")[u.role] || u.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: "13px 16px" }}>
                                            <div>
                                                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: u.is_active ? "#dcfce7" : "#fef2f2", color: u.is_active ? "#166534" : "#b91c1c", whiteSpace: "nowrap" }}>
                                                    {u.is_active ? t("activeStatus") : t("inactiveStatus")}
                                                </span>
                                                {hrs !== null && (
                                                    <div style={{ fontSize: 10, color: hrs <= 2 ? "#dc2626" : "#f59e0b", fontWeight: 600, marginTop: 3, whiteSpace: "nowrap" }}>
                                                        ⏰ {hrs <= 0 ? "Deleting…" : `~${hrs}${t("hoursUntilDeletion")}`}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: "13px 16px", color: stale && u.is_active ? "#dc2626" : "#9aa5b4", fontSize: 12, whiteSpace: "nowrap" }}>
                                            {u.last_login ? new Date(u.last_login).toLocaleDateString() : "—"}
                                            {stale && u.is_active && <span style={{ marginLeft: 5, fontSize: 10 }}>⚠</span>}
                                        </td>
                                        <td style={{ padding: "13px 16px", textAlign: "right" }}>
                                            <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                                <ActionBtn title={t("viewDetails")} onClick={() => setModal({ type: "detail", user: u })} color="#1d4ed8" bg="#eff6ff">
                                                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                                </ActionBtn>
                                                <ActionBtn title={t("edit")} onClick={() => setModal({ type: "edit", user: u })} color="#166534" bg="#dcfce7">
                                                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 11.5L2.5 14l2.5-.5L13 5.5 10.5 3 2 11.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                                                </ActionBtn>
                                                {!isAdmin && !isSelf && (
                                                    <ActionBtn title={u.is_active ? t("deactivate") : t("activate")} onClick={() => handleToggleActive(u)} color={u.is_active ? "#92400e" : "#059669"} bg={u.is_active ? "#fef9ec" : "#ecfdf5"}>
                                                        {u.is_active
                                                            ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                                                            : <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                                                        }
                                                    </ActionBtn>
                                                )}
                                                <ActionBtn title={isAdmin ? t("cantDeleteAdmin") : isSelf ? t("cantDeleteSelf") : t("delete")} onClick={() => canDel && setModal({ type: "delete", user: u })} color={canDel ? "#b91c1c" : "#c4ccd8"} bg={canDel ? "#fef2f2" : "#f3f4f6"} disabled={!canDel}>
                                                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2.5h4V4M5.5 4l.5 9h4l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                </ActionBtn>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {!loading && !error && totalPages > 1 && (
                    <div style={{ padding: "12px 16px", borderTop: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#9aa5b4" }}>
                            {t("page")} <strong style={{ color: "#1a2332" }}>{page}</strong> {t("of")} <strong style={{ color: "#1a2332" }}>{totalPages}</strong>
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...btnS, padding: "5px 12px", fontSize: 12, opacity: page === 1 ? 0.45 : 1 }}>{t("prev")}</button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button key={i} onClick={() => setPage(i + 1)} style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, border: "1px solid " + (page === i + 1 ? "#1d6fcc" : "#d1d9e6"), background: page === i + 1 ? "#eff6ff" : "#fff", color: page === i + 1 ? "#1d6fcc" : "#374151", cursor: "pointer", fontFamily: "inherit", fontWeight: page === i + 1 ? 600 : 400 }}>
                                    {i + 1}
                                </button>
                            ))}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...btnS, padding: "5px 12px", fontSize: 12, opacity: page === totalPages ? 0.45 : 1 }}>{t("next")}</button>
                        </div>
                    </div>
                )}
            </div>

            {modal?.type === "add"    && <UserFormModal onClose={() => setModal(null)} onSaved={handleSaved} />}
            {modal?.type === "edit"   && <UserFormModal user={modal.user} onClose={() => setModal(null)} onSaved={handleSaved} />}
            {modal?.type === "delete" && <ConfirmDeleteModal user={modal.user} onClose={() => setModal(null)} onConfirm={() => handleDelete(modal.user)} />}
            {modal?.type === "detail" && <DetailModal user={modal.user} onClose={() => setModal(null)} />}
            {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
        </div>
    );
}
