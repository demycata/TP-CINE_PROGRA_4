import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

export const adminGuard: CanActivateFn = async () => {
    const auth = inject(Auth);
    const router = inject(Router);

    await auth.listo;

    if (auth.rol() !== 'admin') {
        return router.parseUrl('/');
    }

    return true;
};
