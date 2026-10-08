import { IEmailAdapter, SendEmailOptions, SendEmailResult } from './email.interface';
import { logger } from '../logger';

export interface ResendAdapterConfig {
  apiKey: string;
  fromEmail?: string;
}

export class ResendEmailAdapter implements IEmailAdapter {
  private apiKey: string;
  private fromEmail: string;

  constructor(config: ResendAdapterConfig) {
    this.apiKey = config.apiKey;
    this.fromEmail = config.fromEmail || 'Agora <notifications@agora-pm.com>';
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        logger.error('Resend email delivery failed', {
          status: response.status,
          errorData: errData as Record<string, unknown>,
        });
        return {
          success: false,
          error: `Provider rejected delivery with status ${response.status}`,
        };
      }

      const data = (await response.json()) as { id?: string };
      return {
        success: true,
        messageId: data.id,
      };
    } catch (err) {
      logger.error('Network error while delivering email via Resend', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: 'Failed to send email through provider',
      };
    }
  }
}
