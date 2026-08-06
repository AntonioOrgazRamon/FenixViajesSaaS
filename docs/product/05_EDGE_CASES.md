# 05 — Catálogo de casos límite

> **Responsabilidad de este documento**: reunir, en un único catálogo sin duplicados, todas las preguntas "¿y qué pasa si...?" de negocio detectadas hasta ahora. Cada una lleva un estado y, cuando aplica, el ID de la decisión relacionada en [06_DECISIONS.md](./06_DECISIONS.md). Este documento no resuelve nada — es un inventario de riesgo funcional para priorizar descubrimiento y backlog.

**Leyenda de estado**: 🟢 Resuelto (el sistema ya responde a esto de forma razonable) · 🟡 Parcial (hay una respuesta, pero incompleta o fragil) · 🔴 Sin resolver (no hay respuesta hoy, ni siquiera parcial).

## Catálogo y proveedores

1. 🟡 ¿Qué pasa si un viaje cambia de precio después de generar una propuesta? — la versión ya generada queda congelada; el precio nuevo solo se refleja en una versión futura.
2. 🟡 ¿Qué pasa si cambia el hotel de un viaje ya propuesto? — mismo mecanismo que el precio; no hay aviso de que la propuesta quedó desactualizada.
3. 🔴 ¿Qué pasa si un viaje se rechaza en el catálogo mientras hay propuestas activas que lo referencian?
4. 🟢 ¿Qué pasa si se intenta borrar por completo un viaje ya usado en una propuesta? — el sistema lo impide a nivel de integridad.
5. 🟡 ¿Qué pasa si dos importaciones de catálogo distintas generan el mismo viaje duplicado?
6. 🟡 ¿Qué pasa si la extracción automática de un catálogo interpreta mal un dato (precio, fechas, hotel)? — existe un proceso de calidad, pero puede saltarse sin revisión humana obligatoria.
7. 🔴 ¿Qué pasa si un proveedor deja de operar un destino que sigue en catálogo?
8. 🔴 ¿Qué pasa si la disponibilidad de fechas de un viaje cambia o se agota? — D004
9. 🟢 ¿Qué pasa si dos proveedores ofrecen el mismo destino a precios distintos? — son dos productos de catálogo distintos, sin conflicto de modelo.
10. 🔴 ¿Qué pasa si un hotel cambia de categoría? — D006
11. 🟡 ¿Qué pasa si hay que retirar temporalmente un viaje sin borrarlo (fuera de temporada)?
12. 🔴 ¿Qué pasa si el mismo viaje debe existir en varios idiomas o monedas? — D019
13. 🔴 ¿Qué pasa si dos proveedores distintos representan al mismo hotel bajo nombres distintos? — D006
14. 🔴 ¿Qué pasa si un proveedor ofrece una tarifa especial por volumen que no está reflejada en el catálogo estándar?
15. 🔴 ¿Qué pasa si un viaje se importa con datos incompletos (sin precio) pero un cliente insiste en cotizarlo igual?

## Propuestas comerciales

16. 🔴 ¿Qué pasa si el cliente quiere modificar una propuesta ya enviada (cambiar un hotel, quitar una opción)? — D018
17. 🔴 ¿Qué pasa si el cliente quiere varias propuestas alternativas independientes, no versiones de la misma? — D003
18. 🟡 ¿Qué pasa si hay que corregir un error tipográfico en una propuesta ya enviada? — obliga a generar una versión nueva completa.
19. 🔴 ¿Qué pasa si el comercial quiere duplicar una propuesta para un Lead similar?
20. 🔴 ¿Qué pasa si el cliente responde directamente al envío de la propuesta? — D015
21. 🟡 ¿Qué pasa si falla la generación del documento de la propuesta? — la propuesta puede quedar creada sin documento descargable, visible igualmente al usuario.
22. 🔴 ¿Qué pasa si el cliente acepta verbalmente y eso no queda registrado en ningún sitio? — D004
23. 🔴 ¿Qué pasa si hace falta aplicar un descuento comercial puntual a una propuesta?
24. 🔴 ¿Qué pasa si se necesita una plantilla de propuesta distinta según el tipo de cliente? — D017
25. 🟡 ¿Qué pasa si el documento de una versión antigua deja de existir físicamente pero el registro sigue ahí? — inconsistencia detectada en el pasado, sin verificación automática.
26. 🔴 ¿Qué pasa si se necesita firma o aceptación formal del cliente sobre una propuesta? — D004
27. 🔴 ¿Qué pasa si dos propuestas comparten un viaje en común y ese viaje cambia — se refleja en ambas o solo en la más reciente?
28. 🔴 ¿Qué pasa si el cliente rechaza todas las opciones pero pide "algo parecido pero distinto"? — ¿es una iteración o una propuesta nueva? — D003

## Organización interna / comerciales

29. 🔴 ¿Qué pasa si dos comerciales trabajan el mismo Lead sin saberlo? — D010
30. 🔴 ¿Qué pasa si el comercial que gestionaba un Lead deja la empresa? — D013
31. 🔴 ¿Qué pasa si la agencia tiene varias oficinas y un cliente de una contacta por error a otra? — D011
32. 🔴 ¿Qué pasa si hace falta repartir automáticamente Leads nuevos entre comerciales disponibles?
33. 🔴 ¿Qué pasa si un comercial necesita pedir ayuda a otro sobre un caso sin perder la titularidad del Lead?
34. 🟡 ¿Qué pasa si el Super administrador necesita actuar en nombre de una empresa concreta? — hoy debe indicar explícitamente el contexto en cada acción, sin modo de sesión dedicado.

## Clientes y relación a largo plazo

35. 🔴 ¿Qué pasa si el mismo cliente vuelve un año después? — ¿el sistema lo reconoce automáticamente? — D002
36. 🔴 ¿Qué pasa si dos personas comparten datos de contacto (email/teléfono familiar) y son clientes distintos? — D002
37. 🔴 ¿Qué pasa si un cliente cambia de contacto y quedan dos fichas suyas sin fusionar? — D002
38. 🔴 ¿Qué pasa si un cliente reclama formalmente — se distingue de una incidencia operativa normal? — D005
39. 🔴 ¿Qué pasa si un cliente pide que se elimine toda su información?
40. 🔴 ¿Qué pasa si el titular legal de una reserva es un tutor de un menor de edad? — D004
41. 🔴 ¿Qué pasa si el cliente quiere guardar viajes favoritos para decidir más tarde?
42. 🔴 ¿Qué pasa si el cliente quiere comparar muchas opciones a la vez, no solo las 3-4 de una propuesta armada?

## Reservas, pagos y postventa

43. 🔴 ¿Qué pasa si el cliente paga la señal pero nunca completa el saldo? — D004, D008
44. 🔴 ¿Qué pasa si el cliente quiere cambiar la fecha de salida tras haber pagado la señal? — D004
45. 🔴 ¿Qué pasa si el cliente quiere añadir o quitar un acompañante tras confirmar la reserva? — D004
46. 🔴 ¿Qué pasa si hay que devolver dinero y el método de pago original ya no es válido? — D008
47. 🔴 ¿Qué pasa si el cliente compra un segundo viaje mientras el primero sigue en curso? — D002, D004
48. 🔴 ¿Qué pasa si el cliente quiere transferir su reserva a otra persona? — D004
49. 🔴 ¿Qué pasa si una reserva grupal tiene pagos individuales por viajero? — D004, D008
50. 🔴 ¿Qué pasa si se cancela el vuelo por causas ajenas al proveedor de tierra? — D005
51. 🔴 ¿Qué pasa si el cliente cancela por causa de fuerza mayor — aplica la penalización estándar igual? — D005
52. 🔴 ¿Qué pasa si hay overbooking en destino y hay que reubicar al cliente de urgencia? — D005
53. 🔴 ¿Qué pasa si un servicio incluido (ej. una excursión) no se presta y el cliente pide reembolso parcial? — D005
54. 🔴 ¿Qué pasa si una cancelación de un viaje grupal afecta solo a una parte del grupo? — D004, D005
55. 🔴 ¿Qué pasa si varios clientes reportan la misma incidencia sobre el mismo viaje al mismo tiempo (problema del proveedor, no del cliente)? — D005

## Legal y regulatorio

56. 🔴 ¿Qué pasa si un país exige un formato de factura fiscal específico? — D012
57. 🔴 ¿Qué pasa si aplica normativa de protección al viajero (fondos de garantía, seguros obligatorios) según el país de venta? — D004
58. 🔴 ¿Qué pasa si el cliente exige el contrato de viaje firmado antes de pagar, no después? — D004
59. 🔴 ¿Qué pasa si hay que conservar datos de un cliente por obligación legal más allá de cuando pidió borrarlos?

## IA / motor de recomendación

60. 🟡 ¿Qué pasa si la interpretación automática de lo que busca el cliente es incorrecta? — hay una capa que limita coincidencias artificialmente altas, pero no hay corrección humana estructurada del resultado antes de usarlo.
61. 🟢 ¿Qué pasa si el proveedor de IA no responde o da error a mitad de una generación? — el sistema tiene una vía de reserva sin IA verificada en la práctica.
62. 🟡 ¿Qué pasa si no hay ningún viaje que encaje razonablemente con lo que pide el cliente? — el estado global lo refleja, pero las opciones individuales mostradas no siempre son igual de honestas sobre ese hecho (caso conocido, no corregido).
63. 🟢 ¿Qué pasa si el gasto en IA de una empresa se dispara? — hay límites configurables por empresa/usuario/tipo de operación.
64. 🔴 ¿Qué pasa si se quiere auditar exactamente por qué se recomendó un viaje concreto? — 🟢 en realidad esto **sí** está bien resuelto (se conserva la explicación completa del cálculo); se marca aquí solo para que quede junto al resto de preguntas de esta sección.

## Escala y crecimiento del negocio

65. 🔴 ¿Qué pasa si la agencia crece a varias oficinas con comerciales especializados por destino? — D011
66. 🔴 ¿Qué pasa si la agencia empieza a operar como touroperador para otras agencias más pequeñas? — D001, D007, D016
67. 🔴 ¿Qué pasa si hace falta vender en varios idiomas y monedas a la vez sobre el mismo catálogo? — D019
68. 🔴 ¿Qué pasa si aparece un cliente corporativo pidiendo viajes para muchos empleados con política de aprobación propia? — D001 (modelo D, hoy fuera de alcance)
69. 🔴 ¿Qué pasa si dos empresas (agencias) quieren compartir el mismo catálogo (agencias asociadas)?
70. 🔴 ¿Qué pasa si una empresa necesita migrar sus datos a otro tenant (fusión de agencias)?

## Cómo usar este catálogo

Este documento crece con el tiempo — cada vez que se descubra un caso nuevo, se añade aquí con su estado y, si corresponde, se abre una decisión nueva en [06_DECISIONS.md](./06_DECISIONS.md). No se resuelve nada directamente en este archivo.
