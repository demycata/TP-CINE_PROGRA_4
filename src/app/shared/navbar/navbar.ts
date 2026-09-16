import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { SpinnerComponent } from '../spinner.component/spinner.component';

@Component({
  imports: [RouterLink, SpinnerComponent],
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
