import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendSchoolOnboardingEmail(
    to: string,
    username: string,
    password: string,
  ) {
    const subject = 'Your Skill-seed School Admin Credentials';

    const html = `<h1>Welcome to Our Platform !</h1>
        <p>Your School has been onboarded successfully.</p>
        <p>Here are your login credentials:</p>
        <p><strong>Username:</strong> ${username}</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
      <p>Please change your password after first login.</p>
        `;

    await this.sendEmail(to, subject, html);
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    // Implement your email sending logic here
    // This could be using nodemailer, sendgrid, etc.
    console.log(
      `Sending email to ${to} with subject "${subject}" and body "${html}"`,
    );
  }
}
