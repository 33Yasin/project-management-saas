import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { clearDatabase, teardown } from './setup';

describe('Auth Module Integration Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await teardown();
  });

  const validUser = {
    name: 'Yasin Test',
    email: 'test@example.com',
    password: 'SecurePassword123!',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user and set a session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe(validUser.name);
      expect(res.body.user.email).toBe(validUser.email);
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.id).toBeDefined();

      // Verify session cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith('sid='))).toBe(true);
    });

    it('should reject registration when email format is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUser, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields?.email).toBeDefined();
    });

    it('should reject registration when password is shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUser, password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields?.password).toBeDefined();
    });

    it('should return 409 CONFLICT when email is already registered', async () => {
      // First registration
      await request(app).post('/api/auth/register').send(validUser);

      // Duplicate registration with different case
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUser, email: 'TEST@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validUser);
    });

    it('should login successfully with valid credentials and return user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUser.email,
          password: validUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(validUser.email);
      expect(res.body.user.passwordHash).toBeUndefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith('sid='))).toBe(true);
    });

    it('should return 401 INVALID_CREDENTIALS when password is wrong', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUser.email,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 INVALID_CREDENTIALS when email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: validUser.password,
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 AUTH_REQUIRED when not authenticated', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return current user when session cookie is provided', async () => {
      // Register and capture cookie
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      const cookie = regRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe(validUser.email);
      expect(meRes.body.user.name).toBe(validUser.name);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should destroy session and clear cookie', async () => {
      // Register and capture cookie
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      const cookie = regRes.headers['set-cookie'];

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBe(204);

      // Verify subsequent request with that cookie is unauthenticated
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(401);
      expect(meRes.body.error.code).toBe('AUTH_REQUIRED');
    });
  });
});
