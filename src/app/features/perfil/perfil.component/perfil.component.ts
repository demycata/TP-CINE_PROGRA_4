import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { EntradaService } from '../../../services/entrada.service';
import { ResenaService } from '../../../services/resena.service';
import { ToastService } from '../../../shared/toast.service';
import { SpinnerComponent } from '../../../shared/spinner.component/spinner.component';
import { OrdenMisEntradas } from '../../../models/entrada.model';

const LIMITE_CANCELACION_HORAS = 2;

interface PeliculaVista {
  id: string;
  titulo: string;
  imagen_url: string | null;
  fecha: string;
  calificacion: number | null;
}

@Component({
  imports: [RouterLink, SpinnerComponent],
  selector: 'app-perfil',
  styleUrl: './perfil.component.css',
  templateUrl: './perfil.component.html',
})
export class PerfilComponent implements OnInit {
  protected ordenes = signal<OrdenMisEntradas[]>([]);
  protected calificaciones = signal<Map<string, number>>(new Map());
  protected cargando = signal(true);
  protected cancelando = signal<string | null>(null);

  protected creditoDisponible = computed(() => this.auth.creditosDisponibles());

  protected peliculasVistas = computed<PeliculaVista[]>(() => {
    const vistas = new Map<string, PeliculaVista>();
    const ahora = Date.now();

    for (const orden of this.ordenes()) {
      if (orden.estado === 'cancelada') continue;

      for (const entrada of orden.entradas) {
        const funcion = entrada.funciones;
        const pelicula = funcion?.peliculas;
        if (!funcion || !pelicula) continue;

        const inicioFuncion = new Date(`${funcion.fecha}T${funcion.hora_inicio}`);
        if (inicioFuncion.getTime() > ahora) continue; //todavía no pasó, no cuenta como "vista"

        const existente = vistas.get(pelicula.id);
        if (!existente || funcion.fecha > existente.fecha) {
          vistas.set(pelicula.id, {
            id: pelicula.id,
            titulo: pelicula.titulo,
            imagen_url: pelicula.imagen_url,
            fecha: funcion.fecha,
            calificacion: this.calificaciones().get(pelicula.id) ?? null,
          });
        }
      }
    }

    return [...vistas.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  constructor(
    private auth: Auth,
    private entradaService: EntradaService,
    private resenaService: ResenaService,
    private toast: ToastService,
  ) {
  }

  async ngOnInit() {
    await this.auth.listo;
    await this.cargarOrdenes();
  }

  private async cargarOrdenes() {
    const usuarioId = this.auth.session()?.user.id;
    if (!usuarioId) {
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    const [{ data: ordenes }, { data: resenas }] = await Promise.all([
      this.entradaService.misEntradas(usuarioId),
      this.resenaService.misResenas(usuarioId),
    ]);
    this.ordenes.set((ordenes as unknown as OrdenMisEntradas[] | null)?.filter((o) => o.entradas.length > 0) ?? []);
    this.calificaciones.set(new Map((resenas ?? []).map((r) => [r.pelicula_id, r.estrellas])));
    this.cargando.set(false);
  }

  butacasTexto(orden: OrdenMisEntradas): string {
    return orden.entradas
      .map((e) => e.butacas ? `${e.butacas.fila}${e.butacas.columna}` : '-')
      .join(', ');
  }

  estrellasTexto(valor: number): string {
    return '★'.repeat(valor) + '☆'.repeat(5 - valor);
  }

  puedeCancelar(orden: OrdenMisEntradas): boolean {
    if (orden.estado !== 'pagada') return false;
    const funcion = orden.entradas[0]?.funciones;
    if (!funcion) return false;

    const inicioFuncion = new Date(`${funcion.fecha}T${funcion.hora_inicio}`);
    const horasRestantes = (inicioFuncion.getTime() - Date.now()) / (1000 * 60 * 60);
    return horasRestantes > LIMITE_CANCELACION_HORAS;
  }

  async cancelar(orden: OrdenMisEntradas) {
    const confirmado = confirm('¿Cancelar esta entrada? No hay reintegro, se acredita el total como crédito en tu cuenta.');
    if (!confirmado) return;

    this.cancelando.set(orden.id);
    const { error } = await this.entradaService.cancelar(orden.id);
    this.cancelando.set(null);

    if (error) {
      this.toast.mostrar(error.message);
      return;
    }

    this.toast.mostrar(`Entrada cancelada. Se acreditaron $${orden.total} de crédito en tu cuenta.`);
    await this.auth.cargarRol();
    await this.cargarOrdenes();
  }
}
