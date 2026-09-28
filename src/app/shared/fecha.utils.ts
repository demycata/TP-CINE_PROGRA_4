//fecha de hoy en formato YYYY-MM-DD según la hora local. No se usa toISOString() porque devuelve la fecha en UTC:
//en Argentina (UTC-3), después de las 21hs ya daba el día siguiente y se escondían las funciones del día.
export function hoyISO(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}
