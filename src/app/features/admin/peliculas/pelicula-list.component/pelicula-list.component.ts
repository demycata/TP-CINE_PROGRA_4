import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculaService } from '../../../../services/pelicula.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';


//usamos esta interface y no la de pelicula.service.ts porque no necesitamos todos los campos de la película, solo los que vamos a mostrar en la lista
interface FilaPelicula {
  id: string;
  titulo: string;
  duracion_minutos: number;
  activa: boolean;
  fecha_estreno: string | null;
}

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
