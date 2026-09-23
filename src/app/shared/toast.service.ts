import { Service, signal } from '@angular/core';

@Service()
export class ToastService {
    mensaje = signal<string | null>(null);
    private idTimeout?: ReturnType<typeof setTimeout>;

    mostrar(texto: string, duracionMs = 6000) {
        clearTimeout(this.idTimeout);
        this.mensaje.set(texto);
        this.idTimeout = setTimeout(() => this.mensaje.set(null), duracionMs);
    }
}
