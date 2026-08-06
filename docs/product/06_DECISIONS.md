# 06 — Registro de decisiones (fuente única de verdad)

> **Responsabilidad de este documento**: es el **único** lugar del proyecto donde se documentan decisiones de producto — sus opciones, ventajas, inconvenientes y consecuencias. Ningún otro documento debe repetir este análisis; solo pueden referenciar el ID de la decisión (p. ej. "ver D001"). Si en algún momento encuentras una decisión de producto explicada fuera de este archivo, es un defecto de la documentación — debe moverse aquí.

Cada decisión tiene tres estados posibles:
- **Pendiente** — identificada, sin resolver. No se elige una opción por defecto.
- **Aprobada** — ya está en vigor (bien porque el negocio la decidió, bien porque ya está implementada y validada como comportamiento correcto).
- **Rechazada** — se consideró explícitamente y se descartó (con el motivo documentado, para no volver a plantearla sin nueva información).

## Índice

**Decisiones pendientes** — condicionan el resto del producto, en orden de dependencia:
D001 · D002 · D003 · D004 · D005 · D006 · D007 · D008 · D009 · D010 · D011 · D012 · D013 · D014 · D015 · D016 · D017 · D018 · D019

**Decisiones aprobadas** — ya vigentes, documentadas aquí para que no queden implícitas solo en el comportamiento del sistema:
D020 · D021 · D022 · D023 · D024 · D025

---

# D001

**Título**: Modelo de negocio de Fenix Viajes (minorista / touroperador / a medida / corporativo / híbrido)

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: El producto se ha construido con rasgos de varios modelos de negocio de agencia de viajes a la vez (reventa de catálogo cerrado de proveedores + generación de propuestas a medida asistida por IA), sin que exista una declaración explícita de cuál es el modelo real de Fenix Viajes. Casi todas las demás decisiones de este documento dependen de esta.

**Opciones consideradas**:
1. Minorista (revende paquetes cerrados de mayoristas/touroperadores).
2. Touroperador/DMC (diseña y contrata itinerarios propios).
3. A medida / lujo (cada propuesta es un diseño único).
4. Corporativo (el cliente es una empresa, con políticas de aprobación).
5. Híbrido explícito y delimitado (combinación consciente de varias, con reglas claras de cuándo aplica cada una).

**Ventajas**:
- *Minorista*: máxima simplicidad operativa y de producto.
- *Touroperador*: mayor control de precio/disponibilidad y mayor margen potencial.
- *A medida*: mayor valor percibido y ticket medio más alto por cliente.
- *Corporativo*: ingresos más predecibles (contratos, no ventas puntuales).
- *Híbrido explícito*: aprovecha lo ya construido en ambas direcciones sin la ambigüedad actual.

**Inconvenientes**:
- *Minorista*: techo de diferenciación bajo, cualquier competidor revende lo mismo.
- *Touroperador*: mucha más complejidad operativa (gestión directa de proveedores individuales).
- *A medida*: no escala igual con el mismo equipo comercial, ciclo de venta más largo.
- *Corporativo*: requiere construir un producto casi distinto (aprobaciones, facturación centralizada).
- *Híbrido explícito*: exige mantener reglas distintas coexistiendo, más carga de diseño inicial.

**Consecuencias**: condiciona directamente D002, D003, D006, D007, D016, D019 y el alcance completo de [00_PRODUCT_VISION.md](./00_PRODUCT_VISION.md).

**Dependencias**: ninguna — es la decisión raíz.

**Documentos afectados**: 00_PRODUCT_VISION.md, 01_BUSINESS_DOMAIN.md, 02_DOMAIN_MODEL.md, 07_PRODUCT_ROADMAP.md.

---

# D002

**Título**: Relación entre Cliente y Lead

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy toda persona interesada en viajar se trata como una única oportunidad puntual (Lead). No existe una entidad "Cliente" con historial propio a lo largo de varias compras.

**Opciones consideradas**:
1. Fusionar — Cliente y Lead son la misma entidad, con distintos estados.
2. Separar — un Lead, al convertirse, produce (o se vincula a) un Cliente independiente con historial propio.

**Ventajas**:
- *Fusionar*: modelo más simple, menos entidades que mantener.
- *Separar*: habilita venta recurrente y proactiva basada en historial real; refleja mejor cómo trabajan las agencias con buena gestión de cartera (ver [01_BUSINESS_DOMAIN.md](./01_BUSINESS_DOMAIN.md)).

**Inconvenientes**:
- *Fusionar*: pierde toda capacidad de vender proactivamente a alguien que ya compró antes; no distingue "un interesado nuevo" de "un cliente que vuelve".
- *Separar*: requiere resolver cuándo y cómo un Lead nuevo se asocia a un Cliente ya existente (por email, teléfono, validación manual) — no es trivial evitar duplicados.

**Consecuencias**: condiciona D003 (cardinalidad de propuestas) y la posibilidad real de marketing/venta recurrente.

**Dependencias**: D001.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 03_BUSINESS_RULES.md, 04_USER_FLOWS.md, 08_GLOSSARY.md.

---

# D003

**Título**: Cardinalidad entre Lead y Propuesta

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy un Lead solo puede tener una Propuesta activa, que se versiona en cada regeneración. No es posible tener dos propuestas independientes y comparables en paralelo para el mismo Lead (p. ej. "opción playa" vs. "opción cultural" como dos documentos distintos).

**Opciones consideradas**:
1. Mantener: una única Propuesta por Lead, versionada indefinidamente.
2. Permitir: varias Propuestas independientes por Lead, cada una versionable por separado.

**Ventajas**:
- *Mantener*: un único hilo de negociación, simple de seguir y de reportar.
- *Permitir*: refleja cómo se cotiza realmente cuando hay alternativas radicalmente distintas; el cliente puede comparar documentos completos, no solo opciones dentro de un mismo documento.

**Inconvenientes**:
- *Mantener*: fuerza a comprimir alternativas muy distintas en una sola propuesta con varias opciones internas, perdiendo la posibilidad de un documento dedicado por enfoque.
- *Permitir*: más complejidad de interfaz (hay que dejar claro cuál es la propuesta "activa" o de referencia) y de reporting de conversión.

**Consecuencias**: afecta directamente la experiencia comercial diaria y cómo se mide la tasa de conversión de una Propuesta.

**Dependencias**: D001, D002.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 03_BUSINESS_RULES.md, 04_USER_FLOWS.md, 05_EDGE_CASES.md (#17, #27, #28).

---

# D004

**Título**: Alcance de Reserva y Pago dentro del sistema

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: El sistema hoy termina su ciclo en la Propuesta comercial. No existe ninguna entidad que represente una venta confirmada (Reserva), ni registro de pagos. "Convertido" es hoy un estado que un humano marca a mano, sin ninguna verificación de que haya ocurrido una transacción real.

**Opciones consideradas**:
1. No gestionar Reserva/Pago — el sistema se mantiene como herramienta puramente comercial (generación de propuestas), todo lo posterior es responsabilidad externa.
2. Gestionar Reserva completa (con snapshot del viaje contratado, estado, fechas) pero sin procesar pagos, solo registrarlos como conciliación manual.
3. Gestionar Reserva y Pago end-to-end, incluyendo procesamiento de cobro.

**Ventajas**:
- *No gestionar*: alcance acotado, menor complejidad y responsabilidad legal.
- *Gestionar Reserva + registro de pago*: cierra el ciclo comercial (se puede saber de verdad qué se vendió), sin asumir la complejidad regulatoria de procesar dinero.
- *Gestionar todo end-to-end*: máxima fluidez de experiencia, mínima fricción para el cliente y el comercial.

**Inconvenientes**:
- *No gestionar*: el sistema nunca podrá demostrar que generó una venta real; cualquier reporting de "conversión" seguirá siendo tan fiable como la disciplina manual del equipo.
- *Gestionar Reserva + registro*: requiere definir snapshot del viaje contratado, políticas de cancelación, y sigue dependiendo de conciliación manual con el medio de pago real.
- *Gestionar todo end-to-end*: implica cumplimiento normativo serio (tratamiento de datos de pago, posibles licencias según país) — salto de responsabilidad y complejidad considerable.

**Consecuencias**: es la decisión de alcance más grande del documento — define si este producto es un "generador de presupuestos" o un CRM de ciclo de venta completo. Condiciona D005, D008, D009, D012.

**Dependencias**: D001, D002.

**Documentos afectados**: 00_PRODUCT_VISION.md, 02_DOMAIN_MODEL.md, 04_USER_FLOWS.md, 07_PRODUCT_ROADMAP.md.

---

# D005

**Título**: Alcance de Postventa e Incidencias

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy la relación con el interesado termina cuando su Lead se marca como convertido o archivado. No existe ningún concepto de seguimiento durante o después del viaje (incidencias, cancelaciones, reclamaciones).

**Opciones consideradas**:
1. Fuera de alcance — el sistema es puramente comercial (pre-venta).
2. Dentro de alcance — el sistema gestiona también incidencias y cancelaciones posteriores a la reserva.

**Ventajas**:
- *Fuera de alcance*: mantiene el producto acotado y más fácil de construir bien.
- *Dentro de alcance*: cubre el ciclo real completo de una agencia; la postventa es donde se juega buena parte de la fidelización y la reputación (ver [01_BUSINESS_DOMAIN.md](./01_BUSINESS_DOMAIN.md)).

**Inconvenientes**:
- *Fuera de alcance*: deja fuera del sistema justo la fase donde ocurren las crisis operativas reales (overbooking, cancelaciones de última hora) — hoy sin ninguna herramienta de apoyo.
- *Dentro de alcance*: multiplica el alcance del producto de forma significativa; una incidencia en destino no puede esperar como un Lead frío, requiere un tipo de atención distinto (urgente).

**Consecuencias**: condiciona si el producto cubre todo el ciclo de vida de una agencia o solo la mitad comercial.

**Dependencias**: D004 (no tiene sentido gestionar postventa sin gestionar antes la Reserva).

**Documentos afectados**: 00_PRODUCT_VISION.md, 02_DOMAIN_MODEL.md, 04_USER_FLOWS.md, 05_EDGE_CASES.md (bloque "Reservas, pagos y postventa").

---

# D006

**Título**: Hotel como entidad reutilizable frente a dato descriptivo

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy cada viaje describe su hotel como texto propio, sin relación con una ficha de hotel compartida. No es posible saber "en cuántos viajes aparece este hotel" ni detectar que un mismo hotel cambió de categoría en todo el catálogo a la vez.

**Opciones consideradas**:
1. Mantener como texto libre por viaje.
2. Convertir en entidad de catálogo propia y reutilizable entre viajes.

**Ventajas**:
- *Texto libre*: cero complejidad de gestión adicional.
- *Entidad propia*: permite análisis transversal, consistencia de datos, y avisos automáticos ante cambios que afectan a varios viajes a la vez.

**Inconvenientes**:
- *Texto libre*: imposible cualquier análisis transversal por hotel; dos descripciones del mismo hotel escritas de forma distinta se tratan como cosas distintas.
- *Entidad propia*: exige resolver un problema de "matching"/deduplicación al importar catálogo de fuentes distintas (¿"Hotel Riu Cancún" y "Riu Cancun Resort" son el mismo hotel?), que no es trivial.

**Consecuencias**: afecta la calidad y mantenibilidad del catálogo a largo plazo, no la operación comercial inmediata.

**Dependencias**: D001, D007.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 08_GLOSSARY.md, 05_EDGE_CASES.md (#10, #13).

---

# D007

**Título**: Un Viaje con uno o con varios Proveedores

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy un Viaje del catálogo pertenece siempre a un único Proveedor (modelo de paquete cerrado). Si el negocio evoluciona hacia diseñar combinaciones propias (vuelo de una fuente, hotel de otra), el modelo actual no lo representa.

**Opciones consideradas**:
1. Mantener: un Viaje = un Proveedor.
2. Permitir: un Viaje puede combinar componentes de Proveedores distintos.

**Ventajas**:
- *Mantener*: simplicidad total, encaja con el modelo minorista puro.
- *Permitir*: representa la realidad de un touroperador/DMC; habilita mayor control de margen por componente.

**Inconvenientes**:
- *Mantener*: bloquea cualquier evolución hacia el modelo touroperador/DMC sin rediseñar esta parte del catálogo.
- *Permitir*: mucha más complejidad de gestión de precio total (suma de componentes) y de condiciones de cancelación (¿cuál política aplica, la de cada componente por separado?).

**Consecuencias**: es una consecuencia directa de D001; no debería decidirse de forma aislada.

**Dependencias**: D001.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 05_EDGE_CASES.md (#66).

---

# D008

**Título**: Procesamiento de pagos integrado frente a solo registro

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Si se decide gestionar Reservas (D004), queda abierto si el sistema debe cobrar directamente al cliente o solo dejar constancia de que un pago ocurrió por un medio externo.

**Opciones consideradas**:
1. Solo registro — el sistema anota que un pago ocurrió (fecha, importe, medio), conciliado manualmente contra el banco/TPV externo.
2. Procesamiento integrado — el sistema cobra directamente (pasarela de pago).

**Ventajas**:
- *Solo registro*: mucho menor alcance regulatorio, menor responsabilidad legal, más rápido de tener operativo.
- *Procesamiento integrado*: experiencia de venta más fluida, menos fricción para el cliente, cobro más rápido.

**Inconvenientes**:
- *Solo registro*: no automatiza el cobro, sigue dependiendo de procesos externos manuales.
- *Procesamiento integrado*: implica cumplimiento normativo serio y una responsabilidad legal considerablemente mayor.

**Consecuencias**: define si el producto entra o no en el terreno de servicios financieros regulados.

**Dependencias**: D004.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 07_PRODUCT_ROADMAP.md.

---

# D009

**Título**: Caducidad / validez temporal de una Propuesta

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy una Propuesta generada no caduca nunca formalmente. En el sector es práctica estándar que un presupuesto tenga una validez limitada (ver [01_BUSINESS_DOMAIN.md](./01_BUSINESS_DOMAIN.md)).

**Opciones consideradas**:
1. Sin caducidad formal — el comercial es responsable de avisar si el precio ya no es válido.
2. Con caducidad explícita — cada Propuesta lleva una fecha de validez.

**Ventajas**:
- *Sin caducidad*: cero complejidad añadida.
- *Con caducidad*: protege comercialmente a la agencia; genera una urgencia legítima en la negociación; evita disputas por precios ya no vigentes.

**Inconvenientes**:
- *Sin caducidad*: riesgo de disputa con el cliente si el precio subió y la propuesta seguía activa indefinidamente en el sistema.
- *Con caducidad*: requiere definir qué ocurre si el cliente acepta tarde (¿se reabre con precio actualizado, se rechaza directamente?).

**Consecuencias**: afecta directamente la protección comercial de la agencia frente a cambios de precio del proveedor.

**Dependencias**: ninguna directa — puede resolverse independientemente del resto.

**Documentos afectados**: 03_BUSINESS_RULES.md, 04_USER_FLOWS.md.

---

# D010

**Título**: Resolución de conflicto por doble asignación de un Lead

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy nada impide que dos comerciales trabajen el mismo Lead sin saberlo, con riesgo de mensajes contradictorios al cliente y disputas internas de comisión.

**Opciones consideradas**:
1. Bloqueo estricto — un Lead solo puede tener un comercial asignado a la vez, sin excepción.
2. Colaboración explícita permitida — varios comerciales pueden intervenir, con un titular claro registrado para efectos de comisión/trazabilidad.

**Ventajas**:
- *Bloqueo estricto*: elimina el riesgo de raíz, máxima claridad.
- *Colaboración explícita*: permite escenarios legítimos (un comercial cubre a otro de vacaciones, o pide ayuda puntual) sin perder claridad de titularidad.

**Inconvenientes**:
- *Bloqueo estricto*: no cubre casos legítimos de colaboración o cobertura temporal.
- *Colaboración explícita*: requiere reglas claras de quién es "el titular" a efectos de comisión, más complejidad de gestión.

**Consecuencias**: afecta la experiencia del cliente y la confianza interna del equipo comercial.

**Dependencias**: ninguna directa.

**Documentos afectados**: 03_BUSINESS_RULES.md, 05_EDGE_CASES.md (#29).

---

# D011

**Título**: Soporte de múltiples sucursales/oficinas

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy una Empresa (agencia) no tiene ningún concepto interno de sucursal/oficina — todos sus comerciales operan en un único espacio sin segmentación geográfica u organizativa interna.

**Opciones consideradas**:
1. No soportar — una Empresa = una única unidad operativa, siempre.
2. Soportar — una Empresa puede tener varias Sucursales, cada una con su propio equipo.

**Ventajas**:
- *No soportar*: simplicidad, evita complejidad no solicitada.
- *Soportar*: prepara el producto para agencias que crecen a varias ubicaciones físicas.

**Inconvenientes**:
- *No soportar*: bloquea la venta del producto a agencias con estructura multi-oficina sin rediseño.
- *Soportar*: complejidad añadida (asignación de comerciales, posible reparto de leads por proximidad) que hoy nadie ha pedido explícitamente.

**Consecuencias**: es una decisión de anticipación de escala — solo debería tomarse si hay evidencia de una necesidad real, no de forma especulativa (ver [07_PRODUCT_ROADMAP.md](./07_PRODUCT_ROADMAP.md), donde se marca como P3 mientras no haya esa evidencia).

**Dependencias**: ninguna directa.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 05_EDGE_CASES.md (#31, #65).

---

# D012

**Título**: Facturación integrada frente a delegada a herramienta externa

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: No existe hoy ningún documento fiscal (factura) generado por el sistema. Si se decide gestionar Reservas y Pagos (D004), queda abierto si la facturación se hace dentro del propio producto o se delega siempre a una herramienta contable externa.

**Opciones consideradas**:
1. Delegar siempre a herramienta externa.
2. Integrar generación de factura en el propio sistema.

**Ventajas**:
- *Delegar*: evita entrar en implicaciones legales/fiscales que varían mucho por país.
- *Integrar*: experiencia más fluida, un único sistema para todo el ciclo comercial.

**Inconvenientes**:
- *Delegar*: requiere mantener sincronizados dos sistemas (comercial y contable).
- *Integrar*: una decisión equivocada aquí es costosa de deshacer, por la sensibilidad legal/fiscal del dominio.

**Consecuencias**: alto riesgo si se decide mal — requiere validación legal específica por mercado antes de comprometerse.

**Dependencias**: D004.

**Documentos afectados**: 07_PRODUCT_ROADMAP.md.

---

# D013

**Título**: Gestión de la cartera de un comercial que abandona la empresa

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy no hay ningún proceso definido para qué ocurre con los Leads activos, Propuestas pendientes o Reservas en curso de un comercial que deja la empresa.

**Opciones consideradas**:
1. Reasignación automática (a un responsable por defecto o repartida entre el equipo).
2. Reasignación manual obligatoria antes de poder desactivar la cuenta del comercial.
3. Sin proceso formal — queda a criterio del administrador de la empresa en cada caso.

**Ventajas**:
- *Automática*: garantiza que ningún caso queda huérfano.
- *Manual obligatoria*: da control explícito sobre a quién se reasigna cada caso, importante si hay relación de confianza con el cliente.
- *Sin proceso formal*: menor esfuerzo de implementación.

**Inconvenientes**:
- *Automática*: puede asignar casos a alguien sin contexto adecuado del cliente.
- *Manual obligatoria*: añade fricción operativa en el momento de baja de un empleado.
- *Sin proceso formal*: riesgo real de casos abandonados sin que nadie lo note.

**Consecuencias**: afecta la continuidad de servicio al cliente en cada rotación de personal.

**Dependencias**: ninguna directa.

**Documentos afectados**: 03_BUSINESS_RULES.md, 05_EDGE_CASES.md (#30).

---

# D014

**Título**: Registro estructurado del motivo de pérdida de un Lead

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy se puede marcar un Lead como perdido, pero no existe ningún campo estructurado para registrar por qué se perdió (precio, tiempo de respuesta, destino no disponible, etc.).

**Opciones consideradas**:
1. No estructurarlo — el motivo, si se registra, queda en texto libre dentro de una nota interna.
2. Estructurarlo — lista cerrada (o semiabierta) de motivos obligatoria al marcar un Lead como perdido.

**Ventajas**:
- *No estructurarlo*: cero fricción adicional en el flujo de trabajo del comercial.
- *Estructurarlo*: habilita analítica real de por qué se pierden ventas, información de alto valor para mejorar catálogo/precio/proceso.

**Inconvenientes**:
- *No estructurarlo*: la información queda dispersa en texto libre, difícil de analizar de forma agregada.
- *Estructurarlo*: añade un paso obligatorio más al cerrar un Lead como perdido; riesgo de que se elija cualquier motivo solo para poder cerrar el caso, sin reflejar la razón real.

**Consecuencias**: cuanto más se retrase esta decisión, más Leads históricos quedan sin ese dato de forma irrecuperable.

**Dependencias**: ninguna directa. Esfuerzo de implementación bajo.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 03_BUSINESS_RULES.md, 08_GLOSSARY.md.

---

# D015

**Título**: Canal de envío de la Propuesta al cliente

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy el envío de una propuesta al cliente final es enteramente responsabilidad manual del comercial, fuera del sistema (descarga el documento y lo envía por su propio medio). Existe un estado interno que se puede marcar como "enviado al cliente", pero nada garantiza que se haya enviado realmente nada.

**Opciones consideradas**:
1. Mantener 100% manual — el sistema nunca envía nada directamente al cliente; el estado "enviado" es solo una anotación de confianza en el comercial.
2. Envío directo por el sistema (email u otro canal propio), con confirmación real de entrega.

**Ventajas**:
- *Manual*: cero complejidad adicional, máxima flexibilidad de canal para el comercial (email, WhatsApp, en persona).
- *Envío directo*: elimina el riesgo de falsos positivos en el estado "enviado"; abre la puerta a medir aperturas o respuestas en el futuro.

**Inconvenientes**:
- *Manual*: el estado "enviado al cliente" no es una garantía real, solo una anotación de confianza.
- *Envío directo*: requiere elegir y mantener un canal, y decidir qué pasa si el comercial prefiere su propio medio de todas formas.

**Consecuencias**: condiciona si el "estado enviado al cliente" es un dato fiable para reporting o solo una referencia orientativa.

**Dependencias**: ninguna directa, aunque se relaciona con D005 si algún día se quiere medir respuesta del cliente.

**Documentos afectados**: 03_BUSINESS_RULES.md, 04_USER_FLOWS.md.

---

# D016

**Título**: Proveedor como entidad de negocio con condiciones comerciales propias

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy el proveedor de un viaje es un dato descriptivo (texto) dentro de cada producto de catálogo, sin ficha propia que registre condiciones de comisión, plazos de pago o política de cancelación.

**Opciones consideradas**:
1. Mantener como dato descriptivo.
2. Convertir en entidad propia con condiciones comerciales asociadas.

**Ventajas**:
- *Descriptivo*: cero gestión adicional.
- *Entidad propia*: permite gestionar comisiones y condiciones de forma centralizada y consistente, en vez de depender de la memoria de cada comercial.

**Inconvenientes**:
- *Descriptivo*: imposible automatizar cálculo de comisión o alertar sobre condiciones de cancelación específicas por proveedor.
- *Entidad propia*: solo aporta valor real si el negocio efectivamente gestiona esas condiciones de forma sistemática — si no, es complejidad sin uso.

**Consecuencias**: relevante sobre todo si D001/D007 apuntan hacia un modelo touroperador/DMC, donde la relación con cada proveedor individual es más estrecha.

**Dependencias**: D001, D007.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 08_GLOSSARY.md.

---

# D017

**Título**: Plantilla única de propuesta frente a plantillas configurables por segmento

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy existe una única plantilla de documento de propuesta para todos los clientes, independientemente de si se vende un viaje económico o de lujo.

**Opciones consideradas**:
1. Mantener una única plantilla.
2. Permitir varias plantillas configurables por segmento de cliente/tipo de viaje.

**Ventajas**:
- *Única*: consistencia de marca, cero mantenimiento adicional.
- *Varias*: mejor adecuación al segmento (un cliente de lujo espera una presentación distinta a una familia buscando la opción más económica).

**Inconvenientes**:
- *Única*: puede sentirse desalineada en los extremos del catálogo (muy económico o muy premium).
- *Varias*: requiere mantenimiento de varias plantillas y criterio de cuándo usar cada una.

**Consecuencias**: impacto en percepción de marca, no en la lógica comercial central.

**Dependencias**: D001 (relevante sobre todo si el negocio atiende segmentos muy distintos a la vez).

**Documentos afectados**: 03_BUSINESS_RULES.md.

---

# D018

**Título**: Edición de un borrador de Propuesta antes de la primera generación

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Hoy toda propuesta, desde el primer momento, se trata como una versión inmutable generada de una sola vez. No existe un estado de "borrador editable" previo a esa primera generación formal.

**Opciones consideradas**:
1. Mantener inmutabilidad total desde el primer momento — cualquier cambio, incluso antes de enviar nada al cliente, genera una versión nueva completa.
2. Permitir edición ligera de un borrador previo a la primera generación formal, sin que cuente como una versión.

**Ventajas**:
- *Inmutabilidad total*: modelo más simple de razonar, sin estados intermedios.
- *Borrador editable*: evita regenerar (y potencialmente volver a invocar IA/documento) por cada ajuste menor antes de tener algo definitivo que mostrar.

**Inconvenientes**:
- *Inmutabilidad total*: cada pequeño ajuste antes de la primera entrega real al cliente cuenta igual que una revisión "oficial", inflando el historial de versiones sin necesidad.
- *Borrador editable*: introduce un estado adicional que hay que gestionar con cuidado para no romper la garantía de inmutabilidad de las versiones ya enviadas.

**Consecuencias**: afecta la eficiencia operativa diaria del comercial al preparar una propuesta, no la integridad del historial ya enviado.

**Dependencias**: ninguna directa.

**Documentos afectados**: 03_BUSINESS_RULES.md.

---

# D019

**Título**: Gestión de tipo de cambio entre Proveedor y venta al cliente

**Estado**: Pendiente

**Fecha**: Planteada el 2026-08-06

**Problema**: Cuando el proveedor opera en una moneda distinta a la de venta al cliente, hoy no hay ningún mecanismo que registre a qué tipo de cambio se fijó un precio, ni qué ocurre si ese tipo de cambio varía entre la cotización y el pago.

**Opciones consideradas**:
1. Fijar el tipo de cambio en el momento de generar la propuesta (el precio en la moneda de venta queda congelado desde ese instante).
2. Fijar el tipo de cambio en el momento del pago (el precio final depende del tipo de cambio vigente ese día).
3. Dejarlo fuera de alcance mientras el negocio opere en una única moneda.

**Ventajas**:
- *Fijar en propuesta*: mayor certeza para el cliente sobre el precio final desde el primer momento.
- *Fijar en pago*: mayor certeza para la agencia sobre el margen real obtenido.
- *Fuera de alcance*: cero complejidad si hoy no hay operación multi-moneda real.

**Inconvenientes**:
- *Fijar en propuesta*: la agencia asume el riesgo si el tipo de cambio se mueve en contra entre cotización y pago.
- *Fijar en pago*: el cliente puede terminar pagando más de lo cotizado, con el riesgo comercial/reputacional que eso implica.
- *Fuera de alcance*: bloquea cualquier operación real con proveedores en otra moneda.

**Consecuencias**: solo relevante si el negocio opera o planea operar con proveedores en moneda distinta a la de venta.

**Dependencias**: D001, D007, D016.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 05_EDGE_CASES.md (#12, #67).

---

# D020

**Título**: Versionado inmutable de Propuestas

**Estado**: Aprobada

**Fecha**: Aprobada de facto durante el desarrollo previo; formalizada en este documento el 2026-08-06

**Problema**: Se necesitaba decidir si regenerar una propuesta sobrescribe la anterior o conserva historial.

**Opciones consideradas**:
1. Sobrescribir la propuesta existente en cada regeneración.
2. Crear una versión nueva cada vez, sin tocar las anteriores.

**Ventajas**: (de la opción aprobada — versionar) trazabilidad completa; ninguna propuesta ya enviada puede cambiar bajo los pies de un comercial o cliente; permite auditar exactamente qué se prometió en cada momento.

**Inconvenientes**: (de la opción aprobada) el historial crece indefinidamente; corregir un error trivial exige una versión nueva completa (ver D018 para el matiz de borradores).

**Consecuencias**: es la base que permite que D003 y D009 se puedan resolver más adelante sin perder integridad de datos históricos.

**Dependencias**: ninguna.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 03_BUSINESS_RULES.md.

---

# D021

**Título**: Capa de "honestidad" en las recomendaciones de viaje

**Estado**: Aprobada

**Fecha**: Aprobada de facto durante el desarrollo previo; formalizada en este documento el 2026-08-06

**Problema**: Un motor de recomendación puede, con poca información de un Lead, producir coincidencias que parecen muy altas sin serlo realmente — hay que decidir si eso se muestra tal cual o se corrige.

**Opciones consideradas**:
1. Mostrar el resultado del cálculo tal cual, sin ajuste.
2. Limitar/matizar deliberadamente la coincidencia mostrada cuando hay poca información de base, y comunicarlo con transparencia.

**Ventajas**: (de la opción aprobada) evita prometer al cliente un ajuste perfecto que en realidad no está bien fundamentado; protege la credibilidad comercial de la agencia frente al cliente final.

**Inconvenientes**: (de la opción aprobada) puede mostrar resultados menos "vistosos" en una demostración comercial que un cálculo sin ajustar.

**Consecuencias**: es una decisión de producto explícita, no una limitación técnica — no debe "corregirse" para mostrar números más altos sin revisar antes esta decisión.

**Dependencias**: ninguna.

**Documentos afectados**: 03_BUSINESS_RULES.md, 05_EDGE_CASES.md (#60, #62).

---

# D022

**Título**: Solo catálogo aprobado alimenta el motor de recomendación

**Estado**: Aprobada

**Fecha**: Aprobada de facto durante el desarrollo previo; formalizada en este documento el 2026-08-06

**Problema**: Había que decidir si un viaje recién importado (sin revisión de calidad) puede aparecer ya en búsquedas y propuestas, o debe pasar antes por un filtro.

**Opciones consideradas**:
1. Cualquier viaje importado es inmediatamente utilizable.
2. Solo un viaje marcado explícitamente como aprobado es utilizable.

**Ventajas**: (de la opción aprobada) evita mostrar al cliente viajes con datos de mala calidad o sin revisar; da control real sobre qué representa a la agencia de cara a un cliente.

**Inconvenientes**: (de la opción aprobada) depende de que exista disciplina operativa real de revisión — si se salta sistemáticamente la revisión (aprobación automática sin control), la protección que ofrece esta regla se pierde en la práctica.

**Consecuencias**: la calidad del catálogo aprobado es responsabilidad crítica; sin revisión real, esta regla existe solo sobre el papel.

**Dependencias**: ninguna.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 03_BUSINESS_RULES.md.

---

# D023

**Título**: Máquina de estados del Lead con transiciones restringidas

**Estado**: Aprobada

**Fecha**: Aprobada de facto durante el desarrollo previo; formalizada en este documento el 2026-08-06

**Problema**: Había que decidir si el estado de un Lead puede cambiar libremente a cualquier otro estado, o solo siguiendo una secuencia definida.

**Opciones consideradas**:
1. Cambio de estado libre, sin restricciones.
2. Secuencia de estados restringida, con transiciones válidas predefinidas.

**Ventajas**: (de la opción aprobada) evita estados inconsistentes (p. ej. pasar directamente de "nuevo" a "convertido" sin cualificación); da estructura fiable al proceso comercial.

**Inconvenientes**: (de la opción aprobada) puede sentirse rígida en casos legítimos que no encajan perfectamente en la secuencia prevista; el estado archivado es hoy un final sin retorno (ver D014 y 05_EDGE_CASES.md).

**Consecuencias**: da fiabilidad al proceso comercial, a costa de flexibilidad en casos atípicos.

**Dependencias**: ninguna.

**Documentos afectados**: 03_BUSINESS_RULES.md.

---

# D024

**Título**: Aislamiento estricto multi-empresa (multi-tenant)

**Estado**: Aprobada

**Fecha**: Aprobada de facto durante el desarrollo previo; formalizada en este documento el 2026-08-06

**Problema**: Al ser una plataforma que sirve a varias agencias distintas, había que decidir el nivel de aislamiento de datos entre ellas.

**Opciones consideradas**:
1. Aislamiento parcial o configurable (posibilidad de compartir algo entre empresas).
2. Aislamiento estricto y sin excepciones.

**Ventajas**: (de la opción aprobada) elimina cualquier riesgo de que una agencia vea datos de otra; es el estándar esperado de un SaaS multiempresa.

**Inconvenientes**: (de la opción aprobada) bloquea, sin una decisión explícita nueva, escenarios legítimos de negocio como agencias asociadas que quisieran compartir catálogo (ver 05_EDGE_CASES.md #69).

**Consecuencias**: es la base de confianza del modelo SaaS; no debería relajarse sin una decisión de negocio explícita y muy bien justificada.

**Dependencias**: ninguna.

**Documentos afectados**: 02_DOMAIN_MODEL.md, 03_BUSINESS_RULES.md.

---

# D025

**Título**: Auditoría obligatoria de acciones comerciales relevantes

**Estado**: Aprobada

**Fecha**: Aprobada de facto durante el desarrollo previo; formalizada en este documento el 2026-08-06

**Problema**: Había que decidir si las acciones relevantes del sistema (cambios de estado, generación de propuestas, cambios de acceso) quedan registradas de forma permanente o no.

**Opciones consideradas**:
1. No registrar sistemáticamente, solo lo que cada módulo considere necesario de forma ad-hoc.
2. Registrar de forma sistemática y permanente: quién, cuándo, sobre qué.

**Ventajas**: (de la opción aprobada) trazabilidad completa para resolver disputas internas o con clientes; base necesaria para cualquier auditoría de seguridad o de negocio futura.

**Inconvenientes**: (de la opción aprobada) ninguno relevante a nivel de negocio — es una práctica de bajo coste y alto valor.

**Consecuencias**: ninguna decisión futura debería debilitar esta garantía sin una razón de negocio explícita y documentada aquí.

**Dependencias**: ninguna.

**Documentos afectados**: 03_BUSINESS_RULES.md.
