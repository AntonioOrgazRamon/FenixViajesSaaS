# 01 — Dominio de negocio: cómo funciona (en general) una agencia de viajes

> **Responsabilidad de este documento**: explicar el conocimiento de dominio — cómo opera el sector — independientemente de qué haya construido o no Fenix Viajes hoy. Es contexto para entender *por qué* existen ciertas entidades y reglas. No contiene decisiones sobre qué hace específicamente este producto (eso está en [06_DECISIONS.md](./06_DECISIONS.md)) ni el modelo de entidades (eso está en [02_DOMAIN_MODEL.md](./02_DOMAIN_MODEL.md)).

## No existe un único modelo de negocio de "agencia de viajes"

Antes de diseñar o juzgar cualquier parte del producto, hay que saber que el sector opera bajo varios modelos distintos, y cada uno implica un negocio distinto:

| Modelo | Cómo opera | Rasgo distintivo |
|---|---|---|
| **A — Minorista tradicional** | Revende paquetes ya cerrados (vuelo + hotel + traslados) comprados a mayoristas/touroperadores | No diseña el viaje, lo compara y lo vende. Volumen medio-alto, margen bajo por venta. |
| **B — Touroperador / DMC** | Diseña itinerarios propios, contrata hoteles/transporte/guías directamente | Control total sobre precio y disponibilidad, pero mucha más complejidad operativa. |
| **C — A medida / lujo (bespoke)** | Cada viaje se diseña desde cero para un cliente concreto | Bajo volumen, alto ticket medio, ciclo de venta largo con muchas iteraciones. |
| **D — Corporativa (TMC)** | El cliente es una empresa, no una persona | Políticas de viaje, aprobaciones internas, facturación centralizada. |
| **E — OTA / autoservicio online** | El cliente busca y reserva solo, sin comercial en el camino crítico | Requiere inventario y precio en tiempo real vía integración con proveedores. |

Una misma agencia real puede operar como una mezcla de varios de estos modelos a la vez (p. ej. A+C). El modelo (o mezcla) que aplica a **este** producto es una decisión de negocio explícita — ver **D001** en [06_DECISIONS.md](./06_DECISIONS.md).

## Cómo opera el sector, por dimensión

### Captación del cliente
Web propia, redes sociales, boca a boca, referidos, ferias, publicidad. En el modelo D, el cliente entra como una organización con la que ya existe un acuerdo corporativo, no como individuo.

### Registro del cliente
El registro formal de un cliente (con ficha completa) suele ocurrir **en el momento de la reserva**, no antes. Antes de eso, es solo un interesado con nombre y contacto — esta distinción entre "interesado" y "cliente formal" es estructural en el sector, no un matiz menor.

### Cómo se hace una venta
En los modelos A/B/C, el cierre lo hace un comercial humano (llamada, WhatsApp, email, presencial). El pago casi siempre se hace en dos tiempos: **una señal/depósito** al reservar, y **el saldo** antes de la fecha de viaje (a veces con vencimientos intermedios adicionales). En el modelo D, el cierre pasa por aprobación interna de la empresa cliente, con facturación centralizada periódica. En el modelo E, el pago es inmediato y online, sin intervención humana.

### Cómo se buscan viajes
Rara vez es "un único motor de búsqueda unificado" en la operación real del sector — lo habitual es que el comercial salte entre varias herramientas o catálogos de distintos proveedores y arme la propuesta a mano encima. Un motor de recomendación unificado sobre catálogo propio es, de hecho, una ventaja diferencial frente a cómo trabaja hoy una agencia tradicional promedio.

### Relación con proveedores
Los proveedores (mayoristas, touroperadores, hoteles individuales, aerolíneas, DMCs locales, empresas de traslados) operan con contratos de comisión: la agencia gana un porcentaje sobre el precio de venta, pagado por el proveedor, no cargado aparte al cliente. Cada proveedor tiene sus propias condiciones de cancelación/modificación — no son genéricas ni uniformes entre proveedores.

### Recepción de catálogos
PDF y Excel siguen siendo el estándar real de la mayoría de mayoristas/touroperadores para agencias que no son grandes cadenas — no es una limitación arbitraria, es cómo opera el sector hoy. Las APIs de proveedores (GDS, algunos mayoristas grandes) existen, pero suelen requerir volumen mínimo o acuerdos comerciales que una agencia pequeña o mediana no siempre tiene acceso a negociar.

### Actualización de precios
Con frecuencia el precio **no** está disponible en tiempo real para la agencia — se trabaja con el último tarifario recibido y **se confirma el precio final con el proveedor en el momento de reservar**, sabiendo que puede haber cambiado. El precio de catálogo es "orientativo" por diseño del sector, no por limitación técnica.

### Elaboración de presupuestos
Un presupuesto (cotización) suele incluir varias opciones para comparar, con desglose de qué incluye/excluye, condiciones de pago, y **una validez temporal limitada** — el precio cotizado no se sostiene indefinidamente. Esta caducidad es una práctica casi universal del sector.

### Modificación de propuestas
Iterar varias veces antes de cerrar (cambiar fechas, quitar una excursión, cambiar categoría de hotel) es la norma, no la excepción — especialmente en el modelo C.

### Seguimiento comercial
Recordatorios (llamar si no hay respuesta en unos días), control de fechas límite de pago de señal, alertas de vencimiento de presupuesto. Es una actividad tan crítica como la venta inicial: muchas ventas se pierden no por precio, sino por falta de seguimiento a tiempo.

### Clientes recurrentes
Las agencias con buena gestión mantienen una ficha de cliente con historial de viajes y preferencias, y la usan para vender de forma proactiva. Es un activo de negocio de alto valor cuando existe.

### Trabajo en equipo (varios comerciales)
Reparto de interesados (por turno, especialización de destino, o carga de trabajo). En agencias con comisión por venta, la trazabilidad de "quién es el dueño de este caso" es una fuente frecuente de conflicto interno si no queda inequívoca.

### Gestión de incidencias
Vuelo cancelado, overbooking en destino, cliente enfermo, documentación incorrecta — ocurre **después** de la venta, cerca o durante la fecha del viaje. Requiere un tipo de atención distinto (urgente, no diferible) al trabajo comercial habitual.

### Gestión de cancelaciones
Casi siempre implican una penalización parcial que depende de la antigüedad de la cancelación respecto a la fecha de salida, definida por el proveedor, no por la agencia.

### Reservas
Una reserva confirmada normalmente genera un **localizador o bono de viaje** — un documento operativo que el cliente presenta en destino, distinto del documento comercial de propuesta/presupuesto. Son dos artefactos con propósitos distintos.

### Cierre de una venta
Casi nunca es solo "el cliente dijo que sí" — casi siempre hay un evento financiero (el pago de la señal) que constituye el verdadero punto de no retorno comercial.

## Relación de este documento con Fenix Viajes SaaS

Todo lo anterior es conocimiento de sector, no una descripción de lo que el producto hace hoy. El estado real de qué partes de este dominio están cubiertas, parcialmente cubiertas, o fuera de alcance, se documenta entidad por entidad en [02_DOMAIN_MODEL.md](./02_DOMAIN_MODEL.md) y decisión por decisión en [06_DECISIONS.md](./06_DECISIONS.md).
