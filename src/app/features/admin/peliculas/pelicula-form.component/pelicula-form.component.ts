import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PeliculaService } from '../../../../services/pelicula.service';
import { GeneroService } from '../../../../services/genero.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SpinnerComponent],
  selector: 'app-pelicula-form',
  styleUrl: './pelicula-form.component.css',
  templateUrl: './pelicula-form.component.html',
})
export class PeliculaFormComponent implements OnInit {
  constructor(
    private peliculaService: PeliculaService,
    private generoService: GeneroService,
    private route: ActivatedRoute,
    private router: Router
  ) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);
  cargando = signal(true);
  generosDisponibles = signal<{ id: string; nombre: string }[]>([]);

  idPelicula: string | null = null;

  formPelicula = new FormGroup({
    titulo: new FormControl('', [Validators.required, Validators.minLength(2)]),
    sinopsis: new FormControl(''),
    duracion_minutos: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    imagen_url: new FormControl(''),
    restriccion_edad: new FormControl(''),
    fecha_estreno: new FormControl(''),
    generos: new FormControl<string[]>([]),
  });

  async ngOnInit() {
    try {
      const { data: generos } = await this.generoService.listar();
      this.generosDisponibles.set(generos ?? []);

      this.idPelicula = this.route.snapshot.paramMap.get('id');
      if (!this.idPelicula) return;

      const { data: pelicula } = await this.peliculaService.obtenerPorId(this.idPelicula);
      if (!pelicula) return;

      this.formPelicula.patchValue({
        titulo: pelicula.titulo,
        sinopsis: pelicula.sinopsis ?? '',
        duracion_minutos: pelicula.duracion_minutos,
        imagen_url: pelicula.imagen_url ?? '',
        restriccion_edad: pelicula.restriccion_edad ? String(pelicula.restriccion_edad) : '',
        fecha_estreno: pelicula.fecha_estreno ?? '',
        generos: pelicula.generos ?? [],
      });
    } finally {
      this.cargando.set(false);
    }
  }

  async onSubmit() {
    this.formPelicula.markAllAsTouched();
    if (this.formPelicula.invalid) return;

    this.enviado.set(true);
    this.error.set(null);

    const valores = this.formPelicula.value;
    const datos = {
      titulo: valores.titulo!.trim(),
      sinopsis: valores.sinopsis?.trim() || null,
      duracion_minutos: Number(valores.duracion_minutos),
      imagen_url: valores.imagen_url?.trim() || null,
      restriccion_edad: valores.restriccion_edad ? Number(valores.restriccion_edad) : null,
      fecha_estreno: valores.fecha_estreno || null,
      generos: valores.generos ?? [],
    };

    const { error } = this.idPelicula
      ? await this.peliculaService.actualizar(this.idPelicula, datos)
      : await this.peliculaService.crear(datos);

    this.enviado.set(false);
    if (error) {
      this.error.set('No se pudo guardar la película.');
      return;
    }
    this.router.navigateByUrl('/admin/peliculas');
  }
}
