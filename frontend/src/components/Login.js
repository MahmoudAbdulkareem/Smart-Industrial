import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";

// QR Code Generator Component
function QRDisplay({ value }) {
  const size = 180,
    cells = 21,
    cell = size / cells;

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++)
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return h;
  }

  const bits = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const inCorner =
        (r < 7 && c < 7) ||
        (r < 7 && c >= cells - 7) ||
        (r >= cells - 7 && c < 7);
      if (inCorner) {
        bits.push(
          r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            r === cells - 7 ||
            r === cells - 1 ||
            c === cells - 7 ||
            c === cells - 1 ||
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
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ borderRadius: 12 }}
    >
      <rect width={size} height={size} fill="#ffffff" rx={4} />
      {bits.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={(i % cells) * cell}
            y={Math.floor(i / cells) * cell}
            width={cell - 0.5}
            height={cell - 0.5}
            fill="#0F172A"
            rx={1}
          />
        ) : null
      )}
    </svg>
  );
}

// Demo Accounts Data
const DEMO_ACCOUNTS = [
  {
    id: 1,
    role: "Maintenance",
    icon: "🔧",
    color: "#2563EB",
    bg: "#DBEAFE",
    email: "maintenance@dashboard.com",
    pwd: "maintenance123",
  },
  {
    id: 2,
    role: "Energy Manager",
    icon: "⚡",
    color: "#059669",
    bg: "#D1FAE5",
    email: "energy@dashboard.com",
    pwd: "energy123",
  },
  {
    id: 3,
    role: "IT Admin",
    icon: "🖥️",
    color: "#7C3AED",
    bg: "#EDE9FE",
    email: "itadmin@dashboard.com",
    pwd: "itadmin123",
  },
];

// 6-Digit Code Input Component
function CodeInput({ value, onChange, disabled, label }) {
  const inputs = useRef([]);
  const digits = (value + "      ").slice(0, 6).split("");

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, "").slice(-1);
    const arr = (value + "      ").slice(0, 6).split("");
    arr[i] = v;
    const next = arr.join("").replace(/ /g, "");
    onChange(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0)
      inputs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const text = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (text) {
      onChange(text);
      e.preventDefault();
      inputs.current[Math.min(text.length, 5)]?.focus();
    }
  };

  return (
    <div>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "#1E293B",
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i].trim()}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            style={{
              width: 48,
              height: 56,
              textAlign: "center",
              fontSize: 24,
              fontWeight: 700,
              color: "#0F172A",
              border: `2px solid ${
                digits[i].trim() ? "#3B82F6" : "#E2E8F0"
              }`,
              borderRadius: 12,
              outline: "none",
              background: digits[i].trim() ? "#EFF6FF" : "#F8FAFC",
              fontFamily: "inherit",
              transition: "all 0.2s ease",
              boxShadow: digits[i].trim()
                ? "0 0 0 4px rgba(59,130,246,0.1)"
                : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Main Login Component
export default function Login({ onLogin }) {
  const { t, language, setLanguage } = useLanguage();

  // State Management
  const [step, setStep] = useState("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [setupToken, setSetupToken] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [secret, setSecret] = useState(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Styles
  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    fontSize: 14,
    border: "2px solid #E2E8F0",
    borderRadius: 10,
    color: "#0F172A",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.2s ease",
    background: "#F8FAFC",
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#1E293B",
    marginBottom: 6,
  };

  // API Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Login failed");
        setLoading(false);
        return;
      }

      if (json.requiresTotpSetup) {
        setSetupToken(json.setupToken);
        setStep("totp-setup");
        await fetchSetupQR(json.setupToken);
      } else if (json.requiresTotp) {
        setStep("totp");
      }
    } catch {
      setError("Cannot connect to server. Please check your connection.");
    }
    setLoading(false);
  };

  const fetchSetupQR = async (token) => {
    try {
      const res = await fetch("/api/auth/totp-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken: token }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to generate QR");
        return;
      }
      setQrDataUrl(json.qrDataUrl);
      setSecret(json.secret);
    } catch {
      setError("Cannot connect to server.");
    }
  };

  const handleTotpEnable = async (e) => {
    e.preventDefault();
    setError("");
    setVerifying(true);

    try {
      const res = await fetch("/api/auth/totp-enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken, token: confirmCode }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Invalid code");
        setVerifying(false);
        return;
      }

      localStorage.setItem("token", json.token);
      localStorage.setItem("user", JSON.stringify(json.user));
      onLogin(json.user);
    } catch {
      setError("Cannot connect to server.");
    }
    setVerifying(false);
  };

  const handleTotpVerify = async (e) => {
    e.preventDefault();
    setError("");
    setVerifying(true);

    try {
      const res = await fetch("/api/auth/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: totpCode }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Invalid code");
        setVerifying(false);
        return;
      }

      localStorage.setItem("token", json.token);
      localStorage.setItem("user", JSON.stringify(json.user));
      onLogin(json.user);
    } catch {
      setError("Cannot connect to server.");
    }
    setVerifying(false);
  };

  const resetToCredentials = () => {
    setStep("credentials");
    setError("");
    setTotpCode("");
    setConfirmCode("");
  };

  // Progress Steps Indicator
  const ProgressSteps = ({ current }) => {
    const steps = [
      { id: 1, label: "Credentials" },
      { id: 2, label: "Setup" },
      { id: 3, label: "Confirm" },
    ];

    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          {steps.map((s) => (
            <div key={s.id} style={{ textAlign: "center", flex: 1 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: s.id <= current ? "#3B82F6" : "#E2E8F0",
                  color: s.id <= current ? "#fff" : "#94A3B8",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 4,
                  transition: "all 0.3s ease",
                }}
              >
                {s.id}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: s.id <= current ? "#3B82F6" : "#94A3B8",
                  fontWeight: s.id <= current ? 600 : 400,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, padding: "0 16px" }}>
          {steps.map((s) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 4,
                background: s.id <= current ? "#3B82F6" : "#E2E8F0",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 50%, #E0F2FE 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 24,
          padding: "44px 40px",
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.8)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
            paddingBottom: 24,
            borderBottom: "2px solid #F1F5F9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                <rect x="13" y="2" width="9" height="9" rx="2" fill="white" opacity="0.55"/>
                <rect x="2" y="13" width="9" height="9" rx="2" fill="white" opacity="0.55"/>
                <rect x="13" y="13" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <div>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#0F172A",
                  letterSpacing: "-0.3px",
                  margin: 0,
                }}
              >
                Smart Industrial
              </h1>
              <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                Industrial Management Platform
              </p>
            </div>
          </div>
          <button
            onClick={() => setLanguage(language === "en" ? "fr" : "en")}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 700,
              border: "2px solid #E2E8F0",
              borderRadius: 20,
              background: "#F8FAFC",
              cursor: "pointer",
              color: "#3B82F6",
              fontFamily: "inherit",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#3B82F6";
              e.target.style.color = "#fff";
              e.target.style.borderColor = "#3B82F6";
              e.target.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "#F8FAFC";
              e.target.style.color = "#3B82F6";
              e.target.style.borderColor = "#E2E8F0";
              e.target.style.transform = "scale(1)";
            }}
          >
            {language === "en" ? "🇫🇷 FR" : "🇬🇧 EN"}
          </button>
        </div>

        {/* Credentials Step */}
        {step === "credentials" && (
          <>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>{t("emailAddress")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                  style={{
                    ...inputStyle,
                    ...(email && {
                      borderColor: "#3B82F6",
                      background: "#EFF6FF",
                    }),
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#3B82F6";
                    e.target.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = email ? "#3B82F6" : "#E2E8F0";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>{t("password")}</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    style={{
                      ...inputStyle,
                      ...(password && {
                        borderColor: "#3B82F6",
                        background: "#EFF6FF",
                      }),
                      paddingRight: 48,
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#3B82F6";
                      e.target.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = password ? "#3B82F6" : "#E2E8F0";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 18,
                      color: "#94A3B8",
                      padding: 4,
                    }}
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 13,
                    color: "#DC2626",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 600,
                  background: loading
                    ? "#94A3B8"
                    : "linear-gradient(135deg, #3B82F6, #2563EB)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  opacity: loading ? 0.7 : 1,
                  marginBottom: 16,
                  transition: "all 0.2s ease",
                  boxShadow: loading
                    ? "none"
                    : "0 4px 14px rgba(59,130,246,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 20px rgba(59,130,246,0.45)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 14px rgba(59,130,246,0.35)";
                  }
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        animation: "spin 1s linear infinite",
                      }}
                    >
                      ⏳
                    </span>
                    {t("signingIn")}
                  </>
                ) : (
                  <>
                    {t("login")}
                    <span style={{ fontSize: 18 }}>→</span>
                  </>
                )}
              </button>
            </form>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 18 }}>🔐</span>
              <span style={{ fontSize: 12, color: "#1E40AF" }}>
                Two-factor authentication via <strong>Google Authenticator</strong>
              </span>
            </div>

            {/* Demo Accounts */}
            <div
              style={{
                padding: "16px",
                background: "#F8FAFC",
                border: "2px solid #E2E8F0",
                borderRadius: 12,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 12,
                }}
              >
                {t("testAccounts")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.pwd);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: "#FFFFFF",
                      borderRadius: 10,
                      border: "2px solid #F1F5F9",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      transition: "all 0.2s ease",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = "#3B82F6";
                      e.target.style.background = "#EFF6FF";
                      e.target.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = "#F1F5F9";
                      e.target.style.background = "#FFFFFF";
                      e.target.style.transform = "translateX(0)";
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{account.icon}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 12px",
                        borderRadius: 9999,
                        background: account.bg,
                        color: account.color,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {account.role}
                    </span>
                    <code
                      style={{
                        fontSize: 11,
                        color: "#1E293B",
                        marginLeft: "auto",
                        opacity: 0.7,
                      }}
                    >
                      {account.email}
                    </code>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TOTP Setup Step */}
        {step === "totp-setup" && (
          <div>
            <ProgressSteps current={1} />

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🔐</div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: "0 0 8px",
                }}
              >
                Set up 2-Factor Authentication
              </h2>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.6 }}>
                This is a one-time setup. You need the{" "}
                <strong style={{ color: "#3B82F6" }}>Google Authenticator</strong> app
                on your phone.
              </p>
            </div>

            <div
              style={{
                background: "#F8FAFC",
                border: "2px solid #E2E8F0",
                borderRadius: 12,
                padding: "16px 18px",
                marginBottom: 20,
              }}
            >
              {[
                {
                  n: "1",
                  text: "Install Google Authenticator",
                  sub: "Available on App Store & Google Play",
                },
                {
                  n: "2",
                  text: "Tap the + button in the app",
                  sub: 'Then choose "Scan a QR code"',
                },
                {
                  n: "3",
                  text: "Scan the QR code below",
                  sub: "Smart Dashboard will be added automatically",
                },
              ].map((step) => (
                <div
                  key={step.n}
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: step.n === "3" ? 0 : 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {step.n}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                      {step.text}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{step.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              {qrDataUrl ? (
                <div
                  style={{
                    border: "4px solid #3B82F6",
                    borderRadius: 16,
                    padding: 12,
                    background: "#FFFFFF",
                    boxShadow: "0 8px 30px rgba(59,130,246,0.15)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <img
                    src={qrDataUrl}
                    alt="Google Authenticator QR Code"
                    style={{
                      width: 180,
                      height: 180,
                      display: "block",
                      borderRadius: 8,
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: 204,
                    height: 204,
                    background: "#F8FAFC",
                    borderRadius: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px dashed #E2E8F0",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#94A3B8" }}>Loading QR…</div>
                </div>
              )}
            </div>

            {secret && (
              <details style={{ marginBottom: 20 }}>
                <summary
                  style={{
                    fontSize: 12,
                    color: "#64748B",
                    cursor: "pointer",
                    userSelect: "none",
                    fontWeight: 500,
                    padding: "4px 0",
                  }}
                >
                  Can't scan? Enter key manually
                </summary>
                <div
                  style={{
                    marginTop: 10,
                    background: "#F8FAFC",
                    border: "2px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "#94A3B8",
                      margin: "0 0 8px",
                    }}
                  >
                    In Google Authenticator → + → Enter a setup key
                  </p>
                  <code
                    style={{
                      fontSize: 14,
                      color: "#3B82F6",
                      letterSpacing: 2,
                      wordBreak: "break-all",
                      fontWeight: 600,
                      background: "#EFF6FF",
                      padding: "8px 12px",
                      borderRadius: 8,
                      display: "block",
                    }}
                  >
                    {secret}
                  </code>
                </div>
              </details>
            )}

            <button
              onClick={() => setStep("totp-confirm")}
              disabled={!qrDataUrl}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: 14,
                fontWeight: 600,
                background: qrDataUrl
                  ? "linear-gradient(135deg, #3B82F6, #2563EB)"
                  : "#E2E8F0",
                color: qrDataUrl ? "#fff" : "#94A3B8",
                border: "none",
                borderRadius: 12,
                cursor: qrDataUrl ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                marginBottom: 10,
                transition: "all 0.2s ease",
                boxShadow: qrDataUrl
                  ? "0 4px 14px rgba(59,130,246,0.35)"
                  : "none",
              }}
              onMouseEnter={(e) => {
                if (qrDataUrl) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 6px 20px rgba(59,130,246,0.45)";
                }
              }}
              onMouseLeave={(e) => {
                if (qrDataUrl) {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 4px 14px rgba(59,130,246,0.35)";
                }
              }}
            >
              I've scanned it → Continue
            </button>

            <button
              onClick={resetToCredentials}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 13,
                fontWeight: 500,
                background: "#F8FAFC",
                border: "2px solid #E2E8F0",
                borderRadius: 10,
                cursor: "pointer",
                color: "#64748B",
                fontFamily: "inherit",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#F1F5F9";
                e.target.style.borderColor = "#CBD5E1";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "#F8FAFC";
                e.target.style.borderColor = "#E2E8F0";
              }}
            >
              ← Back to Login
            </button>
          </div>
        )}

        {/* TOTP Confirm Step */}
        {step === "totp-confirm" && (
          <div>
            <ProgressSteps current={2} />

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: "0 0 8px",
                }}
              >
                Confirm your authenticator
              </h2>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.6 }}>
                Open <strong style={{ color: "#3B82F6" }}>Google Authenticator</strong>{" "}
                on your phone.
                <br />
                Enter the <strong>6-digit code</strong> shown for{" "}
                <em style={{ color: "#3B82F6" }}>Smart Dashboard</em>.
              </p>
            </div>

            <form onSubmit={handleTotpEnable}>
              <div style={{ marginBottom: 22 }}>
                <CodeInput
                  value={confirmCode}
                  onChange={setConfirmCode}
                  disabled={verifying}
                  label="Enter 6-digit verification code"
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 13,
                    color: "#DC2626",
                    marginBottom: 16,
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || confirmCode.length !== 6}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: 14,
                  fontWeight: 600,
                  background:
                    verifying || confirmCode.length !== 6
                      ? "#94A3B8"
                      : "linear-gradient(135deg, #10B981, #059669)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  cursor: verifying || confirmCode.length !== 6 ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  marginBottom: 10,
                  transition: "all 0.2s ease",
                  boxShadow:
                    verifying || confirmCode.length !== 6
                      ? "none"
                      : "0 4px 14px rgba(16,185,129,0.35)",
                }}
                onMouseEnter={(e) => {
                  if (!verifying && confirmCode.length === 6) {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 20px rgba(16,185,129,0.45)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!verifying && confirmCode.length === 6) {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 14px rgba(16,185,129,0.35)";
                  }
                }}
              >
                {verifying ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        animation: "spin 1s linear infinite",
                      }}
                    >
                      ⏳
                    </span>
                    Verifying…
                  </>
                ) : (
                  "🚀 Activate 2FA"
                )}
              </button>
            </form>

            <button
              onClick={() => {
                setStep("totp-setup");
                setError("");
                setConfirmCode("");
              }}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 13,
                fontWeight: 500,
                background: "#F8FAFC",
                border: "2px solid #E2E8F0",
                borderRadius: 10,
                cursor: "pointer",
                color: "#64748B",
                fontFamily: "inherit",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#F1F5F9";
                e.target.style.borderColor = "#CBD5E1";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "#F8FAFC";
                e.target.style.borderColor = "#E2E8F0";
              }}
            >
              ← Back to QR
            </button>
          </div>
        )}

        {/* TOTP Verify Step */}
        {step === "totp" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🔑</div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: "0 0 8px",
                }}
              >
                Two-Factor Authentication
              </h2>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.6 }}>
                Open <strong style={{ color: "#3B82F6" }}>Google Authenticator</strong>{" "}
                on your phone
                <br />
                and enter the code for <strong style={{ color: "#3B82F6" }}>Smart Dashboard</strong>
              </p>
            </div>

            <div
              style={{
                background: "#F8FAFC",
                border: "2px solid #E2E8F0",
                borderRadius: 12,
                padding: "14px 18px",
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
                  Google Authenticator
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>
                  Smart Dashboard · {email}
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#3B82F6",
                    letterSpacing: 4,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {totpCode.padEnd(6, "·").split("").join(" ")}
                </div>
              </div>
            </div>

            <form onSubmit={handleTotpVerify}>
              <CodeInput
                value={totpCode}
                onChange={setTotpCode}
                disabled={verifying}
                label="Enter 6-digit verification code"
              />

              {error && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 13,
                    color: "#DC2626",
                    marginTop: 16,
                    marginBottom: 16,
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span>{error}</span>
                  {error.includes("clock") && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        width: "100%",
                        color: "#DC2626",
                      }}
                    >
                      Fix: Settings → General → Date & Time → Set Automatically
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || totpCode.length !== 6}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: 14,
                  fontWeight: 600,
                  background:
                    verifying || totpCode.length !== 6
                      ? "#94A3B8"
                      : "linear-gradient(135deg, #3B82F6, #2563EB)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  cursor: verifying || totpCode.length !== 6 ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  marginTop: 16,
                  marginBottom: 10,
                  transition: "all 0.2s ease",
                  boxShadow:
                    verifying || totpCode.length !== 6
                      ? "none"
                      : "0 4px 14px rgba(59,130,246,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!verifying && totpCode.length === 6) {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 20px rgba(59,130,246,0.45)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!verifying && totpCode.length === 6) {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 14px rgba(59,130,246,0.35)";
                  }
                }}
              >
                {verifying ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        animation: "spin 1s linear infinite",
                      }}
                    >
                      ⏳
                    </span>
                    Verifying…
                  </>
                ) : (
                  <>
                    Sign In
                    <span style={{ fontSize: 18 }}>→</span>
                  </>
                )}
              </button>
            </form>

            <button
              onClick={resetToCredentials}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 13,
                fontWeight: 500,
                background: "#F8FAFC",
                border: "2px solid #E2E8F0",
                borderRadius: 10,
                cursor: "pointer",
                color: "#64748B",
                fontFamily: "inherit",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#F1F5F9";
                e.target.style.borderColor = "#CBD5E1";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "#F8FAFC";
                e.target.style.borderColor = "#E2E8F0";
              }}
            >
              ← Use different account
            </button>
          </div>
        )}
      </div>

      {/* Global Styles */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}