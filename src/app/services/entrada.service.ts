import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Auth } from '../core/auth/auth';

const BUTACA_OCUPADA = '23505';//codigo de supabase para violacion de constraint de unicidad

export interface EntradaComprada {
    orden: { id: string; qr_code: string };
    entrada: { id: string; funcion_id: string; butaca_id: string; precio: number };
}

@Service()
export class EntradaService {
    private supabase = inject(SupabaseService);
    private auth = inject(Auth);

    listarButacasOcupadas(funcionId: string) {
        return this.supabase.client.from('entradas').select('butaca_id').eq('funcion_id', funcionId);
    }

    //antes esto era una función de supabase (comprar_entrada, RPC con security definer), se pasó a dos inserts en TS.
    //el UNIQUE(funcion_id, butaca_id) de la tabla entradas sigue siendo el que de verdad evita que se venda dos veces la misma butaca:
    //si dos compras llegan al mismo tiempo, las dos pasan el chequeo de "está libre" en el front, pero solo una gana el insert.
    async comprar(funcionId: string, butacaId: string, precio: number): Promise<{ data: EntradaComprada | null; error: { message: string } | null }> {
        const usuarioId = this.auth.session()?.user.id ?? null; //compra anónima permitida => null

        const { data: orden, error: errorOrden } = await this.supabase.client
            .from('ordenes')
            .insert({ usuario_id: usuarioId, estado: 'pagada', subtotal: precio, total: precio, qr_code: crypto.randomUUID(), estado_qr_entradas: 'valido' })
            .select('id, qr_code')
            .single();

        if (errorOrden || !orden) {
            return { data: null, error: { message: 'No se pudo generar la orden.' } };
        }

        const { data: entrada, error: errorEntrada } = await this.supabase.client
            .from('entradas')
            .insert({ orden_id: orden.id, funcion_id: funcionId, butaca_id: butacaId, precio })
            .select('id')
            .single();

        if (errorEntrada || !entrada) {
            //la orden queda "pagada" sin entrada asociada: no la borramos porque en compra anónima (usuario_id null) el RLS de ordenes
            //no deja borrar/cancelar (usuario_id = auth.uid() no matchea contra null), pero no es grave: es solo una fila huérfana,
            //nadie se queda sin butaca ni paga dos veces por la misma gracias al constraint de unicidad.
            if (errorEntrada?.code === BUTACA_OCUPADA) {
                return { data: null, error: { message: 'Alguien tomó esa butaca justo antes, elegí otra.' } };
            }
            return { data: null, error: { message: 'No se pudo generar la entrada.' } };
        }

        return {
            data: {
                orden: { id: orden.id, qr_code: orden.qr_code },
                entrada: { id: entrada.id, funcion_id: funcionId, butaca_id: butacaId, precio },
            },
            error: null,
        };
    }
}
