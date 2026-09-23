export interface Resena {
    id: string;
    estrellas: number;
    comentario: string | null;
    fecha: string;
    usuario_id: string;
    autor: string;
}

export interface MiResena {
    id: string;
    estrellas: number;
    comentario: string | null;
}
