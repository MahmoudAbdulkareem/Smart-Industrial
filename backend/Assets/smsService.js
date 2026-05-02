/**
 * SMS Service — Twilio
 * Set in .env:
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxxx
 *   TWILIO_AUTH_TOKEN=xxxxxxxxx
 *   TWILIO_FROM=+1xxxxxxxxxx
 *
 * If vars are absent, SMS is silently skipped (dev mode).
 */

let twilioClient = null;

function getTwilio() {
    if (twilioClient) return twilioClient;
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
    const twilio = require("twilio");
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return twilioClient;
}

async function sendSMS(to, body) {
    const client = getTwilio();
    if (!client) {
        console.log("[SMS dev-skip] To:", to, "| Body:", body);
        return;
    }
    try {
        const msg = await client.messages.create({
            body,
            from: process.env.TWILIO_FROM,
            to,
        });
        console.log("SMS sent to", to, "— SID:", msg.sid);
    } catch (err) {
        console.error("SMS error:", err.message);
    }
}

async function sendOTPSms(phone, name, otp) {
    await sendSMS(phone, `Smart Dashboard: Hi ${name}, your login code is ${otp}. It expires in 10 minutes. Never share it.`);
}

async function sendDeactivationSmS(phone, name, hoursLeft) {
    await sendSMS(phone, `Smart Dashboard: Hi ${name}, your account has been deactivated and will be deleted in ${hoursLeft} hour(s). Contact IT Admin to reactivate.`);
}

async function sendAccountDeletedSms(phone, name) {
    await sendSMS(phone, `Smart Dashboard: Hi ${name}, your account has been permanently deleted. Contact IT Admin if this is an error.`);
}

module.exports = { sendOTPSms, sendDeactivationSmS, sendAccountDeletedSms };
