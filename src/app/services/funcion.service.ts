import { Service, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { SalaService } from './sala.service';
import { PeliculaService } from './pelicula.service';
import { FuncionConSala, FuncionInput } from '../models/funcion.model';

const SIN_SALA_LIBRE = '23P01'; //codigo de error que devuelve supabase cuando no hay salas libres
const BUFFER_MINUTOS = 30; //el tiempo que tiene que haber entre funciones

@Service()
export class FuncionService {
    private supabase = inject(SupabaseService);
    private salaService = inject(SalaService);
    private peliculaService = inject(PeliculaService);

    listar() {
        return this.supabase.client.from('funciones').select('*, peliculas(titulo), salas(nombre)').order('fecha', { ascending: false }).order('hora_inicio', { ascending: false });
    }

    obtenerPorId(id: string) {//es para el crud de funciones, no para mostrar en la pagina de inicio
        return this.supabase.client.from('funciones').select('*').eq('id', id).single();
    }
    //se usa para mostrar las funciones de una película en la página de inicio, devuelve la función con el nombre de la sala
    obtenerConSala(id: string) {
        return this.supabase.client
            .from('funciones')
            .select('id, sala_id, fecha, hora_inicio, hora_fin, formato, idioma, precio_base, precio_vip, precio_preventa, fecha_fin_preventa, salas(nombre)')
            .eq('id', id)
            .single();
    }
                                            //Es el principal
    listarPorPelicula(peliculaId: string) { //Este se usa para mostrar las funciones de una película en la página de inicio
        const hoy = new Date().toISOString().slice(0, 10);
        return this.supabase.client
            .from('funciones')
            .select('id, sala_id, fecha, hora_inicio, hora_fin, formato, idioma, precio_base, precio_vip, precio_preventa, fecha_fin_preventa, salas(nombre)')
            .eq('pelicula_id', peliculaId)
            .gte('fecha', hoy)
            .order('fecha')
            .order('hora_inicio');
    }

    //true si hoy todavía está dentro de la ventana de preventa configurada para esa función
    enPreventa(funcion: Pick<FuncionConSala, 'precio_preventa' | 'fecha_fin_preventa'>): boolean {
        const hoy = new Date().toISOString().slice(0, 10);
        return funcion.precio_preventa != null && !!funcion.fecha_fin_preventa && hoy <= funcion.fecha_fin_preventa;
    }
    //si esta en preventa devuelve el precio de preventa, sino el precio base. Se usa para mostrar el precio en la página de inicio y en la página de detalle de película
    precioVigente(funcion: Pick<FuncionConSala, 'precio_base' | 'precio_preventa' | 'fecha_fin_preventa'>): number {
        return this.enPreventa(funcion) ? funcion.precio_preventa! : funcion.precio_base;
    }

    crear(datos: FuncionInput) {//resive la primera interfaz y supa la completa con id, sala_id y hora_fin
        return this.guardar(datos, null);
    }

    actualizar(id: string, datos: FuncionInput) {
        return this.guardar(datos, id);
    }

    private async guardar(datos: FuncionInput, idExcluido: string | null) {
        // 1. Traer la película elegida para obtener duracion_minutos.
        const respPelicula = await this.peliculaService.obtenerPorId(datos.pelicula_id);
        if (respPelicula.error || !respPelicula.data) {
            return { error: { message: 'No se pudo obtener la película elegida.' } };
        }
        const pelicula = respPelicula.data;

        // 2. Calcular hora_fin = hora_inicio + duracion_minutos.
        const minutosInicio = this.aMinutos(datos.hora_inicio);
        const minutosFin = minutosInicio + pelicula.duracion_minutos;

        // 3. Validación: rechazar si cruza medianoche.
        if (minutosFin > 24 * 60) {
            return {
                error: {
                    message: 'La función terminaría después de la medianoche, elegí un horario más temprano.',
                },
            };
        }
        const hora_fin = this.aHora(minutosFin);

        // 4. Traer todas las salas.
        const respSalas = await this.salaService.listar();
        if (respSalas.error) return { error: respSalas.error };
        const salas = respSalas.data;
        if (!salas || salas.length === 0) {
            return { error: { message: 'No hay salas cargadas todavía.' } };
        }

        // 5. Traer todas las funciones existentes con esa misma fecha.
        const respFunciones = await this.supabase.client
            .from('funciones')
            .select('id, sala_id, hora_inicio, hora_fin')
            .eq('fecha', datos.fecha);
        if (respFunciones.error) return { error: respFunciones.error };
        const funcionesDelDia = respFunciones.data;

        // 6-7. Elegir la primera sala sin solapamiento.
        const nuevoInicio = minutosInicio;
        const nuevoFinConBuffer = minutosFin + BUFFER_MINUTOS; //le sumamos los 30 minutos

        const salaLibre = salas.find((sala) => { //devuelve la primera sala cuyo callback retorne true
            const ocupada = (funcionesDelDia ?? []).some((funcion) => { //devuelve true si hay una función que se solapa
                if (funcion.sala_id !== sala.id) return false;//si la función es de otra sala, no importa
                if (idExcluido && funcion.id === idExcluido) return false; //si es la función que estamos editando, no importa

                //pasamos a minutos para poder comparar y le sumamos el buffer
                const existenteInicio = this.aMinutos(funcion.hora_inicio);
                const existenteFinConBuffer = this.aMinutos(funcion.hora_fin) + BUFFER_MINUTOS;
                //comprueba si la nueva función empieza antes de que termine la existente y si la existente empieza antes de que termine la nueva
                return nuevoInicio < existenteFinConBuffer && existenteInicio < nuevoFinConBuffer;
            });
            return !ocupada; //si la sala no está ocupada, la devolvemos
        });

        if (!salaLibre) {
            return { error: { message: 'No hay salas disponibles en ese horario.' } };
        }

        // 8. Insertar/actualizar con la sala elegida.     Guardamos la hora sin buffer, porque el buffer es regla de negocio y no la hora real.
        const payload = { ...datos, sala_id: salaLibre.id, hora_fin };

        const { error } = idExcluido //si hay un idExcluido, edita. Si es null, crea una funcion nueva
            ? await this.supabase.client.from('funciones').update(payload).eq('id', idExcluido)//devuelve true si se actualizó, false si no se encontró la función
            : await this.supabase.client.from('funciones').insert(payload);//si es falso, crea la funcion

        if (error) {
            if (error.code === SIN_SALA_LIBRE) {
                return { error: { message: 'Alguien tomó esa sala justo antes, probá de nuevo.' } };
            }
            return { error };
        }

        return { error: null };
    }


    //funciones auxiliares para convertir entre hora y minutos
    private aMinutos(hora: string): number {
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m;
    }

    private aHora(totalMinutos: number): string {
        const hh = String(Math.floor(totalMinutos / 60)).padStart(2, '0');
        const mm = String(totalMinutos % 60).padStart(2, '0');
        return `${hh}:${mm}`;
    }
}
