import { Component, OnDestroy, signal } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Html5Qrcode } from 'html5-qrcode';
import { EntradaService } from '../../../services/entrada.service';
import { OrdenValidada } from '../../../models/entrada.model';
import { SpinnerComponent } from '../../../shared/spinner.component/spinner.component';

@Component({
  imports: [ReactiveFormsModule, DatePipe, SlicePipe, SpinnerComponent],
  selector: 'app-validar-qr',
  styleUrl: './validar-qr.component.css',
  templateUrl: './validar-qr.component.html',
})
export class ValidarQrComponent implements OnDestroy {
  constructor(private entradaService: EntradaService) {
  }

  enviado = signal(false);
  error = signal<string | null>(null);
  resultado = signal<OrdenValidada | null>(null);
  escaneando = signal(false);
  errorCamara = signal<string | null>(null);

  private lector: Html5Qrcode | null = null;

  formCodigo = new FormGroup({
    codigo: new FormControl('', [Validators.required]),
  });

  async iniciarCamara() {
    this.errorCamara.set(null);
    this.escaneando.set(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      this.lector = new Html5Qrcode('lector-qr');
      await this.lector.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (texto) => this.alLeer(texto),
        () => {},
      );
    } catch {
      this.escaneando.set(false);
      this.errorCamara.set('No se pudo acceder a la cámara. Ingresá el código a mano.');
    }
  }

  async detenerCamara() {
    if (this.lector?.isScanning) await this.lector.stop();
    this.lector = null;
    this.escaneando.set(false);
  }

  private async alLeer(texto: string) {
    await this.detenerCamara();
    await this.validar(texto);
  }

  async onSubmit() {
    this.formCodigo.markAllAsTouched();
    if (this.formCodigo.invalid) return;

    await this.validar(this.formCodigo.value.codigo!.trim());
  }

  private async validar(codigo: string) {
    this.enviado.set(true);
    this.error.set(null);
    this.resultado.set(null);

    const { data, error } = await this.entradaService.validarQr(codigo);

    this.enviado.set(false);
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.resultado.set(data);
    this.formCodigo.reset();
  }

  ngOnDestroy() {
    this.detenerCamara();
  }
}
