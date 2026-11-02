import type { Request, RequestHandler } from 'express';
import { auth, optionalAuth, adminOnly } from '../../src/middleware/auth';
import type { AuthRequest, AuthenticatedUser } from '../../src/middleware/auth';
import { streamCatalogUpdates } from '../../src/lib/catalogEvents';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type RequestIsTyped = Assert<IsAny<AuthRequest> extends false ? true : false>;
type RequestExtendsExpress = Assert<AuthRequest extends Request ? true : false>;

// Compilation-only contracts; nothing in this file runs or emits JavaScript.
export function requestContract(req: AuthRequest) {
  const body: Request['body'] = req.body;
  const params: Request['params'] = req.params;
  const query: Request['query'] = req.query;
  const user: AuthenticatedUser | undefined = req.user;
  const userId: string | undefined = req.user?.id;
  const email: string | undefined = req.user?.email;
  const role: string | undefined = req.user?.role;
  const reset: boolean | undefined = req.user?.pwdReset;
  // @ts-expect-error Authenticated IDs must retain their string type.
  const invalidId: number = req.user?.id;
  // @ts-expect-error Query parameters are parsed data, not functions.
  const invalidQuery: () => void = req.query;
  const handlers: RequestHandler[] = [auth, optionalAuth, adminOnly, streamCatalogUpdates];
  return { body, params, query, user, userId, email, role, reset, handlers, invalidId, invalidQuery };
}

export type RequestContracts = [RequestIsTyped, RequestExtendsExpress];
