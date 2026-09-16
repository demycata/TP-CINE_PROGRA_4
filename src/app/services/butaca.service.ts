import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';

@Service()
export class ButacaService {
    private supabase = inject(SupabaseService);

    listarPorSala(salaId: string) {
        return this.supabase.client
            .from('butacas')
            .select('id, fila, columna, tipo_butaca')
            .eq('sala_id', salaId)
            .order('fila')
            .order('columna');
    }
}
