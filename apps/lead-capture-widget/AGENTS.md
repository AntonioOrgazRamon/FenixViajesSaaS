# apps/lead-capture-widget — contexto para agentes

Se carga solo al trabajar en esta carpeta. Las reglas firmes están en el [AGENTS.md raíz](../../AGENTS.md).

- Angular 19, **fuera del workspace de npm**: `cd apps/lead-capture-widget && npm install && npm start` (:4200). Motivo [A CONFIRMAR] (T006).
- ⚠️ Hoy envía `POST /api/v1/leads` con un JWT de usuario de empresa pegado a mano y guardado en `localStorage`; **no** usa el endpoint público `/api/v1/public/leads/form` (hallazgo H6). No lo cambies salvo que la tarea lo pida.
- No hay tests (`ng test` existe, pero no hay ningún `.spec.ts`). Verificación mínima: `npm run build` en esta carpeta.
- Detalles de configuración: [README.md](./README.md).
