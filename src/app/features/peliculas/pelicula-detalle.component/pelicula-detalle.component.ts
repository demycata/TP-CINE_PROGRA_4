import { Component, OnInit, computed, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PeliculaService } from '../../../services/pelicula.service';
import { FuncionService } from '../../../services/funcion.service';
import { ResenaService } from '../../../services/resena.service';
import { Auth } from '../../../core/auth/auth';
import { ToastService } from '../../../shared/toast.service';
import { SpinnerComponent } from '../../../shared/spinner.component/spinner.component';
import { EstrellasPipe } from '../../../shared/pipes/estrellas.pipe';
import { MetaPeliculaPipe } from '../../../shared/pipes/meta-pelicula.pipe';
import { Pelicula } from '../../../models/pelicula.model';
import { FuncionConSala } from '../../../models/funcion.model';
import { Resena } from '../../../models/resena.model';

@Component({
  imports: [RouterLink, SpinnerComponent, CurrencyPipe, DatePipe, DecimalPipe, SlicePipe, EstrellasPipe, MetaPeliculaPipe],
  selector: 'app-pelicula-detalle',
  styleUrl: './pelicula-detalle.component.css',
  templateUrl: './pelicula-detalle.component.html',
})
export class PeliculaDetalleComponent implements OnInit {
  protected pelicula = signal<Pelicula | null>(null);
  protected funciones = signal<FuncionConSala[]>([]);
  protected cargando = signal(true);

  protected resenas = signal<Resena[]>([]);
  protected miResenaId = signal<string | null>(null);
  protected estrellasElegidas = signal(0);
  protected comentario = signal('');
  protected guardandoResena = signal(false);
  protected errorResena = signal<string | null>(null);

  protected promedio = computed(() => {
    const lista = this.resenas();
    return lista.length ? lista.reduce((suma, r) => suma + r.estrellas, 0) / lista.length : 0;
  });

  protected diaSeleccionado = signal<string | null>(null);

  protected dias = computed(() => [...new Set(this.funciones().map((f) => f.fecha))].sort());//devuelve un array con los dias de las funciones, sin repetir y ordenados 


  //funcion para el front: agrupa las funciones del dia seleccionado por sala, formato e idioma.
  //es un computed y no un pipe porque depende de dos signals (funciones y diaSeleccionado) y arma la estructura que recorre el @for, no formatea un valor.
  //no hace falta ordenar por hora: listarPorPelicula ya las trae ordenadas por fecha y hora_inicio, y el Map respeta el orden en que se van agregando.
  protected gruposSala = computed(() => {
    const delDia = this.funciones().filter((f) => f.fecha === this.diaSeleccionado());//primero se queda solo con las funciones del dia elegido
    const grupos = new Map<string, { sala: string; formato: string; idioma: string; funciones: FuncionConSala[] }>();//clave "sala|formato|idioma" => grupo con sus funciones

    for (const f of delDia) {
      const clave = `${f.salas?.nombre}|${f.formato}|${f.idioma}`;
      if (!grupos.has(clave)) grupos.set(clave, { sala: f.salas?.nombre ?? '', formato: f.formato, idioma: f.idioma, funciones: [] });//si es la primera funcion de ese grupo, lo crea vacio
      grupos.get(clave)!.funciones.push(f);//agrega la funcion a su grupo
    }

    return [...grupos.values()];//convierte el Map en array para poder recorrerlo con @for en el template
  });

  protected formatosDisponibles = computed(() => [...new Set(this.funciones().map((f) => f.formato))]);
  protected idiomasDisponibles = computed(() => [...new Set(this.funciones().map((f) => f.idioma))]);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private peliculaService: PeliculaService,
    private funcionService: FuncionService,
    private resenaService: ResenaService,
    protected auth: Auth,
    private toast: ToastService,
  ) {
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;

    try {
      await this.auth.listo;

      const [{ data: pelicula }, { data: funciones }, { data: resenas }] = await Promise.all([
        this.peliculaService.obtenerPorId(id),
        this.funcionService.listarPorPelicula(id),
        this.resenaService.listarPorPelicula(id),
      ]);
      this.pelicula.set(pelicula);
      this.funciones.set((funciones as unknown as FuncionConSala[]) ?? []);
      this.resenas.set(resenas ?? []);
      this.diaSeleccionado.set(this.dias()[0] ?? null);

      if (this.auth.session()) {
        const { data: mia } = await this.resenaService.miResena(id);
        if (mia) {
          this.miResenaId.set(mia.id);
          this.estrellasElegidas.set(mia.estrellas);
          this.comentario.set(mia.comentario ?? '');
        }
      }
    } finally {
      this.cargando.set(false);
    }
  }

  seleccionarFuncion(funcion: FuncionConSala) {
    this.router.navigate(['/peliculas', this.pelicula()!.id, 'funciones', funcion.id, 'butacas']);
  }

  seleccionarDia(dia: string) {
    this.diaSeleccionado.set(dia);
  }

  scrollAFunciones() {
    document.getElementById('funciones')?.scrollIntoView({ behavior: 'smooth' });
  }





  precioVigente(funcion: FuncionConSala): number {
    return this.funcionService.precioVigente(funcion);
  }

  enPreventa(funcion: FuncionConSala): boolean {
    return this.funcionService.enPreventa(funcion);
  }




  seleccionarEstrellas(n: number) {
    this.estrellasElegidas.set(n);
    this.errorResena.set(null);
  }

  onComentarioInput(valor: string) {
    this.comentario.set(valor);
  }

  async guardarResena() {
    if (this.estrellasElegidas() === 0) {
      this.errorResena.set('Elegí una calificación de 1 a 5 estrellas.');
      return;
    }

    this.guardandoResena.set(true);
    this.errorResena.set(null);

    const { data, error } = await this.resenaService.guardar(
      this.pelicula()!.id!,
      this.estrellasElegidas(),
      this.comentario().trim() || null
    );
    this.guardandoResena.set(false);

    if (error || !data) {
      this.errorResena.set('No se pudo guardar tu reseña.');
      return;
    }

    this.miResenaId.set(data.id);
    const { data: resenas } = await this.resenaService.listarPorPelicula(this.pelicula()!.id!);
    this.resenas.set(resenas ?? []);
    this.toast.mostrar('¡Gracias por tu reseña!');
  }
}
