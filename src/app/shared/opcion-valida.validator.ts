import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function opcionValidaValidator(opciones: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    return opciones.includes(control.value) ? null : { opcionInvalida: true };
  };
}
