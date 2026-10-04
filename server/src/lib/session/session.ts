import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from '../db/prisma';

const PgSessionStore = connectPgSimple(session);

const isProduction = process.env.NODE_ENV === 'production';

export const sessionMiddleware = session({
  store: new PgSessionStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false, // Table managed by Prisma migrations
  }),
  secret: process.env.SESSION_SECRET || 'development-session-secret-fallback',
  resave: false,
  saveUninitialized: false,
  name: 'sid',
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});
