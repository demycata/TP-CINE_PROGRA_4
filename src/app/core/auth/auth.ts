import { Service, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { Rol } from '../../models/usuario.model';
import { DatosRegistro } from '../../models/auth.model';

@Service()
export class Auth {
    private supabase = inject(SupabaseService);

    session = signal<Session | null>(null);
    rol = signal<Rol | null>(null);
    listo: Promise<void>;

    constructor() {
        this.listo = this.supabase.client.auth.getSession().then(({ data }) => {
            this.session.set(data.session);
            return this.cargarRol();
        });

        this.supabase.client.auth.onAuthStateChange((_evento, session) => {
            this.session.set(session);
            this.cargarRol();
        });
    }


    //carga el rol del usuario actual desde la base de datos (lo hace en el constructor y cada vez que cambia la sesion)
    private async cargarRol() {
        const usuario = this.session()?.user;
        if (!usuario) {
            this.rol.set(null);
            return;
        }
        //verificar si el usuario tiene un rol en la base de datos
        const { data } = await this.supabase.client
            .from('profiles')
            .select('rol')
            .eq('id', usuario.id)
            .single();
        //si tiene rol, guardarlo en la señal, si no, pone en null
        this.rol.set(data?.rol ?? null);
    }

    login(email: string, password: string) {
        return this.supabase.client.auth.signInWithPassword({ email, password });
    }

    async registrar(email: string, password: string, datos: DatosRegistro) {
        const { data, error } = await this.supabase.client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nombre: datos.nombre,
                    apellido: datos.apellido,
                    fecha_nacimiento: datos.fecha_nacimiento,
                },
            },
        });

        if (error) return { error };
        if (!data.user) return { error: null };

        return { error: null };
    }

    logout() {
        return this.supabase.client.auth.signOut();
    }
}
