import { Service, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../core/supabase/supabase.service';

const EVENTO_COMPRA = 'compradas';

//usa Supabase Realtime en modo Broadcast: los clientes se mandan mensajes entre sí por un canal, sin pasar por ninguna tabla.
//no se usa postgres_changes sobre entradas porque respeta la RLS, y la RLS de entradas no deja ver las compras de otros usuarios registrados.
@Service()
export class ButacaRealtimeService {
    private supabase = inject(SupabaseService);
    private canal: RealtimeChannel | null = null;

    //se suscribe al canal de la función (uno por función, así solo escuchan los que están mirando esa misma función)
    //y cada vez que otro cliente avisa que compró, llama a alComprar con los ids de las butacas compradas
    escuchar(funcionId: string, alComprar: (butacaIds: string[]) => void) {
        this.salir();
        this.canal = this.supabase.client
            .channel(`funcion-${funcionId}`)
            .on('broadcast', { event: EVENTO_COMPRA }, ({ payload }) => alComprar(payload.butacaIds))
            .subscribe();
    }

    //se llama después de una compra exitosa para avisarle al resto de los clientes que esas butacas ya no están libres
    //(por defecto Broadcast no le devuelve el mensaje a quien lo mandó, así que el comprador no se lo recibe a sí mismo)
    notificarCompra(butacaIds: string[]) {
        return this.canal?.send({ type: 'broadcast', event: EVENTO_COMPRA, payload: { butacaIds } });
    }

    //cierra el canal al salir de la pantalla para no dejar conexiones abiertas escuchando una función que ya no se está viendo
    salir() {
        if (this.canal) {
            this.supabase.client.removeChannel(this.canal);
            this.canal = null;
        }
    }
}
