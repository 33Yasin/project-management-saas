import { IEmailAdapter, SendEmailOptions, SendEmailResult } from './email.interface';
import { logger } from '../logger';

export class DevLogEmailAdapter implements IEmailAdapter {
  private sentEmails: SendEmailOptions[] = [];

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    this.sentEmails.push(options);

    logger.info('Email simulated and logged (dev adapter)', {
      to: options.to,
      subject: options.subject,
    });

    return {
      success: true,
      messageId: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  getSentEmails(): SendEmailOptions[] {
    return [...this.sentEmails];
  }

  clearSentEmails(): void {
    this.sentEmails = [];
  }
}
