// backend/scripts/testEmail.js
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('📧 Testing email configuration...\n');
    
    // Check environment variables
    const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM || 'noreply@smartdashboard.com'
    };
    
    console.log('Configuration:');
    console.log(`  Host: ${config.host}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  User: ${config.user}`);
    console.log(`  From: ${config.from}`);
    console.log(`  Password: ${config.pass ? '✅ Set' : '❌ Missing'}`);
    console.log('');
    
    if (!config.user || !config.pass) {
        console.error('❌ Missing email credentials in .env file');
        console.log('\nPlease add:');
        console.log('  SMTP_USER=your-email@gmail.com');
        console.log('  SMTP_PASS=your-app-password');
        return;
    }
    
    try {
        // Create transporter
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
                user: config.user,
                pass: config.pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        // Verify connection
        console.log('🔌 Verifying connection...');
        await transporter.verify();
        console.log('✅ Connection successful!\n');
        
        // Send test email
        console.log('📤 Sending test email...');
        const info = await transporter.sendMail({
            from: config.from,
            to: config.user, // Send to yourself
            subject: '🧪 Test Email from SmartDashboard',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1d6fcc;">🧪 Test Email</h2>
                    <p>This is a test email from the SmartDashboard notification system.</p>
                    <p style="color: #6b7a99; font-size: 12px;">
                        Sent at: ${new Date().toLocaleString()}
                    </p>
                    <hr>
                    <p style="font-size: 11px; color: #9aa5b4;">
                        If you received this, your email configuration is working correctly!
                    </p>
                    <p style="font-size: 11px; color: #9aa5b4;">
                        <a href="http://localhost:3000" style="color: #1d6fcc;">Visit Dashboard →</a>
                    </p>
                </div>
            `
        });
        
        console.log('✅ Test email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   To: ${config.user}`);
        console.log('\n📧 Check your email inbox (and spam folder).');
        
    } catch (error) {
        console.error('❌ Email test failed:', error.message);
        
        if (error.message.includes('Invalid login')) {
            console.log('\n🔑 Troubleshooting:');
            console.log('   1. Make sure you generated an App Password');
            console.log('   2. Check that 2-Step Verification is enabled');
            console.log('   3. Try regenerating the App Password');
            console.log('   4. Make sure your Gmail account exists');
        }
        
        if (error.message.includes('535')) {
            console.log('\n🔑 Authentication failed:');
            console.log('   1. Go to: https://myaccount.google.com/apppasswords');
            console.log('   2. Generate a new App Password');
            console.log('   3. Copy it exactly as shown (with spaces)');
            console.log('   4. Update your .env file');
        }
    }
}

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

testEmail();