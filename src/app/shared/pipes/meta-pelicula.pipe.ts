import { Pipe, PipeTransform } from '@angular/core';
import { Pelicula } from '../../models/pelicula.model';

//arma la línea de info de una película: géneros + duración, ej: "Acción · Drama · 2h 5m"
@Pipe({ name: 'metaPelicula' })
export class MetaPeliculaPipe implements PipeTransform {
  transform(peli: Pick<Pelicula, 'generos' | 'duracion_minutos'>): string {
    const horas = Math.floor(peli.duracion_minutos / 60);
    const minutos = peli.duracion_minutos % 60;
    const duracion = horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
    return [...(peli.generos ?? []), duracion].join(' · ');
  }
}
