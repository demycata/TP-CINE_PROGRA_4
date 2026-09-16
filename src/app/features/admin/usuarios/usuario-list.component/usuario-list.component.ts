import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UsuarioService, Rol } from '../../../../services/usuario.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';

interface FilaUsuario {
  id: string;
  nombre: string;
  apellido: string;
  rol: Rol;
}

@Component({
  imports: [RouterLink, SpinnerComponent],
  selector: 'app-usuario-list',
  styleUrl: './usuario-list.component.css',
  templateUrl: './usuario-list.component.html',
})
export class UsuarioListComponent implements OnInit {
  constructor(private usuarioService: UsuarioService) {
  }

  usuarios = signal<FilaUsuario[]>([]);
  error = signal<string | null>(null);
  cargando = signal(true);

  async ngOnInit() {
    const { data } = await this.usuarioService.listar();
    this.usuarios.set(data ?? []);
    this.cargando.set(false);
  }

  async cambiarRol(usuario: FilaUsuario, rol: string) {
    this.error.set(null);
    const nuevoRol = rol as Rol;
    const { error } = await this.usuarioService.cambiarRol(usuario.id, nuevoRol);

    if (error) {
      this.error.set('No se pudo actualizar el rol.');
      return;
    }
    this.usuarios.update((lista) =>
      lista.map((u) => (u.id === usuario.id ? { ...u, rol: nuevoRol } : u))
    );
  }
}
