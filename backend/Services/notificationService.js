const nodemailer = require("nodemailer");
const userRepository = require("../repositories/userRepository");
const notificationLogRepository = require("../repositories/notificationLogRepository");

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
    const smtpPort = parseInt((process.env.SMTP_PORT || "587").trim(), 10);
    const smtpSecure = String(process.env.SMTP_SECURE || "false").trim().toLowerCase() === "true";
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();

    if (!smtpUser || !smtpPass) return null;

    transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
    });
    return transporter;
}

function severityPalette(severity) {
    const palettes = {
        critical: { text: "#fca5a5", label: "CRITICAL" },
        caution: { text: "#fcd34d", label: "CAUTION" },
        info: { text: "#34d399", label: "INFO" },
    };
    return palettes[severity?.toLowerCase()] || palettes.info;
}

function buildEmailHtml(alert, assetLabel) {
    const palette = severityPalette(alert.severity);
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Alert Notification</title></head>
<body style="background:#0b1329;font-family:sans-serif;color:#e2e8f0;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#0f172a;border-radius:12px;padding:24px;">
<h2 style="color:${palette.text};">${palette.label}</h2>
<p><strong>Asset:</strong> ${assetLabel}</p>
<p><strong>Message:</strong> ${alert.message}</p>
<p><strong>Time:</strong> ${new Date(alert.created_at || Date.now()).toLocaleString()}</p>
</div>
</body></html>`;
}

async function sendAlertNotification(alert, assetName) {
    const activeTransporter = getTransporter();
    if (!activeTransporter) return { sentCount: 0, failCount: 0, recipients: [] };

    const recipients = await userRepository.getUsersForNotification(alert.severity);
    if (!recipients.length) return { sentCount: 0, failCount: 0, recipients: [] };

    const sender = process.env.SMTP_FROM?.trim() || "noreply@smartdashboard.com";
    const assetLabel = assetName || alert.asset_id || "Unknown Asset";
    const html = buildEmailHtml(alert, assetLabel);

    let sentCount = 0;
    let failCount = 0;

    await Promise.all(recipients.map(async (user) => {
        try {
            await activeTransporter.sendMail({
                from: sender,
                to: user.email,
                subject: `${alert.severity?.toUpperCase() || "ALERT"}: ${alert.message.slice(0, 60)}`,
                html,
            });
            await notificationLogRepository.logNotification(user.id, alert.id, "email", "sent");
            sentCount += 1;
        } catch (error) {
            await notificationLogRepository.logNotification(user.id, alert.id, "email", "failed", error.message);
            failCount += 1;
        }
    }));

    return { sentCount, failCount, recipients: recipients.map((r) => r.email) };
}

module.exports = { sendAlertNotification };
