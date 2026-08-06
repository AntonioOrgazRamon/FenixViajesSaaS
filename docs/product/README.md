# Documentación de producto — Fenix Viajes SaaS

Esta es la documentación **oficial de producto**: qué es el negocio, cómo funciona, qué está decidido y qué no. Es independiente del código — debería ser posible reconstruir el software desde cero leyendo únicamente estos documentos, sin abrir el repositorio.

No confundir con `jejeje/docs/` (nivel superior): esa carpeta contiene informes técnicos de QA, auditorías puntuales de sesiones de desarrollo y notas de implementación — documentación de **proceso**, no de **producto**. Si buscas por qué el negocio funciona como funciona, o qué decisión falta tomar, estás en el lugar correcto.

## Índice y cuándo leer cada documento

| Documento | Léelo cuando quieras saber... | Fuente de verdad de... |
|---|---|---|
| [00_PRODUCT_VISION.md](./00_PRODUCT_VISION.md) | Qué es el producto, a quién sirve, qué hace y qué no hace hoy | La visión y el alcance actual real |
| [01_BUSINESS_DOMAIN.md](./01_BUSINESS_DOMAIN.md) | Cómo funciona, en general, el negocio de una agencia de viajes (independientemente de este producto) | El conocimiento de dominio/sector |
| [02_DOMAIN_MODEL.md](./02_DOMAIN_MODEL.md) | Qué entidades existen y cómo se relacionan entre sí | El mapa de relaciones entre entidades |
| [03_BUSINESS_RULES.md](./03_BUSINESS_RULES.md) | Cómo se comporta el sistema regla por regla, hoy | Las reglas de negocio vigentes |
| [04_USER_FLOWS.md](./04_USER_FLOWS.md) | La secuencia de pasos de un caso de uso, en positivo y en negativo | Los flujos, felices y de excepción |
| [05_EDGE_CASES.md](./05_EDGE_CASES.md) | Qué pasa en un escenario límite concreto, y si el sistema ya lo cubre | El inventario de riesgo funcional |
| [06_DECISIONS.md](./06_DECISIONS.md) | Qué está decidido, qué sigue abierto, y por qué | **Toda** decisión de producto — la única fuente de verdad |
| [07_PRODUCT_ROADMAP.md](./07_PRODUCT_ROADMAP.md) | Qué hacer primero y por qué, a nivel de negocio | La priorización funcional (P0–P3) |
| [08_GLOSSARY.md](./08_GLOSSARY.md) | Qué significa exactamente un término del negocio | **Toda** definición de entidad — la única fuente de verdad |
| [09_FAQ.md](./09_FAQ.md) | Una duda rápida y frecuente, con enlace al detalle | Nada por sí mismo — siempre remite a otro documento |

## Ruta de lectura recomendada para alguien nuevo en el proyecto

```
README.md (este documento)
   ↓
00_PRODUCT_VISION.md
   ↓
01_BUSINESS_DOMAIN.md
   ↓
02_DOMAIN_MODEL.md
   ↓
06_DECISIONS.md
```

Con esos cinco documentos debería ser posible entender el producto completo — qué es, cómo funciona el negocio detrás, qué entidades maneja y qué decisiones están tomadas o pendientes — sin necesidad de abrir el código en ningún momento. El resto de documentos ([03](./03_BUSINESS_RULES.md), [04](./04_USER_FLOWS.md), [05](./05_EDGE_CASES.md), [07](./07_PRODUCT_ROADMAP.md), [08](./08_GLOSSARY.md), [09](./09_FAQ.md)) son de profundización, para cuando haga falta el detalle de una regla, un flujo, un caso límite, una prioridad o un término concretos.

## Reglas de mantenimiento de esta documentación

Para que este sistema no se degrade con el tiempo de la misma forma en que se degradó la documentación anterior:

1. **Una decisión de producto se documenta una única vez**, en [06_DECISIONS.md](./06_DECISIONS.md). Si la encuentras explicada en otro sitio, es un defecto — muévela allí y deja solo una referencia por ID.
2. **Una entidad se define una única vez**, en [08_GLOSSARY.md](./08_GLOSSARY.md). El resto de documentos la usan, nunca la redefinen.
3. **Ningún documento debe crecer indefinidamente mezclando temas.** Si un documento empieza a cubrir la responsabilidad de otro, es momento de separarlo — no de seguir añadiendo secciones.
4. **No se resuelve una decisión pendiente "de paso"** dentro de otro documento. Toda resolución de una decisión pasa por actualizar su estado en [06_DECISIONS.md](./06_DECISIONS.md).

## Estado de esta documentación

Generada a partir de una auditoría técnica, una auditoría funcional y un ejercicio de descubrimiento de producto realizados sobre el estado del repositorio a fecha 2026-08-06. Contiene **25 decisiones registradas** (19 pendientes, 6 ya aprobadas y en vigor) y un catálogo de **70 casos límite** identificados. Es un punto de partida, no un documento cerrado — debe seguir creciendo con cada decisión nueva que se tome.
