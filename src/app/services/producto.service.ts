import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { ProductoInput } from '../models/producto.model';

@Service()
export class ProductoService {
    private supabase = inject(SupabaseService);

    listar() {
        return this.supabase.client
            .from('productos')
            .select('id, nombre, precio, activo, imagen_url, categorias_producto(nombre)')
            .order('nombre');
    }

    obtenerPorId(id: string) {
        return this.supabase.client.from('productos').select('*').eq('id', id).single();
    }

    crear(datos: ProductoInput) {
        return this.supabase.client.from('productos').insert(datos);
    }

    actualizar(id: string, datos: ProductoInput) {
        return this.supabase.client.from('productos').update(datos).eq('id', id);
    }
}
