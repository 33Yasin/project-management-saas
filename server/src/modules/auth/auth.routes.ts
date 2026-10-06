import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/require-auth';
import { authRateLimiter } from '../../middleware/rate-limiter';
import { registerSchema, loginSchema } from './auth.schemas';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  (req, res, next) => {
    authController.register(req, res, next);
  }
);

router.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  (req, res, next) => {
    authController.login(req, res, next);
  }
);

router.post('/logout', (req, res, next) => {
  authController.logout(req, res, next);
});

router.get('/me', requireAuth, (req, res, next) => {
  authController.me(req, res, next);
});

export default router;
