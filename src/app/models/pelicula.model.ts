export interface Pelicula {
    id?: string;  //generado automaticamente por supabase
    titulo: string;
    sinopsis?: string | null;
    duracion_minutos: number;
    imagen_url: string | null;
    restriccion_edad?: number | null;
    fecha_estreno: string | null;
    activa?: boolean; //baja logica, si esta activa o no la pelicula
    created_at?: string;    //generado por supa
    generos: string[];
    entradas_vendidas?: number;
}

//usamos esta interface y no Pelicula porque no necesitamos todos los campos de la película, solo los que vamos a mostrar en la lista
export interface FilaPelicula {
    id: string;
    titulo: string;
    duracion_minutos: number;
    activa: boolean;
    fecha_estreno: string | null;
}

export interface PeliculaOpcion {//interface que se usa para mostrar las peliculas en un select al crear o editar una funcion   
    id: string;
    titulo: string;
}
