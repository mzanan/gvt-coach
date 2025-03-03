// Este es un archivo CommonJS que actuará como wrapper para probar el servicio de correo
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

console.log('===============================');
console.log('🧪 TEST DE ENVÍO DE CORREO 🧪');
console.log('===============================');

// Check and load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: .env.local file not found');
  console.error('Please create this file with FROM_EMAIL and GMAIL_PASSWORD variables');
  process.exit(1);
}

// Load environment variables from .env.local
dotenv.config({ path: envPath });
console.log('✅ Variables de entorno cargadas desde:', envPath);

// Check required variables
if (!process.env.FROM_EMAIL) {
  console.error('❌ ERROR: Missing FROM_EMAIL variable in .env.local');
  process.exit(1);
}

if (!process.env.GMAIL_PASSWORD) {
  console.error('❌ ERROR: Missing GMAIL_PASSWORD variable in .env.local');
  console.error('If you have two-factor authentication, you must use an App Password');
  console.error('Generate one at: https://myaccount.google.com/apppasswords');
  process.exit(1);
}

// Main test function
async function testEmail() {
  console.log('🔄 Starting email sending test...');
  console.log('📧 Using account:', process.env.FROM_EMAIL);
  
  try {
    // Import mail service - using require to avoid ESM vs CommonJS issues
    const nodemailer = require('nodemailer');
    
    // Create a transporter for testing
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.FROM_EMAIL,
        pass: process.env.GMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log('✅ Transporter created, verifying configuration...');
    
    // Verify configuration
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Error verifying SMTP configuration:', error);
        return;
      }
      
      console.log('✅ SMTP configuration verified successfully');
      console.log('🔄 Sending test email to:', process.env.FROM_EMAIL);
      
      // Configure message
      const mailOptions = {
        from: `"GVT Coach Test" <${process.env.FROM_EMAIL}>`,
        to: process.env.FROM_EMAIL,
        subject: 'Test email from GVT Coach',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <h1 style="color: #4CAF50;">Email configuration is working!</h1>
            <p>This is a test email to verify that the Nodemailer configuration with Gmail is working correctly.</p>
            <p>Test details:</p>
            <ul>
              <li><strong>Date and time:</strong> ${new Date().toLocaleString()}</li>
              <li><strong>Sent from:</strong> ${process.env.FROM_EMAIL}</li>
              <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</li>
            </ul>
            <p>If you're receiving this email, it means the configuration is correct and you can start using the email notification system.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 14px; color: #666;">GVT Coach - Notification System</p>
          </div>
        `,
      };
      
      // Send email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('');
          console.error('❌ ERROR SENDING EMAIL');
          console.error('Error details:', error);
          console.error('');
          console.error('Please verify:');
          console.error('1. That the credentials in .env.local are correct');
          console.error('2. If you use two-factor authentication, you must use an App Password');
          console.error('3. Check your Gmail account security settings');
          console.error('4. Visit https://accounts.google.com/DisplayUnlockCaptcha and authorize access');
          return;
        }
        
        console.log('');
        console.log('✅ EMAIL SENT SUCCESSFULLY!');
        console.log('📧 Message ID:', info.messageId);
        console.log('');
        console.log('👉 Check your inbox (or spam) at', process.env.FROM_EMAIL);
        console.log('   to confirm you received the test email.');
      });
    });
  } catch (error) {
    console.error('');
    console.error('❌ UNEXPECTED ERROR');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

// Run the test
testEmail(); 