# 09 — Preguntas frecuentes

> **Responsabilidad de este documento**: respuestas rápidas a las preguntas que un desarrollador o stakeholder nuevo suele hacer en sus primeros días. Cada respuesta remite al documento que tiene el detalle completo — este archivo no repite el análisis, solo orienta.

**¿Por qué no puedo tener dos propuestas distintas para el mismo cliente?**
Porque hoy el sistema asume que un Lead tiene una única Propuesta que se versiona, no varias independientes. Es una decisión pendiente, no una limitación técnica — ver D003 en [06_DECISIONS.md](./06_DECISIONS.md).

**¿Por qué el sistema no gestiona el pago del viaje?**
Porque el alcance de Reserva y Pago es una decisión de producto todavía no tomada, no un olvido. Ver D004 en [06_DECISIONS.md](./06_DECISIONS.md).

**¿Cómo se envía una propuesta al cliente final?**
Hoy, siempre de forma manual, fuera del sistema — el comercial descarga el documento y lo envía por su propio medio. Ver D015.

**¿Qué pasa si el precio de un viaje cambia después de enviar una propuesta?**
La versión ya enviada queda congelada con el precio de ese momento; no cambia retroactivamente. Pero el sistema no avisa de que quedó desactualizada frente al catálogo actual. Ver [05_EDGE_CASES.md](./05_EDGE_CASES.md) #1.

**¿Por qué un viaje "pendiente de revisión" no aparece en las búsquedas?**
Por diseño: solo el catálogo aprobado alimenta el motor de recomendación (D022) — es una decisión de calidad, no un bug.

**¿Existe el concepto de "cliente recurrente"?**
No como entidad separada del Lead puntual — ver D002. Es una de las decisiones fundacionales pendientes con más impacto en el negocio a largo plazo.

**¿Puedo saber por qué el motor recomendó un viaje concreto?**
Sí — es de las partes mejor resueltas del producto: la explicación completa del cálculo se conserva junto con cada recomendación.

**¿Por qué a veces las recomendaciones parecen "conservadoras" en vez de mostrar coincidencias perfectas?**
Es intencional — existe una capa de honestidad que evita prometer ajustes mejores de los que realmente hay, sobre todo cuando hay poca información del cliente. Ver D021.

**¿Qué le pasa a un Lead marcado como "perdido"? ¿Se puede reabrir?**
No hoy — pasa a un estado archivado sin vía de reapertura. Ver la máquina de estados en [03_BUSINESS_RULES.md](./03_BUSINESS_RULES.md) y D023.

**¿Se registra por qué se pierde una venta?**
No de forma estructurada todavía — es una decisión pendiente de bajo esfuerzo y alto valor analítico. Ver D014.

**¿Puede una empresa (agencia) ver datos de otra empresa en la plataforma?**
Nunca — el aislamiento entre empresas es una garantía firme del producto, sin excepciones. Ver D024.

**¿Qué pasa si dos comerciales trabajan el mismo Lead sin saberlo?**
Hoy nada lo impide ni lo detecta. Es una decisión pendiente — ver D010.

**¿El sistema factura las ventas?**
No. Ver D012 — depende de si se decide gestionar Reserva/Pago primero (D004).

**¿Por qué hay tantas decisiones "pendientes" en vez de resueltas?**
Porque el producto creció rápido añadiendo funcionalidad antes de que el negocio declarase explícitamente varias decisiones fundacionales (empezando por D001, el modelo de negocio). Este sistema documental existe precisamente para que esas decisiones dejen de estar implícitas en el código y se tomen de forma consciente. Ver [06_DECISIONS.md](./06_DECISIONS.md).

**Si tengo que tomar una decisión de producto nueva, ¿dónde la documento?**
Siempre en [06_DECISIONS.md](./06_DECISIONS.md), con el formato ya establecido (Estado, Fecha, Problema, Opciones, Ventajas, Inconvenientes, Consecuencias, Dependencias, Documentos afectados). No la documentes solo en una conversación, un comentario de código o un documento de otra sección.

**¿Puedo entender el producto sin mirar el código?**
Ese es el objetivo explícito de este sistema documental — sigue el orden de lectura en [README.md](./README.md).
