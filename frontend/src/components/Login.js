import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

function QRDisplay({ value }) {
    const size = 180, cells = 21, cell = size / cells;
    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        return h;
    }
    const bits = [];
    for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
            const inCorner = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
            if (inCorner) {
                bits.push(
                    r === 0 || r === 6 || c === 0 || c === 6 ||
                    r === cells - 7 || r === cells - 1 || c === cells - 7 || c === cells - 1 ||
                    (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
                    (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3) ||
                    (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4)
                );
            } else {
                bits.push(Math.abs(hash(value + r + "," + c)) % 3 === 0);
            }
        }
    }
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 8 }}>
            <rect width={size} height={size} fill="white" />
            {bits.map((on, i) => on ? (
                <rect key={i} x={(i % cells) * cell} y={Math.floor(i / cells) * cell}
                    width={cell - 0.5} height={cell - 0.5} fill="#1a2332" rx={0.5} />
            ) : null)}
        </svg>
    );
}

const DEMO_ACCOUNTS = [
    { role: "Maintenance", color: "#1d4ed8", bg: "#dbeafe", email: "maintenance@dashboard.com", pwd: "maintenance123" },
    { role: "Energy Mgr",  color: "#166534", bg: "#dcfce7", email: "energy@dashboard.com",      pwd: "energy123" },
    { role: "IT Admin",    color: "#6d28d9", bg: "#ede9fe", email: "itadmin@dashboard.com",      pwd: "itadmin123" },
];

export default function Login({ onLogin }) {
    const { t, language, setLanguage } = useLanguage();
    const [step,      setStep]      = useState("email");
    const [email,     setEmail]     = useState("");
    const [password,  setPassword]  = useState("");
    const [error,     setError]     = useState("");
    const [loading,   setLoading]   = useState(false);
    const [otp,       setOtp]       = useState("");
    const [otpHint,   setOtpHint]   = useState("");
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [qrToken,   setQrToken]   = useState(null);
    const [qrExpiry,  setQrExpiry]  = useState(null);

    const inp = { width: "100%", padding: "10px 13px", fontSize: 14, border: "1px solid #d1d9e6", borderRadius: 8, color: "#1a2332", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
    const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 };

    async function handleSubmit(e) {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            const res  = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
            const json = await res.json();
            if (!res.ok) { setError(json.error || "Login failed"); setLoading(false); return; }
            setOtpHint(json.devOTP ? `Dev code: ${json.devOTP}` : `Code sent to ${email}`);
            setStep("otp");
        } catch { setError("Cannot connect to server."); }
        setLoading(false);
    }

    async function handleVerifyOTP(e) {
        e.preventDefault();
        setError(""); setVerifying(true);
        try {
            const res  = await fetch("/api/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, otp: otp.trim() }) });
            const json = await res.json();
            if (!res.ok) { setError(json.error || t("invalidCode")); setVerifying(false); return; }
            localStorage.setItem("token", json.token);
            localStorage.setItem("user",  JSON.stringify(json.user));
            onLogin(json.user);
        } catch { setError("Cannot connect to server."); }
        setVerifying(false);
    }

    async function handleResend() {
        setResending(true); setError("");
        try {
            const res  = await fetch("/api/auth/resend-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
            const json = await res.json();
            setOtpHint(json.devOTP ? `Dev code: ${json.devOTP}` : `New code sent to ${email}`);
            setOtp("");
        } catch { setError("Failed to resend."); }
        setResending(false);
    }

    async function startQRLogin() {
        try {
            const res  = await fetch("/api/auth/qr-generate", { method: "POST" });
            const json = await res.json();
            setQrToken(json.token); setQrExpiry(json.expiresAt); setStep("qr");
        } catch { setError("Failed to generate QR."); }
    }

    useEffect(() => {
        if (step !== "qr" || !qrToken) return;
        const id = setInterval(async () => {
            if (Date.now() > qrExpiry) { setQrToken(null); return; }
            try {
                const res  = await fetch(`/api/auth/qr-status?token=${qrToken}`);
                if (res.status === 410) { setQrToken(null); return; }
                const json = await res.json();
                if (json.approved) {
                    localStorage.setItem("token", json.token);
                    localStorage.setItem("user",  JSON.stringify(json.user));
                    onLogin(json.user);
                }
            } catch {}
        }, 1500);
        return () => clearInterval(id);
    }, [step, qrToken, qrExpiry, onLogin]);

    const qrUrl = qrToken ? `${window.location.origin}/api/auth/qr-approve?token=${qrToken}` : "";

    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#e8f0fe 0%,#f0f4f8 60%,#e0f2fe 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#fff", border: "1px solid #dde3ec", borderRadius: 14, padding: "40px 36px", width: "100%", maxWidth: 440, boxShadow: "0 6px 32px rgba(29,111,204,0.1)" }}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #f0f4f8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1d6fcc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <rect x="2" y="2" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                                <rect x="13" y="2" width="9" height="9" rx="2" fill="white" opacity="0.55"/>
                                <rect x="2" y="13" width="9" height="9" rx="2" fill="white" opacity="0.55"/>
                                <rect x="13" y="13" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                            </svg>
                        </div>
                        <h1 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332", letterSpacing: -0.2 }}>Smart Industrial Dashboard</h1>
                    </div>
                    <button onClick={() => setLanguage(language === "en" ? "fr" : "en")}
                        style={{ padding: "4px 14px", fontSize: 12, fontWeight: 700, border: "1px solid #d1d9e6", borderRadius: 20, background: "#f8faff", cursor: "pointer", color: "#1d6fcc", fontFamily: "inherit" }}>
                        {language === "en" ? "FR" : "EN"}
                    </button>
                </div>

                {step === "email" && (
                    <>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={lbl}>{t("emailAddress")}</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email" style={inp} />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={lbl}>{t("password")}</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={inp} />
                            </div>
                            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>⚠ {error}</div>}
                            <button type="submit" disabled={loading} style={{ width: "100%", padding: 11, fontSize: 14, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.75 : 1 }}>
                                {loading ? t("signingIn") : t("login")}
                            </button>
                        </form>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px" }}>
                            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                            <span style={{ fontSize: 11, color: "#9aa5b4" }}>OR</span>
                            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                        </div>
                        <button onClick={startQRLogin} style={{ width: "100%", padding: 10, fontSize: 13, fontWeight: 600, background: "#f0f7ff", color: "#1d6fcc", border: "1px solid #bfdbfe", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
                            <span style={{ fontSize: 18 }}>📱</span> {t("qrLoginTitle")}
                        </button>
                        <div style={{ padding: 16, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>{t("testAccounts")}</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                {DEMO_ACCOUNTS.map(a => (
                                    <button key={a.role} onClick={() => { setEmail(a.email); setPassword(a.pwd); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#fff", borderRadius: 8, border: "1px solid #f1f5f9", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, background: a.bg, color: a.color, whiteSpace: "nowrap" }}>{a.role}</span>
                                        <code style={{ fontSize: 11, color: "#1e2937" }}>{a.email}</code>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {step === "otp" && (
                    <div>
                        <div style={{ textAlign: "center", marginBottom: 22 }}>
                            <div style={{ fontSize: 44, marginBottom: 10 }}>📧</div>
                            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1a2332", marginBottom: 6 }}>{t("emailVerificationTitle")}</h2>
                            <p style={{ fontSize: 13, color: "#6b7a99" }}>{t("emailVerificationDesc")} <strong>{email}</strong></p>
                        </div>
                        {otpHint && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 16, textAlign: "center" }}>🔑 {otpHint}</div>}
                        <form onSubmit={handleVerifyOTP}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={lbl}>{t("enterCode")}</label>
                                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required maxLength={6} autoComplete="one-time-code" style={{ ...inp, fontSize: 26, letterSpacing: 10, textAlign: "center", fontWeight: 700 }} />
                            </div>
                            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "#dc2626", marginBottom: 12 }}>⚠ {error}</div>}
                            <button type="submit" disabled={verifying || otp.length !== 6} style={{ width: "100%", padding: 11, fontSize: 14, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", marginBottom: 10, opacity: (verifying || otp.length !== 6) ? 0.65 : 1 }}>
                                {verifying ? t("verifying") : t("verifyCode")}
                            </button>
                        </form>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={handleResend} disabled={resending} style={{ flex: 1, padding: 9, fontSize: 12, fontWeight: 500, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", color: "#1d6fcc", fontFamily: "inherit", opacity: resending ? 0.6 : 1 }}>🔄 {t("resendCode")}</button>
                            <button onClick={() => { setStep("email"); setError(""); setOtp(""); setOtpHint(""); }} style={{ flex: 1, padding: 9, fontSize: 12, fontWeight: 500, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", color: "#6b7a99", fontFamily: "inherit" }}>← {t("cancel")}</button>
                        </div>
                    </div>
                )}

                {step === "qr" && (
                    <div>
                        <div style={{ textAlign: "center", marginBottom: 18 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332", marginBottom: 4 }}>{t("qrLoginTitle")}</h2>
                            <p style={{ fontSize: 12, color: "#6b7a99" }}>{t("qrLoginDesc")}</p>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                            <div style={{ border: "2px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff", position: "relative" }}>
                                {qrToken ? (
                                    <>
                                        <QRDisplay value={qrUrl} />
                                        <div style={{ position: "absolute", bottom: 10, right: 10, background: "#dcfce7", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#166534", fontWeight: 700 }}>● LIVE</div>
                                    </>
                                ) : (
                                    <div style={{ width: 180, height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                        <div style={{ fontSize: 32 }}>⏱</div>
                                        <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center" }}>{t("qrExpired")}</p>
                                        <button onClick={startQRLogin} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}>Refresh</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <p style={{ fontSize: 11, color: "#9aa5b4", textAlign: "center", marginBottom: 14 }}>Scan to open approval URL. Expires in 2 minutes.</p>
                        <button onClick={() => { setStep("email"); setError(""); }} style={{ width: "100%", padding: 9, fontSize: 12, fontWeight: 500, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", color: "#6b7a99", fontFamily: "inherit" }}>← {t("login")}</button>
                    </div>
                )}

            </div>
        </div>
    );
}
