import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";

function QRDisplay({ value }) {
    const size = 180, cells = 21, cell = size / cells;
    function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; return h; }
    const bits = [];
    for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
            const inCorner = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
            if (inCorner) {
                bits.push(r === 0 || r === 6 || c === 0 || c === 6 || r === cells - 7 || r === cells - 1 || c === cells - 7 || c === cells - 1 || (r >= 2 && r <= 4 && c >= 2 && c <= 4) || (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3) || (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4));
            } else { bits.push(Math.abs(hash(value + r + "," + c)) % 3 === 0); }
        }
    }
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 8 }}>
            <rect width={size} height={size} fill="white" />
            {bits.map((on, i) => on ? <rect key={i} x={(i % cells) * cell} y={Math.floor(i / cells) * cell} width={cell - 0.5} height={cell - 0.5} fill="#1a2332" rx={0.5} /> : null)}
        </svg>
    );
}

const DEMO_ACCOUNTS = [
    { role: "Maintenance", color: "#1d4ed8", bg: "#dbeafe", email: "maintenance@dashboard.com", pwd: "maintenance123" },
    { role: "Energy Mgr",  color: "#166534", bg: "#dcfce7", email: "energy@dashboard.com",      pwd: "energy123" },
    { role: "IT Admin",    color: "#6d28d9", bg: "#ede9fe", email: "itadmin@dashboard.com",      pwd: "itadmin123" },
];

function CodeInput({ value, onChange, disabled }) {
    const inputs = useRef([]);
    const digits = (value + "      ").slice(0, 6).split("");

    function handleChange(i, e) {
        const v = e.target.value.replace(/\D/g, "").slice(-1);
        const arr = (value + "      ").slice(0, 6).split("");
        arr[i] = v;
        const next = arr.join("").replace(/ /g, "");
        onChange(next);
        if (v && i < 5) inputs.current[i + 1]?.focus();
    }

    function handleKeyDown(i, e) {
        if (e.key === "Backspace" && !digits[i].trim() && i > 0) inputs.current[i - 1]?.focus();
        if (e.key === "ArrowLeft"  && i > 0) inputs.current[i - 1]?.focus();
        if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
    }

    function handlePaste(e) {
        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (text) { onChange(text); e.preventDefault(); inputs.current[Math.min(text.length, 5)]?.focus(); }
    }

    return (
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {[0,1,2,3,4,5].map(i => (
                <input
                    key={i}
                    ref={el => inputs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digits[i].trim()}
                    onChange={e => handleChange(i, e)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    style={{
                        width: 44, height: 52, textAlign: "center",
                        fontSize: 22, fontWeight: 700, color: "#1a2332",
                        border: "2px solid " + (digits[i].trim() ? "#1d6fcc" : "#d1d9e6"),
                        borderRadius: 10, outline: "none",
                        background: digits[i].trim() ? "#f0f7ff" : "#fafbfc",
                        fontFamily: "inherit",
                        transition: "border-color 0.15s, background 0.15s",
                    }}
                />
            ))}
        </div>
    );
}

export default function Login({ onLogin }) {
    const { t, language, setLanguage } = useLanguage();

    const [step,       setStep]       = useState("credentials");
    const [email,      setEmail]      = useState("");
    const [password,   setPassword]   = useState("");
    const [error,      setError]      = useState("");
    const [loading,    setLoading]    = useState(false);
    const [totpCode,   setTotpCode]   = useState("");
    const [verifying,  setVerifying]  = useState(false);
    const [setupToken, setSetupToken] = useState(null);
    const [qrDataUrl,  setQrDataUrl]  = useState(null);
    const [secret,     setSecret]     = useState(null);
    const [confirmCode,setConfirmCode]= useState("");
    const [qrToken,    setQrToken]    = useState(null);
    const [qrExpiry,   setQrExpiry]   = useState(null);

    const inp = { width: "100%", padding: "10px 13px", fontSize: 14, border: "1px solid #d1d9e6", borderRadius: 8, color: "#1a2332", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
    const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 };

    async function handleLogin(e) {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            const res  = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
            const json = await res.json();
            if (!res.ok) { setError(json.error || "Login failed"); setLoading(false); return; }

            if (json.requiresTotpSetup) {
                setSetupToken(json.setupToken);
                setStep("totp-setup");
                await fetchSetupQR(json.setupToken);
            } else if (json.requiresTotp) {
                setStep("totp");
            }
        } catch { setError("Cannot connect to server."); }
        setLoading(false);
    }

    async function fetchSetupQR(token) {
        try {
            const res  = await fetch("/api/auth/totp-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupToken: token }) });
            const json = await res.json();
            if (!res.ok) { setError(json.error || "Failed to generate QR"); return; }
            setQrDataUrl(json.qrDataUrl);
            setSecret(json.secret);
        } catch { setError("Cannot connect to server."); }
    }

    async function handleTotpEnable(e) {
        e.preventDefault();
        setError(""); setVerifying(true);
        try {
            const res  = await fetch("/api/auth/totp-enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupToken, token: confirmCode }) });
            const json = await res.json();
            if (!res.ok) { setError(json.error || "Invalid code"); setVerifying(false); return; }
            localStorage.setItem("token", json.token);
            localStorage.setItem("user",  JSON.stringify(json.user));
            onLogin(json.user);
        } catch { setError("Cannot connect to server."); }
        setVerifying(false);
    }

    async function handleTotpVerify(e) {
        e.preventDefault();
        setError(""); setVerifying(true);
        try {
            const res  = await fetch("/api/auth/verify-totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token: totpCode }) });
            const json = await res.json();
            if (!res.ok) { setError(json.error || "Invalid code"); setVerifying(false); return; }
            localStorage.setItem("token", json.token);
            localStorage.setItem("user",  JSON.stringify(json.user));
            onLogin(json.user);
        } catch { setError("Cannot connect to server."); }
        setVerifying(false);
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
                if (json.approved) { localStorage.setItem("token", json.token); localStorage.setItem("user", JSON.stringify(json.user)); onLogin(json.user); }
            } catch {}
        }, 1500);
        return () => clearInterval(id);
    }, [step, qrToken, qrExpiry, onLogin]);

    function resetToCredentials() { setStep("credentials"); setError(""); setTotpCode(""); setConfirmCode(""); }

    const qrUrl = qrToken ? `${window.location.origin}/api/auth/qr-approve?token=${qrToken}` : "";

    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#e8f0fe 0%,#f0f4f8 60%,#e0f2fe 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#fff", border: "1px solid #dde3ec", borderRadius: 16, padding: "38px 36px", width: "100%", maxWidth: 440, boxShadow: "0 8px 40px rgba(29,111,204,0.12)" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #f0f4f8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1d6fcc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <rect x="2" y="2" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                                <rect x="13" y="2" width="9" height="9" rx="2" fill="white" opacity="0.55"/>
                                <rect x="2" y="13" width="9" height="9" rx="2" fill="white" opacity="0.55"/>
                                <rect x="13" y="13" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                            </svg>
                        </div>
                        <h1 style={{ fontSize: 15, fontWeight: 700, color: "#1a2332", letterSpacing: -0.2 }}>Smart Industrial Dashboard</h1>
                    </div>
                    <button onClick={() => setLanguage(language === "en" ? "fr" : "en")}
                        style={{ padding: "4px 14px", fontSize: 12, fontWeight: 700, border: "1px solid #d1d9e6", borderRadius: 20, background: "#f8faff", cursor: "pointer", color: "#1d6fcc", fontFamily: "inherit" }}>
                        {language === "en" ? "FR" : "EN"}
                    </button>
                </div>

                {step === "credentials" && (
                    <>
                        <form onSubmit={handleLogin}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={lbl}>{t("emailAddress")}</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email" style={inp} />
                            </div>
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>{t("password")}</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={inp} />
                            </div>
                            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>⚠ {error}</div>}
                            <button type="submit" disabled={loading} style={{ width: "100%", padding: 11, fontSize: 14, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.75 : 1, marginBottom: 8 }}>
                                {loading ? t("signingIn") : t("login")} →
                            </button>
                        </form>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
                            <span style={{ fontSize: 18 }}>🔐</span>
                            <span style={{ fontSize: 12, color: "#1d4ed8" }}>Two-factor authentication via <strong>Google Authenticator</strong></span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px" }}>
                            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                            <span style={{ fontSize: 11, color: "#9aa5b4" }}>OR</span>
                            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                        </div>
                        

                        <div style={{ padding: 14, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>{t("testAccounts")}</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                {DEMO_ACCOUNTS.map(a => (
                                    <button key={a.role} onClick={() => { setEmail(a.email); setPassword(a.pwd); }}
                                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#fff", borderRadius: 8, border: "1px solid #f1f5f9", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, background: a.bg, color: a.color, whiteSpace: "nowrap" }}>{a.role}</span>
                                        <code style={{ fontSize: 11, color: "#1e2937" }}>{a.email}</code>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {step === "totp-setup" && (
                    <div>
                        {/* Progress */}
                        <div style={{ display: "flex", gap: 6, marginBottom: 22, alignItems: "center" }}>
                            <div style={{ flex: 1, height: 3, borderRadius: 3, background: "#1d6fcc" }} />
                            <div style={{ flex: 1, height: 3, borderRadius: 3, background: "#1d6fcc" }} />
                            <div style={{ flex: 1, height: 3, borderRadius: 3, background: "#e2e8f0" }} />
                        </div>

                        <div style={{ textAlign: "center", marginBottom: 20 }}>
                            <div style={{ fontSize: 40, marginBottom: 10 }}>📱</div>
                            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1a2332", margin: "0 0 6px" }}>Set up 2-Factor Authentication</h2>
                            <p style={{ fontSize: 13, color: "#6b7a99", margin: 0 }}>This is a one-time setup. You need the <strong>Google Authenticator</strong> app on your phone.</p>
                        </div>

                        <div style={{ background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
                            {[
                                { n: "1", text: "Install Google Authenticator on your phone", sub: "Available on App Store & Google Play" },
                                { n: "2", text: "Tap the + button in the app", sub: "Then choose \"Scan a QR code\"" },
                                { n: "3", text: "Point your camera at the QR code below", sub: "Smart Dashboard will be added automatically" },
                            ].map(s => (
                                <div key={s.n} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1d6fcc", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2332" }}>{s.text}</div>
                                        <div style={{ fontSize: 11, color: "#9aa5b4" }}>{s.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                            {qrDataUrl ? (
                                <div style={{ border: "3px solid #1d6fcc", borderRadius: 14, padding: 10, background: "#fff", boxShadow: "0 4px 20px rgba(29,111,204,0.15)" }}>
                                    <img src={qrDataUrl} alt="Google Authenticator QR Code" style={{ width: 180, height: 180, display: "block" }} />
                                </div>
                            ) : (
                                <div style={{ width: 200, height: 200, background: "#f0f4f8", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ fontSize: 13, color: "#9aa5b4" }}>Loading QR…</div>
                                </div>
                            )}
                        </div>

                        {secret && (
                            <details style={{ marginBottom: 16 }}>
                                <summary style={{ fontSize: 12, color: "#6b7a99", cursor: "pointer", userSelect: "none" }}>Can't scan? Enter key manually</summary>
                                <div style={{ marginTop: 8, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
                                    <p style={{ fontSize: 11, color: "#9aa5b4", margin: "0 0 6px" }}>In Google Authenticator → + → Enter a setup key</p>
                                    <code style={{ fontSize: 13, color: "#1d6fcc", letterSpacing: 2, wordBreak: "break-all" }}>{secret}</code>
                                </div>
                            </details>
                        )}

                        <button
                            onClick={() => setStep("totp-confirm")}
                            disabled={!qrDataUrl}
                            style={{ width: "100%", padding: 11, fontSize: 14, fontWeight: 600, background: qrDataUrl ? "#1d6fcc" : "#e2e8f0", color: qrDataUrl ? "#fff" : "#9aa5b4", border: "none", borderRadius: 8, cursor: qrDataUrl ? "pointer" : "not-allowed", fontFamily: "inherit", marginBottom: 8 }}>
                            I've scanned it → Continue
                        </button>
                        <button onClick={resetToCredentials} style={{ width: "100%", padding: 9, fontSize: 12, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", color: "#6b7a99", fontFamily: "inherit" }}>
                            ← Back
                        </button>
                    </div>
                )}

                {step === "totp-confirm" && (
                    <div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 22, alignItems: "center" }}>
                            <div style={{ flex: 1, height: 3, borderRadius: 3, background: "#1d6fcc" }} />
                            <div style={{ flex: 1, height: 3, borderRadius: 3, background: "#1d6fcc" }} />
                            <div style={{ flex: 1, height: 3, borderRadius: 3, background: "#1d6fcc" }} />
                        </div>

                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1a2332", margin: "0 0 8px" }}>Confirm your authenticator</h2>
                            <p style={{ fontSize: 13, color: "#6b7a99", margin: 0 }}>
                                Open <strong>Google Authenticator</strong> on your phone.<br />
                                Enter the <strong>6-digit code</strong> shown for <em>Smart Dashboard</em>.
                            </p>
                        </div>

                        <form onSubmit={handleTotpEnable}>
                            <div style={{ marginBottom: 20 }}>
                                <CodeInput value={confirmCode} onChange={setConfirmCode} disabled={verifying} />
                            </div>
                            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "#dc2626", marginBottom: 14, textAlign: "center" }}>⚠ {error}</div>}
                            <button type="submit" disabled={verifying || confirmCode.length !== 6}
                                style={{ width: "100%", padding: 11, fontSize: 14, fontWeight: 600, background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", marginBottom: 8, opacity: (verifying || confirmCode.length !== 6) ? 0.65 : 1 }}>
                                {verifying ? "Verifying…" : "Activate & Sign In 🎉"}
                            </button>
                        </form>
                        <button onClick={() => { setStep("totp-setup"); setError(""); setConfirmCode(""); }}
                            style={{ width: "100%", padding: 9, fontSize: 12, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", color: "#6b7a99", fontFamily: "inherit" }}>
                            ← Back to QR
                        </button>
                    </div>
                )}

                {step === "totp" && (
                    <div>
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#f0f7ff,#dbeafe)", border: "2px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 28 }}>
                                🔐
                            </div>
                            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1a2332", margin: "0 0 8px" }}>Two-Factor Authentication</h2>
                            <p style={{ fontSize: 13, color: "#6b7a99", margin: 0 }}>
                                Open <strong>Google Authenticator</strong> on your phone<br />
                                and enter the code for <strong>Smart Dashboard</strong>
                            </p>
                        </div>

                        <div style={{ background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#4285f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🔑</div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2332" }}>Google Authenticator</div>
                                <div style={{ fontSize: 11, color: "#9aa5b4" }}>Smart Dashboard · {email}</div>
                            </div>
                            <div style={{ marginLeft: "auto", textAlign: "right" }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#1d6fcc", letterSpacing: 3, fontVariantNumeric: "tabular-nums" }}>
                                    {totpCode.padEnd(6, "·").split("").join(" ")}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleTotpVerify}>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ ...lbl, textAlign: "center", display: "block", marginBottom: 12 }}>Enter 6-digit code</label>
                                <CodeInput value={totpCode} onChange={setTotpCode} disabled={verifying} />
                            </div>
                            {error && (
                                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "#dc2626", marginBottom: 14, textAlign: "center" }}>
                                    ⚠ {error}
                                    {error.includes("clock") && <div style={{ marginTop: 6, fontSize: 11 }}>Fix: Settings → General → Date & Time → Set Automatically</div>}
                                </div>
                            )}
                            <button type="submit" disabled={verifying || totpCode.length !== 6}
                                style={{ width: "100%", padding: 11, fontSize: 14, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", marginBottom: 8, opacity: (verifying || totpCode.length !== 6) ? 0.65 : 1 }}>
                                {verifying ? "Verifying…" : "Sign In →"}
                            </button>
                        </form>
                        <button onClick={resetToCredentials}
                            style={{ width: "100%", padding: 9, fontSize: 12, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", color: "#6b7a99", fontFamily: "inherit" }}>
                            ← Use different account
                        </button>
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
                                    <><QRDisplay value={qrUrl} /><div style={{ position: "absolute", bottom: 10, right: 10, background: "#dcfce7", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#166534", fontWeight: 700 }}>● LIVE</div></>
                                ) : (
                                    <div style={{ width: 180, height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                        <div style={{ fontSize: 32 }}>⏱</div>
                                        <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center" }}>{t("qrExpired")}</p>
                                        <button onClick={startQRLogin} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}>Refresh</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <p style={{ fontSize: 11, color: "#9aa5b4", textAlign: "center", marginBottom: 14 }}>Expires in 2 minutes.</p>
                        <button onClick={resetToCredentials} style={{ width: "100%", padding: 9, fontSize: 12, fontWeight: 500, background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", color: "#6b7a99", fontFamily: "inherit" }}>← {t("login")}</button>
                    </div>
                )}

            </div>
        </div>
    );
}
