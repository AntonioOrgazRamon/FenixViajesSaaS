# 08 — Glosario de negocio

> **Responsabilidad de este documento**: es la **única** fuente de definición de cada entidad de negocio. Ningún otro documento debe redefinir un término — solo usarlo y, si hace falta, enlazar aquí. Orden alfabético para consulta rápida. El indicador "Existe hoy" refleja si la entidad es parte funcional real del producto actual, no una aspiración — cuando depende de una decisión pendiente, se referencia su ID.

**Auditoría (rastro de auditoría)** — Registro permanente e inmutable de quién hizo qué, cuándo y sobre qué entidad, para acciones comerciales relevantes. *Existe hoy: Sí (D025).*

**Cancelación / Modificación de reserva** — Cambio sobre una Reserva ya confirmada (fecha, ocupantes, o cancelación total/parcial), sujeto a la política de cancelación del Proveedor correspondiente. *Existe hoy: No — depende de que exista Reserva (D004, D005).*

**Catálogo** — El conjunto de Viajes de una Empresa disponibles para ser propuestos a un Lead, filtrado por su estado de aprobación. *Existe hoy: Sí.*

**Cliente** — Persona (o, en un modelo corporativo, organización) con historial de compra propio, distinguible de un interés puntual. *Existe hoy: No como entidad separada — ver D002. Hoy el histórico de compra vive, si acaso, dentro del propio Lead.*

**Comercial (agente)** — Persona del equipo de una Empresa responsable de gestionar Leads, elaborar Propuestas y cerrar ventas. *Existe hoy: Sí (rol "Usuario de empresa").*

**Destino** — Lugar geográfico (país, región, ciudad) referenciado por uno o varios Viajes del catálogo. *Existe hoy: Sí.*

**Divisa / Tipo de cambio** — La moneda en la que opera un Proveedor frente a la moneda de venta al cliente, y el criterio para fijar el tipo de cambio aplicable a un precio. *Existe hoy: Parcial — se registra la moneda de un Viaje, pero no hay gestión de conversión ni tipo de cambio histórico (D019).*

**Empresa** — La agencia de viajes cliente de la plataforma; unidad raíz de aislamiento de datos (multi-tenant). Cada Empresa opera de forma completamente aislada de las demás. *Existe hoy: Sí (D024).*

**Factura** — Documento fiscal asociado a una venta confirmada. *Existe hoy: No (D012).*

**Hotel** — Alojamiento incluido en un Viaje. *Existe hoy: Sí, pero solo como dato descriptivo dentro de cada Viaje, no como entidad de catálogo reutilizable (D006).*

**Incidencia** — Problema ocurrido durante o cerca de la fecha de un viaje ya vendido (vuelo cancelado, overbooking, reclamación). *Existe hoy: No (D005).*

**Interacción / Seguimiento** — Cada contacto registrado con un Lead (llamada, email, nota interna, cambio de estado). *Existe hoy: Sí, parcialmente — se registra actividad e historial, pero sin recordatorios/alertas automáticas de seguimiento pendiente.*

**Lead (oportunidad)** — Un interés de compra sin confirmar todavía; nace en el primer contacto y avanza por una secuencia de estados hasta un desenlace (ganado, perdido o archivado). *Existe hoy: Sí (D023 define su máquina de estados).*

**Motor de recomendación** — El componente que, a partir de lo que un Lead busca, sugiere Viajes del Catálogo que encajan, con explicación de por qué. Solo considera Viajes aprobados (D022) y aplica una capa de honestidad que evita sobre-prometer coincidencias (D021). *Existe hoy: Sí.*

**Pago** — Cada movimiento de dinero asociado a una Reserva (señal, saldo, devolución). *Existe hoy: No (D004, D008).*

**Propuesta (presupuesto)** — Documento comercial que agrupa una o varias opciones de Viaje para un Lead concreto. *Existe hoy: Sí — pero limitada a una única Propuesta activa por Lead (D003), sin fecha de caducidad (D009).*

**Proveedor** — Entidad externa que provee un producto turístico (mayorista, touroperador, hotel individual, aerolínea, DMC local, transportista). *Existe hoy: Sí, pero solo como dato descriptivo dentro de cada Viaje, sin condiciones comerciales propias asociadas (D016).*

**Reserva** — Confirmación real de compra de un Viaje por un Cliente, con fecha de salida fijada y estado de pago. *Existe hoy: No (D004).*

**Rol** — Nivel de acceso de un usuario dentro de la plataforma: *Super administrador* (opera la plataforma, no vende viajes), *Administrador de empresa* (dirige una agencia), *Usuario de empresa* (comercial, trabaja Leads y Propuestas). *Existe hoy: Sí.*

**Sucursal (oficina)** — Ubicación física de una Empresa con su propio equipo de comerciales. *Existe hoy: No (D011).*

**Versión de Propuesta** — Cada iteración de una Propuesta, congelada de forma inmutable en el momento en que se generó (precio, opciones, condiciones de ese instante); nunca se sobrescribe (D020). *Existe hoy: Sí.*

**Viaje (producto turístico)** — Producto vendible del Catálogo: itinerario, precio orientativo, hoteles, duración; pasa por un estado de aprobación antes de ser utilizable comercialmente. *Existe hoy: Sí.*
