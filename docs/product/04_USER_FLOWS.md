# 04 — Flujos de usuario

> **Responsabilidad de este documento**: mostrar la secuencia de pasos del negocio, en positivo y en negativo. No define entidades (→ [08_GLOSSARY.md](./08_GLOSSARY.md)) ni decide nada (→ [06_DECISIONS.md](./06_DECISIONS.md)); cuando un flujo depende de una decisión pendiente, se marca explícitamente.

## Flujo principal (extremo a extremo, incluyendo tramos aún no decididos)

```
Contacto inicial (web / referido / llamada / oficina)
   ↓
Alta como Lead (o vinculación a Cliente existente, si ya compró antes)     [depende de D002]
   ↓
Cualificación (qué busca, cuándo, cuánto quiere gastar, con quién viaja)
   ↓
Búsqueda de opciones en el catálogo (comparación entre viajes disponibles)
   ↓
Elaboración de Propuesta (con validez temporal)                            [depende de D009]
   ↓
Envío al cliente                                                            [canal — depende de D015]
   ↓
Negociación / iteración (0 a N rondas de cambios)
   ↓
Aceptación explícita del cliente
   ↓
Pago de señal → Reserva confirmada                                          [tramo no existente — depende de D004]
   ↓
Emisión de documentación de viaje (bono/voucher)                            [tramo no existente — depende de D004]
   ↓
Pago de saldo antes de fecha límite                                         [tramo no existente — depende de D008]
   ↓
Viaje (ocurre fuera del sistema)
   ↓
Postventa: incidencias, satisfacción, nueva oportunidad futura              [tramo no existente — depende de D005]
   ↓
Cliente con historial, base de una futura venta recurrente                  [depende de D002]
```

## Flujos de excepción

> Cada flujo muestra la **secuencia** del escenario. El estado de cobertura de cada uno (resuelto/parcial/sin resolver) vive en [05_EDGE_CASES.md](./05_EDGE_CASES.md), identificado por número — no se repite aquí para evitar mantener el mismo dato en dos sitios.

### El cliente no responde tras recibir la propuesta
```
Propuesta enviada → sin respuesta N días → recordatorio (manual o automático)
   → sigue sin respuesta → la propuesta pierde vigencia [D009] → Lead pasa a "en espera" o "perdido"
   → (meses después) el cliente vuelve → ¿se reabre el mismo Lead o se crea uno nuevo? [D002, y estado ARCHIVED no reabrible hoy — ver 03_BUSINESS_RULES.md]
```

### El cliente rechaza la propuesta
```
Propuesta enviada → cliente dice "no" → se registra el motivo [D014]
   → ¿se ofrece de inmediato una alternativa (nueva versión) o se cierra el Lead como perdido? [proceso comercial, no técnico]
```

### El proveedor cambia el precio antes de que el cliente acepte (→ 05_EDGE_CASES.md #1)
```
Propuesta enviada con precio X → proveedor sube precio a Y
   → ¿el sistema debe detectar y avisar el cambio? (no existe hoy)
   → si el cliente acepta con el precio desactualizado, ¿se respeta X o se cobra Y?
     (pregunta de negocio pura: ¿quién asume la diferencia?)
```

### El viaje se retira del catálogo con propuestas activas que lo incluyen (→ 05_EDGE_CASES.md #3)
```
Viaje en catálogo, referenciado por propuestas activas → se retira/rechaza en el catálogo
   → las propuestas ya generadas NO cambian (quedan congeladas, ver 03_BUSINESS_RULES.md)
   → pero cualquier nueva propuesta para ese Lead ya no podrá incluirlo
   → ¿se avisa al comercial de que su propuesta activa referencia algo ya retirado? (no existe hoy)
```

### El viaje se cancela después de la venta, ya confirmado y pagado (→ 05_EDGE_CASES.md #50)
```
Reserva confirmada y pagada → proveedor cancela el viaje
   → gestión de incidencia: reembolso, reubicación, compensación                  [depende de D004, D005]
   → es una crisis operativa que requiere atención inmediata, no un simple cambio de estado
```

### Overbooking en destino (→ 05_EDGE_CASES.md #52)
```
Cliente llega al hotel → no hay habitación reservada disponible
   → ocurre en tiempo real, sin margen de espera, fuera del ciclo comercial normal    [depende de D005]
```

### El hotel cambia, mismo viaje, distinto alojamiento ofrecido (→ 05_EDGE_CASES.md #2)
```
Viaje ya vendido → proveedor sustituye el hotel original
   → ¿quién decide si es un cambio aceptable o requiere reconfirmación del cliente?
   → ¿queda constancia de qué se prometió originalmente frente a lo que se dio? (relevante ante una reclamación)
```

### Dos comerciales trabajando el mismo Lead (→ 05_EDGE_CASES.md #29)
```
Lead entra → se asigna a Comercial A → Comercial B, sin saberlo, también lo contacta
   → riesgo de mensajes duplicados o contradictorios al cliente     [depende de D010]
```

### El cliente quiere pagar en más plazos de los previstos (→ 05_EDGE_CASES.md #43)
```
Reserva con plan de pago estándar (señal + saldo) → cliente pide fraccionar más
   → ¿lo puede aceptar cualquier comercial, o requiere aprobación de dirección?   [depende de D004, D008]
```

### Cambio de divisa entre la cotización y el pago
```
Precio fijado en un tipo de cambio → tiempo pasa → cliente paga con tipo de cambio distinto
   → ¿quién absorbe la diferencia? ¿se fija el tipo de cambio en la propuesta o en el pago?   [D019]
```

### El comercial que gestionaba el Lead deja la empresa (→ 05_EDGE_CASES.md #30)
```
Comercial se va → tiene Leads activos, Propuestas pendientes, posibles Reservas en curso
   → reasignación: ¿automática, manual, con aviso obligatorio al cliente del cambio de interlocutor?   [D013]
```

## Nota de lectura

Cualquier tramo marcado con "no existente" o "depende de D0xx" no es un error de esta documentación ni del sistema — es, literalmente, el estado real hoy. Este documento no rellena esos huecos con una solución supuesta; los deja visibles a propósito.
