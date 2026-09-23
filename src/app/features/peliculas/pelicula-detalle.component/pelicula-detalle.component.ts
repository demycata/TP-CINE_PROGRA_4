import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PeliculaService } from '../../../services/pelicula.service';
import { FuncionService } from '../../../services/funcion.service';
import { ResenaService } from '../../../services/resena.service';
import { Auth } from '../../../core/auth/auth';
import { ToastService } from '../../../shared/toast.service';
import { SpinnerComponent } from '../../../shared/spinner.component/spinner.component';
import { Pelicula } from '../../../models/pelicula.model';
import { FuncionConSala } from '../../../models/funcion.model';
import { Resena } from '../../../models/resena.model';

@Component({
  imports: [RouterLink, SpinnerComponent],
  selector: 'app-pelicula-detalle',
  styleUrl: './pelicula-detalle.component.css',
  templateUrl: './pelicula-detalle.component.html',
})
export class PeliculaDetalleComponent implements OnInit {
  protected pelicula = signal<Pelicula | null>(null);
  protected funciones = signal<FuncionConSala[]>([]);
  protected funcionSeleccionada = signal<FuncionConSala | null>(null);
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

  protected histograma = computed(() => {
    const lista = this.resenas();
    const total = lista.length;
    return [5, 4, 3, 2, 1].map((estrellas) => {
      const cantidad = lista.filter((r) => r.estrellas === estrellas).length;
      return { estrellas, pct: total ? Math.round((cantidad / total) * 100) : 0 };
    });
  });

  protected diaSeleccionado = signal<string | null>(null);

  protected dias = computed(() => [...new Set(this.funciones().map((f) => f.fecha))].sort());

  protected gruposSala = computed(() => {
    const dia = this.diaSeleccionado();
    const mapa = new Map<string, { sala: string; formato: string; idioma: string; funciones: FuncionConSala[] }>();

    for (const f of this.funciones()) {
      if (f.fecha !== dia) { continue; }
      const clave = `${f.salas?.nombre}|${f.formato}|${f.idioma}`;
      if (!mapa.has(clave)) {
        mapa.set(clave, { sala: f.salas?.nombre ?? '', formato: f.formato, idioma: f.idioma, funciones: [] });
      }
      mapa.get(clave)!.funciones.push(f);
    }

    return [...mapa.values()].map((grupo) => ({
      ...grupo,
      funciones: grupo.funciones.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
    }));
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
    this.funcionSeleccionada.set(funcion);
    this.router.navigate(['/peliculas', this.pelicula()!.id, 'funciones', this.funcionSeleccionada()!.id, 'butacas'])
  }

  seleccionarDia(dia: string) {
    this.diaSeleccionado.set(dia);
    this.funcionSeleccionada.set(null);
  }

  scrollAFunciones() {
    document.getElementById('funciones')?.scrollIntoView({ behavior: 'smooth' });
  }

  metaLine(peli: Pelicula): string {
    const horas = Math.floor(peli.duracion_minutos / 60);
    const minutos = peli.duracion_minutos % 60;
    const duracion = horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
    return [...(peli.generos ?? []), duracion].join(' · ');
  }

  estrenoTexto(fechaEstreno: string): string {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fecha = new Date(`${fechaEstreno}T00:00:00`);
    return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
  }

  diaSemana(fecha: string): string {
    const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    return dias[new Date(`${fecha}T00:00:00`).getDay()];
  }

  diaNumero(fecha: string): string {
    return String(new Date(`${fecha}T00:00:00`).getDate());
  }

  iniciales(nombre: string): string {
    return nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('');
  }

  precioVigente(funcion: FuncionConSala): number {
    return this.funcionService.precioVigente(funcion);
  }

  enPreventa(funcion: FuncionConSala): boolean {
    return this.funcionService.enPreventa(funcion);
  }

  irAButacas() {
  this.router.navigate(['/peliculas', this.pelicula()!.id, 'funciones', this.funcionSeleccionada()!.id, 'butacas']);
  }

  estrellasTexto(valor: number): string {
    const llenas = Math.round(valor);
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
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
