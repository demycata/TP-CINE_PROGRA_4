import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, SlicePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PeliculaService } from '../../../services/pelicula.service';
import { FuncionService } from '../../../services/funcion.service';
import { ButacaService } from '../../../services/butaca.service';
import { EntradaService } from '../../../services/entrada.service';
import { ButacaRealtimeService } from '../../../services/butaca-realtime.service';
import { Auth } from '../../../core/auth/auth';
import { ToastService } from '../../../shared/toast.service';
import { SpinnerComponent } from '../../../shared/spinner.component/spinner.component';
import { Pelicula } from '../../../models/pelicula.model';
import { FuncionConSala } from '../../../models/funcion.model';
import { Butaca, FilaButacas, FILAS_NORMALES, FILAS_VIP } from '../../../models/butaca.model';

const ORDEN_FILAS = [...FILAS_NORMALES.slice(0, 9), 'J', ...FILAS_NORMALES.slice(9), ...FILAS_VIP];
const MAX_BUTACAS_POR_COMPRA = 8;

@Component({
  imports: [RouterLink, SpinnerComponent, CurrencyPipe, DatePipe, SlicePipe],
  selector: 'app-butaca-seleccion',
  styleUrl: './butaca-seleccion.component.css',
  templateUrl: './butaca-seleccion.component.html',
})
export class ButacaSeleccionComponent implements OnInit, OnDestroy {
  protected pelicula = signal<Pelicula | null>(null);
  protected funcion = signal<FuncionConSala | null>(null);
  protected filas = signal<FilaButacas[]>([]);
  protected ocupadas = signal<Set<string>>(new Set());//crea una colección de valores únicos
  protected butacasSeleccionadas = signal<Butaca[]>([]);
  protected generandoPdf = signal(false);
  protected cargando = signal(true);
  protected error = signal<string | null>(null);
  protected edadInsuficiente = signal(false);

  protected creditoAUsar = signal(0);

  protected total = computed(() => {
    const funcion = this.funcion();
    if (!funcion) return 0;
    return this.butacasSeleccionadas().reduce((suma, b) => suma + this.precioButaca(b, funcion), 0);//suma el precio de todas las butacas seleccionadas
  });

  protected creditoDisponible = computed(() => this.auth.session() ? this.auth.creditosDisponibles() : 0);
  protected maxCredito = computed(() => Math.min(this.creditoDisponible(), this.total()));
  protected creditoAplicado = computed(() => Math.min(this.creditoAUsar(), this.maxCredito()));
  protected totalFinal = computed(() => this.total() - this.creditoAplicado());

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private peliculaService: PeliculaService,
    private funcionService: FuncionService,
    private butacaService: ButacaService,
    private entradaService: EntradaService,
    private butacaRealtime: ButacaRealtimeService,
    private auth: Auth,
    private toast: ToastService,
  ) {
  }

  async ngOnInit() {
    try {
      const peliculaId = this.route.snapshot.paramMap.get('peliculaId')!;
      const funcionId = this.route.snapshot.paramMap.get('funcionId')!;

      const [{ data: pelicula }, { data: funcion }] = await Promise.all([
        this.peliculaService.obtenerPorId(peliculaId),
        this.funcionService.obtenerConSala(funcionId),
      ]);
      this.pelicula.set(pelicula ?? null);
      this.funcion.set((funcion as unknown as FuncionConSala) ?? null);
      if (!funcion) return;

      await this.auth.listo;
      await this.verificarRestriccionEdad(pelicula ?? null);

      const [{ data: butacas }, { data: ocupadas }] = await Promise.all([
        this.butacaService.listarPorSala(funcion.sala_id),
        this.entradaService.listarButacasOcupadas(funcionId),
      ]);

      this.ocupadas.set(new Set((ocupadas ?? []).map((e) => e.butaca_id)));//crea un conjunto de butacas ocupadas a partir de los datos obtenidos
      this.filas.set(this.agruparPorFila(butacas ?? []));

      this.butacaRealtime.escuchar(funcionId, (butacaIds) => this.marcarCompradasPorOtro(butacaIds));//a partir de acá, si otro cliente compra butacas de esta función, se marcan como ocupadas sin recargar
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    this.butacaRealtime.salir();//al irse de la pantalla deja de escuchar el canal de la función
  }

  //se ejecuta cuando llega el aviso de compra de otro cliente por el canal de Realtime
  private marcarCompradasPorOtro(butacaIds: string[]) {
    this.ocupadas.update((actuales) => new Set([...actuales, ...butacaIds]));//suma las butacas recién compradas al conjunto de ocupadas, así el mapa las pinta en rojo al instante

    const seleccionadas = this.butacasSeleccionadas();
    const perdidas = seleccionadas.filter((b) => butacaIds.includes(b.id));//butacas que yo tenía elegidas y que otro compró primero
    if (perdidas.length === 0) return;

    this.butacasSeleccionadas.set(seleccionadas.filter((b) => !butacaIds.includes(b.id)));//las saca de mi selección para que no intente comprarlas
    this.toast.mostrar(`Otra persona compró ${perdidas.map((b) => `${b.fila}${b.columna}`).join(', ')}. Se quitaron de tu selección.`);
  }

  private async verificarRestriccionEdad(pelicula: Pelicula | null) {
    const edadMinima = pelicula?.restriccion_edad;
    if (!edadMinima) return;

    if (!this.auth.session()) {
      this.toast.mostrar(`Esta función es +${edadMinima}. Debe ir acompañado de un adulto.`);
      return;
    }

    const fechaNacimiento = this.auth.fechaNacimiento();
    if (fechaNacimiento && this.calcularEdad(fechaNacimiento) < edadMinima) {
      this.edadInsuficiente.set(true);
      this.error.set(`Esta película es apta para mayores de ${edadMinima} años. No podés comprar esta entrada.`);
    }
  }
//funcion auxiliar para calcular la edad a partir de la fecha de nacimiento
  private calcularEdad(fechaNacimiento: string): number {
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const noCumplioAnioAun =
      hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
    if (noCumplioAnioAun) edad--;
    return edad;
  }

  private agruparPorFila(butacas: Butaca[]): FilaButacas[] {//organiza las butacas para poder mostrarlas correctamente en el mapa del cine
    const porFila = new Map<string, Butaca[]>();//Crea un Map donde:la clave es el nombre de la fila, por ejemplo "A"; el valor es un array de butacas de esa fila.
    for (const butaca of butacas) {
      const lista = porFila.get(butaca.fila) ?? [];//obtiene la lista de butacas de la fila actual, o un array vacío si no existe
      lista.push(butaca);
      porFila.set(butaca.fila, lista);
    }

    return ORDEN_FILAS.filter((fila) => porFila.has(fila)).map((fila) => {//filtra las filas que existen en el Map y las ordena según ORDEN_FILAS
      const ordenadas = [...porFila.get(fila)!].sort((a, b) => a.columna - b.columna);//ordena las butacas de la fila por número de columna
      const borde = fila === 'J' ? 2 : 4;
      return {
        fila,
        izquierda: ordenadas.slice(0, borde),
        centro: ordenadas.slice(borde, ordenadas.length - borde),
        derecha: ordenadas.slice(ordenadas.length - borde),
      };
    });
  }

  seleccionarButaca(butaca: Butaca) {
    if (this.ocupadas().has(butaca.id) || this.edadInsuficiente()) return;

    const actuales = this.butacasSeleccionadas();
    if (actuales.some((b) => b.id === butaca.id)) {//si la butaca ya estaba seleccionada, la deselecciona
      this.butacasSeleccionadas.set(actuales.filter((b) => b.id !== butaca.id));
      this.error.set(null);
      return;
    }

    if (actuales.length >= MAX_BUTACAS_POR_COMPRA) {
      this.error.set(`Podés elegir hasta ${MAX_BUTACAS_POR_COMPRA} butacas por compra.`);
      return;
    }

    this.butacasSeleccionadas.set([...actuales, butaca]);//si la butaca no estaba seleccionada, la agrega a la lista de seleccionadas
    this.error.set(null);
  }

  estaSeleccionada(butaca: Butaca): boolean {
    return this.butacasSeleccionadas().some((b) => b.id === butaca.id);
  }

  precioButaca(butaca: Butaca, funcion: FuncionConSala): number {
    return butaca.tipo_butaca === 'vip' ? funcion.precio_vip : this.funcionService.precioVigente(funcion);
  }

  enPreventa(funcion: FuncionConSala): boolean {
    return this.funcionService.enPreventa(funcion);
  }

  onCreditoInput(valor: string) {
    const numero = Number(valor);
    this.creditoAUsar.set(Number.isFinite(numero) ? Math.max(0, numero) : 0);
  }

  usarTodoElCredito() {
    this.creditoAUsar.set(this.maxCredito());
  }

  async comprar() {
    const peli = this.pelicula();
    const funcion = this.funcion();
    const butacas = this.butacasSeleccionadas();
    if (!peli || !funcion || butacas.length === 0 || this.edadInsuficiente()) return;

    this.generandoPdf.set(true);
    this.error.set(null);

    const { data, error } = await this.entradaService.comprar(
      funcion.id,
      butacas.map((b) => ({ butacaId: b.id, precio: this.precioButaca(b, funcion) })),
      this.creditoAplicado()
    );
    if (error || !data) {
      this.error.set(error?.message ?? 'No se pudo generar la entrada.');
      this.generandoPdf.set(false);
      if (error?.message.includes('tomó una de esas butacas')) {//si la compra falló porque otra persona compró una de las butacas seleccionadas, actualiza la lista de butacas ocupadas y deselecciona las que ya no están disponibles
        const { data: ocupadasActuales } = await this.entradaService.listarButacasOcupadas(funcion.id);
        const idsOcupados = new Set((ocupadasActuales ?? []).map((e) => e.butaca_id));
        this.ocupadas.set(idsOcupados);
        this.butacasSeleccionadas.update((actuales) => actuales.filter((b) => !idsOcupados.has(b.id)));
      }
      return;
    }

    await this.butacaRealtime.notificarCompra(butacas.map((b) => b.id));//avisa por el canal de Realtime a los demás clientes que están viendo esta función que estas butacas ya se vendieron

    const [{ jsPDF }, { default: QRCode }] = await Promise.all([import('jspdf'), import('qrcode')]);
    const qrDataUrl = await QRCode.toDataURL(data.orden.qr_code);

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('TP Cine — Entrada', 20, 20);

    doc.setFontSize(14);
    doc.text(peli.titulo, 20, 35);

    doc.setFontSize(11);
    const lineas = [
      `Función: ${funcion.fecha} ${funcion.hora_inicio.slice(0, 5)}`,
      `Sala: ${funcion.salas?.nombre ?? '-'}`,
      `Formato: ${funcion.formato} · ${funcion.idioma}`,
      `Butacas: ${butacas.map((b) => `${b.fila}${b.columna}${b.tipo_butaca === 'vip' ? ' (VIP)' : ''}`).join(', ')}`,
      `Subtotal: $${this.total()}`,
      ...(data.orden.credito_usado > 0 ? [`Crédito aplicado: -$${data.orden.credito_usado}`] : []),
      `Total pagado: $${data.orden.total}`,
    ];
    lineas.forEach((linea, i) => doc.text(linea, 20, 50 + i * 8));

    doc.addImage(qrDataUrl, 'PNG', 20, 50 + lineas.length * 8 + 10, 50, 50);
    doc.setFontSize(9);
    doc.text(data.orden.qr_code, 20, 50 + lineas.length * 8 + 66);

    doc.save(`entrada-${peli.titulo}-${funcion.fecha}.pdf`);
    this.generandoPdf.set(false);
    if (data.orden.credito_usado > 0) await this.auth.cargarRol(); //refresca el crédito disponible después de gastarlo
    this.router.navigateByUrl('/');
  }
}
