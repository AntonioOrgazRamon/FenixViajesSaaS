# Bibliotecas visual de viajes y propuestas

Guía para demo, permisos y API interna (`jejeje`).

## Rutas SPA

| Ruta | Descripción |
|------|-------------|
| `/travel/library` | Listado visual de viajes del tenant |
| `/travel/library/:tripId` | Ficha detalle del viaje |
| `/proposals/library` | Listado visual de propuestas del tenant |
| `/proposals/library/:proposalId` | Detalle con HTML incrustado, PDF y timeline |

## Roles

| Rol | Viajes | Propuestas | Acciones admin |
|-----|--------|------------|----------------|
| `COMPANY_USER` | Ver biblioteca y ficha | Ver biblioteca y detalle, PDF/HTML, abrir lead | No aprueba viajes ni cambia estado de propuesta |
| `COMPANY_ADMIN` | Todo lo anterior | Todo lo anterior | Aprobar viajes, enriquecer media (cola), PATCH estado propuesta, reenvío notificación vendedores |
| `SUPER_ADMIN` | Todo lo anterior | Todo lo anterior | Debe elegir **empresa** (`companyId` en query) en todos los `fetch` |

## Endpoints (multi-tenant)

Base: `/api/v1`

### Viajes

- `GET /travel/trips/library` — lista + métricas. Query: `page`, `pageSize`, `preset`, `q`, `country`, `city`, `style`, `status`, `companyId` (solo super).
- `GET /travel/trips/library/:tripId` — ficha enriquecida. Query: `companyId` (solo super).
- `POST /travel/trips/:id/media/enqueue` — cola enriquecimiento (admin catálogo).
- `POST /travel/trips/:id/approve` — aprobar (admin catálogo).

### Propuestas

- `GET /proposals/library` — lista + métricas. Query: `page`, `pageSize`, `preset`, `status`, `leadId`, `destination`, `hasPdf`, `hasHtml`, `dateFrom`, `dateTo`, `q`, `companyId` (solo super).
- `GET /proposals/library/:proposalId` — detalle (lead, última versión, historial, actividades).
- `GET /proposals/library/:proposalId/pdf` — descarga PDF de la última versión con PDF.
- `PATCH /proposals/library/:proposalId` — body `{ status?, assignedUserId? }`. Roles: `COMPANY_ADMIN`, `SUPER_ADMIN`. Query: `companyId` (super).
- `POST /proposals/library/:proposalId/notify-sellers` — reintenta email a vendedores (audita `SELLER_NOTIFIED`). Roles: `COMPANY_ADMIN`, `SUPER_ADMIN`.

## Filtros rápidos (propuestas)

Presets admitidos en servidor (campo `preset`): `draft`, `generated`, `sent`, `accepted`, `rejected`, `with_pdf`, `without_pdf`, `with_html`.

## QA manual (checklist)

1. Como `COMPANY_USER`, solo ves datos de tu empresa (sin `companyId` en query).
2. Como `COMPANY_ADMIN`, puedes aprobar viaje desde la ficha y encolar imágenes si está `APPROVED`.
3. Como `SUPER_ADMIN`, sin `companyId` la API debe responder error de validación; con empresa seleccionada, datos coherentes.
4. Viajes sin hero muestran fallback en cards y en detalle.
5. Propuesta sin PDF: card muestra aviso; botón PDF oculto en detalle si no hay `pdfStoragePath`.
6. Buscador de propuestas (`q`) filtra por nombre/email/teléfono de lead e ID de propuesta.
7. Cambiar filtros resetea a página 1 en cliente.
8. Paginación: total coherente con backend.
9. Descarga PDF usa cookie/header Bearer vía `axios` + `blob`.
10. HTML: iframe `srcDoc` en detalle + “HTML completo” abre pestaña.
11. No debe ser posible ver propuesta o viaje de otra empresa cambiando solo el ID en la URL (404/forbidden según caso).

## Si ves «Error interno del servidor» en biblioteca de viajes

1. **Revisa logs del backend** (la respuesta 500 genérica oculta el detalle; el log sí muestra el stack trace de Prisma/MySQL).
2. **Aplica migraciones**: `npx prisma migrate deploy` en el entorno donde corre la API (tablas nuevas como import JSON / geo pueden faltar).
3. En la UI ya **no se muestra** «No hay viajes…» cuando la petición falla: verás el mensaje de error y un panel dedicado.
4. El listado de la biblioteca **ya no hace join** con `travel_json_import_items` solo para las tarjetas (evita 500 si esa tabla no existe en BD antigua). La ficha detalle del viaje sigue pudiendo usar ese include; si fallara ahí, el mismo checklist de migraciones aplica.

## Demo sugerida

1. Entrar como admin → **Biblioteca viajes** → abrir ficha → playground desde cabecera.
2. Generar propuesta desde un lead → **Biblioteca propuestas** → ver métricas → abrir detalle → timeline.
3. Entrar como usuario empresa → comprobar mismas bibliotecas en solo lectura (sin PATCH ni notify).
