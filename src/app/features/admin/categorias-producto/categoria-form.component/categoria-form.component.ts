import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoriaProductoService } from '../../../../services/categoria-producto.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SpinnerComponent],
  selector: 'app-categoria-form',
  styleUrl: './categoria-form.component.css',
  templateUrl: './categoria-form.component.html',
})
export class CategoriaFormComponent {
  constructor(private categoriaService: CategoriaProductoService) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);

  formCategoria = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(3)]),
  });

  async onSubmit() {
    this.formCategoria.markAllAsTouched();
    if (this.formCategoria.invalid) return;

    this.enviado.set(true);
    this.error.set(null);

    const nombre = this.formCategoria.value.nombre!.trim();
    const { error } = await this.categoriaService.crear(nombre);

    this.enviado.set(false);
    if (error) {
      this.error.set('No se pudo crear la categoría. ¿Ya existe una con ese nombre?');
      return;
    }
    this.formCategoria.reset();
  }
}
