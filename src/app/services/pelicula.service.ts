import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Pelicula } from '../models/pelicula.model';

@Service()
export class PeliculaService {
    private supabase = inject(SupabaseService);

    listar() {
        return this.supabase.client
            .from('peliculas')
            .select('*')
            .order('titulo');
    }

    //excluye las que todavía no se estrenaron (esas van en "Próximamente", no en la cartelera comprable)
    activas() {
        const hoy = new Date().toISOString().slice(0, 10);
        return this.supabase.client
            .from('peliculas')
            .select('*')
            .eq('activa', true)
            .or(`fecha_estreno.is.null,fecha_estreno.lte.${hoy}`)
            .order('titulo');
    }

    proximamente() {
        const hoy = new Date().toISOString().slice(0, 10);
        return this.supabase.client
            .from('peliculas')
            .select('*')
            .eq('activa', true)
            .not('fecha_estreno', 'is', null)
            .gt('fecha_estreno', hoy)
            .order('fecha_estreno');
    }

    masVistas() {
        return this.supabase.client
            .from('peliculas_mas_vendidas')
            .select('*')
            .order('entradas_vendidas', { ascending: false })
            .limit(3);
    }

    obtenerPorId(id: string) {
        return this.supabase.client.from('peliculas').select('*').eq('id', id).single(); //Single trae uno solo
    }

    crear(datos: Pelicula) {
        return this.supabase.client.from('peliculas').insert(datos);
    }

    actualizar(id: string, datos: Pelicula) {
        return this.supabase.client.from('peliculas').update(datos).eq('id', id);
    }

    cambiarActiva(id: string, activa: boolean) {
        return this.supabase.client.from('peliculas').update({ activa }).eq('id', id);
    }
}
