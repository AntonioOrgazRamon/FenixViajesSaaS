# Cuenta, apariencia y tema (claro, oscuro, sistema)

Documento de referencia sobre la sección **Cuenta** del producto, la **preferencia de tema** (modo claro, oscuro, sistema), cómo se persiste en **base de datos** y en el **cliente**, y cómo afecta a la **UI** (incluidos colores y variantes `dark` en Tailwind).

---

## 1. Qué se entiende por «Cuenta»

En el shell de la aplicación (`AppShell`), el bloque de perfil agrupa la navegación a:

| Ruta | Uso |
|------|-----|
| `/profile` | **Cuenta**: datos personales, preferencias (idioma, tema, zona horaria), **correo** (cambio con contraseña), e **identidad** (foto/avatar) |
| `/profile/password` | **Contraseña** |
| `/profile/sessions` | **Sesiones** activas |

Ese conjunto (cuenta, contraseña, sesiones) comparte el mismo marco de navegación; este documento se centra en **cuenta y aspecto visual**, incluido el **tema**.

---

## 2. Preferencia de tema: valores y significado

La preferencia es un enum de tres valores (misma letra en API, front y base de datos):

| Valor | Nombre en UI | Comportamiento |
|--------|----------------|----------------|
| `LIGHT` | Claro | Fuerza **apariencia clara** (independientemente del sistema) |
| `DARK` | Oscuro | Fuerza **apariencia oscura** |
| `SYSTEM` | Sistema | Sigue el **tema del sistema** (`prefers-color-scheme: dark`) en tiempo real |

- **Origen del valor:** usuario autenticado, campo almacenado en servidor; por defecto en BD: `SYSTEM` (`User.theme` en Prisma, enum `Theme`).

- **Cómo se elige en la app:**
  - Página **Cuenta y preferencias** (`ProfilePage`): selector *Tema* (Sistema / Claro / Oscuro).
  - **Barra lateral** – componente `SidebarThemeToggle`: tres botones (sol / luna / monitor) que hacen `PATCH` con solo `{ theme: 'LIGHT' | 'DARK' | 'SYSTEM' }` y actualizan sesión + `localStorage` (ver §4).

---

## 3. De la base de datos a la UI

### 3.1 Almacenamiento (Prisma / MySQL)

- Campo: `users.theme` → enum `Theme` (`LIGHT`, `DARK`, `SYSTEM`).

- Idioma de la interfaz se guarda en `users.locale` (p. ej. `es` / `en`); en las respuestas al cliente suele ir como `language` para el front.

- Validación en API: `updateProfileExtendedSchema` acepta `theme` y `language` como opcionales, entre otros.

### 3.2 Sincronización con el documento (modo claro/oscuro real)

El flujo de renderizado vive en `ThemeProvider` (envuelve la app en `main.tsx`):

1. Se lee `user?.theme` del **Zustand** `authStore` (datos de sesión tras login o actualización de perfil).
2. Si aún no hay usuario o no trae `theme`, se usa copia en **localStorage** (`nc-theme`) — útil al cargar o antes de hidratar sesión.
3. Si tampoco hay nada, se asume `SYSTEM`.
4. Con `matchMedia('(prefers-color-scheme: dark)')` se mantiene el **modo del sistema** reactivo (cambia si el usuario cambia el sistema).
5. `resolveThemeToMode(pref, systemIsDark)` devuelve `light` o `dark` efectivo:
   - `LIGHT` → `light`
   - `DARK` → `dark`
   - `SYSTEM` → `dark` o `light` según el sistema
6. Ese modo se aplica a:
   - `document.documentElement.classList` → clase `dark` en el `<html>` (activa el tema oscuro de Tailwind y de los tokens CSS en `index.css`)
   - `document.documentElement.style.colorScheme` → `dark` o `light` (navegadores / barra, etc.)
   - `<meta name="theme-color" content="...">` (barra móvil / cromo): aprox. `#09090b` en oscuro y `#fafafa` en claro

### 3.3 Cómo se “pinta” el claro/oscuro (visión rápida)

- **Tailwind v4 (proyecto):** variante `dark` definida en `index.css` con  
  `@custom-variant dark (&:where(.dark, .dark *));`  
  Es decir: cualquier ancestro con clase `dark` en el `<html>` aplica reglas con prefijo `dark:`.
- **Tokens de fondo:** en `:root` (claro) y en `html.dark` se sobreescriben variables como `--color-app-bg`, bordes, etc., para alinear con la paleta zinc/ámbar de la app.

**Resumen:** “modo oscuro” o “fondo blanco / claro” en pantalla **no** son un archivo aparte: son el mismo layout con **clase `dark` en `<html>`** y utilidades `dark:…` o variables CSS según el modo resuelto.

### 3.4 Persistencia local (localStorage)

- Clave: `nc-theme`
- Se escribe cuando el usuario **guarda el formulario de cuenta** (si se envió `theme`) o cuando **cambia el tema** desde el toggle del sidebar, Tras un `PATCH /profile` exitoso.
- Sirve de respaldo inmediato para el `ThemeProvider` si el objeto `user` aún no refleja el valor.

---

## 4. Dónde se actualiza el tema (API y front)

- **Misma operación** en los dos sitios: `PATCH /api/v1/profile` con cuerpo JSON, por ejemplo `{ "theme": "DARK" }` (a menudo junto a otros campos de perfil).

- **Cuenta (formulario completo):** al enviar preferencias, el front envía `theme` entre los campos; al éxito, fusiona el usuario en Zustand y llama a `writeStoredThemePreference` si vino un `theme` en la respuesta.

- **Barra lateral:** `SidebarThemeToggle` solo manda `theme` y, en `onSuccess`, actualiza el store, el `localStorage` e invalida la query `['profile']` para que Cuenta muestre datos alineados.

Tras el login, el objeto de usuario en sesión debería incluir `theme` (y el resto de campos mapeados por el servicio de auth), de modo que el `ThemeProvider` tenga de inmediato la preferencia de servidor, con refuerzo desde `nc-theme` si aplica.

---

## 5. Otras “preferencias de cuenta” (además del tema)

En la **misma** pantalla de Cuenta suelen ir:

- Nombre, apellidos, teléfono  
- **Idioma** (`es` / `en`) – persistido en `users.locale`  
- **Zona horaria** (texto) – `users.timezone`  
- **Correo** – flujo separado (contraseña actual) en la misma página, distinto `PATCH` de email

La **identidad (avatar)**: subida, borrado, avatar por defecto (iniciales, colores, forma) vía endpoints bajo perfil; no afecta al enum `Theme`, solo a imágenes y a componentes de avatar.

---

## 6. Glosario breve

| Término | Uso en este contexto |
|---------|------------------------|
| **Cuenta** | Pantalla `/profile` (datos, preferencias, email, avatar) y sub-sección en el menú lateral. |
| **Tema (LIGHT / DARK / SYSTEM)** | Preferencia guardada en `User.theme` y replicada en el cliente. |
| **Modo claro/oscuro efectivo** | `light` o `dark` resultante de `resolveThemeToMode` (lo que pone la clase `dark` en el HTML). |
| **Fondo claro / “blanco”** | Modo claro: tokens y utilidades base sin “oscurecer” el shell (p. ej. fondos `bg-white`, `zinc-50`, etc.). |
| **Modo oscuro** | `html` con clase `dark` + utilidades `dark:…` y variables en `html.dark` en `index.css`. |
| **nc-theme** | Valor de respaldo en `localStorage` para alinear al usuario con su última preferencia guardada. |

---

## 7. Archivos principales a revisar o extender

| Área | Archivos típicos |
|------|-------------------|
| Tema (resolución, DOM) | `frontend/src/providers/ThemeProvider.tsx` |
| Helpers tema | `frontend/src/lib/theme.ts` |
| Toggle lateral | `frontend/src/components/layout/SidebarThemeToggle.tsx` |
| Cuenta (formulario) | `frontend/src/features/profile/pages/ProfilePage.tsx` |
| Estilos y variante `dark` | `frontend/src/index.css` |
| Tipo de usuario (sesión) | `frontend/src/store/authStore.ts` |
| API perfil (validación / actualización) | `backend/src/modules/profile/profile.schema.ts`, `profile.service.ts` |
| Modelo | `backend/prisma/schema.prisma` → `User.theme`, `Theme` enum |

---

*Última actualización: documentación alineada con el código bajo `jejeje/frontend` y `jejeje/backend` (enum `Theme`, `ThemeProvider`, Cuenta y `localStorage` `nc-theme`).*
