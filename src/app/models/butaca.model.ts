export const FILAS_NORMALES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'N', 'O', 'P', 'Q']; //15 filas de 28 butacas (4+20+4)
export const FILAS_VIP = ['R', 'S', 'T']; //últimas 3 filas, 28 butacas cada una pero tipo vip

export interface Butaca {//interface que representa una butaca en la base de datos
    id: string;
    fila: string;
    columna: number;
    tipo_butaca: 'normal' | 'accesible' | 'vip';
}

export interface ButacaAInsertar {//interface que representa una butaca a insertar en la base de datos, se usa para crear las butacas de una sala
    sala_id: string;
    fila: string;
    columna: number;
    tipo_butaca: 'normal' | 'accesible' | 'vip';
}

export interface FilaButacas {//interface que se usa para mostrar las butacas de una sala
    fila: string;
    izquierda: Butaca[];
    centro: Butaca[];
    derecha: Butaca[];
}
