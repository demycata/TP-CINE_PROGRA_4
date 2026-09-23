export interface EntradaComprada {
    orden: { id: string; qr_code: string; total: number; credito_usado: number };
    entradas: { id: string; funcion_id: string; butaca_id: string; precio: number }[];
}

export interface OrdenMisEntradas {
    id: string;
    estado: 'pendiente' | 'pagada' | 'cancelada';
    total: number;
    fecha: string;
    entradas: {
        id: string;
        precio: number;
        butacas: { fila: string; columna: number; tipo_butaca: 'normal' | 'accesible' | 'vip' } | null;
        funciones: {
            id: string;
            fecha: string;
            hora_inicio: string;
            formato: string;
            idioma: string;
            salas: { nombre: string } | null;
            peliculas: { id: string; titulo: string; imagen_url: string | null } | null;
        } | null;
    }[];
}
