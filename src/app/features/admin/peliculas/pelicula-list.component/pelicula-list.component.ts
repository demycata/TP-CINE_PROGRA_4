import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculaService } from '../../../../services/pelicula.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';
import { FilaPelicula } from '../../../../models/pelicula.model';

@Component({
  imports: [RouterLink, SpinnerComponent],
  selector: 'app-pelicula-list',
  styleUrl: './pelicula-list.component.css',
  templateUrl: './pelicula-list.component.html',
})
export class PeliculaListComponent implements OnInit {
  constructor(private peliculaService: PeliculaService) {
  }

  peliculas = signal<FilaPelicula[]>([]);
  cargando = signal(true);

  async ngOnInit() {
    const { data } = await this.peliculaService.listar();
    this.peliculas.set(data ?? []);
    this.cargando.set(false);
  }

  async toggleActiva(pelicula: FilaPelicula) {
    const { error } = await this.peliculaService.cambiarActiva(pelicula.id, !pelicula.activa);

    //si no hay error, actualiza la lista de películas para reflejar el cambio en la propiedad "activa" de la película correspondiente
    if (!error) {
      this.peliculas.update((lista) => //recorre la lista de películas y reemplaza la película que se acaba de actualizar con la nueva versión que tiene el valor de "activa" cambiado
        lista.map((p) => (p.id === pelicula.id ? { ...p, activa: !p.activa } : p))
      );
    }
  }
}
