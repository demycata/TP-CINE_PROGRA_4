import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Pelicula, PeliculaService } from '../../../services/pelicula.service';
import { FuncionConSala, FuncionService } from '../../../services/funcion.service';
import { SpinnerComponent } from '../../../shared/spinner.component/spinner.component';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private peliculaService: PeliculaService,
    private funcionService: FuncionService,
  ) {
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;

    try {
      const [{ data: pelicula }, { data: funciones }] = await Promise.all([
        this.peliculaService.obtenerPorId(id),
        this.funcionService.listarPorPelicula(id),
      ]);
      this.pelicula.set(pelicula);
      this.funciones.set((funciones as unknown as FuncionConSala[]) ?? []);
    } finally {
      this.cargando.set(false);
    }
  }

  seleccionarFuncion(funcion: FuncionConSala) {
    this.funcionSeleccionada.set(funcion);
  }

  irAButacas() {
  this.router.navigate(['/peliculas', this.pelicula()!.id, 'funciones', this.funcionSeleccionada()!.id, 'butacas']);
  }
}
