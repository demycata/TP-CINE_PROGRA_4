import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalaService } from '../../../../services/sala.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';
import { FilaSala } from '../../../../models/sala.model';

const TIENE_ENTRADAS_VENDIDAS = '23503';

@Component({
  imports: [RouterLink, SpinnerComponent],
  selector: 'app-sala-list',
  styleUrl: './sala-list.component.css',
  templateUrl: './sala-list.component.html',
})
export class SalaListComponent implements OnInit {
  constructor(private salaService: SalaService) {
  }

  salas = signal<FilaSala[]>([]);
  error = signal<string | null>(null);
  cargando = signal(true);

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    const { data } = await this.salaService.listar();
    this.salas.set(data ?? []);
    this.cargando.set(false);
  }

  async eliminar(sala: FilaSala) {
    if (!confirm(`¿Eliminar la sala "${sala.nombre}"? Esto borra también sus butacas y sus funciones.`)) return;

    this.error.set(null);
    const { error } = await this.salaService.eliminar(sala.id);
    if (error) {
      this.error.set(
        error.code === TIENE_ENTRADAS_VENDIDAS
          ? 'No se puede borrar: hay entradas vendidas para funciones de esta sala.'
          : 'No se pudo borrar la sala.'
      );
      return;
    }
    await this.cargar();
  }
}
