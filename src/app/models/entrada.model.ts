export interface EntradaComprada {//interface que se usa para devolver el resultado de la compra de entradas, contiene la orden y las entradas compradas
    orden: { id: string; qr_code: string; total: number; credito_usado: number };
    entradas: { id: string; funcion_id: string; butaca_id: string; precio: number }[];
}

export interface OrdenMisEntradas {//interface que se usa para devolver las ordenes de un usuario, contiene la orden y las entradas compradas
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

export interface OrdenValidada {//datos que ve el empleado al validar el QR de una orden
    id: string;
    funcion: { fecha: string; hora_inicio: string; formato: string; idioma: string; sala: string; pelicula: string };
    butacas: { fila: string; columna: number; tipo_butaca: 'normal' | 'accesible' | 'vip' }[];
}
