// Este es un archivo CommonJS que actuará como wrapper para probar el servicio de correo
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

console.log('===============================');
console.log('🧪 TEST DE ENVÍO DE CORREO 🧪');
console.log('===============================');

// Verificar y cargar variables de entorno
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: No se encontró el archivo .env.local');
  console.error('Por favor, crea este archivo con las variables GMAIL_USER y GMAIL_PASSWORD');
  process.exit(1);
}

// Cargar variables de entorno desde .env.local
dotenv.config({ path: envPath });
console.log('✅ Variables de entorno cargadas desde:', envPath);

// Verificar variables requeridas
if (!process.env.GMAIL_USER) {
  console.error('❌ ERROR: Falta la variable GMAIL_USER en .env.local');
  process.exit(1);
}

if (!process.env.GMAIL_PASSWORD) {
  console.error('❌ ERROR: Falta la variable GMAIL_PASSWORD en .env.local');
  console.error('Si tienes autenticación de dos factores, debes usar una App Password');
  console.error('Genera una en: https://myaccount.google.com/apppasswords');
  process.exit(1);
}

// Función principal de prueba
async function testEmail() {
  console.log('🔄 Iniciando prueba de envío de correo electrónico...');
  console.log('📧 Usando cuenta:', process.env.GMAIL_USER);
  
  try {
    // Importar el servicio de correo - utilizando require para evitar problemas de ESM vs CommonJS
    const nodemailer = require('nodemailer');
    
    // Crear un transportador para la prueba
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log('✅ Transportador creado, verificando configuración...');
    
    // Verificar la configuración
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Error al verificar configuración SMTP:', error);
        return;
      }
      
      console.log('✅ Configuración SMTP verificada correctamente');
      console.log('🔄 Enviando correo de prueba a:', process.env.GMAIL_USER);
      
      // Configurar mensaje
      const mailOptions = {
        from: `"GVT Coach Test" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: 'Prueba de envío de correo desde GVT Coach',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <h1 style="color: #4CAF50;">¡La configuración de correos funciona!</h1>
            <p>Este es un correo de prueba para verificar que la configuración de Nodemailer con Gmail está funcionando correctamente.</p>
            <p>Detalles de la prueba:</p>
            <ul>
              <li><strong>Fecha y hora:</strong> ${new Date().toLocaleString()}</li>
              <li><strong>Enviado desde:</strong> ${process.env.GMAIL_USER}</li>
              <li><strong>Entorno:</strong> ${process.env.NODE_ENV || 'desarrollo'}</li>
            </ul>
            <p>Si estás recibiendo este correo, significa que la configuración es correcta y puedes comenzar a usar el sistema de notificaciones por correo electrónico.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 14px; color: #666;">GVT Coach - Sistema de Notificaciones</p>
          </div>
        `,
      };
      
      // Enviar correo
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('');
          console.error('❌ ERROR AL ENVIAR EL CORREO');
          console.error('Detalles del error:', error);
          console.error('');
          console.error('Por favor, verifica:');
          console.error('1. Que las credenciales en .env.local sean correctas');
          console.error('2. Si usas autenticación de dos factores, debes usar una App Password');
          console.error('3. Revisa la configuración de seguridad de tu cuenta de Gmail');
          console.error('4. Visita https://accounts.google.com/DisplayUnlockCaptcha y autoriza el acceso');
          return;
        }
        
        console.log('');
        console.log('✅ CORREO ENVIADO EXITOSAMENTE!');
        console.log('📧 ID del mensaje:', info.messageId);
        console.log('');
        console.log('👉 Verifica la bandeja de entrada (o spam) de', process.env.GMAIL_USER);
        console.log('   para confirmar que recibiste el correo de prueba.');
      });
    });
  } catch (error) {
    console.error('');
    console.error('❌ ERROR INESPERADO');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

// Ejecutar la prueba
testEmail(); 