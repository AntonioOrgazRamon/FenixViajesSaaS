# 00 — Visión de producto

> **Responsabilidad de este documento**: responder, en pocas páginas, "¿qué es esto y para quién existe?". No describe cómo funciona el negocio de una agencia de viajes en general (eso vive en [01_BUSINESS_DOMAIN.md](./01_BUSINESS_DOMAIN.md)), ni el modelo de entidades (eso vive en [02_DOMAIN_MODEL.md](./02_DOMAIN_MODEL.md)), ni decisiones (eso vive **únicamente** en [06_DECISIONS.md](./06_DECISIONS.md)).

## Qué es Fenix Viajes SaaS

Una plataforma multiempresa (multi-tenant) que da a agencias de viajes una herramienta única para gestionar el ciclo comercial de un cliente potencial: desde que alguien muestra interés en viajar, hasta que se le presenta una propuesta comercial con opciones de viaje concretas.

Cada agencia que usa la plataforma (una **Empresa**, ver [08_GLOSSARY.md](./08_GLOSSARY.md)) opera de forma aislada: su propio equipo, su propio catálogo de viajes, sus propios clientes.

## Qué problema resuelve hoy

- Centraliza la captación de interesados en viajar (formulario web, integraciones externas, alta manual) en un único lugar, en vez de dispersos entre WhatsApp, email y hojas de cálculo.
- Ayuda al equipo comercial a encontrar, dentro del catálogo de la agencia, qué viajes encajan con lo que un cliente concreto busca, con una explicación de por qué encajan (no una caja negra).
- Genera documentos de propuesta comercial (PDF) de forma consistente, sin que cada comercial arme el suyo a mano desde cero.
- Dota al catálogo de un proceso de calidad (revisión antes de publicar) en vez de confiar ciegamente en una extracción automática.

## Qué problema NO resuelve todavía (alcance actual real, no aspiracional)

Esto es deliberadamente honesto, no una lista de "próximamente":

- No gestiona la reserva ni el pago de un viaje — el ciclo del sistema termina en la propuesta comercial.
- No hay ningún canal de comunicación con el cliente final integrado — el envío de la propuesta y toda la negociación posterior ocurre fuera del sistema.
- No gestiona la relación con el cliente después de la venta (incidencias, documentación de viaje, seguimiento durante el viaje).
- No gestiona clientes recurrentes con historial propio — cada interesado es tratado como una oportunidad puntual.

Estas ausencias no son errores de implementación: son **decisiones de alcance todavía no tomadas de forma explícita**. Ver [06_DECISIONS.md](./06_DECISIONS.md), especialmente D001 y D004, antes de asumir que alguna de ellas es "simplemente un bug por corregir".

## A quién sirve (roles)

| Rol | Para qué usa la plataforma |
|---|---|
| **Super administrador** | Opera la plataforma en sí: da de alta agencias, no vende viajes. |
| **Administrador de empresa** | Dirige una agencia: gestiona su equipo comercial, aprueba el catálogo de viajes de su empresa, supervisa auditoría. |
| **Usuario de empresa (comercial)** | Trabaja con los interesados en viajar día a día: cualifica, busca opciones, genera propuestas. |

No existe hoy ningún rol de "cliente final" con acceso directo a la plataforma — ver D015 en [06_DECISIONS.md](./06_DECISIONS.md).

## Cómo leer el resto de la documentación

Si eres nuevo en el proyecto, sigue este orden — está diseñado para que entiendas el producto sin necesidad de abrir el código en ningún momento:

1. Este documento.
2. [01_BUSINESS_DOMAIN.md](./01_BUSINESS_DOMAIN.md) — cómo funciona, en general, el negocio de una agencia de viajes.
3. [02_DOMAIN_MODEL.md](./02_DOMAIN_MODEL.md) — qué entidades existen y cómo se relacionan.
4. [06_DECISIONS.md](./06_DECISIONS.md) — qué está decidido y qué sigue abierto.

El resto de documentos ([03](./03_BUSINESS_RULES.md)–[09](./09_FAQ.md)) profundizan en aspectos concretos; el índice completo con cuándo leer cada uno está en [README.md](./README.md).
