import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  async sendSchoolOnboardingEmail(email: string, password: string) {
    const mailOptions = {
      from: '"Skillseed" <skillseed.wekraft.co>',
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

    await this.transporter.sendMail(mailOptions);
  }
}
