import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { SITE_CONFIG } from '@/config/site';

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.GVT_COACH_MAILGUN_SMTP_HOST &&
    process.env.GVT_COACH_MAILGUN_SMTP_USER &&
    process.env.GVT_COACH_MAILGUN_SMTP_PASS
  );
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.GVT_COACH_MAILGUN_SMTP_HOST,
    port: Number(process.env.GVT_COACH_MAILGUN_SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.GVT_COACH_MAILGUN_SMTP_USER,
      pass: process.env.GVT_COACH_MAILGUN_SMTP_PASS,
    },
  });
}

const FROM_NAME = process.env.GVT_COACH_FROM_NAME || 'GVT Coach';
const defaultFromEmail = process.env.GVT_COACH_FROM_EMAIL || SITE_CONFIG.contactEmail;
const formattedFromEmail = `${FROM_NAME} <${defaultFromEmail}>`;

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { to, subject, html, text, cc, bcc } = data;

    if (!to || (!subject && !html && !text)) {
      return NextResponse.json(
        { error: 'Missing required data for email' },
        { status: 400 }
      );
    }

    if (!isSmtpConfigured()) {
      console.warn(`SMTP not configured, skipping email to ${to} (subject: ${subject})`);
      return NextResponse.json({ success: true, skipped: 'smtp-not-configured' });
    }

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

      const info = await getTransporter().sendMail(mailOptions);

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
