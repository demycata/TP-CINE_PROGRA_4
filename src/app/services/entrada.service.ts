import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Auth } from '../core/auth/auth';
import { EntradaComprada, OrdenValidada } from '../models/entrada.model';
import { hoyISO } from '../shared/fecha.utils';

const BUTACA_OCUPADA = '23505';//codigo de supabase para violacion de constraint de unicidad

@Service()
export class EntradaService {
    private supabase = inject(SupabaseService);
    private auth = inject(Auth);

    //se lee de la vista butacas_ocupadas y no de entradas: la RLS de entradas solo deja ver las propias (o anónimas), así que las
    //compradas por otros usuarios registrados aparecían libres. La vista solo expone funcion_id/butaca_id y ya excluye órdenes canceladas.
    listarButacasOcupadas(funcionId: string) {
        return this.supabase.client
            .from('butacas_ocupadas')
            .select('butaca_id')
            .eq('funcion_id', funcionId);
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


    //primero se lee la orden para poder explicar por qué se rechaza (no existe, cancelada, ya usada, otro día).
    //el update final vuelve a exigir estado_qr_entradas = 'valido': si dos empleados escanean el mismo QR a la vez,
    //solo a uno le devuelve la fila y al otro le sale "ya fue usado".
    async validarQr(codigo: string): Promise<{ data: OrdenValidada | null; error: { message: string } | null }> {
        const { data: orden } = await this.supabase.client
            .from('ordenes')
            .select(`
                id, estado, estado_qr_entradas,
                entradas (
                    butacas ( fila, columna, tipo_butaca ),
                    funciones ( fecha, hora_inicio, formato, idioma, salas ( nombre ), peliculas ( titulo ) )
                )
            `)
            .eq('qr_code', codigo)
            .maybeSingle();

        if (!orden) return { data: null, error: { message: 'El código no corresponde a ninguna compra.' } };
        if (orden.estado === 'cancelada') return { data: null, error: { message: 'La compra fue cancelada.' } };
        if (orden.estado_qr_entradas === 'usado') return { data: null, error: { message: 'Este QR ya fue usado.' } };

        const funcion: any = orden.entradas[0]?.funciones;
        if (orden.estado !== 'pagada' || orden.estado_qr_entradas !== 'valido' || !funcion) {
            return { data: null, error: { message: 'El QR no tiene entradas válidas.' } };
        }
        if (funcion.fecha !== hoyISO()) {
            return { data: null, error: { message: 'La función no es de hoy.' } };
        }

        const { data: actualizada } = await this.supabase.client
            .from('ordenes')
            .update({ estado_qr_entradas: 'usado' })
            .eq('id', orden.id)
            .eq('estado_qr_entradas', 'valido')
            .select('id')
            .maybeSingle();

        if (!actualizada) return { data: null, error: { message: 'Este QR ya fue usado.' } };

        return {
            data: {
                id: orden.id,
                funcion: {
                    fecha: funcion.fecha,
                    hora_inicio: funcion.hora_inicio,
                    formato: funcion.formato,
                    idioma: funcion.idioma,
                    sala: funcion.salas?.nombre ?? '',
                    pelicula: funcion.peliculas?.titulo ?? '',
                },
                butacas: orden.entradas.map((e: any) => e.butacas).filter(Boolean),
            },
            error: null,
        };
    }

    //el UNIQUE(funcion_id, butaca_id) de la tabla entradas sigue siendo el que de verdad evita que se venda dos veces la misma butaca:
    //si dos compras llegan al mismo tiempo, las dos pasan el chequeo de "está libre" en el front, pero solo una gana el insert.
    //el insert de varias entradas es una sola sentencia: si una butaca ya fue tomada, Postgres rechaza el insert completo (nada queda a medias).
    async comprar(funcionId: string, butacas: { butacaId: string; precio: number }[], creditoAUsar = 0): Promise<{ data: EntradaComprada | null; error: { message: string } | null }> {
        const usuarioId = this.auth.session()?.user.id ?? null; //compra anónima permitida => null
        const subtotal = butacas.reduce((suma, b) => suma + b.precio, 0);//sumamos el preico de tolas las butacas
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
            .insert(butacas.map((b) => ({ orden_id: orden.id, funcion_id: funcionId, butaca_id: b.butacaId, precio: b.precio })))//por cada butaca elegida, insertamos una fila en entradas con el id de la orden, el id de la función, el id de la butaca y el precio
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
