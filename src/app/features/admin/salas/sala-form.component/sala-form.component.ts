import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SalaService } from '../../../../services/sala.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SpinnerComponent],
  selector: 'app-sala-form',
  styleUrl: './sala-form.component.css',
  templateUrl: './sala-form.component.html',
})
export class SalaFormComponent {
  constructor(private salaService: SalaService) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);

  formSala = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
  });

  async onSubmit() {
    this.formSala.markAllAsTouched();
    if (this.formSala.invalid) return;

    this.enviado.set(true);
    this.error.set(null);

    const nombre = this.formSala.value.nombre!.trim();
    const { error } = await this.salaService.crear(nombre);

    this.enviado.set(false);
    if (error) {
      this.error.set('No se pudo crear la sala. ¿Ya existe una con ese nombre?');
      return;
    }
    this.formSala.reset();
  }
}
