import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

/**
 * Extract the authenticated user (or a single field) from the request.
 *
 * @example
 * login(@CurrentUser() user: AuthUser) { ... }
 * login(@CurrentUser('id') actorId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
