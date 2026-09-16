import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductoService } from '../../../../services/producto.service';
import { SpinnerComponent } from '../../../../shared/spinner.component/spinner.component';
import { FilaProducto } from '../../../../models/producto.model';

@Component({
  imports: [RouterLink, SpinnerComponent],
  selector: 'app-producto-list',
  styleUrl: './producto-list.component.css',
  templateUrl: './producto-list.component.html',
})
export class ProductoListComponent implements OnInit {
  constructor(private productoService: ProductoService) {
  }

  productos = signal<FilaProducto[]>([]);
  cargando = signal(true);

  async ngOnInit() {
    const { data } = await this.productoService.listar();
    this.productos.set((data as unknown as FilaProducto[]) ?? []);
    this.cargando.set(false);
  }
}
