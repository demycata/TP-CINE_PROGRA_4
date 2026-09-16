export type Rol = 'cliente' | 'empleado' | 'admin';

export interface FilaUsuario {
    id: string;
    nombre: string;
    apellido: string;
    rol: Rol;
}
