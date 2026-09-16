import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { Auth } from '../core/auth/auth';
import { Rol } from '../services/usuario.service';

@Directive({
  selector: '[appSiRol]',
})
export class SiRolDirective {
  private auth = inject(Auth);
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);

  private rolesPermitidos: Rol[] = [];
  private mostrada = false;

  @Input({ required: true })
  set appSiRol(rol: Rol | Rol[]) {
    this.rolesPermitidos = Array.isArray(rol) ? rol : [rol];
    this.actualizar();
  }

  constructor() {
    effect(() => this.actualizar());
  }

  private actualizar() {
    const rolActual = this.auth.rol();
    const debeMostrarse = rolActual !== null && this.rolesPermitidos.includes(rolActual);

    if (debeMostrarse && !this.mostrada) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.mostrada = true;
    } else if (!debeMostrarse && this.mostrada) {
      this.viewContainer.clear();
      this.mostrada = false;
    }
  }
}
