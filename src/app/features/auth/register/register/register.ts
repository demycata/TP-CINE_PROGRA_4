import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../../core/auth/auth';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SpinnerComponent],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html',
})
export class Register {

  constructor(private auth: Auth, private router: Router) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);

  formRegistro = new FormGroup({
    nombre: new FormControl('', [Validators.required]),
    apellido: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    fecha_nacimiento: new FormControl('', [Validators.required]),
    tipo_sangre: new FormControl('', [Validators.required]),
    color_ojos: new FormControl('', [Validators.required]),
    dias_vacaciones_anio: new FormControl(0, [Validators.required, Validators.min(0)]),
  });

  async onSubmit() {
    this.formRegistro.markAllAsTouched();
    if (this.formRegistro.invalid) return;

    this.enviado.set(true);
    this.error.set(null);

    const valores = this.formRegistro.value;

    const { error } = await this.auth.registrar(
      valores.email!.trim(),
      valores.password!.trim(),
      {
        nombre: valores.nombre!.trim(),
        apellido: valores.apellido!.trim(),
        fecha_nacimiento: valores.fecha_nacimiento!,
        tipo_sangre: valores.tipo_sangre!,
        color_ojos: valores.color_ojos!,
        dias_vacaciones_anio: Number(valores.dias_vacaciones_anio),
      }
    );

    this.enviado.set(false);
    if (error) {
      this.error.set('No se pudo completar el registro. Probá con otro email.');
      return;
    }

    this.router.navigateByUrl('/');
  }
}
