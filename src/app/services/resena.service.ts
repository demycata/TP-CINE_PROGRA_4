import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Auth } from '../core/auth/auth';
import { Resena } from '../models/resena.model';

@Service()
export class ResenaService {
    private supabase = inject(SupabaseService);
    private auth = inject(Auth);

    //resenas.usuario_id no tiene FK a perfiles_publicos (es una vista, no una tabla), así que PostgREST no puede
    //embeber el autor en un solo select: se trae aparte y se combina acá. La vista existe para exponer nombre/apellido
    //públicamente sin abrir el resto de profiles (crédito, tipo de sangre, rol, etc.) que sí están protegidos por RLS.
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
        const { data: perfiles } = usuarioIds.length
            ? await this.supabase.client.from('perfiles_publicos').select('id, nombre, apellido').in('id', usuarioIds)
            : { data: [] as { id: string; nombre: string; apellido: string }[] };

        const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, `${p.nombre} ${p.apellido}`]));

        return {
            data: resenas.map((r) => ({ ...r, autor: nombrePorId.get(r.usuario_id) ?? 'Usuario' })),
            error: null,
        };
    }

    miResena(peliculaId: string) {
        const usuarioId = this.auth.session()?.user.id;
        if (!usuarioId) return Promise.resolve({ data: null, error: null });

        return this.supabase.client
            .from('resenas')
            .select('id, estrellas, comentario')
            .eq('pelicula_id', peliculaId)
            .eq('usuario_id', usuarioId)
            .maybeSingle();
    }

    async promedios(peliculaIds: string[]): Promise<Map<string, string>> {
        if (peliculaIds.length === 0) return new Map();

        const { data } = await this.supabase.client
            .from('resenas')
            .select('pelicula_id, estrellas')
            .in('pelicula_id', peliculaIds);

        const porPelicula = new Map<string, number[]>();
        for (const r of data ?? []) {
            porPelicula.set(r.pelicula_id, [...(porPelicula.get(r.pelicula_id) ?? []), r.estrellas]);
        }

        return new Map(
            [...porPelicula].map(([id, estrellas]) => [
                id,
                (estrellas.reduce((suma, e) => suma + e, 0) / estrellas.length).toFixed(1),
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
