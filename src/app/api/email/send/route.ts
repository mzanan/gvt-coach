import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { SITE_CONFIG } from '@/config/site';

// Nodemailer transporter configuration for Mailgun SMTP
const transporter = nodemailer.createTransport({
  host: process.env.GVT_COACH_MAILGUN_SMTP_HOST,
  port: Number(process.env.GVT_COACH_MAILGUN_SMTP_PORT),
  secure: false, // false for 587, true for 465
  auth: {
    user: process.env.GVT_COACH_MAILGUN_SMTP_USER,
    pass: process.env.GVT_COACH_MAILGUN_SMTP_PASS,
  },
});

// Email address configuration
const FROM_NAME = process.env.GVT_COACH_FROM_NAME || 'GVT Coach';
const defaultFromEmail = process.env.GVT_COACH_FROM_EMAIL || SITE_CONFIG.contactEmail;
const formattedFromEmail = `${FROM_NAME} <${defaultFromEmail}>`;

// Endpoint para enviar un correo electrónico genérico
export async function POST(req: NextRequest) {
  try {
    // Extraemos los datos del correo del cuerpo de la solicitud
    const data = await req.json();
    const { to, subject, html, text, cc, bcc } = data;

    // Validamos los datos mínimos necesarios
    if (!to || (!subject && !html && !text)) {
      return NextResponse.json(
        { error: 'Missing required data for email' },
        { status: 400 }
      );
    }

    // Enviamos el correo
    try {
      const mailOptions = {
        from: formattedFromEmail,
        to,
        subject,
        html,
        text,
        cc,
        bcc,
      };

      const info = await transporter.sendMail(mailOptions);
      
      return NextResponse.json({ success: true, data: info });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return NextResponse.json(
        { error: 'Error sending email', details: emailError },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in email sending endpoint:', error);
    return NextResponse.json(
      { error: 'Error processing request' },
      { status: 500 }
    );
  }
} 