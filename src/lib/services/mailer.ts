import nodemailer from 'nodemailer';
import { 
  getBookingConfirmationTemplate,
  getSessionReminderTemplate,
  getCancellationTemplate,
  getSessionSummaryTemplate 
} from './email-templates';

// Configuración del transportador de nodemailer para Gmail
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true para 465, false para otros puertos
  auth: {
    user: process.env.GMAIL_USER, // Tu email de Gmail
    pass: process.env.GMAIL_PASSWORD, // Contraseña o App Password
  },
  tls: {
    // No falla si el certificado es self-signed
    rejectUnauthorized: false
  }
});

// Verificar la configuración del transportador (opcional pero recomendado)
if (process.env.NODE_ENV !== 'production') {
  transporter.verify(function(error, success) {
    if (error) {
      console.error('Error en la configuración del servidor SMTP:', error);
      console.error('Asegúrate de configurar correctamente GMAIL_USER y GMAIL_PASSWORD en .env.local');
      console.error('Valores actuales:', {
        GMAIL_USER: process.env.GMAIL_USER || 'no configurado',
        GMAIL_PASSWORD: process.env.GMAIL_PASSWORD ? '******' : 'no configurado'
      });
    } else {
      console.log('✅ Servidor SMTP está listo para enviar mensajes');
    }
  });
}

// Dirección de correo desde la que se enviarán los emails
const defaultFromEmail = process.env.GMAIL_USER || process.env.COACH_EMAIL || 'matiaszanan@gmail.com';

// Interfaz para los datos de correo electrónico
export interface EmailData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * Envía un correo electrónico usando nodemailer con SMTP de Gmail
 * @param emailData Datos del correo electrónico a enviar
 * @returns Una promesa con el resultado del envío
 */
export async function sendEmail(emailData: EmailData) {
  try {
    // Verificaciones previas
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      throw new Error('Faltan credenciales de Gmail. Verifica las variables GMAIL_USER y GMAIL_PASSWORD.');
    }

    // Aseguramos que al menos haya contenido en html o text
    if (!emailData.html && !emailData.text) {
      throw new Error('Debes proporcionar contenido HTML o texto plano para el correo electrónico');
    }

    // Logs para depuración (no en producción)
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 Intentando enviar correo a:', emailData.to);
      console.log('📧 Asunto:', emailData.subject);
    }

    // Configurar mensaje
    const mailOptions = {
      from: emailData.from || `"GVT Coach" <${defaultFromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      replyTo: emailData.replyTo,
      cc: emailData.cc,
      bcc: emailData.bcc,
    };

    // Enviar el correo y esperar la respuesta
    const info = await transporter.sendMail(mailOptions);
    
    // Log del resultado
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Mensaje enviado: %s', info.messageId);
    }
    
    return { success: true, data: info };
  } catch (error) {
    // Logueo detallado del error
    console.error('❌ Error al enviar correo electrónico:', error);
    
    if (error instanceof Error) {
      // Añadir más información de diagnóstico
      console.error('Mensaje de error:', error.message);
      console.error('Stack:', error.stack);
    }
    
    // Si es un error de autenticación, dar indicaciones específicas
    if (error instanceof Error && error.message.includes('Authentication')) {
      console.error('Error de autenticación. Por favor verifica:');
      console.error('1. Que las credenciales de Gmail sean correctas');
      console.error('2. Si usas autenticación de dos factores, debes usar una "App Password"');
      console.error('3. Si no usas 2FA, habilita "Acceso de apps menos seguras" en tu cuenta de Google');
      console.error('4. Visita https://accounts.google.com/DisplayUnlockCaptcha y autoriza el acceso');
    }
    
    return { success: false, error };
  }
}

/**
 * Envía un correo electrónico de confirmación de reserva
 * @param to Email del destinatario
 * @param bookingDetails Detalles de la reserva
 * @returns Una promesa con el resultado del envío
 */
export async function sendBookingConfirmation(
  to: string, 
  bookingDetails: { 
    start_time: string | Date, 
    end_time: string | Date, 
    zoom_link?: string,
    user_name?: string
  }
) {
  const subject = `Confirmación de tu sesión de coaching`;
  const html = getBookingConfirmationTemplate(bookingDetails);

  return sendEmail({
    to,
    subject,
    html,
  });
}

/**
 * Envía un recordatorio de sesión 24 horas antes
 * @param to Email del destinatario
 * @param bookingDetails Detalles de la reserva
 * @returns Una promesa con el resultado del envío
 */
export async function sendSessionReminder(
  to: string, 
  bookingDetails: { 
    start_time: string | Date, 
    end_time: string | Date, 
    zoom_link?: string,
    user_name?: string
  }
) {
  const subject = `Recordatorio: Tu sesión de coaching es mañana`;
  const html = getSessionReminderTemplate(bookingDetails);

  return sendEmail({
    to,
    subject,
    html,
  });
}

/**
 * Envía una notificación de cancelación de sesión
 * @param to Email del destinatario
 * @param bookingDetails Detalles de la reserva cancelada
 * @returns Una promesa con el resultado del envío
 */
export async function sendCancellationNotification(
  to: string, 
  bookingDetails: { 
    start_time: string | Date,
    user_name?: string
  }
) {
  const subject = `Sesión Cancelada`;
  const html = getCancellationTemplate(bookingDetails);

  return sendEmail({
    to,
    subject,
    html,
  });
}

/**
 * Envía un resumen de la sesión realizada
 * @param to Email del destinatario
 * @param sessionDetails Detalles de la sesión y su resumen
 * @returns Una promesa con el resultado del envío
 */
export async function sendSessionSummary(
  to: string, 
  sessionDetails: {
    date: string | Date,
    summary: string,
    next_steps?: string[],
    resources?: Array<{title: string, url: string}>,
    user_name?: string
  }
) {
  const subject = `Resumen de tu sesión de coaching`;
  const html = getSessionSummaryTemplate(sessionDetails);

  return sendEmail({
    to,
    subject,
    html,
  });
}

// Puedes añadir más funciones específicas para diferentes tipos de emails 