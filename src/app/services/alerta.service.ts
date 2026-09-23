import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';

@Service()
export class AlertaService {
    private supabase = inject(SupabaseService);

    misAlertas(usuarioId: string) {
        return this.supabase.client
            .from('alertas_disponibilidad')
            .select('pelicula_id')
            .eq('usuario_id', usuarioId);
    }

    crear(usuarioId: string, peliculaId: string) {
        return this.supabase.client
            .from('alertas_disponibilidad')
            .insert({ usuario_id: usuarioId, pelicula_id: peliculaId });
    }

    //no hay infraestructura de push/email en el proyecto: esto se llama al entrar al home logueado y devuelve
    //los títulos de las alertas cuya película ya tiene alguna función a la venta, marcándolas como notificadas.
    async chequearDisponibles(usuarioId: string): Promise<string[]> {
        const { data: alertas } = await this.supabase.client
            .from('alertas_disponibilidad')
            .select('id, pelicula_id, peliculas(titulo)')
            .eq('usuario_id', usuarioId)
            .eq('notificado', false);

        if (!alertas || alertas.length === 0) return [];

        const hoy = new Date().toISOString().slice(0, 10);
        const { data: funciones } = await this.supabase.client
            .from('funciones')
            .select('pelicula_id')
            .in('pelicula_id', alertas.map((a) => a.pelicula_id))
            .gte('fecha', hoy);

        const peliculasConFuncion = new Set((funciones ?? []).map((f) => f.pelicula_id));
        const disponibles = alertas.filter((a) => peliculasConFuncion.has(a.pelicula_id));
        if (disponibles.length === 0) return [];

        await this.supabase.client
            .from('alertas_disponibilidad')
            .update({ notificado: true })
            .in('id', disponibles.map((d) => d.id));

        return disponibles.map((d) => (d.peliculas as unknown as { titulo: string } | null)?.titulo ?? 'una película');
    }
}
