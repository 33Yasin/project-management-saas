import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';
import { DevLogEmailAdapter } from '../src/lib/email/dev-log.adapter';
import { ResendEmailAdapter } from '../src/lib/email/resend.adapter';
import { EmailService, emailService } from '../src/lib/email/email.service';

describe('Email Service & Invitation Email Tests', () => {
  let devAdapter: DevLogEmailAdapter;

  beforeEach(async () => {
    await clearDatabase();
    devAdapter = new DevLogEmailAdapter();
    emailService.setAdapter(devAdapter);
  });

  afterAll(async () => {
    await teardown();
  });

  describe('DevLogEmailAdapter', () => {
    it('should record sent emails in memory and support clearing', async () => {
      const adapter = new DevLogEmailAdapter();
      expect(adapter.getSentEmails()).toHaveLength(0);

      const res = await adapter.send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
      expect(adapter.getSentEmails()).toHaveLength(1);
      expect(adapter.getSentEmails()[0].to).toBe('user@example.com');

      adapter.clearSentEmails();
      expect(adapter.getSentEmails()).toHaveLength(0);
    });
  });

  describe('ResendEmailAdapter', () => {
    it('should successfully deliver email via Resend API when response is 200', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend_msg_123' }),
      } as Response);

      const adapter = new ResendEmailAdapter({
        apiKey: 'test_api_key',
        fromEmail: 'Agora <team@agora.com>',
      });

      const res = await adapter.send({
        to: 'collaborator@example.com',
        subject: 'Join Team',
        html: '<p>Welcome</p>',
        text: 'Welcome',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_api_key',
          }),
        })
      );
      expect(res.success).toBe(true);
      expect(res.messageId).toBe('resend_msg_123');

      fetchSpy.mockRestore();
    });

    it('should handle provider errors gracefully without throwing', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Invalid recipient' }),
      } as Response);

      const adapter = new ResendEmailAdapter({ apiKey: 'test_api_key' });
      const res = await adapter.send({
        to: 'invalid',
        subject: 'Test',
        html: '',
        text: '',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('422');

      fetchSpy.mockRestore();
    });
  });

  describe('EmailService Template & Fallbacks', () => {
    it('should compose invitation email containing inviter name, workspace, role, and URL', async () => {
      const service = new EmailService(devAdapter);
      const expiresAt = new Date('2026-12-31T23:59:59Z');

      const result = await service.sendInvitationEmail({
        to: 'newuser@example.com',
        inviterName: 'Sarah Connor',
        workspaceName: 'Cyberdyne Resistance',
        inviteUrl: 'http://localhost:5173/invitations/sample-token',
        role: 'ADMIN',
        expiresAt,
      });

      expect(result.success).toBe(true);
      const sent = devAdapter.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('newuser@example.com');
      expect(sent[0].subject).toContain('Sarah Connor invited you to join Cyberdyne Resistance');
      expect(sent[0].html).toContain('Cyberdyne Resistance');
      expect(sent[0].html).toContain('ADMIN');
      expect(sent[0].html).toContain('http://localhost:5173/invitations/sample-token');
      expect(sent[0].text).toContain('Sarah Connor has invited you');
      expect(sent[0].text).toContain('http://localhost:5173/invitations/sample-token');
    });
  });

  describe('POST /api/workspaces/:workspaceId/invitations with Email Delivery', () => {
    it('should trigger invitation email delivery when an invitation is created', async () => {
      // 1. Register owner
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Alice Owner', email: 'alice@example.com', password: 'Password123!' });
      const cookie = regRes.headers['set-cookie'];

      // 2. Create workspace
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', cookie)
        .send({ name: 'Acme Rocket Labs' });
      const workspaceId = wsRes.body.workspace.id;

      // 3. Create invitation
      const inviteRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', cookie)
        .send({ email: 'bob@example.com', role: 'MEMBER' });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.invitation).toBeDefined();
      expect(inviteRes.body.invitation.token).toBeDefined();

      // 4. Verify email was dispatched via devAdapter
      const sentEmails = devAdapter.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe('bob@example.com');
      expect(sentEmails[0].subject).toContain('Alice Owner invited you to join Acme Rocket Labs');
      expect(sentEmails[0].html).toContain(inviteRes.body.invitation.token);
      expect(sentEmails[0].text).toContain(inviteRes.body.invitation.token);
    });

    it('should succeed in creating invitation even if email sending encounters an error', async () => {
      // Configure adapter to simulate failure
      const failingAdapter = {
        send: vi.fn().mockRejectedValue(new Error('SMTP Connection timeout')),
      };
      emailService.setAdapter(failingAdapter);

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Charlie', email: 'charlie@example.com', password: 'Password123!' });
      const cookie = regRes.headers['set-cookie'];

      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', cookie)
        .send({ name: 'Resilient Team' });
      const workspaceId = wsRes.body.workspace.id;

      const inviteRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', cookie)
        .send({ email: 'david@example.com', role: 'ADMIN' });

      // Invitation is still created and token returned safely to UI
      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.invitation.email).toBe('david@example.com');
      expect(inviteRes.body.invitation.token).toBeDefined();

      // Check DB record exists
      const dbInvite = await prisma.invitation.findFirst({
        where: { email: 'david@example.com' },
      });
      expect(dbInvite).not.toBeNull();
    });
  });
});
