# @fenix/contracts

Tipos y esquemas del contrato público entre `apps/api` y sus consumidores (`apps/panel`, y potencialmente `apps/lead-capture-widget` en el futuro).

## Alcance actual (deliberadamente mínimo)

Este paquete es un piloto: contiene un único contrato, `Role`, que antes estaba duplicado en tres sitios (`apps/api/prisma/schema.prisma`, `apps/panel/src/store/authStore.ts` y un `z.enum(...)` suelto en `apps/panel/src/features/superadmin/pages/SuperUserEditPage.tsx`). Se movió aquí como caso piloto porque era pequeño, tenía una duplicación verificable y su riesgo de cambiar era mínimo.

**No** se ha hecho una extracción masiva de todos los tipos compartibles entre `apps/api` y `apps/panel` — eso queda para un trabajo aparte, deliberado, no como efecto secundario de esta migración estructural.

## Qué debe vivir aquí

Formas de datos que cruzan la frontera HTTP entre `apps/api` y sus consumidores: enumeraciones de negocio, formas de petición/respuesta. Código realmente compartido por más de una aplicación — nunca "por si acaso" se necesita en el futuro.

## Qué nunca debe vivir aquí

- Modelos internos de Prisma o cualquier tipo que dependa de `@prisma/client`.
- Hashes, secretos, tokens o cualquier dato sensible.
- Entidades privadas de base de datos que no se exponen tal cual por la API.
- Detalles de infraestructura (conexión a BD, colas, storage).
- Servicios o lógica de negocio del backend.
- Lógica específica de una única aplicación.

## Quién puede depender de este paquete

`apps/api`, `apps/panel`, `apps/lead-capture-widget`. Nadie más — y este paquete, a su vez, no debe depender nunca de ninguna `apps/*` (ver `docs/architecture/` para la regla completa de dependencias del monorepo).

## Estado de adopción

- `apps/panel`: consume `Role`/`ROLE_VALUES` desde aquí (`authStore.ts` re-exporta `AppRole` como alias de `Role` para no romper el resto del código que ya lo usaba).
- `apps/api`: **todavía no lo consume**. Su fuente de verdad interna sigue siendo el `enum Role` generado por Prisma (correcto para código que toca la base de datos). Conectar la capa de esquemas HTTP (Zod) de `apps/api` a este mismo paquete es un paso natural pendiente, pero se dejó fuera de este piloto a propósito para mantener acotado el riesgo de esta migración estructural — tocar las validaciones de entrada de la API es un cambio de mayor superficie que ligar un único store de frontend.
