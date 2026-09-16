import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { Pelicula, PeliculaService } from '../../../services/pelicula.service';
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
  protected peliculas = signal<Pelicula[]>([]);
  protected cargando = signal(true);

  constructor(
    protected auth: Auth,
    private peliculasService: PeliculaService,
  ) {
  }

  async ngOnInit() {
    try {
      const [masVistas, peliculas] = await Promise.all([
        this.peliculasService.masVistas(),
        this.peliculasService.listar(),
      ]);

      if (masVistas.error) {console.error(masVistas.error);}
      else {this.masVistas.set(masVistas.data || []);}

      if (peliculas.error) {console.error(peliculas.error);}
      else {this.peliculas.set(peliculas.data || []);}
    } finally {
      this.cargando.set(false);
    }
  }
}
