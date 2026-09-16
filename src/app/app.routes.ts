import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/auth/register/register/register').then((m) => m.Register),
  },
  {
    path: 'peliculas/:id',
    loadComponent: () =>
      import('./features/peliculas/pelicula-detalle.component/pelicula-detalle.component').then(
        (m) => m.PeliculaDetalleComponent
      ),
  },
  {
    path: 'peliculas/:peliculaId/funciones/:funcionId/butacas',
    loadComponent: () =>
      import('./features/peliculas/butaca-seleccion.component/butaca-seleccion.component').then(
        (m) => m.ButacaSeleccionComponent
      ),
  },
  {
    path: 'perfil',
    loadComponent: () =>
      import('./features/perfil/perfil.component/perfil.component').then(
        (m) => m.PerfilComponent
      ),
  },
  {
    path: 'admin',
    canMatch: [adminGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/admin-home.component/admin-home.component').then(
            (m) => m.AdminHomeComponent
          ),
      },
      {
        path: 'categorias-producto/nueva',
        loadComponent: () =>
          import('./features/admin/categorias-producto/categoria-form.component/categoria-form.component').then(
            (m) => m.CategoriaFormComponent
          ),
      },
      {
        path: 'generos/nuevo',
        loadComponent: () =>
          import('./features/admin/generos/genero-form.component/genero-form.component').then(
            (m) => m.GeneroFormComponent
          ),
      },
      {
        path: 'salas',
        loadComponent: () =>
          import('./features/admin/salas/sala-list.component/sala-list.component').then(
            (m) => m.SalaListComponent
          ),
      },
      {
        path: 'salas/nueva',
        loadComponent: () =>
          import('./features/admin/salas/sala-form.component/sala-form.component').then(
            (m) => m.SalaFormComponent
          ),
      },
      {
        path: 'peliculas',
        loadComponent: () =>
          import('./features/admin/peliculas/pelicula-list.component/pelicula-list.component').then(
            (m) => m.PeliculaListComponent
          ),
      },
      {
        path: 'peliculas/nueva',
        loadComponent: () =>
          import('./features/admin/peliculas/pelicula-form.component/pelicula-form.component').then(
            (m) => m.PeliculaFormComponent
          ),
      },
      {
        path: 'peliculas/:id/editar',
        loadComponent: () =>
          import('./features/admin/peliculas/pelicula-form.component/pelicula-form.component').then(
            (m) => m.PeliculaFormComponent
          ),
      },
      {
        path: 'funciones',
        loadComponent: () =>
          import('./features/admin/funciones/funcion-list.component/funcion-list.component').then(
            (m) => m.FuncionListComponent
          ),
      },
      {
        path: 'funciones/nueva',
        loadComponent: () =>
          import('./features/admin/funciones/funcion-form.component/funcion-form.component').then(
            (m) => m.FuncionFormComponent
          ),
      },
      {
        path: 'funciones/:id/editar',
        loadComponent: () =>
          import('./features/admin/funciones/funcion-form.component/funcion-form.component').then(
            (m) => m.FuncionFormComponent
          ),
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('./features/admin/productos/producto-list.component/producto-list.component').then(
            (m) => m.ProductoListComponent
          ),
      },
      {
        path: 'productos/nuevo',
        loadComponent: () =>
          import('./features/admin/productos/producto-form.component/producto-form.component').then(
            (m) => m.ProductoFormComponent
          ),
      },
      {
        path: 'productos/:id/editar',
        loadComponent: () =>
          import('./features/admin/productos/producto-form.component/producto-form.component').then(
            (m) => m.ProductoFormComponent
          ),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/admin/usuarios/usuario-list.component/usuario-list.component').then(
            (m) => m.UsuarioListComponent
          ),
      },
    ],
  },
];
