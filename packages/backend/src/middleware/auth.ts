import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { UserRole } from '../types/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userRole?: UserRole;
  }
}

export function authMiddleware(authService: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError();
    }

    const token = authHeader.slice(7);
    const { userId, role } = authService.verifyToken(token);
    request.userId = userId;
    request.userRole = role;
  };
}

export function adminMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.userRole !== UserRole.ADMIN) {
      throw new ForbiddenError('Admin access required.');
    }
  };
}
