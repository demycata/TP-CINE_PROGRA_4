import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { ButacaAInsertar } from '../models/butaca.model';

//antes esto lo hacía un trigger (generar_butacas_sala) en supabase, se pasó a TS para no depender de una función en la base
const FILAS_NORMALES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'N', 'O', 'P', 'Q']; //15 filas de 28 butacas (4+20+4)
const FILAS_VIP = ['R', 'S', 'T']; //últimas 3 filas, 28 butacas cada una pero tipo vip

@Service()
export class SalaService {
    private supabase = inject(SupabaseService);

    listar() {
        return this.supabase.client.from('salas').select('id, nombre').order('nombre');
    }

    //crea la sala y arma sus butacas en el mismo paso, porque el form solo pide el nombre
    async crear(nombre: string) {
        const { data: sala, error: errorSala } = await this.supabase.client.from('salas').insert({ nombre }).select('id').single();
        if (errorSala || !sala) return { error: errorSala };

        const { error: errorButacas } = await this.supabase.client.from('butacas').insert(this.generarButacas(sala.id));
        if (errorButacas) {
            //si fallaron las butacas no dejamos la sala a medio armar, sin butacas es inútil
            await this.eliminar(sala.id);
            return { error: errorButacas };
        }

        return { error: null };
    }

    eliminar(id: string) {
        return this.supabase.client.from('salas').delete().eq('id', id);
    }

    private generarButacas(salaId: string): ButacaAInsertar[] {
        const butacas: ButacaAInsertar[] = [];

        for (const fila of FILAS_NORMALES) {
            for (let columna = 1; columna <= 28; columna++) {
                butacas.push({ sala_id: salaId, fila, columna, tipo_butaca: 'normal' });
            }
        }

        //fila "J" reemplaza a J y K juntas: 2 + 10 + 2 = 14 butacas accesibles
        for (let columna = 1; columna <= 14; columna++) {
            butacas.push({ sala_id: salaId, fila: 'J', columna, tipo_butaca: 'accesible' });
        }

        for (const fila of FILAS_VIP) {
            for (let columna = 1; columna <= 28; columna++) {
                butacas.push({ sala_id: salaId, fila, columna, tipo_butaca: 'vip' });
            }
        }

        return butacas;
    }
}
