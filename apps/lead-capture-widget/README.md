# Demo Angular · captación de leads (viajes)

> ⚠️ **Contradicción conocida (auditoría 2026-10-05)**: el README raíz presenta esta app como «formulario público embebible», pero hoy exige el JWT de un usuario de empresa y no usa el endpoint público `POST /api/v1/public/leads/form`. Ver hallazgo H6 en [TAREAS.md](../../docs/development/TAREAS.md).

SPA **independiente** del frontend React del SaaS. Construye un `travelProfile` rico (duración, tags, preferidos, fechas, presupuesto con alcance) y envía `POST /api/v1/leads`.

## Configuración

Archivo principal: `src/environments/environment.common.ts`

- `apiBaseUrl` — ej. `http://localhost:3000/api/v1`
- `companyId` — referencia documental; el **tenant efectivo lo fija el JWT**
- `saasFrontendUrl` — ej. `http://localhost:5173` (enlace «Abrir lead en SaaS»)
- `debugLogPayload` — si es `true`, se hace `console.log` del JSON del body antes del POST (desarrollo)

En pantalla: **Configuración API** guarda token y URL base en `localStorage`.

### Auth

`POST /leads` requiere JWT de **COMPANY_ADMIN** o **COMPANY_USER**. El token debe ser de la empresa donde quieres crear el lead.

### CORS

En desarrollo el backend permite `http://localhost:4200` (véase `apps/api/src/index.ts`).

## Comandos

```bash
cd apps/lead-capture-widget
npm install
npm start
```

Build producción:

```bash
npm run build
```

(En producción `debugLogPayload` se fuerza a `false` vía `environment.production.ts`.)

## Ejemplo de payload (debug / cuerpo del POST)

Tras **Rellenar ejemplo** y enviar, el body es análogo a:

```json
{
  "name": "Laura Martínez",
  "email": "laura.qa@example.com",
  "phone": "+34 600 000 123",
  "message": "Queremos una luna de miel especial, cultural y gastronómica, con algo de naturaleza, sin que sea un viaje demasiado acelerado.",
  "travelProfile": {
    "destinationText": "Asia",
    "preferredDestinations": ["Tailandia", "Japón"],
    "activitiesText": "cultura, gastronomía, naturaleza, templos, mercados locales",
    "activityTags": ["Cultura", "Gastronomía", "Naturaleza", "Templos"],
    "durationDays": 14,
    "travelDateText": "octubre 2026",
    "travelDateFrom": null,
    "travelDateTo": null,
    "budgetAmount": 4000,
    "budgetCurrency": "EUR",
    "budgetType": "PER_PERSON",
    "tripType": "HONEYMOON",
    "departureAirportText": "Madrid"
  }
}
```

## Respuesta backend (creación)

Forma típica:

```json
{
  "success": true,
  "data": {
    "id": "uuid-del-lead",
    "fullName": "Laura Martínez",
    "email": "laura.qa@example.com",
    "status": "NEW",
    "travelProfile": { }
  }
}
```

La aplicación muestra `data.id` y un enlace a `{saasFrontendUrl}/leads/{id}`. La propuesta se genera desde el SaaS (no en esta SPA).

## Estructura

- `src/app/lead-capture/` — formulario por secciones + chips de actividades
- `src/app/services/lead-form.service.ts` — cliente `POST /leads`
- `src/app/services/app-settings.service.ts` — persistencia local de token y URL
- `src/app/models/lead-capture.models.ts` — tipos del payload
