export interface FuncionInput { //No tiene id, sala_id ni hora_fin porque esos valores los asigna supa
    pelicula_id: string;
    fecha: string;
    hora_inicio: string;
    formato: '2D' | '3D' | '4D' | '5D';
    idioma: 'castellano' | 'subtitulada';
    precio_base: number;
    precio_preventa: number | null;
    fecha_fin_preventa: string | null;
}

export interface FuncionConSala { //Son los datos que salen al consultar una función para mostrarla
    id: string;
    sala_id: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    formato: '2D' | '3D' | '4D' | '5D';
    idioma: 'castellano' | 'subtitulada';
    precio_base: number;
    precio_preventa: number | null;
    fecha_fin_preventa: string | null;
    salas: { nombre: string } | null;
}

export interface FilaFuncion {
    id: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    formato: string;
    idioma: string;
    precio_base: number;
    precio_preventa: number | null;
    peliculas: { titulo: string } | null;
    salas: { nombre: string } | null;
}
