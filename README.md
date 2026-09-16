# TP Cine

Sistema de venta de entradas para un cine de un solo edificio con varias salas. Trabajo práctico integrador de **Programación IV**.

Catálogo de películas, gestión de salas/funciones con asignación automática de sala, compra de entradas con selección de butacas en tiempo real, candy bar, fidelización por puntos y panel de administración con control de roles reforzado a nivel de base de datos.

## Stack

- **[Angular 22](https://angular.dev)** — standalone components (sin NgModules), control flow nativo (`@if`/`@for`), signals para estado.
- **[Supabase](https://supabase.com)** — Postgres con Row Level Security, Auth (email/password) y Realtime. Sin Storage configurado: las imágenes son URLs de texto, no upload de archivos.
- **Firebase Hosting** — deploy estático, con preview automático por pull request vía GitHub Actions.

## Arquitectura y decisiones técnicas

### Componentes y servicios

- Los **servicios** transversales (`src/app/services/*.service.ts`) se declaran con `@Service()` de `@angular/core`, no `@Injectable()`. Un `@Service` no admite constructor injection para sus propias dependencias, así que estas se inyectan con `inject()` como propiedad de clase.
- Los **componentes** sí usan inyección por constructor.
- Los servicios devuelven directamente la respuesta de Supabase (`{ data, error }`); el componente que llama hace `await` y decide qué hacer con el resultado, reflejándolo en la UI con signals (`enviando`, `error`) — nunca se asume éxito sin chequear el error.
- Formularios reactivos (`ReactiveFormsModule`) con `markAllAsTouched()` + early return si son inválidos, y mensajes de error en `<small class="error">`.

### Estado

Signals para todo el estado local y compartido (sesión y rol del usuario, butacas seleccionadas, carrito, estados de carga/error de formularios). Sin NgRx — no es un requisito de la consigna y agrega complejidad injustificada para el alcance del TP.

### Autenticación y roles

- Supabase Auth (email/password). La tabla `profiles` se crea sola vía trigger (`crear_perfil_nuevo_usuario`) cuando se registra un usuario en `auth.users`, con un campo `rol` (`cliente` / `empleado` / `admin`).
- **La protección real de los roles vive en Row Level Security**, no en el cliente: las tablas de catálogo (`peliculas`, `salas`, `funciones`, `generos`, `categorias_producto`, `productos`, `combos`, `cupones`, `recompensas_puntos`, `pelicula_generos`) tienen SELECT público pero INSERT/UPDATE/DELETE restringido a `rol_actual() = 'admin'` a nivel de base de datos.
- El guard funcional `adminGuard` sobre `/admin` es una capa de UX (evita el flash de contenido y redirige), no el mecanismo de seguridad.

### Salas, funciones y asignación automática

- Al dar de alta una sala solo se pide el nombre: `SalaService.crear()` inserta la sala y arma sus butacas en el mismo paso (28 por fila normal A-I/L-Q, la fila accesible "J" con 14 reemplazando a J y K, y las filas VIP R/S/T con 28 cada una). Esto generaba una fila normal a través de un trigger de Postgres (`generar_butacas_sala`); se movió a TypeScript para no depender de una función server-side en una operación que es puro armado de datos, sin nada de seguridad en juego (el INSERT en `butacas` ya está protegido por RLS a `rol_actual() = 'admin'`, igual que antes). Si falla el insert de butacas, se borra la sala recién creada para no dejarla a medio armar.
- **La sala de una función no la elige el admin.** `FuncionService` trae todas las salas y las funciones ya cargadas ese día, descarta las salas que solapan con la ventana horaria pedida (`hora_inicio` → `hora_fin` + 30 min de buffer) y asigna la primera libre — la lógica vive en TypeScript, no en un RPC de Postgres, para mantenerla junto al resto de los services de negocio.
- El `EXCLUDE` constraint `funciones_no_solapamiento` (GiST) es el respaldo final ante condiciones de carrera, no el mecanismo principal: si salta, Postgres devuelve el código `23P01`, que se captura para mostrar un error claro en vez de duplicar una función.
- Antes de asignar, se valida en Angular que la función no cruce la medianoche.

### Compra de entradas

- `EntradaService.comprar()` hace dos inserts directos desde el cliente (`ordenes` y luego `entradas`) en vez de llamar a un RPC de Postgres (`comprar_entrada`, que existió y se borró de la base). Ambos inserts ya estaban permitidos por las policies de RLS existentes (`ordenes_insert`/`entradas_insert` aceptan `usuario_id = auth.uid()` o `null` para compra anónima), así que no hizo falta tocar seguridad para lograrlo.
- Lo que **no** se movió al cliente es la garantía de que dos personas no compren la misma butaca: eso lo sigue resolviendo el índice único `entradas_funcion_id_butaca_id_key` (`UNIQUE(funcion_id, butaca_id)`) en la base. Si dos compras concurrentes pasan el chequeo visual de "butaca libre" al mismo tiempo, ambas intentan el insert pero solo una lo logra; la otra recibe el código `23505` y un mensaje para elegir otra butaca. Sacar este constraint para tener "todo en el cliente" hubiese roto la única protección real contra la doble venta.
- Efecto secundario aceptado de este diseño: si el insert de `entradas` falla por butaca ocupada, la `orden` ya insertada (marcada `pagada`) queda huérfana sin entrada asociada. No se revierte porque en compra anónima (`usuario_id null`) el RLS de `ordenes` no permite borrar ni actualizar esa fila (no hay policy de `DELETE`, y `ordenes_update` exige `usuario_id = auth.uid()`, que nunca es verdadero si ambos son `null`). Es una fila de más en `ordenes`, no una venta duplicada ni una pérdida de plata real — se documenta acá en vez de agregar un mecanismo de limpieza que no aporta al alcance del TP.
- Se dejaron **sin** mover al cliente `rol_actual()` (la función detrás de casi todas las policies de RLS) y `crear_perfil_nuevo_usuario` (el trigger que crea el perfil al registrarse): la primera es la base de la seguridad por roles — moverla rompería la garantía de "roles reforzados a nivel de RLS, no solo en el cliente" — y la segunda evita que un registro quede sin perfil si el cliente falla entre el `signUp` y la creación del perfil.

### Base de datos

- `formato` (2D/3D/4D/5D) e `idioma` (doblada/subtitulada) son atributos de la **función**, no de la película.
- Géneros: tabla `generos` (`id`, `nombre`) con el mismo patrón de RLS que el resto del catálogo, administrable desde `/admin/generos/nuevo`. Pero **sin** relación N:N con películas — `peliculas.generos` sigue siendo un array de texto (`text[]`), filtrado con `.overlaps()`; el form de alta de película puebla el multi-select consultando `GeneroService.listar()`. Se evita la tabla puente (`pelicula_generos`) porque no aporta nada funcional extra para este TP.
- `entradas` y `orden_productos` en tablas separadas. Un QR por orden (no uno por entrada), con dos estados de validación independientes (`estado_qr_entradas`, `estado_qr_candy`).

### Config y deploy

- `src/environments/environments.ts` se commitea con la URL del proyecto Supabase y la **publishable key** (no la service role key) — es segura para exponer en el cliente por diseño de Supabase.
- Deploy a **Firebase Hosting** (`dist/tp-cine/browser`, rewrite catch-all a `index.html` para el routing de Angular). GitHub Actions despliega un preview por cada PR (`.github/workflows/firebase-hosting-pull-request.yml`); el deploy a producción es manual (`firebase deploy`) por ahora.

## Estructura del proyecto

```
src/app/
├── core/
│   ├── auth/          # Auth service (session/rol como signals), guards funcionales
│   └── supabase/      # cliente de Supabase
├── services/           # acceso a datos, uno por entidad (@Service)
├── shared/             # constantes/datos compartidos (géneros, etc.)
└── features/
    ├── home/            # catálogo público
    ├── auth/            # login, registro
    ├── perfil/          # perfil de usuario
    └── admin/            # panel de administración (peliculas, generos, salas, funciones, productos, categorias-producto, usuarios)
```

Cada componente vive en su propia carpeta colocada (`.ts` + `.html` + `.css`). Todo lo de `/admin` cuelga de una única ruta padre con `children`, lazy-loaded con `loadComponent`.

## Cómo correr el proyecto

```bash
npm install
npm start        # ng serve, http://localhost:4200
```

La app apunta al proyecto de Supabase configurado en `src/environments/environments.ts` (id `larqmdlbkbhuljhtkjvt`, región us-east-2) — no hace falta ningún `.env` adicional para desarrollo local.

```bash
npm run build     # build de producción en dist/tp-cine/browser
npm test          # unit tests con Vitest
```

## Estado actual

**Implementado**: login/registro, guard de admin, panel de administración con CRUD de películas (+ géneros multi-select desde tabla `generos`, activar/desactivar), géneros (alta), salas (alta simple con generación automática de butacas), funciones (alta/edición con asignación automática de sala), categorías de producto, productos, listado de usuarios con cambio de rol, home pública con listado de películas y destacadas, detalle de película con selección de función, selección de butacas (mapa real de la sala, ocupadas marcadas) y compra con generación de PDF + QR.

**Pendiente**: reseñas, cupones, puntos de fidelización, candy bar y combos, "Mis entradas" y "Mis películas", validación de QR por empleados, reportes y log de actividad del admin, PWA, y llevar la selección de butacas a tiempo real de verdad (hoy se listan las ocupadas al cargar la pantalla; el `UNIQUE` de la base evita la doble venta pero no hay push en vivo entre usuarios que están mirando la misma función).

Detalle de decisiones y alcance priorizado (MoSCoW) en `Seguimiento interno - TP Cine (no entregable).md` (uso interno, no forma parte del entregable).
