import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FuncionService } from '../../../../services/funcion.service';
import { PeliculaService } from '../../../../services/pelicula.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';
import { PeliculaOpcion } from '../../../../models/pelicula.model';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SpinnerComponent],
  selector: 'app-funcion-form',
  styleUrl: './funcion-form.component.css',
  templateUrl: './funcion-form.component.html',
})
export class FuncionFormComponent implements OnInit {
  constructor(
    private funcionService: FuncionService,
    private peliculaService: PeliculaService,
    private route: ActivatedRoute,
    private router: Router
  ) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);
  cargando = signal(true);
  peliculasDisponibles = signal<PeliculaOpcion[]>([]);

  idFuncion: string | null = null;

  formFuncion = new FormGroup({
    pelicula_id: new FormControl('', Validators.required),
    fecha: new FormControl('', Validators.required,),
    hora_inicio: new FormControl('', Validators.required),
    formato: new FormControl<'2D' | '3D' | '4D' | '5D'>('2D', Validators.required), //lo que esta entre <> es el tipo de dato que va a tener el formControl
    idioma: new FormControl<'castellano' | 'subtitulada'>('castellano', Validators.required),
    precio_base: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    precio_preventa: new FormControl<number | null>(null),
    fecha_fin_preventa: new FormControl(''),
  });

  async ngOnInit() {
    try {
      const { data: activas } = await this.peliculaService.activas();
      const peliculas = activas ?? [];

      this.idFuncion = this.route.snapshot.paramMap.get('id');
      if (!this.idFuncion) {
        this.peliculasDisponibles.set(peliculas);
        return;
      }

      const { data: funcion } = await this.funcionService.obtenerPorId(this.idFuncion);
      if (!funcion) {
        this.peliculasDisponibles.set(peliculas);
        return;
      }

      //verifica si la película de la función que se está editando está en la lista de películas activas. Si no, la agrega a la lista para que pueda ser seleccionada en el formulario.
      if (funcion.pelicula_id && !peliculas.some((p) => p.id === funcion.pelicula_id)) {
        const { data: peliculaActual } = await this.peliculaService.obtenerPorId(funcion.pelicula_id);
        if (peliculaActual) peliculas.push(peliculaActual);
      }
      this.peliculasDisponibles.set(peliculas);


      //remplaza los valores del form con los de la función que se está editando. Si la función no tiene fecha_fin_preventa, se establece como una cadena vacía para que el formulario no muestre "null" o "undefined".
      this.formFuncion.patchValue({
        pelicula_id: funcion.pelicula_id,
        fecha: funcion.fecha,
        hora_inicio: funcion.hora_inicio,
        formato: funcion.formato,
        idioma: funcion.idioma,
        precio_base: funcion.precio_base,
        precio_preventa: funcion.precio_preventa,
        fecha_fin_preventa: funcion.fecha_fin_preventa ?? '',
      });
    } finally {
      this.cargando.set(false);
    }
  }

  async onSubmit() {
    this.formFuncion.markAllAsTouched();
    if (this.formFuncion.invalid) return;

    this.enviado.set(true);
    this.error.set(null);

    const valores = this.formFuncion.value;
    const precio_preventa = valores.precio_preventa != null ? Number(valores.precio_preventa) : null;//si el precio de preventa es null, lo dejamos como null. Si no, lo convertimos a número.

    const datos = {
      pelicula_id: valores.pelicula_id!,
      fecha: valores.fecha!,
      hora_inicio: valores.hora_inicio!,
      formato: valores.formato!,
      idioma: valores.idioma!,
      precio_base: Number(valores.precio_base),
      precio_preventa,
      // La fecha de cierre de preventa solo tiene sentido si hay precio de preventa.
      fecha_fin_preventa: precio_preventa != null ? valores.fecha_fin_preventa || null : null,
    };

    const { error } = this.idFuncion //si hay un idFuncion, edita. Si es null, crea una funcion nueva
      ? await this.funcionService.actualizar(this.idFuncion, datos)
      : await this.funcionService.crear(datos);

    this.enviado.set(false);
    if (error) {
      this.error.set(error.message ?? 'No se pudo guardar la función.');
      return;
    }
    this.router.navigateByUrl('/admin/funciones');
  }
}
