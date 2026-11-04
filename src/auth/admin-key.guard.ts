import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from './public.decorator';

/** Header the admin panel's server-side proxy sends. Browsers never see the key. */
export const ADMIN_KEY_HEADER = 'x-admin-key';

/** Shortest key we accept. A short key is treated as missing so it can't be brute-forced. */
const MIN_KEY_LENGTH = 32;

/**
 * True when the guard verified the caller holds the admin key.
 * Public handlers use this to decide whether to show drafts / internal fields.
 */
export function isAdminRequest(req: unknown): boolean {
  return (req as { isAdmin?: boolean } | undefined)?.isAdmin === true;
}

/**
 * Global guard: every route requires the admin key unless marked @Public().
 *
 * Fails closed — if ADMIN_API_KEY is unset or too short, admin routes are
 * locked rather than left open. Public routes keep working either way, so the
 * storefront stays up even if the key is misconfigured.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminKeyGuard.name);
  private warnedMissingKey = false;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const isAdmin = this.hasValidKey(req);
    req.isAdmin = isAdmin;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || isAdmin) return true;

    throw new UnauthorizedException('Admin credentials required.');
  }

  private hasValidKey(req: { headers?: Record<string, string | string[] | undefined> }): boolean {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected || expected.length < MIN_KEY_LENGTH) {
      if (!this.warnedMissingKey) {
        this.logger.error(
          `ADMIN_API_KEY is missing or shorter than ${MIN_KEY_LENGTH} characters — all admin routes are locked.`,
        );
        this.warnedMissingKey = true;
      }
      return false;
    }

    const raw = req.headers?.[ADMIN_KEY_HEADER];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    if (typeof provided !== 'string' || provided.length === 0) return false;

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
