import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  styleUrl: './spinner.component.css',
  templateUrl: './spinner.component.html',
})
export class SpinnerComponent {
  inline = input(false);
}
