/**
 * emailService.js — Brevo (formerly Sendinblue) SMTP
 *
 * WHY BREVO:
 *   - Gmail OAuth blocked: app unverified (access_denied)
 *   - Gmail App Passwords blocked: managed/workspace account
 *   - Brevo: free tier, 300 emails/day, works with ANY gmail address as sender
 *     No Google restrictions. No domain needed.
 *
 * SETUP (takes 3 minutes):
 *   1. Create free account at https://app.brevo.com
 *   2. Go to: Settings → SMTP & API → SMTP tab
 *   3. Copy: Login (your Brevo email) and Master Password
 *      OR generate a new SMTP password on that page
 *   4. Add to backend/.env:
 *        BREVO_SMTP_USER=your_brevo_login_email
 *        BREVO_SMTP_PASS=your_brevo_smtp_password
 *        MAIL_FROM_NAME=Smart Dashboard
 *        MAIL_FROM_ADDRESS=negamex4274@gmail.com   ← shows as sender in inbox
 *
 * BREVO SMTP SETTINGS (already hardcoded below):
 *   Host: smtp-relay.brevo.com
 *   Port: 587
 *   Encryption: STARTTLS
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const nodemailer = require("nodemailer");

// ─────────────────────────────────────────────────────────────────────────────
function buildTransporter() {
    // Brevo SMTP
    if (process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS) {
        console.log("[Email] Using Brevo SMTP →", process.env.BREVO_SMTP_USER);
        return nodemailer.createTransport({
            host:   "smtp-relay.brevo.com",
            port:   587,
            secure: false,
            auth: {
                user: process.env.BREVO_SMTP_USER,
                pass: process.env.BREVO_SMTP_PASS,
            },
        });
    }

    // Generic SMTP fallback (Office365, etc.)
    if (process.env.SMTP_HOST) {
        console.log("[Email] Using SMTP:", process.env.SMTP_HOST);
        return nodemailer.createTransport({
            host:   process.env.SMTP_HOST,
            port:   parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }

    return null; // dev fallback handled below
}

async function getTransporter() {
    const t = buildTransporter();
    if (t) return t;

    // Ethereal dev fallback — catches emails, nothing really sent
    const test = await nodemailer.createTestAccount();
    console.log("[Email] ⚠ DEV MODE — no BREVO_SMTP_USER set. Using Ethereal (fake inbox).");
    console.log("[Email] Set BREVO_SMTP_USER + BREVO_SMTP_PASS in backend/.env to send real emails.");
    return nodemailer.createTransport({
        host: "smtp.ethereal.email", port: 587, secure: false,
        auth: { user: test.user, pass: test.pass },
    });
}

function getFrom() {
    const name    = process.env.MAIL_FROM_NAME    || "Smart Dashboard";
    const address = process.env.MAIL_FROM_ADDRESS || process.env.BREVO_SMTP_USER || "noreply@smartdashboard.local";
    return `"${name}" <${address}>`;
}

// ── HTML template ─────────────────────────────────────────────────────────────
function buildHtml(title, accentColor, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#eef2f7;font-family:'Segoe UI',Inter,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto">

    <!-- Header -->
    <div style="background:${accentColor};border-radius:14px 14px 0 0;padding:24px 28px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td>
          <div style="font-size:21px;font-weight:800;color:#fff;letter-spacing:-0.4px">Smart Dashboard</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.72);margin-top:4px;letter-spacing:0.2px">${title}</div>
        </td>
        <td align="right" style="font-size:32px;line-height:1">📊</td>
      </tr></table>
    </div>

    <!-- Card -->
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:30px 28px 24px;border:1px solid #dde3ec;border-top:none;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
      ${bodyHtml}
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #f0f4f8;text-align:center">
        <p style="font-size:11px;color:#9aa5b4;margin:0;line-height:1.6">
          This is an automated message — please do not reply.<br>
          Smart Dashboard · Industrial Monitoring Platform
        </p>
      </div>
    </div>

  </div>
</body>
</html>`;
}

// ── Senders ───────────────────────────────────────────────────────────────────

async function sendOTPEmail(toEmail, toName, otp) {
    const t = await getTransporter();
    const body = `
      <p style="font-size:15px;color:#1a2332;margin:0 0 18px">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size:14px;color:#374151;margin:0 0 22px">
        Your one-time login code for <strong>Smart Dashboard</strong> is:
      </p>
      <div style="background:#f0f7ff;border:2px dashed #1d6fcc;border-radius:14px;padding:30px 20px;text-align:center;margin:0 0 22px">
        <div style="font-size:46px;font-weight:900;color:#1d6fcc;letter-spacing:20px;font-variant-numeric:tabular-nums;line-height:1">
          ${otp}
        </div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background:#f8faff;border-radius:8px;padding:13px 16px;font-size:12px;color:#6b7a99;line-height:1.7">
            ⏱ &nbsp;<strong>Expires in 10 minutes</strong><br>
            🔒 &nbsp;Never share this code with anyone
          </td>
        </tr>
      </table>`;
    try {
        const info = await t.sendMail({
            from:    getFrom(),
            to:      `"${toName}" <${toEmail}>`,
            subject: `🔐 ${otp} — Your Smart Dashboard login code`,
            html:    buildHtml("Login Verification", "#1d6fcc", body),
        });
        console.log("[Email] OTP sent →", toEmail);
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) console.log("[Email] Ethereal preview:", preview);
    } catch (err) {
        console.error("[Email] OTP send failed for", toEmail, "→", err.message);
        throw err;
    }
}

async function sendDeactivationWarning(toEmail, toName, hoursLeft) {
    try {
        const t = await getTransporter();
        const body = `
          <p style="font-size:15px;color:#1a2332;margin:0 0 16px">Hi <strong>${toName}</strong>,</p>
          <p style="font-size:14px;color:#374151;margin:0 0 18px">
            Your Smart Dashboard account (<strong>${toEmail}</strong>) has been <strong>deactivated</strong>.
          </p>
          <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 10px 10px 0;padding:14px 18px;margin:0 0 18px">
            <p style="color:#c2410c;font-weight:700;font-size:14px;margin:0;line-height:1.5">
              ⚠ &nbsp;Your account will be permanently deleted in
              <strong>${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}</strong>.
            </p>
          </div>
          <p style="font-size:13px;color:#6b7a99;margin:0">
            Contact your IT Administrator immediately to reactivate before the deadline.
          </p>`;
        await t.sendMail({
            from:    getFrom(),
            to:      `"${toName}" <${toEmail}>`,
            subject: `⚠ Action required — Smart Dashboard account deletion in ${hoursLeft}h`,
            html:    buildHtml("Account Deactivation Notice", "#ea580c", body),
        });
        console.log("[Email] Deactivation warning →", toEmail);
    } catch (err) {
        console.error("[Email] Deactivation warning failed →", toEmail, err.message);
    }
}

async function sendAccountDeletedEmail(toEmail, toName) {
    try {
        const t = await getTransporter();
        const body = `
          <p style="font-size:15px;color:#1a2332;margin:0 0 16px">Hi <strong>${toName}</strong>,</p>
          <p style="font-size:14px;color:#374151;margin:0 0 16px">
            Your Smart Dashboard account (<strong>${toEmail}</strong>) has been
            <strong style="color:#dc2626">permanently deleted</strong>.
          </p>
          <p style="font-size:13px;color:#6b7a99;margin:0">
            If you believe this was a mistake, please contact your IT Administrator.
          </p>`;
        await t.sendMail({
            from:    getFrom(),
            to:      `"${toName}" <${toEmail}>`,
            subject: "Your Smart Dashboard account has been deleted",
            html:    buildHtml("Account Deleted", "#dc2626", body),
        });
        console.log("[Email] Deletion confirmation →", toEmail);
    } catch (err) {
        console.error("[Email] Deletion email failed →", toEmail, err.message);
    }
}

module.exports = { sendOTPEmail, sendDeactivationWarning, sendAccountDeletedEmail };
