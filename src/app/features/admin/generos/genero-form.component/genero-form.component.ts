import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GeneroService } from '../../../../services/genero.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SpinnerComponent],
  selector: 'app-genero-form',
  styleUrl: './genero-form.component.css',
  templateUrl: './genero-form.component.html',
})
export class GeneroFormComponent {
  constructor(private generoService: GeneroService) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);

  formGenero = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(3)]),
  });

  async onSubmit() {
    this.formGenero.markAllAsTouched();
    if (this.formGenero.invalid) return;

    this.enviado.set(true);
    this.error.set(null);

    const nombre = this.formGenero.value.nombre!.trim();
    const { error } = await this.generoService.crear(nombre);

    this.enviado.set(false);
    if (error) {
      this.error.set('No se pudo crear el género. ¿Ya existe uno con ese nombre?');
      return;
    }
    this.formGenero.reset();
  }
}
