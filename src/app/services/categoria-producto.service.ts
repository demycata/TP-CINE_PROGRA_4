import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';

@Service()
export class CategoriaProductoService {
    private supabase = inject(SupabaseService);

    listar() {
        return this.supabase.client.from('categorias_producto').select('id, nombre').order('nombre');
    }

    crear(nombre: string) {
        return this.supabase.client.from('categorias_producto').insert({ nombre });
    }
}
