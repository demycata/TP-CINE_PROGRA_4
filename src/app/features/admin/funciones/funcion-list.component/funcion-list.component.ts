import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FuncionService } from '../../../../services/funcion.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

interface FilaFuncion {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  formato: string;
  idioma: string;
  precio_base: number;
  precio_preventa: number | null;
  peliculas: { titulo: string } | null;
  salas: { nombre: string } | null;
}

@Component({
  imports: [RouterLink, SpinnerComponent],
  selector: 'app-funcion-list',
  styleUrl: './funcion-list.component.css',
  templateUrl: './funcion-list.component.html',
})
export class FuncionListComponent implements OnInit {
  constructor(private funcionService: FuncionService) {
  }

  funciones = signal<FilaFuncion[]>([]);
  cargando = signal(true);

  async ngOnInit() {
    const { data } = await this.funcionService.listar();
    this.funciones.set((data as unknown as FilaFuncion[]) ?? []);//setea la señal con la lista de funciones obtenida del servicio, o un array vacío si no hay datos
    this.cargando.set(false);
  }
}
