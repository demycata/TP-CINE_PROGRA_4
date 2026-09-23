import { Component, inject } from '@angular/core';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-toast',
  styleUrl: './toast.component.css',
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  protected toast = inject(ToastService);
}
