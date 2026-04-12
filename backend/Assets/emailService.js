const nodemailer = require("nodemailer");

let transporter = null;

async function getTransporter() {
    if (transporter) return transporter;
    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host:   process.env.SMTP_HOST,
            port:   parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    } else {
        const test = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: { user: test.user, pass: test.pass },
        });
        console.log("Email — Ethereal test account:", test.user);
    }
    return transporter;
}

const FROM = process.env.SMTP_FROM || '"Smart Dashboard" <noreply@smartdashboard.local>';

async function sendOTPEmail(toEmail, toName, otp) {
    const t = await getTransporter();
    const info = await t.sendMail({
        from: FROM,
        to: `"${toName}" <${toEmail}>`,
        subject: "Your Smart Dashboard login code",
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8faff;border-radius:12px"><h2 style="color:#1a2332">Login Verification</h2><p style="color:#6b7a99">Hi <strong>${toName}</strong>, your one-time login code is:</p><div style="background:#fff;border:2px dashed #1d6fcc;border-radius:10px;padding:20px;text-align:center;margin:16px 0"><span style="font-size:36px;font-weight:800;color:#1d6fcc;letter-spacing:12px">${otp}</span></div><p style="color:#9aa5b4;font-size:12px">Expires in 10 minutes. Never share this code.</p></div>`,
    });
    console.log("OTP sent to", toEmail, "— Preview:", nodemailer.getTestMessageUrl(info));
}

async function sendDeactivationWarning(toEmail, toName, hoursLeft) {
    const t = await getTransporter();
    await t.sendMail({
        from: FROM,
        to: `"${toName}" <${toEmail}>`,
        subject: "Your Smart Dashboard account will be deleted",
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px"><h2 style="color:#c2410c">Account Deletion Notice</h2><p>Hi <strong>${toName}</strong>, your account <strong>${toEmail}</strong> has been deactivated.</p><p style="color:#dc2626;font-weight:600">It will be permanently deleted in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}.</p><p style="color:#6b7a99">Contact your IT Administrator to reactivate it.</p></div>`,
    });
    console.log("Deactivation warning sent to", toEmail);
}

async function sendAccountDeletedEmail(toEmail, toName) {
    const t = await getTransporter();
    await t.sendMail({
        from: FROM,
        to: `"${toName}" <${toEmail}>`,
        subject: "Your Smart Dashboard account has been deleted",
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px"><h2 style="color:#dc2626">Account Deleted</h2><p>Hi <strong>${toName}</strong>, your account <strong>${toEmail}</strong> has been permanently deleted.</p><p style="color:#6b7a99">Contact your IT Administrator if you need access restored.</p></div>`,
    });
    console.log("Deletion confirmation sent to", toEmail);
}

module.exports = { sendOTPEmail, sendDeactivationWarning, sendAccountDeletedEmail };
