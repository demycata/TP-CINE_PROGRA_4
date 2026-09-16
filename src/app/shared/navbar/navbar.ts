import { Component, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { SpinnerComponent } from '../spinner.component/spinner.component';
import { SiRolDirective } from '../si-rol.directive';

@Component({
  imports: [RouterLink, RouterLinkActive, SpinnerComponent, SiRolDirective],
  selector: 'app-navbar',
  styleUrl: './navbar.css',
  templateUrl: './navbar.html',
})
export class Navbar {

//señal para que angual actualice la pantalla
  protected cerrandoSesion = signal(false);

  constructor(
    protected auth: Auth,
    private router: Router,
  ) {
  }

  async cerrarSesion() {
    this.cerrandoSesion.set(true);
    await this.auth.logout();
    this.cerrandoSesion.set(false);
    this.router.navigateByUrl('/');
  }
}
