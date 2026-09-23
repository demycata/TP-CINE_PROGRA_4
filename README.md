# TP Cine

Sistema de venta de entradas para un cine de un solo edificio con varias salas. Trabajo práctico integrador de **Programación IV**.

Catálogo de películas, gestión de salas/funciones con asignación automática de sala, compra de entradas con selección de butacas en tiempo real, candy bar, fidelización por puntos y panel de administración con control de roles reforzado a nivel de base de datos.

## Stack

- **[Angular 22](https://angular.dev)** — standalone components 
- **[Supabase](https://supabase.com)** — Postgres con Row Level Security, Auth (email/password) y Realtime.
- **Firebase Hosting** — deploy estático.

## Arquitectura y decisiones técnicas

### Componentes y servicios

- Los **servicios** transversales (`src/app/services/*.service.ts`) se declaran con `@Service()` de `@angular/core`, no `@Injectable()`. Un `@Service` no admite constructor injection para sus propias dependencias, así que estas se inyectan con `inject()` como propiedad de clase.
- Los **componentes** sí usan inyección por constructor.
- Los servicios devuelven directamente la respuesta de Supabase (`{ data, error }`); el componente que llama hace `await` y decide qué hacer con el resultado, reflejándolo en la UI con signals (`enviando`, `error`) — nunca se asume éxito sin chequear el error.
- Formularios reactivos (`ReactiveFormsModule`) con `markAllAsTouched()` + return si son inválidos, y mensajes de error en `<small class="error">`.
- Avisos transitorios (ej. "reseña guardada", "compra realizada") van por `ToastService` (`shared/toast.service.ts`, signal `mensaje`) + `ToastComponent` montado una sola vez en `app.html`, no por alerts ni estado local por componente.

### Estado

Signals para todo el estado local y compartido (sesión y rol del usuario, butacas seleccionadas, carrito, estados de carga/error de formularios).
### Autenticación y roles

- Supabase Auth (email/password). La tabla `profiles` se crea sola vía trigger (`crear_perfil_nuevo_usuario`) cuando se registra un usuario en `auth.users`, con un campo `rol` (`cliente` / `empleado` / `admin`).
- **La protección real de los roles vive en Row Level Security**, no en el cliente: las tablas de catálogo (`peliculas`, `salas`, `funciones`, `generos`, `categorias_producto`, `productos`, `combos`, `cupones`, `recompensas_puntos`) tienen SELECT público pero INSERT/UPDATE/DELETE restringido a `rol_actual() = 'admin'` a nivel de base de datos.
- El guard funcional `adminGuard` sobre `/admin` espera `Auth.listo` (una `Promise<void>`, no la signal `rol`) antes de resolver — el bug original solo se notaba con carga directa de una URL de `/admin`, porque en navegación SPA normal el rol ya estaba cargado de antes. En la misma línea, `Auth.login()` espera a que `cargarRol()` termine antes de resolver, así el link "Admin" de la navbar aparece sin necesidad de refrescar.
- Registro con `<select>` de opciones fijas (no texto libre) para tipo de sangre y color de ojos, con un validator propio (`shared/opcion-valida.validator.ts`) al estilo `Validators.required`, como defensa extra sobre el `CHECK` de la base.

### Salas, funciones y asignación automática

- Al dar de alta una sala solo se pide el nombre: `SalaService.crear()` inserta la sala y arma sus butacas en el mismo paso (28 por fila normal A-I/L-Q, la fila accesible "J" con 14 reemplazando a J y K, y las filas VIP R/S/T con 28 cada una). Si falla el insert de butacas, se borra la sala recién creada para no dejarla a medio armar.
- **La sala de una función no la elige el admin.** `FuncionService` trae todas las salas y las funciones ya cargadas ese día, descarta las salas que solapan con la ventana horaria pedida (`hora_inicio` → `hora_fin` + 30 min de buffer) y asigna la primera libre. El `EXCLUDE` constraint `funciones_no_solapamiento` en la base es el respaldo final, no el mecanismo principal.
- Antes de asignar, se valida en Angular que la función no cruce la medianoche.
- `funciones.precio_vip` (`NOT NULL`, `CHECK (precio_vip > precio_base)`) es un precio aparte para las butacas VIP (filas R/S/T), validado también en el propio form antes de tocar la base. `funciones.precio_preventa`/`fecha_fin_preventa` habilitan un precio especial configurable por función mientras `hoy <= fecha_fin_preventa`; las butacas VIP nunca entran en preventa, siempre cobran `precio_vip`. No hay ventana automática de apertura: el admin decide cuándo empieza a regir cargando esos valores.

### Compra de entradas

- `EntradaService.comprar(funcionId, butacas, creditoAUsar)` hace dos inserts directos desde el cliente: una `orden` y después un **insert bulk** en `entradas` (una sola sentencia con todas las butacas de la compra, hasta 8 por vez). Ambos aceptan `usuario_id = auth.uid()` o `null` para compra anónima, así que no hizo falta tocar seguridad para lograrlo.
- Lo que **no** está en el cliente es la garantía de que dos personas no compren la misma butaca: eso lo resuelve el índice único `entradas_funcion_id_butaca_id_key` (`UNIQUE(funcion_id, butaca_id)`) en la base. Si dos compras concurrentes pasan el chequeo visual de "butaca libre" al mismo tiempo, ambas intentan el insert pero solo una lo logra (código `23505`); como el insert es una sola sentencia con todas las butacas, si una sola está ocupada se rechaza la compra completa y el componente refresca las butacas ocupadas para que el usuario reintente con el resto.
- Cada butaca cobra `precio_vip` o `precio_base`/preventa según `tipo_butaca`, calculado por butaca (no `cantidad * precio`) — cada fila de `entradas` guarda su propio precio real pagado.
- Compra con crédito: un input numérico en el panel de butacas permite aplicar crédito disponible (`profiles.creditos_disponibles`), clampeado siempre a `[0, subtotal]`. Se descuenta recién después de que el insert de `entradas` salga bien, para no tocar crédito en una compra que termina fallando por butaca ocupada.
- Restricción de edad: si la película tiene `restriccion_edad` y hay sesión, se compara contra `Auth.fechaNacimiento` y se bloquea la compra a menores; en compra anónima no hay forma de verificar la edad, así que solo se avisa por toast ("debe ir acompañado de un adulto") y se deja continuar, tal como lo pidió el cliente.
- Al finalizar, se genera QR (`qrcode`) + PDF (`jsPDF`) en el cliente con el detalle de butacas, subtotal, crédito aplicado y total pagado — ambos importados dinámicamente para no inflar el bundle inicial.
- Cancelación (`EntradaService.cancelar`, solo para usuarios registrados): pone la orden en `cancelada` y acredita el total como crédito, hasta 2hs antes de la función. No borra la fila de `entradas` — `listarButacasOcupadas` excluye órdenes canceladas, así la butaca vuelve a estar disponible sola.
- Se dejaron **sin** mover al cliente `rol_actual()` (la función detrás de casi todas las policies de RLS) y `crear_perfil_nuevo_usuario` (el trigger que crea el perfil al registrarse): la primera es la base de la seguridad por roles — moverla rompería la garantía de "roles reforzados a nivel de RLS, no solo en el cliente" — y la segunda evita que un registro quede sin perfil si el cliente falla entre el `signUp` y la creación del perfil.

### Reseñas

- Cualquier usuario logueado puede calificar (1-5 estrellas) y comentar cualquier película, sin haber comprado entrada — `UNIQUE(usuario_id, pelicula_id)` en la base, `ResenaService.guardar` hace `upsert` sobre esa constraint.
- Para mostrar el nombre del autor de una reseña ajena hizo falta una vista `perfiles_publicos (id, nombre, apellido)`: `profiles_select` solo deja ver la fila propia, así que un embed directo a `profiles` devuelve `null` para las demás. La vista corre con los privilegios de quien la creó (bypassea esa RLS) pero solo expone nombre/apellido. Como no hay FK de `resenas` a una vista, `listarPorPelicula` hace dos queries (reseñas, después nombres por `.in()`) y las combina en TS.
- El promedio de estrellas se calcula en TS sobre la lista ya traída, mismo criterio que el filtro de géneros: no hay vista/RPC de agregación porque el volumen de datos es chico.

### "Próximamente" y alertas de disponibilidad

- `PeliculaService.proximamente()` trae películas activas con `fecha_estreno` futura; `activas()` (la que alimenta la Cartelera) las excluye, para que una película recién cargada no aparezca como comprable antes de tiempo.
- El botón "Avisarme" (`AlertaService`, tabla `alertas_disponibilidad`, `UNIQUE(usuario_id, pelicula_id)`) solo aparece con sesión. **No hay notificaciones push ni mail reales**: `chequearDisponibles()` corre en `HomeComponent.ngOnInit()` de cada usuario logueado, busca alertas no notificadas cuya película ya tiene función habilitada, y avisa por toast — es un aviso "la próxima vez que entrás a la home", no una notificación real.

### Base de datos

- `formato` (2D/3D/4D/5D) e `idioma` (doblada/subtitulada) son atributos de la **función**, no de la película.
- Géneros: tabla `generos` (`id`, `nombre`) con el mismo patrón de RLS que el resto del catálogo, administrable desde `/admin/generos/nuevo`. Pero **sin** relación N:N con películas — `peliculas.generos` sigue siendo un array de texto (`text[]`), filtrado con `.overlaps()`/`.some()` en el cliente; el form de alta de película puebla el multi-select consultando `GeneroService.listar()`. Se evita la tabla puente (`pelicula_generos`) porque no aporta nada funcional extra.
- `entradas` y `orden_productos` en tablas separadas. Un QR por orden (no uno por entrada), con dos estados de validación independientes (`estado_qr_entradas`, `estado_qr_candy`).

### Diseño visual

Hay un proyecto de diseño de referencia en claude.ai/design ("Plataforma de venta de entradas de cine") con el mockup de toda la app, que se va adoptando pantalla por pantalla (no de una sola vez): navbar, home (Próximamente, Más vendidas, Cartelera con buscador + chips de género), badge de rating dorado en las cards. Paleta oscura turquesa + rojo/coral, tokens de color en `src/styles.css`. El negocio se llama **Cinemax**.

### Config y deploy

- `src/environments/environments.ts` se commitea con la URL del proyecto Supabase y la **publishable key** 
- Deploy a **Firebase Hosting** (`dist/tp-cine/browser`, rewrite catch-all a `index.html` para el routing de Angular). GitHub Actions despliega un preview por cada PR (`.github/workflows/firebase-hosting-pull-request.yml`); el deploy a producción es manual (`firebase deploy`) por ahora.
- PWA instalable con `@angular/service-worker` (`ngsw-config.json`, `public/manifest.webmanifest`).

## Estructura del proyecto

```
src/app/
├── core/
│   ├── auth/          # Auth service (session/rol/fechaNacimiento como signals), guards funcionales
│   └── supabase/      # cliente de Supabase
├── services/           # acceso a datos, uno por entidad (@Service)
├── shared/             # navbar, toast, spinner, directivas y validators compartidos
└── features/
    ├── home/            # catálogo público (Próximamente, Más vendidas, Cartelera)
    ├── auth/            # login, registro
    ├── peliculas/        # detalle de película (reseñas, funciones) y selección de butacas/compra
    ├── perfil/          # perfil, crédito, Mis entradas, Mis películas
    └── admin/            # panel de administración (peliculas, generos, salas, funciones, productos, categorias-producto, usuarios)
```

Cada componente vive en su propia carpeta colocada (`.ts` + `.html` + `.css`). Todo lo de `/admin` cuelga de una única ruta padre con `children`, lazy-loaded con `loadComponent`.

## Cómo correr el proyecto

```bash
npm install
npm start        # ng serve, http://localhost:4200
```

## Estado actual

**Implementado**: login/registro, guard de admin, panel de administración con CRUD de películas (+ géneros multi-select desde tabla `generos`, activar/desactivar), géneros (alta), salas (alta simple con generación automática de butacas), funciones (alta/edición con asignación automática de sala y precio VIP/preventa), categorías de producto, productos, listado de usuarios con cambio de rol, home pública con "Próximamente" (+ alertas de disponibilidad), "Más vendidas de la semana" y Cartelera con buscador/filtro por género, detalle de película con reseñas (estrellas + comentario, promedio) y selección de función, selección de butacas (mapa real de la sala, ocupadas marcadas, precio VIP, restricción de edad) con panel de compra (crédito a usar) y generación de PDF + QR, perfil con crédito disponible, "Mis entradas" (cancelables hasta 2hs antes, con reintegro en crédito) y "Mis películas". PWA instalable, deploy a Firebase Hosting con preview automático por PR.

**Pendiente**: cupón 20% primera compra y cupones segmentados, puntos de fidelización (canje por entrada/producto), candy bar y combos en la compra, validación de QR por empleados, reportes y log de actividad del admin.
