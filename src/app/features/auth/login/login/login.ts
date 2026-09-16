import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../../core/auth/auth';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SpinnerComponent],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {

  constructor(private auth: Auth, private router: Router) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);

  formLogin = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  async onSubmit() {
    this.formLogin.markAllAsTouched();
    if (this.formLogin.invalid) return;

    this.enviado.set(true);
    this.error.set(null);

    const email = this.formLogin.value.email!.trim();
    const password = this.formLogin.value.password!.trim();

    const { error } = await this.auth.login(email, password);

    this.enviado.set(false);
    if (error) {
      this.error.set('Email o contraseña incorrectos.');
      return;
    }

    this.router.navigateByUrl('/');
  }
}
