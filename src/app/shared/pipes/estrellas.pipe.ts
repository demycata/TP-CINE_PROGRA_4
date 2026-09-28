import { Pipe, PipeTransform } from '@angular/core';

//convierte un número de 1 a 5 en estrellas llenas y vacías, ej: 3.6 => ★★★★☆ (redondea para que sirva también con promedios)
@Pipe({ name: 'estrellas' })
export class EstrellasPipe implements PipeTransform {
  transform(valor: number): string {
    const llenas = Math.round(valor);
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
  }
}
