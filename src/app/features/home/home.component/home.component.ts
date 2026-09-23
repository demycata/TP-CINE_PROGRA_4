import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { PeliculaService } from '../../../services/pelicula.service';
import { GeneroService } from '../../../services/genero.service';
import { AlertaService } from '../../../services/alerta.service';
import { ResenaService } from '../../../services/resena.service';
import { ToastService } from '../../../shared/toast.service';
import { Pelicula } from '../../../models/pelicula.model';
import { HoverScaleDirective } from '../../../shared/hover-scale.directive';
import { SpinnerComponent } from '../../../shared/spinner.component/spinner.component';

@Component({
  imports: [RouterLink, HoverScaleDirective, SpinnerComponent],
  selector: 'app-home',
  styleUrl: './home.component.css',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  protected masVistas = signal<Pelicula[]>([]);
  protected cartelera = signal<Pelicula[]>([]);
  protected proximamente = signal<Pelicula[]>([]);
  protected alertasActivas = signal<Set<string>>(new Set());
  protected ratings = signal<Map<string, string>>(new Map());
  protected generosDisponibles = signal<string[]>([]);
  protected cargando = signal(true);

  protected busqueda = signal('');
  protected generosSeleccionados = signal<string[]>([]);

  protected peliculasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const generos = this.generosSeleccionados();

    return this.cartelera().filter((peli) => {
      const coincideTitulo = !texto || peli.titulo.toLowerCase().includes(texto);
      const coincideGenero = generos.length === 0 || peli.generos?.some((g) => generos.includes(g));
      return coincideTitulo && coincideGenero;
    });
  });

  protected hasFiltros = computed(() => this.busqueda().trim().length > 0 || this.generosSeleccionados().length > 0);//indica si hay filtros aplicados (busqueda o generos seleccionados) 

  constructor(
    protected auth: Auth,
    private peliculasService: PeliculaService,
    private generoService: GeneroService,
    private alertaService: AlertaService,
    private resenaService: ResenaService,
    private toast: ToastService,
  ) {
  }

  async ngOnInit() {
    try {
      const [masVistas, cartelera, proximamente, generos] = await Promise.all([
        this.peliculasService.masVistas(),
        this.peliculasService.activas(),
        this.peliculasService.proximamente(),
        this.generoService.listar(),
      ]);

      if (masVistas.error) {console.error(masVistas.error);}
      else {this.masVistas.set(masVistas.data || []);}

      if (cartelera.error) {console.error(cartelera.error);}
      else {this.cartelera.set(cartelera.data || []);}

      if (proximamente.error) {console.error(proximamente.error);}
      else {this.proximamente.set(proximamente.data || []);}

      if (generos.error) {console.error(generos.error);}
      else {this.generosDisponibles.set((generos.data || []).map((g) => g.nombre));}


      //funciones para el proceso de ratings y alertas: se hace en paralelo con la carga de peliculas y generos, para no bloquear la UI
      const idsConPoster = [...(masVistas.data ?? []), ...(cartelera.data ?? []), ...(proximamente.data ?? [])];
      const ids = [...new Set(idsConPoster.map((p) => p.id!))];//filtra los ids de peliculas que tienen poster, para no hacer la query de ratings de peliculas que no se muestran
      this.ratings.set(await this.resenaService.promedios(ids));

      await this.auth.listo;
      const usuarioId = this.auth.session()?.user.id;
      //si hay usuario logueado, se traen sus alertas y se chequea si alguna de ellas ya tiene funciones a la venta, para mostrar un toast notificando
      if (usuarioId) {
        const [{ data: misAlertas }, disponibles] = await Promise.all([
          this.alertaService.misAlertas(usuarioId),
          this.alertaService.chequearDisponibles(usuarioId),
        ]);
        this.alertasActivas.set(new Set((misAlertas ?? []).map((a) => a.pelicula_id)));
        if (disponibles.length > 0) {
          this.toast.mostrar(`¡Ya podés comprar entradas para ${disponibles.join(', ')}!`);
        }
      }
    } finally {
      this.cargando.set(false);
    }
  }

  protected rating(peliculaId: string): string | undefined {
    return this.ratings().get(peliculaId);
  }

  protected tieneAlerta(peliculaId: string): boolean {
    return this.alertasActivas().has(peliculaId);
  }

  protected async avisarme(peliculaId: string) {
    const usuarioId = this.auth.session()?.user.id;
    if (!usuarioId) {
      this.toast.mostrar('Iniciá sesión para activar el aviso.');
      return;
    }

    const { error } = await this.alertaService.crear(usuarioId, peliculaId);
    if (error) {
      this.toast.mostrar('No se pudo activar el aviso.');
      return;
    }

    this.alertasActivas.update((actuales) => new Set(actuales).add(peliculaId));
    this.toast.mostrar('Listo, te vamos a avisar cuando esté disponible.');
  }

  protected estrenoTexto(fechaEstreno: string): string {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fecha = new Date(`${fechaEstreno}T00:00:00`);
    return `Estreno ${fecha.getDate()} ${meses[fecha.getMonth()]}`;
  }

  protected onBuscar(texto: string) {
    this.busqueda.set(texto);
  }

  protected toggleGenero(genero: string) {
    this.generosSeleccionados.update((actuales) =>
      actuales.includes(genero)
        ? actuales.filter((g) => g !== genero)
        : [...actuales, genero]
    );
  }

  protected limpiarFiltros() {
    this.busqueda.set('');
    this.generosSeleccionados.set([]);
  }

  protected metaLine(peli: Pelicula) {
    const horas = Math.floor(peli.duracion_minutos / 60);
    const minutos = peli.duracion_minutos % 60;
    const duracion = horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
    return [...(peli.generos ?? []), duracion].join(' · ');
  }
}
