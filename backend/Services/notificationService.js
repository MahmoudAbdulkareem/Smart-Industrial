// backend/services/notificationService.js
const nodemailer = require('nodemailer');
const { query, queryOne } = require('../DataBase/db');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }
    return transporter;
}

// Get users to notify based on role
async function getNotificationRecipients(severity) {
    let sql = `
        SELECT id, name, email, role 
        FROM users 
        WHERE email IS NOT NULL 
          AND email != '' 
          AND is_active = 1
    `;
    
    // For critical alerts, notify maintenance engineers and admins
    if (severity === 'critical') {
        sql += ` AND role IN ('maintenance_engineer', 'it_admin', 'admin', 'energy_manager')`;
    } else {
        // For other alerts, notify all relevant users
        sql += ` AND role IN ('maintenance_engineer', 'it_admin', 'admin', 'energy_manager')`;
    }
    
    return query(sql);
}

// Log notification
async function logNotification(userId, alertId, channel, status, error = null) {
    return query(`
        INSERT INTO notification_logs (user_id, alert_id, channel, status, error, sent_at)
        VALUES (@userId, @alertId, @channel, @status, @error, GETDATE())
    `, {
        userId,
        alertId,
        channel,
        status,
        error: error ? JSON.stringify(error) : null
    });
}

// Send alert notification email
async function sendAlertNotification(alert, assetName) {
    const isConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    
    if (!isConfigured) {
        console.warn('[NotificationService] Email not configured. Alert notification would be sent:', {
            alertId: alert.id,
            severity: alert.severity,
            asset: assetName,
            message: alert.message
        });
        return;
    }

    try {
        const recipients = await getNotificationRecipients(alert.severity);
        
        if (recipients.length === 0) {
            console.log('[NotificationService] No recipients for alert:', alert.id);
            return;
        }

        const transporter = getTransporter();
        const assetLabel = assetName || alert.asset_id || 'Unknown Asset';
        
        // Color coding based on severity
        const severityColors = {
            critical: { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c', label: '🚨 CRITICAL' },
            caution: { bg: '#fffbeb', border: '#f59e0b', text: '#b45309', label: '⚠️ CAUTION' },
            info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', label: 'ℹ️ INFO' }
        };
        
        const colors = severityColors[alert.severity?.toLowerCase()] || severityColors.info;

        // Build email HTML
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1a2332; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
                    .header h2 { margin: 0; color: ${colors.text}; }
                    .details { background: #f8faff; padding: 16px; border-radius: 8px; margin: 16px 0; }
                    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
                    .detail-row:last-child { border-bottom: none; }
                    .label { color: #6b7a99; font-weight: 600; }
                    .value { color: #1a2332; }
                    .action-box { background: #f0fdf4; padding: 12px; border-radius: 6px; margin: 16px 0; border: 1px solid #bbf7d0; }
                    .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px; font-size: 11px; color: #9aa5b4; text-align: center; }
                    .button { display: inline-block; padding: 10px 20px; background: #1d6fcc; color: white; text-decoration: none; border-radius: 6px; }
                    .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; background: ${colors.bg}; color: ${colors.text}; border: 1px solid ${colors.border}; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>${colors.label}</h2>
                    </div>
                    
                    <h3 style="margin-top: 0;">Alert Notification</h3>
                    
                    <div class="details">
                        <div class="detail-row">
                            <span class="label">📋 Alert ID</span>
                            <span class="value">#${alert.id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">🏷️ Asset</span>
                            <span class="value"><strong>${assetLabel}</strong></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">📊 Severity</span>
                            <span class="value"><span class="severity-badge">${alert.severity?.toUpperCase() || 'INFO'}</span></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">📝 Message</span>
                            <span class="value">${alert.message}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">⏰ Time</span>
                            <span class="value">${new Date(alert.created_at || alert.time).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="action-box">
                        <strong>💡 Recommended Action:</strong>
                        ${alert.severity?.toLowerCase() === 'critical' 
                            ? 'Immediate attention required. Please investigate and take corrective action immediately.'
                            : alert.severity?.toLowerCase() === 'caution'
                            ? 'Please review this alert and take appropriate action if needed.'
                            : 'This is an informational alert for your awareness.'}
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated notification from Smart Industrial Monitor.</p>
                        <p>© ${new Date().getFullYear()} SmartDashboard. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Send to each recipient
        const emailPromises = recipients.map(async (user) => {
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || 'noreply@smartdashboard.com',
                    to: user.email,
                    subject: `🚨 ${alert.severity?.toUpperCase() || 'ALERT'}: ${alert.message.slice(0, 50)}${alert.message.length > 50 ? '...' : ''}`,
                    html: htmlContent
                });
                
                await logNotification(user.id, alert.id, 'email', 'sent');
                console.log(`[NotificationService] Alert sent to ${user.email}`);
                
            } catch (err) {
                console.error(`[NotificationService] Failed to send to ${user.email}:`, err.message);
                await logNotification(user.id, alert.id, 'email', 'failed', err.message);
            }
        });

        await Promise.all(emailPromises);
        console.log(`[NotificationService] Alert ${alert.id} sent to ${recipients.length} recipients`);

    } catch (error) {
        console.error('[NotificationService] Error sending alert notification:', error);
    }
}

module.exports = { sendAlertNotification, logNotification };