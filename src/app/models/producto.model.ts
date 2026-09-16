export interface ProductoInput {
    nombre: string;
    categoria_id: string | null;
    precio: number;
    imagen_url: string | null;
    activo: boolean;
}

export interface FilaProducto {
    id: string;
    nombre: string;
    precio: number;
    activo: boolean;
    imagen_url: string | null;
    categorias_producto: { nombre: string } | null;
}
