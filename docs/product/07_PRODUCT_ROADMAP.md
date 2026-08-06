# 07 — Roadmap de producto

> **Responsabilidad de este documento**: priorizar, a nivel funcional/de negocio, qué hacer y en qué orden. No es un roadmap técnico (refactors, deuda de código, infraestructura) — ese vive en la auditoría técnica del proyecto, fuera de este sistema documental centrado en producto. No resuelve ninguna decisión — cada ítem que depende de una, la referencia por ID y espera a que se resuelva en [06_DECISIONS.md](./06_DECISIONS.md).

## Cómo leer este roadmap

Cada ítem indica: valor de negocio, riesgo de no hacerlo, impacto y dependencias. La prioridad P0–P3 refleja **orden de resolución de bloqueos**, no urgencia arbitraria: P0 son decisiones sin las cuales cualquier trabajo posterior se construye sobre una base ambigua.

## P0 — Fundacional (bloquea todo lo demás)

| Ítem | Valor de negocio | Riesgo si no se hace | Impacto | Dependencias |
|---|---|---|---|---|
| Resolver D001 (modelo de negocio) | Altísimo — define el resto del producto | Cada decisión posterior queda ambigua o contradictoria | Total | Ninguna |
| Resolver D002 (Cliente vs. Lead) | Alto — habilita venta recurrente, la vía más barata de generar ingreso adicional | Se sigue tratando a clientes que ya compraron como desconocidos | Alto | D001 |
| Resolver D003 (cardinalidad Lead↔Propuesta) | Alto — condiciona la experiencia comercial diaria | El modelo puede no encajar con cómo vende realmente el equipo | Medio-alto | D001 |
| Resolver D004 (alcance de Reserva/Pago) | Muy alto — diferencia entre "generador de presupuestos" y CRM de ciclo completo | El producto sigue sin poder demostrar que genera ventas reales | Total | D001, D002 |

## P1 — Alto valor, consecuencia directa de las decisiones P0

| Ítem | Valor de negocio | Riesgo si no se hace | Impacto | Dependencias |
|---|---|---|---|---|
| Modelar Reserva (si D004 resulta en "sí") | Muy alto — cierra el ciclo comercial | "Conversión" sigue siendo un flag manual sin respaldo | Alto | D004 |
| Resolver D009 (caducidad de propuestas) | Medio-alto, esfuerzo bajo | Riesgo comercial de sostener precios no vigentes indefinidamente | Medio | Ninguna |
| Resolver D014 (motivo de pérdida estructurado) | Alto para analítica futura, esfuerzo muy bajo | Se pierde para siempre la posibilidad de analizar leads ya cerrados sin ese dato | Bajo esfuerzo / alto valor acumulado | Ninguna |
| Resolver D010 (conflicto de doble asignación) | Medio — experiencia de cliente y confianza interna del equipo | Fricción comercial recurrente | Medio | Ninguna |
| Resolver D015 (canal de envío al cliente) | Medio — define si "enviado al cliente" es un dato fiable | El estado actual puede inducir a error en reporting | Bajo-medio | Ninguna |

## P2 — Importante, puede esperar a que P0/P1 estén resueltas

| Ítem | Valor de negocio | Riesgo si no se hace | Impacto | Dependencias |
|---|---|---|---|---|
| Resolver D005 (postventa/incidencias) | Alto a medio plazo (fidelización, reputación) | Se sigue perdiendo la fase donde se juega la repetición de compra | Alto, implementación grande | D004 |
| Resolver D006 (Hotel como entidad reutilizable) | Medio — calidad y análisis de catálogo | Catálogo sigue siendo difícil de auditar transversalmente | Medio | Volumen de catálogo suficiente para justificarlo |
| Resolver D007 (Viaje multi-proveedor) | Alto solo si D001 apunta a touroperador/DMC | Bloquea esa evolución si algún día se quiere | Alto, condicional | D001 |
| Resolver D013 (cartera de comercial saliente) | Medio — continuidad operativa | Riesgo puntual pero real en cada rotación de equipo | Bajo esfuerzo | Ninguna |
| Resolver D016 (Proveedor como entidad con condiciones comerciales) | Medio, depende de cuánto se gestione comisión hoy manualmente | Cálculo de comisión sigue dependiendo de memoria individual | Medio | D001, D007 |
| Resolver D018 (edición de borrador previo) | Medio — eficiencia operativa diaria | Cada ajuste menor antes de la primera entrega genera versión completa | Bajo-medio | Ninguna |

## P3 — Futuro, solo si el negocio confirma la necesidad real

| Ítem | Valor de negocio | Riesgo si no se hace | Impacto | Dependencias |
|---|---|---|---|---|
| Resolver D008 (procesamiento de pagos integrado) | Alto si el volumen lo justifica | Ninguno inmediato — se puede seguir cobrando fuera del sistema | Muy alto esfuerzo/responsabilidad | D004 |
| Resolver D012 (facturación integrada) | Medio, depende de mercado/país | Se sigue delegando a herramienta externa sin problema | Alto esfuerzo, alta sensibilidad legal | D004 |
| Resolver D011 (multi-sucursal) | Bajo hoy, alto si la agencia crece físicamente | Ninguno mientras la agencia opere desde una ubicación | Medio, prematuro sin confirmación de crecimiento | Ninguna — no construir especulativamente |
| Resolver D017 (plantillas por segmento) | Bajo-medio, depende de diversidad real de clientes | Ninguno inmediato | Bajo | D001 |
| Resolver D019 (gestión de tipo de cambio) | Solo si hay operación real multi-moneda | Ninguno si el negocio opera en una única moneda hoy | Medio, condicional | D001, D007, D016 |
| Evaluar modelo corporativo/TMC (rama de D001) | Solo si se decide expandir a ese segmento | Ninguno si el negocio se mantiene B2C | Muy alto — casi un producto aparte | D001 |

## Qué NO merece la pena tocar todavía

- Cualquier construcción especulativa sobre D011 (multi-sucursal), D008 (pagos) o D012 (facturación) sin evidencia de negocio real que lo exija — son las decisiones de mayor coste de deshacer si se construyen mal.
- Diseñar plantillas múltiples (D017) antes de que exista una base de clientes lo bastante diversa para justificarlas.
- Cualquier trabajo sobre postventa (D005) antes de que exista Reserva (D004) — no hay nada sobre lo que hacer seguimiento postventa todavía.

## Relación con el roadmap técnico

Este documento es exclusivamente funcional. La deuda técnica del código (organización de archivos, cobertura de pruebas, pipeline de build, etc.) se gestiona en un roadmap técnico independiente, fuera de este sistema documental de producto.
