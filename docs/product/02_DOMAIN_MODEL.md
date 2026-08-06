# 02 — Modelo de dominio

> **Responsabilidad de este documento**: mostrar qué entidades de negocio existen y cómo se relacionan entre sí. Las **definiciones** de cada entidad viven únicamente en [08_GLOSSARY.md](./08_GLOSSARY.md) — aquí no se redefine ninguna, solo se muestra su lugar en el mapa. Las relaciones marcadas como **abiertas** remiten a la decisión correspondiente en [06_DECISIONS.md](./06_DECISIONS.md), que es la única fuente de verdad sobre esa duda.

## Mapa de entidades y relaciones

```
Empresa (tenant)
 ├─ tiene → Comercial(es)
 ├─ tiene → Catálogo (Viaje, Hotel, Destino, Proveedor)
 ├─ tiene → Lead(es)
 └─ tiene → Sucursal(es)                         [relación abierta — D011]

Lead
 ├─ pertenece a → Empresa
 ├─ asignado a → Comercial
 ├─ tiene → Interacciones/Seguimiento
 ├─ produce → Cliente, al convertirse            [relación abierta — D002]
 ├─ genera → Propuesta(s)                        [cardinalidad abierta — D003]
 └─ motivo de cierre (ganado/perdido)             [campo abierto — D014]

Cliente                                           [entidad abierta — D002]
 ├─ tiene → Lead(es) a lo largo del tiempo
 └─ tiene → Reserva(s)                            [relación abierta — D004]

Propuesta
 ├─ pertenece a → Lead
 ├─ tiene → Versión(es) (1 a N, siempre creciente, nunca se sobrescribe)
 ├─ referencia → Viaje(s) del catálogo
 ├─ tiene → fecha de validez/caducidad            [campo abierto — D009]
 └─ se envía a Cliente por canal…                 [canal abierto — D015]

Versión de propuesta
 ├─ pertenece a → Propuesta
 ├─ congela → precio y condiciones del momento en que se generó
 └─ produce → documento (PDF) inmutable

Viaje (producto turístico)
 ├─ pertenece a → Empresa (catálogo propio de esa agencia)
 ├─ pertenece a → Proveedor(es)                   [cardinalidad abierta — D007]
 ├─ referencia → Destino(s)
 ├─ referencia → Hotel(es)                        [¿entidad propia o texto? — D006]
 ├─ tiene → estado de aprobación (borrador → revisión → aprobado/rechazado)
 └─ es incluido en → Propuesta(s)

Proveedor                                         [alcance abierto — D016]
 └─ provee → Viaje(s)

Destino
 └─ es referenciado por → Viaje(s)

Hotel                                             [entidad abierta — D006]
 └─ es referenciado por → Viaje(s)

Reserva                                           [entidad no existente hoy — D004]
 ├─ pertenece a → Cliente
 ├─ referencia → Viaje (snapshot congelado, no el catálogo vivo)
 ├─ tiene → Pago(s)                               [alcance abierto — D008]
 └─ puede tener → Incidencia(s)                   [alcance abierto — D005]

Comercial
 ├─ pertenece a → Empresa
 ├─ pertenece a → Sucursal                        [relación abierta — D011]
 ├─ gestiona → Lead(es) asignados
 └─ al salir de la empresa → su cartera requiere resolución  [D013]
```

## Reglas de relación ya vigentes (no abiertas)

Estas relaciones **sí** están decididas y en uso — se documentan aquí como parte del mapa, y su justificación completa está en [06_DECISIONS.md](./06_DECISIONS.md) (decisiones D020–D025):

- Un **Lead** pertenece siempre a una única **Empresa** — no se comparte entre agencias (D024).
- Un **Viaje** solo puede ser incluido en una **Propuesta** si su estado de aprobación es "aprobado" — nunca uno en borrador o revisión (D022).
- Una **Propuesta** nunca pierde sus **Versiones** anteriores al generar una nueva — el historial es acumulativo, no sustitutivo (D020).
- Toda acción relevante sobre estas entidades queda registrada en un rastro de auditoría (D025).

## Qué queda deliberadamente fuera de este mapa

- **Pago**, **Factura**, **Incidencia** y **Reserva** aparecen en el mapa porque son parte del dominio de negocio de una agencia de viajes (ver [01_BUSINESS_DOMAIN.md](./01_BUSINESS_DOMAIN.md)), pero **no existen hoy** como parte funcional del producto. Su inclusión aquí es intencional: sirve para que quien lea este documento entienda que su ausencia es una decisión pendiente (D004, D005, D008, D012), no un olvido de diseño.
- **Sucursal** y la relación multi-oficina de un Comercial son parte del mapa por la misma razón — su necesidad depende de D011.

## Cómo leer las relaciones abiertas

Cada relación marcada como abierta tiene, como mínimo, dos configuraciones posibles documentadas con sus ventajas/inconvenientes en [06_DECISIONS.md](./06_DECISIONS.md). Este documento **no elige** ninguna — solo señala dónde está la bifurcación en el mapa.
