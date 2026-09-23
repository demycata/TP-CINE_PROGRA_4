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
    fechaNacimiento = signal<string | null>(null);
    creditosDisponibles = signal(0);
    listo: Promise<void>;

    constructor() {
        this.listo = this.supabase.client.auth.getSession().then(({ data }) => {
            this.session.set(data.session);
            return this.cargarRol();
        });

        this.supabase.client.auth.onAuthStateChange((_evento, session) => {//cuando cambia la sesion, se actualiza la señal de session y se carga el rol del usuario
            this.session.set(session);
            this.cargarRol();
        });
    }


    //carga el rol del usuario actual desde la base de datos (lo hace en el constructor, cada vez que cambia la sesion,
    //y se puede volver a llamar a mano para refrescar el crédito después de una compra o cancelación)
    async cargarRol() {
        const usuario = this.session()?.user;
        if (!usuario) {
            this.rol.set(null);
            this.fechaNacimiento.set(null);
            this.creditosDisponibles.set(0);
            return;
        }
        //verificar si el usuario tiene un rol en la base de datos
        const { data } = await this.supabase.client
            .from('profiles')
            .select('rol, fecha_nacimiento, creditos_disponibles')
            .eq('id', usuario.id)
            .single();
        //si tiene rol, guardarlo en la señal, si no, pone en null
        this.rol.set(data?.rol ?? null);
        this.fechaNacimiento.set(data?.fecha_nacimiento ?? null);
        this.creditosDisponibles.set(data?.creditos_disponibles ?? 0);
    }

    async login(email: string, password: string) {
        const resultado = await this.supabase.client.auth.signInWithPassword({ email, password });
        if (!resultado.error) {
            this.session.set(resultado.data.session);
            await this.cargarRol();
        }
        return resultado;
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
                    tipo_sangre: datos.tipo_sangre,
                    color_ojos: datos.color_ojos,
                    dias_vacaciones_anio: datos.dias_vacaciones_anio,
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
