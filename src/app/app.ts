import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/navbar/navbar';
import { ToastComponent } from './shared/toast.component/toast.component';

@Component({
  imports: [RouterOutlet, Navbar, ToastComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
