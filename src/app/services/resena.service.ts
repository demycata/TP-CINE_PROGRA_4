import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Auth } from '../core/auth/auth';
import { Resena } from '../models/resena.model';

@Service()
export class ResenaService {
    private supabase = inject(SupabaseService);
    private auth = inject(Auth);

    //traemos solamente el nombre y apellido del autor, no el email ni otros datos sensibles
    async listarPorPelicula(peliculaId: string): Promise<{ data: Resena[] | null; error: { message: string } | null }> {
        const { data: resenas, error } = await this.supabase.client
            .from('resenas')
            .select('id, estrellas, comentario, fecha, usuario_id')
            .eq('pelicula_id', peliculaId)
            .order('fecha', { ascending: false });

        if (error || !resenas) {
            return { data: null, error: { message: 'No se pudieron cargar las reseñas.' } };
        }

        const usuarioIds = [...new Set(resenas.map((r) => r.usuario_id))];
        const { data: perfiles } = usuarioIds.length//si esta no esta vacio ejecuta la query, sino devuelve un array vacio para no hacer la query
            ? await this.supabase.client.from('perfiles_publicos').select('id, nombre, apellido').in('id', usuarioIds)
            : { data: [] as { id: string; nombre: string; apellido: string }[] };

        const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, `${p.nombre} ${p.apellido}`]));//crea un mapa de id de usuario a nombre completo para poder mostrarlo en la reseña

        return {
            data: resenas.map((r) => ({ ...r, autor: nombrePorId.get(r.usuario_id) ?? 'Usuario' })),//devuelve las reseñas con el nombre del autor, si no se encuentra el nombre devuelve 'Usuario'
            error: null,
        };
    }

    miResena(peliculaId: string) {
        const usuarioId = this.auth.session()?.user.id;
        if (!usuarioId) return Promise.resolve({ data: null, error: null });//si no hay usuario logueado no tiene sentido hacer la query, devolvemos null en todo

        return this.supabase.client
            .from('resenas')
            .select('id, estrellas, comentario')
            .eq('pelicula_id', peliculaId)
            .eq('usuario_id', usuarioId)
            .maybeSingle();
    }

    async promedios(peliculaIds: string[]): Promise<Map<string, string>> {//devuelve una promesa con un Map que relaciona cada película con su promedio
        if (peliculaIds.length === 0) return new Map(); //si no hay peliculas no tiene sentido hacer la query, devolvemos un mapa vacio

        const { data } = await this.supabase.client
            .from('resenas')
            .select('pelicula_id, estrellas')
            .in('pelicula_id', peliculaIds);

        const porPelicula = new Map<string, number[]>(); //crea un mapa vacio, cada clave será un ID de película y cada valor será un array de puntuaciones
        for (const r of data ?? []) {//Busca las estrellas que ya estaban guardadas para esa película
            porPelicula.set(r.pelicula_id, [...(porPelicula.get(r.pelicula_id) ?? []), r.estrellas]);//Si todavía no hay ninguna, usa un array vacío. Luego agrega la nueva puntuación y actualiza el mapa.
        }

        return new Map(
            [...porPelicula].map(([id, estrellas]) => [//construye un par [id, promedio] para el Map.
                id,
                (estrellas.reduce((suma, e) => suma + e, 0) / estrellas.length).toFixed(1),//calcula el promedio de estrellas y lo redondea a 1 decimal
            ])
        );
    }

    misResenas(usuarioId: string) {
        return this.supabase.client
            .from('resenas')
            .select('pelicula_id, estrellas')
            .eq('usuario_id', usuarioId);
    }

    guardar(peliculaId: string, estrellas: number, comentario: string | null) {
        const usuarioId = this.auth.session()!.user.id;
        return this.supabase.client
            .from('resenas')
            .upsert(
                { usuario_id: usuarioId, pelicula_id: peliculaId, estrellas, comentario },
                { onConflict: 'usuario_id,pelicula_id' }
            )
            .select('id, estrellas, comentario')
            .single();
    }
}
