export interface EntradaComprada {
    orden: { id: string; qr_code: string };
    entrada: { id: string; funcion_id: string; butaca_id: string; precio: number };
}
