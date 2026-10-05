# Integracion frontend - formulario publico de leads

> ⚠️ **Contradicción conocida (auditoría 2026-10-05)**: este documento describe el endpoint público `POST /api/v1/public/leads/form`, pero `apps/lead-capture-widget` no lo usa: envía `POST /api/v1/leads` con un JWT pegado a mano. Ver hallazgo H6 en [TAREAS.md](../development/TAREAS.md).

Guia para el equipo frontend sobre como enviar formularios publicos al sistema interno de leads.

---

## Endpoint oficial

- **Metodo:** `POST`
- **URL:** `/api/v1/public/leads/form`
- **Auth de usuario:** no requerida
- **Rate limit:** activo en backend para evitar abuso
- **Header opcional/condicional:** `X-Integration-Token`
  - Si la empresa tiene `integrationToken`, este header pasa a ser obligatorio.

---

## Payload requerido

```json
{
  "company_slug": "fenixviajes",
  "origin": "landing-home",
  "source_detail": "hero-form",
  "destination": "Japon",
  "travel_date": "2026-09-15",
  "seats": 2,
  "first_name": "Ana",
  "last_name": "Perez",
  "email": "ana@example.com",
  "phone": "+34 600 123 123",
  "raw_payload": {
    "utm_source": "google",
    "utm_campaign": "japon-otono"
  }
}
```

---

## Validaciones de backend (obligatorias)

- `company_slug`: requerido.
- `destination`: requerido.
- `travel_date`: requerido y fecha valida.
- `seats`: entero mayor que 0.
- `first_name`: requerido.
- `last_name`: requerido.
- `email`: requerido y con formato valido.
- `phone`: requerido y formato razonable (`+`, espacios, parentesis, guiones, numeros; 7-20 chars).

Si falla algo, backend responde error claro en `error.message`.

---

## Respuestas esperadas

### Exito (lead creado o detectado como duplicado)

```json
{
  "success": true,
  "data": {
    "id": "uuid-del-lead",
    "status": "PENDING_REVIEW",
    "duplicated": false
  },
  "message": "Solicitud recibida correctamente."
}
```

### Exito con posible duplicado

```json
{
  "success": true,
  "data": {
    "id": "uuid-lead-existente",
    "status": "PENDING_REVIEW",
    "duplicated": true
  },
  "message": "Solicitud recibida correctamente."
}
```

> `duplicated: true` significa que backend detecto un lead muy parecido en ventana corta y evito crear uno nuevo.

### Error de validacion

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El numero de plazas debe ser mayor que 0"
  }
}
```

Otros errores posibles:
- `Empresa no encontrada`
- `Token de integracion invalido o ausente`
- `Demasiadas solicitudes de intake` (rate limit)

---

## Reglas de UX recomendadas para el formulario

- Deshabilitar boton mientras se envia.
- Mostrar mensajes de campo antes de enviar (validacion frontend) y respetar mensaje final de backend.
- Si `success=true`, mostrar confirmacion: **"Solicitud recibida correctamente."**
- Si `duplicated=true`, puedes mantener el mismo mensaje de exito (no tratar como error).
- Guardar `origin` con un identificador estable de componente/pagina (`landing-home`, `travel-page-sidebar`, etc.).

---

## Ejemplo de integracion (frontend)

```ts
const payload = {
  company_slug: "fenixviajes",
  origin: "landing-home",
  source_detail: "hero-form",
  destination: form.destination,
  travel_date: form.travelDate, // "YYYY-MM-DD" recomendado
  seats: Number(form.seats),
  first_name: form.firstName,
  last_name: form.lastName,
  email: form.email,
  phone: form.phone,
  raw_payload: {
    utm_source: utm.source,
    utm_campaign: utm.campaign,
  },
};

const { data } = await api.post("/public/leads/form", payload, {
  headers: {
    "X-Integration-Token": integrationToken, // enviar si aplica
  },
});
```

---

## Como se refleja en panel interno

El lead aparece en la vista interna de leads con:

- nombre completo
- destino
- fecha de viaje
- plazas
- correo
- telefono
- estado inicial `PENDING_REVIEW`
- fecha de entrada

---

## Checklist QA frontend

- [ ] envio valido crea lead en panel interno
- [ ] campos vacios muestran error correcto
- [ ] email invalido muestra error correcto
- [ ] seats = 0 muestra error correcto
- [ ] fecha invalida muestra error correcto
- [ ] token faltante/invalido (si empresa lo exige) devuelve error claro
- [ ] doble submit rapido no rompe UX
- [ ] payload con `origin` y `raw_payload` llega correctamente

