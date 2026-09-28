import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Auth } from './auth';

export const empleadoGuard: CanMatchFn = async () => {
    const auth = inject(Auth);
    const router = inject(Router);

    await auth.listo;

    const rol = auth.rol();
    if (rol !== 'empleado' && rol !== 'admin') {
        return router.parseUrl('/');
    }

    return true;
};
