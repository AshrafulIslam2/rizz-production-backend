import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without the admin key.
 *
 * Every route is admin-only by default (see AdminKeyGuard). Only add this to
 * routes the public storefront genuinely needs — reading catalog content and
 * placing an order. Anything that reads customer data, costs, or mutates the
 * catalog must stay private.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
