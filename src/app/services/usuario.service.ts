import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Rol } from '../models/usuario.model';

@Service()
export class UsuarioService {
    private supabase = inject(SupabaseService);


    //se maneja por la tabla profiles, que es la que tiene los datos de los usuarios. 
    listar() {
        return this.supabase.client
            .from('profiles')
            .select('id, nombre, apellido, rol')
            .order('apellido');
    }

    cambiarRol(id: string, rol: Rol) {
        return this.supabase.client.from('profiles').update({ rol }).eq('id', id);
    }
}
