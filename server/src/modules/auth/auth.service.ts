import * as argon2 from 'argon2';
import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import { RegisterInput, LoginInput } from './auth.schemas';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class AuthService {
  async register(input: RegisterInput): Promise<SafeUser> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw AppError.conflict(
        'An account with this email address already exists.',
        ErrorCode.CONFLICT
      );
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return user;
  }

  async login(input: LoginInput): Promise<SafeUser> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) {
      // Use generic error message to reduce account enumeration risk
      throw AppError.unauthenticated(
        'Invalid email or password.',
        ErrorCode.INVALID_CREDENTIALS
      );
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, input.password);

    if (!isPasswordValid) {
      throw AppError.unauthenticated(
        'Invalid email or password.',
        ErrorCode.INVALID_CREDENTIALS
      );
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw AppError.unauthenticated(
        'User session is no longer valid.',
        ErrorCode.AUTH_REQUIRED
      );
    }

    return user;
  }
}

export const authService = new AuthService();
