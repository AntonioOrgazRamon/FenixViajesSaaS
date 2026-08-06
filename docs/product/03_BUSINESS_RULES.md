# 03 — Reglas de negocio

> **Responsabilidad de este documento**: listar, de forma operativa, cómo se comporta (o debería comportarse) el sistema regla por regla. Las reglas ya vigentes se documentan aquí con su comportamiento exacto. Las reglas todavía sin decidir se listan por su pregunta, sin repetir el análisis de alternativas/ventajas/inconvenientes — ese análisis vive **únicamente** en [06_DECISIONS.md](./06_DECISIONS.md).

## Reglas vigentes hoy

### Ciclo de vida de un Lead
Un Lead avanza por una secuencia de estados restringida — no se puede saltar pasos ni retroceder libremente:

```
PENDING_REVIEW → NEW → QUALIFYING → QUALIFIED → CONTACTED ⇄ WAITING → CONVERTED → ARCHIVED
                                                      ↓                    ↓
                                                    LOST ──────────────→ ARCHIVED
```

- `ARCHIVED` es un estado terminal — no existe hoy una vía para reabrir un Lead archivado.
- No hay campo estructurado para registrar **por qué** un Lead se marcó como perdido (pregunta abierta — ver D014).
- Justificación de por qué esta máquina de estados es una regla firme, no una elección de implementación menor: **D023**.

### Catálogo de viajes
- Un Viaje pasa por un estado de calidad antes de ser vendible: borrador → pendiente de revisión → aprobado / rechazado.
- **Solo un Viaje en estado "aprobado" puede aparecer en una búsqueda o en una propuesta comercial.** Esto es una regla firme, no una limitación técnica — su justificación de negocio está en **D022**.
- Cuánta revisión humana es obligatoria antes de aprobar (frente a aprobación automática por calidad de datos) es, en cambio, una pregunta abierta de proceso operativo — no de esta plataforma, sino de cómo cada agencia decide operar su propio control de calidad.

### Propuestas comerciales
- Cada vez que se genera una propuesta para un Lead, se crea una **versión** nueva — nunca se sobrescribe una versión existente. Justificación: **D020**.
- Cada versión "congela" el precio y las condiciones del viaje en el momento exacto en que se generó — si el catálogo cambia después, las versiones ya generadas no se alteran retroactivamente.
- El comercial puede dejar que el sistema elija automáticamente qué viajes incluir en una propuesta, o elegirlos manualmente uno por uno.
- Notificar internamente al equipo de que una propuesta está lista no bloquea ni retrasa la generación de esa propuesta — son dos pasos desacoplados.
- Si una propuesta ya se envió y hace falta corregirla, hoy la única vía es generar una versión nueva completa — no existe edición parcial de una versión ya creada. Si esto debería cambiar para borradores previos a la primera generación es una pregunta abierta — **D018**.
- Cuánto tiempo sigue siendo válido el precio de una propuesta ya generada es una pregunta abierta — **D009**.
- Si un Lead puede tener una única propuesta (versionada) o varias propuestas independientes en paralelo es una pregunta abierta — **D003**.

### Aislamiento entre empresas (multi-tenant)
- Ningún dato de negocio (Lead, catálogo, propuesta, usuario) es visible ni accesible entre dos Empresas distintas bajo ninguna circunstancia — regla firme sin excepciones. Justificación: **D024**.
- El único rol que puede operar sobre el contexto de más de una Empresa es el Super administrador, y siempre debe indicar explícitamente sobre qué Empresa está actuando en cada acción — nunca se asume un contexto por defecto.

### Auditoría
- Toda acción comercial relevante (creación/cambio de estado de un Lead, generación de una propuesta, cambios de acceso de usuarios) queda registrada de forma permanente: quién la hizo, cuándo, y sobre qué. Justificación: **D025**.

## Reglas pendientes de decidir

Listadas aquí solo como pregunta — el análisis completo de opciones, ventajas, inconvenientes y consecuencias de cada una está en [06_DECISIONS.md](./06_DECISIONS.md), identificado por su ID:

| Pregunta | Decisión relacionada |
|---|---|
| ¿Un Cliente puede tener varios Leads a lo largo del tiempo? | D002 |
| ¿Un Lead puede generar más de una venta? | D002, D004 |
| ¿Un Lead puede tener varias propuestas independientes, no solo versiones de una? | D003 |
| ¿Una venta puede cancelarse, y bajo qué condiciones? | D004, D005 |
| ¿Un Viaje puede pertenecer a varios Proveedores a la vez? | D007 |
| ¿Un Hotel puede existir como entidad reutilizable en varios Viajes? | D006 |
| ¿El sistema debe procesar pagos o solo registrarlos? | D008 |
| ¿Una propuesta caduca automáticamente? | D009 |
| ¿Cómo se resuelve que dos comerciales trabajen el mismo Lead? | D010 |
| ¿La agencia opera o podría operar con varias sucursales? | D011 |
| ¿Se factura desde este sistema o desde una herramienta externa? | D012 |
| ¿Qué pasa con la cartera de un comercial que deja la empresa? | D013 |
| ¿Se registra un motivo estructurado cuando se pierde un Lead? | D014 |
| ¿Quién envía la propuesta al cliente, y por qué canal? | D015 |
| ¿El Proveedor es una entidad con condiciones comerciales propias o un dato descriptivo? | D016 |
| ¿Existe una única plantilla de propuesta o varias por segmento? | D017 |
| ¿Se permite editar un borrador antes de la primera generación? | D018 |
| ¿Cómo se gestiona el tipo de cambio entre proveedor y venta? | D019 |

Ninguna de estas preguntas se responde en este documento. Si necesitas tomar una de estas decisiones, hazlo directamente en [06_DECISIONS.md](./06_DECISIONS.md) — no la respondas de forma implícita en otro documento o en el código.
