# **Seguimiento interno — TP Cine**

*Este documento NO va en el entregable. Es para uso propio: mantener el alcance ordenado, las decisiones técnicas documentadas y tener a mano qué preguntarle al profesor.*

## **Plataforma objetivo**

El profesor confirmó en la primera entrega (mostrando el documento de requerimientos) que la aplicación es una **web de escritorio**, no mobile-first. Esto afecta el diseño de las pantallas (mapa de butacas, panel admin, checkout) que se piensan primero para pantallas grandes con mouse y teclado, no para touch.

## **Decisiones técnicas y su porqué**

### **Arquitectura Angular**

> * **Standalone components**, sin NgModules — coincide con lo que se está usando en clase actualmente.  
> * Routing con loadComponent/loadChildren para lazy loading; inject() para inyección de dependencias (nunca constructor injection, para mantener el estilo consistente en toda la app); guards funcionales (CanActivateFn) cuando corresponda.  
> * Bootstrap vía bootstrapApplication() \+ app.config.ts centralizando providers (Router, HttpClient, cliente de Supabase).  
> * Sin SSR: no hay necesidad de SEO ni pre-renderizado, y sumarlo traería complejidad de hidratación injustificada.  
> * Estilos: CSS nativo con custom properties (var(--token)) para la paleta y el sistema de diseño

### **Manejo de estado**

> * **Signals** para estado local y compartido simple (butacas seleccionadas, carrito, estados de carga/error de formularios). Se descartó NgRx: no se vio en clase y no es un requisito explícito de la consigna.

### **Capa de acceso a datos**

> * Todos los accesos a Supabase pasan por servicios; los componentes nunca llaman a Supabase directamente.  
> * **Convención de servicios**: los métodos de servicio devuelven directamente la promesa/resultado de Supabase ({ data, error }) en vez de consumirla internamente con console.log/console.error. El componente decide qué hacer con el éxito o el error, reflejado en la UI con señales (enviando, error) — nunca se resetea un formulario sin confirmar éxito.

### **Autenticación y seguridad**

> * Supabase Auth (email/password) \+ tabla profiles con campo rol (cliente/empleado/admin), poblada automáticamente por un trigger en auth.users.  
> * **Row Level Security (RLS)** en Supabase para reforzar permisos por rol a nivel de base de datos, no solo en el cliente.  
> * Guard funcional `adminGuard` (`CanActivateFn`) implementado sobre `/admin`: espera a que se resuelva la carga de sesión/rol y redirige a `/` si no es admin. Sigue siendo una capa de UX, no la protección real — esa la da RLS en la base. Falta el guard equivalente para `/empleado` cuando se implemente ese rol.  
> * **Bug encontrado y corregido**: el guard hacía `await auth.rol` para "esperar a que cargue el rol", pero `auth.rol` es la signal (una función), no una promesa — `await` sobre una función se resuelve al instante, no espera nada. En navegación SPA normal (clickeando links dentro de la app) no se notaba porque el rol ya estaba cargado de una carga anterior. Se detectó probando con `Page.navigate` (recarga completa) en vez de clicks: un admin real accediendo por URL directa o con F5 a una ruta de `/admin` podía terminar rebotado a `/` porque el guard corría antes de que `Auth` terminara de resolver la sesión. Fix: `Auth` ahora expone `listo: Promise<void>` que resuelve cuando terminó el primer `getSession()` + carga de rol, y el guard hace `await auth.listo`.
> * `environments.ts` se commitea tal cual, con la **publishable key** de Supabase (no la service role key) — es segura para exponer en el cliente por diseño de Supabase, así que no hace falta `.env` ni gitignorarla.

### **Tiempo real**

> * Supabase Realtime para reflejar la disponibilidad de butacas — es el caso de uso explícito de esa feature de Supabase.

### **Checkout y butacas**

> * La butaca se bloquea recién al confirmar el pago, no con una reserva temporal durante la selección.  
> * Se garantiza que no haya doble venta con un constraint único (funcion\_id, butaca\_id) en entradas, y que no haya solapamiento de funciones en una sala con un EXCLUDE constraint (GiST) sobre el rango de horario \+ buffer de 30 min.  
> * Trade-off aceptado: es posible llegar al final del checkout y perder la butaca por una colisión rara; se maneja con un mensaje de error y redirección a la selección de butacas.

### **Asignación automática de sala**

> * **La lógica de elegir qué sala usar vive en Angular, no en un RPC de Postgres** (decisión del alumno). El formulario de alta de función no pide sala: Angular calcula la duración de la película, arma la ventana horaria (hora\_inicio → hora\_fin \+ 30 min de buffer), consulta las funciones existentes de cada sala en esa fecha, y asigna la primera sala sin solapamiento.  
> * Razón: mantiene toda la lógica de negocio de "función" junto al resto de los services del front, en vez de repartirla entre Angular y funciones de base de datos.  
> * El EXCLUDE constraint sigue siendo la garantía final ante condiciones de carrera (dos altas simultáneas): si Angular calcula mal o hay una colisión, el insert falla con código 23P01 y se captura para mostrar un error claro, nunca se duplica una reserva de sala real.  
> * Validación adicional en Angular antes de intentar la asignación: una función no puede cruzar la medianoche (hora\_inicio \+ duración de la película debe caer en el mismo día), porque hora\_fin es de tipo time y el constraint check (hora\_fin \> hora\_inicio) de la tabla lo rechazaría igual, pero con un error menos claro.

### **QR**

> * Un QR por orden (no uno por entrada individual), con dos estados de validación independientes: estado\_qr\_entradas y estado\_qr\_candy.  
> * **Implementado (parcial) — flujo de compra en dos pantallas**, hecho end-to-end (probado contra la base de Supabase real, no solo en el front):  
>   1. `pelicula-detalle.component`: se elige función, "Siguiente" navega a `/peliculas/:peliculaId/funciones/:funcionId/butacas`.  
>   2. `butaca-seleccion.component`: **mapa de butacas real** de la sala de la función (`ButacaService.listarPorSala`), agrupado por fila en 3 bloques (izquierda/centro/derecha, 4/20/4 para filas normales y VIP, 2/10/2 para la fila accesible "J") replicando el layout de RF-13/14/15. Butacas ya vendidas para esa función (`EntradaService.listarButacasOcupadas`) se muestran en rojo y deshabilitadas; fila "J" con borde verde (accesible), filas R/S/T con borde dorado (VIP); la seleccionada se resalta en turquesa. Se elige una butaca (no hay reserva temporal ni tiempo real todavía — RNF-04 sigue pendiente) y "Comprar" llama a `EntradaService.comprar(funcionId, butacaId, precio)`.  
>   3. `EntradaService.comprar()` ya **no auto-asigna** butaca (eso quedó descartado cuando se agregó el mapa visual) — usa directo la butaca que eligió el usuario.  
>   4. **Orden + entrada se crean en una sola transacción, vía RPC de Postgres** (`comprar_entrada(p_funcion_id, p_butaca_id, p_precio)`, migración `comprar_entrada_rpc`), no con dos `insert` sueltos desde el cliente. La función inserta en `ordenes` (`usuario_id` resuelto server-side con `auth.uid()`, nunca confiando en un parámetro del cliente; `estado: 'pagada'` porque no hay pasarela de pago real; `qr_code` generado con `gen_random_uuid()`) y después en `entradas` (`orden_id`, `funcion_id`, `butaca_id`, `precio`). Si el segundo `insert` falla por el `UNIQUE(funcion_id, butaca_id)` (colisión: dos personas comprando la misma butaca a la vez, código `23505`), Postgres deshace toda la transacción — nunca queda una orden "pagada" sin entrada. Función `security definer` (las policies de RLS de `ordenes`/`entradas` están pensadas para inserts individuales del cliente, no para que una función interna haga los dos pasos) con `set search_path = public` para evitar search\_path hijacking. El componente sigue capturando el `23505` igual que antes para avisar "alguien tomó esa butaca, elegí otra".  
>   5. `butaca-seleccion.component` genera la imagen del QR a partir de `orden.qr_code` con la librería `qrcode` y arma el PDF con `jsPDF`, ambas cargadas con `import()` dinámico para que no engorden el bundle inicial (quedan en un chunk aparte, solo se baja si el usuario compra).  
>   **Bug encontrado y corregido**: la versión original de `EntradaService.comprar()` hacía los dos `insert` (orden, después entrada) por separado. Si el segundo fallaba (butaca tomada justo antes), quedaba una orden "pagada" huérfana sin entrada — inflando además cualquier futuro reporte de facturación diaria con plata "cobrada" sin entrada real. Primer intento de arreglo: borrar la orden a mano desde el cliente si el segundo insert fallaba — no funcionó, no existe policy de `DELETE` para `ordenes` (solo insert/select/update), así que el `.delete()` corría sin tirar error pero borraba 0 filas por RLS. Fix real: mover los dos inserts al RPC de arriba, donde el rollback es automático (transacción de Postgres) y no depende de un permiso de `DELETE` que el cliente no tiene ni debería tener.  
>   **Falta para que sea el flujo completo de compra (RF-19 a RF-24)**: bloqueo en tiempo real de butacas mientras otra compra está en curso (RNF-04/RF-19 — hoy solo se ve ocupada recién después de comprada, no mientras otro la está por comprar), método de pago real, aplicar cupón/crédito/puntos, cancelación con reintegro en crédito, preventa (usa siempre `precio_base`, nunca `precio_preventa`), y que el mismo QR sirva para candy bar (`estado_qr_candy` no se toca todavía). Tampoco valida edad contra `restriccion_edad` de la película.

### **Modelo de datos**

> * formato e idioma son atributos de la función, no de la película.  
> * entradas y orden\_productos separadas en dos tablas.  
> * **Géneros: tabla `generos` (catálogo administrable), pero `peliculas.generos` sigue siendo `text[]`** — no se vuelve a la relación N:N (`pelicula_generos`) del diseño inicial. Historial de la decisión:  
>   1. Diseño inicial: tabla `generos` + N:N `pelicula_generos`.  
>   2. Se simplificó a array de texto en `peliculas` con opciones hardcodeadas en el front (constante `GENEROS` en `src/app/shared/generos.ts`) — quedó documentado que la consigna no exige tabla (RF-02 solo pide el comportamiento; el docx lista `Genero`/`Pelicula_Genero` en la sección 4 como "modelo de datos preliminar", no como RF), así que no tomar ese modelo al pie de la letra no es una desviación de un requisito.  
>   3. **Decisión final (esta) — implementada**: se vuelve a una tabla `generos (id, nombre)` — mismo patrón de RLS que `categorias_producto` (SELECT público, INSERT/UPDATE/DELETE solo admin) — para que el admin pueda dar de alta géneros desde el panel sin tocar código. Pero **no** se reintroduce `pelicula_generos`: `peliculas.generos` sigue siendo `text[]` y `PeliculaService.buscar()` sigue filtrando con `.overlaps()`. El form de películas dejó de importar la constante `GENEROS` y ahora puebla el multi-select con `GeneroService.listar()`.  
>   Razón del punto intermedio: la tabla resuelve lo que hacía falta (administrable, no hardcodeado) sin pagar el costo de la tabla puente (que no aporta nada funcional extra para este TP — no hay metadata por género más allá del nombre que la justifique, y el filtro por `.overlaps()` sobre `text[]` ya funciona bien).  
>   **Hecho**: migración `crear_tabla_generos` (tabla + RLS + seed de los 9 géneros que antes estaban hardcodeados), `GeneroService` (`src/app/services/genero.service.ts`), pantalla de alta `/admin/generos/nuevo` (`genero-form.component`, calcado de `categoria-form.component`), link agregado en el panel de admin, `pelicula-form.component` migrado a `GeneroService.listar()`, y se eliminó `src/app/shared/generos.ts` (ya no queda ninguna referencia a `GENEROS`). Sin pantalla de listado/edición de géneros todavía — solo alta, igual que categorías de producto.
> * **Butacas generadas por trigger de Postgres** (AFTER INSERT on salas). La fila accesible que reemplaza a J y K se llama **"J"** (se eliminó "K" de la secuencia).

### **Home — más vistas**

> * `PeliculaService.masVistas()` consulta la vista `peliculas_mas_vendidas` (no la tabla `peliculas`), que agrupa por película y calcula `count(entradas.id) FILTER (WHERE ordenes.estado = 'pagada')`, ordenado desc y limitado a 3 — así se arma el top-3 del home.  
> * **Bug encontrado y corregido**: `masVistas()` apuntaba a `.from('peliculas').order('entradas_vendidas', ...)`, pero esa columna no existe en la tabla — solo en la vista. El `order()` sobre una columna inexistente devuelve error de Postgres, y en `home.component.ts` ese error solo se hacía `console.error` (nunca se mostraba al usuario), así que la sección "Más vistas" del home quedaba vacía en silencio, sin que se notara sin abrir devtools. Fix: apuntar la consulta a la vista en vez de la tabla.  
> * **Decisión: vista, no columna desnormalizada en `peliculas`.** Se evaluó agregar `entradas_vendidas` como columna directa en `peliculas` para no depender de una vista aparte. Se descartó: una columna necesitaría un trigger que la incremente en cada `insert` en `entradas` y la decremente en cada cancelación (feature todavía sin implementar) — más código y otro lugar donde el número puede desincronizarse del real, sin ninguna ganancia de performance al volumen de este TP. La vista no persiste datos, se recalcula en cada `SELECT`, así que no hay nada que mantener sincronizado.  
> * El advisor de seguridad de Supabase marca la vista como `SECURITY DEFINER` (comportamiento default de Postgres para vistas, no una configuración explícita) — revisado: la vista solo expone un `count()` agregado, ninguna fila cruda de `entradas`/`ordenes`, así que no hay fuga de datos de otros usuarios pese a que bypassea el RLS de esas tablas al calcular el conteo (que es justamente lo necesario para que el ranking cuente ventas de todos los usuarios, no solo las del que mira el home).

### **PWA**

> * Alcance mínimo: instalable \+ cache de assets estáticos vía ng add @angular/pwa. No visto en clase, pero requisito explícito de la consigna.  
> * Offline real queda como stretch goal del Sprint 4\.

### **Identidad visual**

> * Paleta oscura, turquesa primario, rojo/coral acento — referencia al color grading cinematográfico típico.  
> * Assets propios (Illustrator/Photoshop) \+ sistema de tokens CSS nativo.

### **Deploy e infraestructura**

> * **Firebase Hosting** como destino de deploy (`firebase.json` apunta a `dist/tp-cine/browser`, rewrite catch-all a `index.html` para el routing de Angular). Proyecto Firebase `tp-cine-progra4-f19af`.  
> * **GitHub Actions** (`.github/workflows/firebase-hosting-pull-request.yml`, autogenerado por `firebase init hosting:github`) despliega un preview por cada PR contra el repo — no corre en PRs de forks (`github.event.pull_request.head.repo.full_name == github.repository`).  
> * Sin pipeline de deploy a producción todavía (solo el preview de PRs); el deploy a `default` channel queda manual (`firebase deploy`) hasta que se agregue el workflow de `push` a `main`.

*Esta sección va a alimentar directamente el README de arquitectura y decisiones técnicas que pide la consigna (entregable 4).*

## **Priorización (MoSCoW)**

### **Must have**

> * Catálogo de películas (listado, detalle, formato, idioma, duración)  
> * Búsqueda \+ filtro por género (multi-género)  
> * Registro/login \+ compra anónima  
> * Gestión de salas y funciones con asignación automática de sala \+ buffer de 30 min  
> * Restricción de edad por película  
> * Mapa de butacas con disponibilidad en tiempo real  
> * Flujo de compra completo \+ PDF \+ QR  
> * Validación de QR por empleados  
> * Panel admin: CRUD de salas, funciones, películas, productos  
> * PWA mínima  
> * Deploy \+ GitHub \+ README

### **Should have**

> * Reseñas, cupón de primera compra, candy bar, reportes de facturación, log de actividad, cancelación con crédito

### **Could have**

> * Fidelización completa, combos, cupones segmentados, "Próximamente" \+ alertas, preventa, "Mis películas", gráficos, top 3 en home

### **Won't have**

> * Mapa físico del cine, PWA offline real, pasarela de pago real

## **Puntos a preguntarle al profesor**

> 1. Datos de registro sin relación aparente con el negocio (tipo de sangre, color de ojos, días de vacaciones).  
> 2. Posición de la fila accesible — se resolvió técnicamente llamándola "J".  
> 3. "Debe ir acompañado de un adulto" — se interpreta como leyenda informativa, no validación dura.  
> 4. Medio de pago simulado para esta entrega académica.  
> 5. Mapa del cine fuera de alcance (el cliente lo pausó).  
> 6. Butacas accesibles como tipo\_butaca adicional, sin funcionalidad extra.

## **Estado real del desarrollo**

*Detalle granular para uso propio — la versión resumida para dar contexto rápido está en el "Estado actual" de `CLAUDE.md`.*

### **Hecho**

> * **Auth**: login, registro (con los campos no convencionales del RF — sangre, ojos, vacaciones), logout. `Auth` service con signals `session` y `rol`, cargadas desde `profiles` on auth state change.  
> * **Guard de admin** (`adminGuard`) protegiendo `/admin` a nivel de ruta, con `Auth.listo` (ver bug corregido más arriba). Todas las pantallas de `/admin` tienen un link "← Volver" (a su listado si lo tiene — ej. `pelicula-form` → `/admin/peliculas` — o si no a `/admin`).  
> * **Panel admin completo para catálogo base**: películas (alta/edición, géneros multi-select, activar/desactivar), géneros (alta), **salas (listado en `/admin/salas` con borrado + alta en `/admin/salas/nueva`)**, funciones (alta/edición con asignación automática de sala), categorías de producto (alta), productos (alta/edición), usuarios (listado con selector de rol).  
>   **Borrado de sala — decisión sobre qué cascadea y qué no**: al principio `funciones_sala_id_fkey` no tenía cascada, así que borrar una sala con funciones fallaba siempre por FK. Se cambió a `ON DELETE CASCADE` (migración `cascade_borrado_funciones_al_borrar_sala`) porque no tiene sentido bloquear el borrado de una sala solo porque tiene funciones sin vender — es más trabajo para el admin (borrar función por función a mano) sin ganar nada. **Pero `entradas_funcion_id_fkey` se dejó en `NO ACTION` a propósito**: si alguna de esas funciones ya tiene entradas vendidas, el borrado de la sala sigue fallando (código `23503`, capturado y mostrado como "hay entradas vendidas para funciones de esta sala") — nunca se cascadea el borrado hasta destruir un registro de venta real. Probado end-to-end contra la base: sala+función sin entradas se borra en cascada; sala+función+entrada vendida bloquea el borrado.  
> * **Home pública**: stub funcional que lista películas (`listar()`) y destaca más vistas (`masVistas()`) vía `PeliculaService`, con botón de logout. Sin buscador por género ni sección "Próximamente" todavía.  
> * **Flujo de compra en dos pantallas** (`/peliculas/:id` → `/peliculas/:peliculaId/funciones/:funcionId/butacas`): mapa real de butacas de la sala (4/20/4 normal, 2/10/2 fila accesible "J" con borde verde, R/S/T VIP con borde dorado, ocupadas en rojo), se elige butaca y "Comprar" crea orden+entrada reales en Supabase y descarga un PDF con QR (ver sección QR más arriba). Sin pago real, cupón/crédito/puntos, validación de edad, ni bloqueo en tiempo real de la butaca mientras otro la está por comprar.  
> * **Perfil**: componente placeholder, sin contenido (ni puntos, ni historial, ni "Mis entradas").  
> * **Deploy**: Firebase Hosting configurado, preview automático por PR vía GitHub Actions.

### **Pendiente (no implementado)**

> * Resto del flujo de cliente final: buscador/filtro por género, reseñas, bloqueo de butacas en tiempo real mientras otra compra está en curso, medio de pago, cupón primera compra, puntos/fidelización, "Mis entradas" (con cancelación), "Mis películas", candy bar (compra) y combos, validación de edad contra `restriccion_edad`, preventa (`precio_preventa`).  
> * Rol empleado: guard, pantalla de escaneo/validación de QR, ingreso manual de código.  
> * Reportes de admin: facturación diaria, entradas vendidas (export PDF/Excel), gráfico de más vistas por semana/mes, producto de candy bar más vendido, log de actividad.  
> * PWA (`ng add @angular/pwa` todavía no corrido).  
> * Cupones y recompensas de puntos como entidades de catálogo gestionables desde el admin (tablas existen en el modelo pero sin UI).  
> * Guard de ruta para `/empleado`.  
> * Workflow de deploy a producción (`push` a `main`) — hoy el `firebase deploy` a producción es manual.
