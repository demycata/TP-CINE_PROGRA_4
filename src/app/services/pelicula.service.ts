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

    activas() {
        return this.supabase.client
            .from('peliculas')
            .select('*')
            .eq('activa', true)
            .order('titulo');
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
