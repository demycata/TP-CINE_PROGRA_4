import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Pelicula, PeliculaService } from '../../../services/pelicula.service';
import { FuncionConSala, FuncionService } from '../../../services/funcion.service';
import { Butaca, ButacaService } from '../../../services/butaca.service';
import { EntradaService } from '../../../services/entrada.service';
import { SpinnerComponent } from '../../../shared/spinner.component/spinner.component';

const FILAS_NORMALES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'N', 'O', 'P', 'Q'];
const FILAS_VIP = ['R', 'S', 'T'];
const ORDEN_FILAS = [...FILAS_NORMALES.slice(0, 9), 'J', ...FILAS_NORMALES.slice(9), ...FILAS_VIP];

interface FilaButacas {
  fila: string;
  izquierda: Butaca[];
  centro: Butaca[];
  derecha: Butaca[];
}

@Component({
  imports: [RouterLink, SpinnerComponent],
  selector: 'app-butaca-seleccion',
  styleUrl: './butaca-seleccion.component.css',
  templateUrl: './butaca-seleccion.component.html',
})
export class ButacaSeleccionComponent implements OnInit {
  protected pelicula = signal<Pelicula | null>(null);
  protected funcion = signal<FuncionConSala | null>(null);
  protected filas = signal<FilaButacas[]>([]);
  protected ocupadas = signal<Set<string>>(new Set());
  protected butacaSeleccionada = signal<Butaca | null>(null);
  protected generandoPdf = signal(false);
  protected cargando = signal(true);
  protected error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private peliculaService: PeliculaService,
    private funcionService: FuncionService,
    private butacaService: ButacaService,
    private entradaService: EntradaService,
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

      const [{ data: butacas }, { data: ocupadas }] = await Promise.all([
        this.butacaService.listarPorSala(funcion.sala_id),
        this.entradaService.listarButacasOcupadas(funcionId),
      ]);

      this.ocupadas.set(new Set((ocupadas ?? []).map((e) => e.butaca_id)));
      this.filas.set(this.agruparPorFila(butacas ?? []));
    } finally {
      this.cargando.set(false);
    }
  }

  private agruparPorFila(butacas: Butaca[]): FilaButacas[] {
    const porFila = new Map<string, Butaca[]>();
    for (const butaca of butacas) {
      const lista = porFila.get(butaca.fila) ?? [];
      lista.push(butaca);
      porFila.set(butaca.fila, lista);
    }

    return ORDEN_FILAS.filter((fila) => porFila.has(fila)).map((fila) => {
      const ordenadas = [...porFila.get(fila)!].sort((a, b) => a.columna - b.columna);
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
    if (this.ocupadas().has(butaca.id)) return;
    this.butacaSeleccionada.set(butaca);
    this.error.set(null);
  }

  async comprar() {
    const peli = this.pelicula();
    const funcion = this.funcion();
    const butaca = this.butacaSeleccionada();
    if (!peli || !funcion || !butaca) return;

    this.generandoPdf.set(true);
    this.error.set(null);

    const { data, error } = await this.entradaService.comprar(funcion.id, butaca.id, funcion.precio_base);
    if (error || !data) {
      this.error.set(error?.message ?? 'No se pudo generar la entrada.');
      this.generandoPdf.set(false);
      if (error?.message.includes('tomó esa butaca')) {
        this.ocupadas.update((set) => new Set(set).add(butaca.id));
        this.butacaSeleccionada.set(null);
      }
      return;
    }

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
      `Butaca: ${butaca.fila}${butaca.columna} (${butaca.tipo_butaca})`,
      `Precio: $${funcion.precio_base}`,
    ];
    lineas.forEach((linea, i) => doc.text(linea, 20, 50 + i * 8));

    doc.addImage(qrDataUrl, 'PNG', 20, 98, 50, 50);
    doc.setFontSize(9);
    doc.text(data.orden.qr_code, 20, 154);

    doc.save(`entrada-${peli.titulo}-${funcion.fecha}.pdf`);
    this.generandoPdf.set(false);
    this.router.navigateByUrl('/');
  }
}
