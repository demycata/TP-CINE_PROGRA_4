import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';

@Service()
export class GeneroService {
    private supabase = inject(SupabaseService);

    listar() {
        return this.supabase.client.from('generos').select('id, nombre').order('nombre');
    }

    crear(nombre: string) {
        return this.supabase.client.from('generos').insert({ nombre });
    }
}
