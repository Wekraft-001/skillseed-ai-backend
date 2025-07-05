import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      auth: {
        user: process.env.MAIL_USER || 'api',
        pass: process.env.MAIL_PASS || '7f608d469e261486705539e674a462dd',
        authMethod: 'PLAIN,LOGIN',
      },
      tls: {
        rejectUnauthorized: process.env.MAIL_STARTTLS === 'true',
      },
      debug: true,
    });
    console.log('MAIL_USER:', process.env.MAIL_USER);
    console.log('MAIL_PASS:', process.env.MAIL_PASS);
  }

  async sendSchoolOnboardingEmail(email: string, password: string) {
    const mailOptions = {
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Your Skillseed School Account',
      html: `
        <p>Hi there,</p>
        <p>Your school has been onboarded on Skillseed 🎉</p>
        <p>Here are your login credentials:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
        <p>You'll be asked to reset this password on first login.</p>
        <p>Welcome aboard!</p>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent:', info.response);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
    }
  }
}
