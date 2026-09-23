import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Auth } from '../core/auth/auth';
import { EntradaComprada } from '../models/entrada.model';

const BUTACA_OCUPADA = '23505';//codigo de supabase para violacion de constraint de unicidad

@Service()
export class EntradaService {
    private supabase = inject(SupabaseService);
    private auth = inject(Auth);

    //la orden!inner filtra las entradas cuya orden está cancelada: al cancelar no se borra la fila de entradas (no hay policy de DELETE),
    //simplemente deja de contar como ocupada y la butaca vuelve a estar disponible para la venta.
    listarButacasOcupadas(funcionId: string) {
        return this.supabase.client
            .from('entradas')
            .select('butaca_id, ordenes!inner(estado)')
            .eq('funcion_id', funcionId)
            .neq('ordenes.estado', 'cancelada');
    }

    misEntradas(usuarioId: string) {
        return this.supabase.client
            .from('ordenes')
            .select(`
                id, estado, total, fecha,
                entradas (
                    id, precio,
                    butacas ( fila, columna, tipo_butaca ),
                    funciones ( id, fecha, hora_inicio, formato, idioma, salas ( nombre ), peliculas ( id, titulo, imagen_url ) )
                )
            `)
            .eq('usuario_id', usuarioId)
            .order('fecha', { ascending: false });
    }

    //cancelación con crédito: no hay reintegro real, se acredita el total en profiles.creditos_disponibles.
    //se lee el crédito actual y se suma (no hay RPC de incremento) porque el proyecto evita meter lógica de negocio en la base.
    async cancelar(ordenId: string): Promise<{ error: { message: string } | null }> {
        const usuarioId = this.auth.session()?.user.id;
        if (!usuarioId) return { error: { message: 'Necesitás iniciar sesión.' } };

        const { data: orden, error: errorOrden } = await this.supabase.client
            .from('ordenes')
            .update({ estado: 'cancelada' })
            .eq('id', ordenId)
            .eq('usuario_id', usuarioId)
            .eq('estado', 'pagada')
            .select('total')
            .single();

        if (errorOrden || !orden) {
            return { error: { message: 'No se pudo cancelar la entrada.' } };
        }

        const { data: perfil } = await this.supabase.client
            .from('profiles')
            .select('creditos_disponibles')
            .eq('id', usuarioId)
            .single();

        const { error: errorCredito } = await this.supabase.client
            .from('profiles')
            .update({ creditos_disponibles: (perfil?.creditos_disponibles ?? 0) + orden.total })
            .eq('id', usuarioId);

        if (errorCredito) {
            return { error: { message: 'Se canceló la entrada pero no se pudo acreditar el crédito. Contactá a soporte.' } };
        }

        return { error: null };
    }


    //el UNIQUE(funcion_id, butaca_id) de la tabla entradas sigue siendo el que de verdad evita que se venda dos veces la misma butaca:
    //si dos compras llegan al mismo tiempo, las dos pasan el chequeo de "está libre" en el front, pero solo una gana el insert.
    //el insert de varias entradas es una sola sentencia: si una butaca ya fue tomada, Postgres rechaza el insert completo (nada queda a medias).
    async comprar(funcionId: string, butacas: { butacaId: string; precio: number }[], creditoAUsar = 0): Promise<{ data: EntradaComprada | null; error: { message: string } | null }> {
        const usuarioId = this.auth.session()?.user.id ?? null; //compra anónima permitida => null
        const subtotal = butacas.reduce((suma, b) => suma + b.precio, 0);
        const credito = usuarioId ? Math.min(Math.max(creditoAUsar, 0), subtotal) : 0; //el crédito es solo para usuarios registrados
        const total = subtotal - credito;

        const { data: orden, error: errorOrden } = await this.supabase.client
            .from('ordenes')
            .insert({ usuario_id: usuarioId, estado: 'pagada', subtotal, credito_usado: credito, total, qr_code: crypto.randomUUID(), estado_qr_entradas: 'valido' })
            .select('id, qr_code, total, credito_usado')
            .single();

        if (errorOrden || !orden) {
            return { data: null, error: { message: 'No se pudo generar la orden.' } };
        }

        const { data: entradas, error: errorEntradas } = await this.supabase.client
            .from('entradas')
            .insert(butacas.map((b) => ({ orden_id: orden.id, funcion_id: funcionId, butaca_id: b.butacaId, precio: b.precio })))
            .select('id, butaca_id, precio');

        if (errorEntradas || !entradas) {
            //la orden queda "pagada" sin entradas asociadas: no la borramos porque en compra anónima (usuario_id null) el RLS de ordenes
            //no deja borrar/cancelar (usuario_id = auth.uid() no matchea contra null), pero no es grave: es solo una fila huérfana,
            //nadie se queda sin butaca ni paga dos veces por la misma gracias al constraint de unicidad.
            if (errorEntradas?.code === BUTACA_OCUPADA) {
                return { data: null, error: { message: 'Alguien tomó una de esas butacas justo antes, revisá tu selección.' } };
            }
            return { data: null, error: { message: 'No se pudo generar la entrada.' } };
        }

        //recién acá se descuenta el crédito: si el insert de entradas falló arriba, no se llega a este punto y no se pierde crédito.
        if (credito > 0 && usuarioId) {
            const { data: perfil } = await this.supabase.client
                .from('profiles')
                .select('creditos_disponibles')
                .eq('id', usuarioId)
                .single();

            await this.supabase.client
                .from('profiles')
                .update({ creditos_disponibles: (perfil?.creditos_disponibles ?? 0) - credito })
                .eq('id', usuarioId);
        }

        return {
            data: {
                orden: { id: orden.id, qr_code: orden.qr_code, total: orden.total, credito_usado: orden.credito_usado },
                entradas: entradas.map((e) => ({ id: e.id, funcion_id: funcionId, butaca_id: e.butaca_id, precio: e.precio })),
            },
            error: null,
        };
    }
}
