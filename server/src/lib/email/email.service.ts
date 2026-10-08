import { IEmailAdapter, InvitationEmailOptions, SendEmailResult } from './email.interface';
import { DevLogEmailAdapter } from './dev-log.adapter';
import { ResendEmailAdapter } from './resend.adapter';
import { logger } from '../logger';

export class EmailService {
  private adapter: IEmailAdapter;

  constructor(adapter?: IEmailAdapter) {
    if (adapter) {
      this.adapter = adapter;
    } else {
      const driver = process.env.EMAIL_DRIVER || 'log';
      const apiKey = process.env.RESEND_API_KEY;

      if (driver === 'resend' && apiKey) {
        this.adapter = new ResendEmailAdapter({
          apiKey,
          fromEmail: process.env.EMAIL_FROM,
        });
      } else {
        this.adapter = new DevLogEmailAdapter();
      }
    }
  }

  getAdapter(): IEmailAdapter {
    return this.adapter;
  }

  setAdapter(adapter: IEmailAdapter): void {
    this.adapter = adapter;
  }

  async sendInvitationEmail(options: InvitationEmailOptions): Promise<SendEmailResult> {
    const formattedExpiresAt = options.expiresAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const subject = `${options.inviterName} invited you to join ${options.workspaceName} on Agora`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { margin-bottom: 24px; text-align: center; }
    .logo { font-size: 24px; font-weight: 700; color: #4f46e5; letter-spacing: -0.5px; }
    .content { font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 32px; }
    .badge { display: inline-block; background-color: #e0e7ff; color: #4338ca; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 6px; text-decoration: none; transition: background-color 0.2s; }
    .footer { font-size: 13px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 20px; line-height: 1.5; }
    .link-alt { word-break: break-all; color: #4f46e5; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Agora</div>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p><strong>${options.inviterName}</strong> has invited you to join the <strong>${options.workspaceName}</strong> workspace as a <span class="badge">${options.role}</span>.</p>
      <div class="btn-container">
        <a href="${options.inviteUrl}" class="btn" target="_blank" rel="noopener noreferrer">Accept Invitation</a>
      </div>
      <p>This invitation will expire on <strong>${formattedExpiresAt}</strong>.</p>
      <p>If you don't recognize this workspace or weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>Having trouble with the button? Copy and paste the link below into your web browser:</p>
      <p><a href="${options.inviteUrl}" class="link-alt">${options.inviteUrl}</a></p>
    </div>
  </div>
</body>
</html>
`.trim();

    const text = `
Agora Workspace Invitation

Hello,

${options.inviterName} has invited you to join the "${options.workspaceName}" workspace on Agora as a ${options.role}.

Accept the invitation here:
${options.inviteUrl}

This invitation will expire on ${formattedExpiresAt}.

If you weren't expecting this invitation, you can safely ignore this email.
`.trim();

    try {
      return await this.adapter.send({
        to: options.to,
        subject,
        html,
        text,
      });
    } catch (err) {
      logger.error('EmailService: Failed to send invitation email', {
        err: err instanceof Error ? err.message : String(err),
        recipient: options.to,
      });
      return {
        success: false,
        error: 'Email delivery failed',
      };
    }
  }
}

export const emailService = new EmailService();
