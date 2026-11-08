import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

export const ownerGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.isOwner()
    ? true
    : router.createUrlTree(['/admin/login'], {
        queryParams: { returnUrl: state.url },
      });
};
