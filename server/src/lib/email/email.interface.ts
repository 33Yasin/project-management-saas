export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailAdapter {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}

export interface InvitationEmailOptions {
  to: string;
  inviterName: string;
  workspaceName: string;
  inviteUrl: string;
  role: 'ADMIN' | 'MEMBER';
  expiresAt: Date;
}
