export interface Butaca {
    id: string;
    fila: string;
    columna: number;
    tipo_butaca: 'normal' | 'accesible' | 'vip';
}

export interface ButacaAInsertar {
    sala_id: string;
    fila: string;
    columna: number;
    tipo_butaca: 'normal' | 'accesible' | 'vip';
}

export interface FilaButacas {
    fila: string;
    izquierda: Butaca[];
    centro: Butaca[];
    derecha: Butaca[];
}
