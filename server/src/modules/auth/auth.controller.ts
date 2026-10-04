import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.register(req.body);

      // Regenerate session ID to mitigate session fixation attacks
      await regenerateSession(req);
      req.session.userId = user.id;

      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.login(req.body);

      // Regenerate session ID on privilege level change
      await regenerateSession(req);
      req.session.userId = user.id;

      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await destroySession(req);
      res.clearCookie('sid');
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // req.session.userId is guaranteed to exist because of requireAuth middleware
      const user = await authService.getCurrentUser(req.session.userId!);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
