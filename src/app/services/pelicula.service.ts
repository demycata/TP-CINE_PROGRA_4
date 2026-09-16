import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';

export interface Pelicula {
    id?: string;  //generado automaticamente por supabase
    titulo: string;
    sinopsis?: string | null;
    duracion_minutos: number;
    imagen_url: string | null;
    restriccion_edad?: number | null;
    fecha_estreno: string | null;
    activa?: boolean; //baja logica, si esta activa o no la pelicula
    created_at?: string;    //generado por supa
    generos: string[];     
    entradas_vendidas?: number;
}

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
