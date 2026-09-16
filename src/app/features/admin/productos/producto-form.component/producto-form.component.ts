import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductoService } from '../../../../services/producto.service';
import { CategoriaProductoService } from '../../../../services/categoria-producto.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SpinnerComponent],
  selector: 'app-producto-form',
  styleUrl: './producto-form.component.css',
  templateUrl: './producto-form.component.html',
})
export class ProductoFormComponent implements OnInit {
  constructor(
    private productoService: ProductoService,
    private categoriaService: CategoriaProductoService,
    private route: ActivatedRoute,
    private router: Router
  ) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);
  cargando = signal(true);
  categoriasDisponibles = signal<{ id: string; nombre: string }[]>([]);

  idProducto: string | null = null;

  formProducto = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    categoria_id: new FormControl(''),
    precio: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    imagen_url: new FormControl(''),
    activo: new FormControl(true, { nonNullable: true }),
  });

  async ngOnInit() {
    try {
      const { data: categorias } = await this.categoriaService.listar();
      this.categoriasDisponibles.set(categorias ?? []);

      this.idProducto = this.route.snapshot.paramMap.get('id');
      if (!this.idProducto) return;

      const { data: producto } = await this.productoService.obtenerPorId(this.idProducto);
      if (!producto) return;

      this.formProducto.patchValue({
        nombre: producto.nombre,
        categoria_id: producto.categoria_id ?? '',
        precio: producto.precio,
        imagen_url: producto.imagen_url ?? '',
        activo: producto.activo,
      });
    } finally {
      this.cargando.set(false);
    }
  }

  async onSubmit() {
    this.formProducto.markAllAsTouched();
    if (this.formProducto.invalid) return;

    this.enviado.set(true);
    this.error.set(null);

    const valores = this.formProducto.value;
    const datos = {
      nombre: valores.nombre!.trim(),
      categoria_id: valores.categoria_id || null,
      precio: Number(valores.precio),
      imagen_url: valores.imagen_url?.trim() || null,
      activo: valores.activo!,
    };

    const { error } = this.idProducto
      ? await this.productoService.actualizar(this.idProducto, datos)
      : await this.productoService.crear(datos);

    this.enviado.set(false);
    if (error) {
      this.error.set('No se pudo guardar el producto.');
      return;
    }
    this.router.navigateByUrl('/admin/productos');
  }
}
