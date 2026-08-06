# Rediseño: Cuenta, perfil y preferencias (SaaS multiempresa)

Documento de **diagnóstico**, **arquitectura propuesta** y **plan de implementación** alineado con el objetivo: experiencia de producto profesional, fuente de verdad en servidor, y sin duplicar lógica crítica entre barra lateral y `/profile`.

---

## 1. Diagnóstico técnico (implementación previa)

- **Un solo servicio de verdad en backend** para leer/actualizar perfil: `ProfileService` usado por `/api/v1/profile` y por `authService.getProfile` (p. ej. `GET /auth/me`). Bien.
- **Duplicación de contrato** residual: `PATCH /api/v1/auth/profile` y `PATCH /api/v1/profile` podían divergir si `auth.schema` y `profile.schema` no compartían el mismo Zod. Se unifica reutilizando el esquema extendido del módulo `profile`.
- **Front**: `ProfilePage` concentraba formulario monolítico, tema como `<select>`, feedback genérico, poca separación de bloques y sin resumen de cuenta. `SidebarThemeToggle` y el formulario duplicaban `PATCH` + invalidación de query.
- **Tema**: `ThemeProvider` resolvía bien `LIGHT` / `DARK` / `SYSTEM` y escuchaba `prefers-color-scheme`, pero **faltaba script anti flash** antes del primer paint; `meta[theme-color]` fijado en build podía chocar con claro/oscuro hasta hidratar.
- **Sincronización**: Tras guardar, se mezclaba `setUser` con `invalidateQueries(['profile'])` — correcto en esencia, pero el tema en sidebar no tenía **optimistic update** ni reversión clara.
- **Seguridad**: `passwordHash` no se expone en `select` de perfil. Cambio de email con contraseña y audit log ya existían. **Rol, companyId** no se aceptan en `PATCH` de perfil (correcto).
- **Sesiones**: Listado y revocación unitaria existían; faltaba **“cerrar el resto de sesiones”** conociendo la sesión actual (JWT `sessionId`).

---

## 2. Problemas detectados (lista breve)

| # | Problema | Impacto |
|---|----------|--------|
| 1 | Esquemas `auth` / `profile` desalineados para el mismo concepto | Riesgo de dos APIs con distintas reglas |
| 2 | Página de cuenta monolítica y poco “producto” | UX y mantenimiento |
| 3 | Tema: select pobre y sin abstracción compartida con el sidebar | Inconsistencia y peor percepción de calidad |
| 4 | Sin anti flash | Parpadeo al cargar |
| 5 | Sin `revoke-others` en API | Flujo de seguridad incompleto |
| 6 | Perfil API sin metadatos útiles (empresa, fechas, estado) | Resumen de cuenta pobre |

---

## 3. Arquitectura frontend propuesta

- **Capa de datos**: `useProfileQuery()` (React Query) + claves `['profile']` centralizadas.
- **Mutación tema**: `useUpdateThemePreference()` — optimistic update, `localStorage` (`nc-theme`), `setUser`, caché de `profile`, reversión y mensaje de error amable.
- **Mutación secciones**: `useUpdateProfileFields()` acepta **solo parcial** (solo campos enviados, comparación de dirty en formularios o helper).
- **Presentación**: `ProfilePage` orquesta; piezas en `features/profile/components/` (cards, resumen, pickers, formularios acotados).
- **Navegación sub-secciones**: `ProfileLayout` incluye tabs horizontales (Cuenta · Contraseña · Sesiones) además del sidebar, para reforzar jerarquía en móvil/desktop.

---

## 4. Nueva estructura UX (bloques en `/profile`)

- **A — Resumen**: avatar, nombre, email, rol, empresa, estado, último acceso, fecha de alta.
- **B — Datos personales** (guardar independiente).
- **C — Preferencias** (guardar independiente): idioma, zona horaria, formato 24/12h, formato de fecha; **tema** con selector de tarjetas (guardado inmediato, compartido con el sidebar).
- **D — Identidad visual**: subida, quitar, editor de avatar por defecto.
- **E — Correo**: flujo con contraseña; microcopy de seguridad.
- **F — Seguridad**: enlaces a contraseña, sesiones; texto sobre cierre de sesión global (contraseña).
- **G — Zona de peligro**: sin eliminar cuenta hasta existir flujo y política; mensaje informativo y CTA a soporte si aplica.

---

## 5. Componentes frontend (referencia)

| Componente | Responsabilidad |
|------------|-----------------|
| `ProfileSectionCard` | Card con título, descripción, children |
| `AccountSummaryCard` | Resumen (A) |
| `PersonalInfoForm` | (B) |
| `ThemePreferencePicker` | (C) tarjetas SYSTEM / LIGHT / DARK |
| `PreferencesForm` | (C) resto, botón guardar |
| `AvatarSettingsSection` | (D) |
| `EmailChangeCard` | (E) |
| `SecuritySummaryCard` | (F) |
| `ProfileDangerZoneCard` | (G) |
| `ProfileSubNav` | Tabs Cuenta / Contraseña / Sesiones |
| `FormField` / `StatusBadge` | primitivos reutilizables |

---

## 6. Cambios backend (resumen)

- **Unificar validación** de actualización de perfil con un único `updateProfileExtendedSchema` (o export compartido).
- **`GET` perfil** ampliado: `lastLoginAt`, `createdAt`, `status` (lectura), `company: { id, name, status } | null`, `displayName`, `timeFormat`, `dateFormat` si existen en BD.
- **`PATCH`**: solo campos permitidos; nunca `role` ni `companyId` vía cuerpo de perfil.
- **Sesiones**: `GET` incluye `currentSessionId` para marcar “esta sesión”; `POST /sessions/revoke-others` revoca el resto.

## 7. Prisma (no destructivo)

- Columnas añadidas (nullable, sin borrar datos): `display_name`, `time_format`, `date_format` (strings con validación Zod en API).

## 8. Tema: utilidades y ThemeProvider

- `getStoredThemePreference` = lectura de `nc-theme` (alias documentado con `readStoredThemePreference`).
- `isValidTheme`, `applyResolvedTheme(mode)`: clas `dark`, `colorScheme`, `meta theme-color`.
- **Anti flash**: script inline en `index.html` antes del bundle, con `try/catch` si `localStorage` falla.
- `ThemeProvider` llama a `applyResolvedTheme` al cambiar el modo resuelto.

## 9. Sincronización (Zustand + React Query + `localStorage`)

- **Orden de preferencia** para el modo: `user.theme` (Zustand, refleja servidor) → `nc-theme` → `SYSTEM`.
- Tras login/`/auth/me`, el servidor pisa el tema; `writeStoredThemePreference` en cada guardado exitoso de tema alinea flash futuro.
- **Tema desde sidebar o desde perfil**: misma mutación y mismos `onMutate`/`onError`.

## 10. Checklist de seguridad

- [x] No exponer `passwordHash` ni secretos.
- [x] Email y contraseña: endpoints dedicados y validación.
- [x] No aceptar elevación de rol/empresa vía `PATCH` perfil.
- [x] Enums validados (Theme, idioma, formatos).
- [x] Revocar sesión ajena: solo con permisos; `revoke-others` atado al `userId` del token.

## 11. Checklist de accesibilidad

- Labels reales, `aria-describedby` en errores donde aplique.
- Tarjetas de tema: `role="group"`, `aria-pressed` en el valor activo, teclado y foco visible.
- Botones destructivos o de revocación claramente identificados.
- Contraste en claro/oscuro revisado con tokens y `dark:`.
- `img` con `alt` descriptivo o decorativo con `alt=""` solo si es puramente decorativa.

## 12. Fases de implementación (orden)

1. Migración Prisma + `profile` service/schema + alinear `auth` con el mismo Zod; sesiones `currentSessionId` + `revoke-others`.
2. `theme.ts` + anti flash + `ThemeProvider`.
3. Hooks `useProfileQuery`, `useUpdateThemePreference`, `useUpdateProfileFields`.
4. Componentes y nueva `ProfilePage` + `ProfileLayout` (tabs).
5. `SidebarThemeToggle` a hooks; tipos `AuthUser` y tests manuales de flujos.
6. Documentación (este archivo) y, si aplica, actualizar `docs/CUENTA_Y_TEMA.md` con enlace.

---

*Este documento se acompaña de la implementación en el repositorio; las rutas y nombres de archivos reales viven bajo `jejeje/frontend` y `jejeje/backend`.*

---

## 16. Implementación aplicada (resumen)

- **Prisma:** columnas `display_name`, `time_format`, `date_format` (ver migración `20260427010000_profile_display_preferences`). Desplegar con `npx prisma migrate deploy` (o `db push` en entorno de prueba) y `npx prisma generate`.
- **API perfil:** `mapToClient` enriquecido (empresa, fechas, estado, nuevos campos); `PATCH` acepta los nuevos campos; `updateProfileSchema` de `auth` unificado con `updateProfileExtendedSchema`.
- **API sesiones:** respuesta con `currentSessionId` e `isCurrent` por fila; `POST /api/v1/sessions/revoke-others`.
- **Tema:** `getStoredThemePreference`, `applyResolvedTheme`, script anti flash en `index.html`, `ThemeProvider` actualizado.
- **Hooks:** `useProfileQuery`, `useUpdateThemePreference` (optimistic), `useUpdateProfileFields`.
- **UI:** nuevas cards y formularios; `ProfilePage` reescrita; `ProfileLayout` con `ProfileSubNav`; `SessionsPage` y `ChangePasswordPage` con cabecera; `SidebarThemeToggle` unificado con el hook de tema.

Si Prisma no regenera en Windows por bloqueo de `query_engine`, cierra procesos que usen el cliente y vuelve a `npx prisma generate`.
