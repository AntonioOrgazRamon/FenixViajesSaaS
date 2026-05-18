export const apiDocs = {
  name: "API MVP SaaS Multiempresa",
  version: "1.0.0",
  description: "Documentación de los endpoints disponibles en la API.",
  basePath: "/api/v1",
  endpoints: {
    health: [
      {
        method: "GET",
        path: "/health",
        description: "Comprueba el estado de salud del servidor.",
        authRequired: false
      }
    ],
    auth: [
      {
        method: "POST",
        path: "/api/v1/auth/login",
        description: "Inicia sesión y devuelve access y refresh tokens.",
        authRequired: false,
        body: {
          email: "string (requerido)",
          password: "string (requerido)",
          deviceName: "string (opcional)"
        }
      },
      {
        method: "POST",
        path: "/api/v1/auth/logout",
        description: "Cierra la sesión actual (revoca el token de sesión).",
        authRequired: true
      },
      {
        method: "POST",
        path: "/api/v1/auth/refresh",
        description: "Genera un nuevo access token usando un refresh token válido.",
        authRequired: false,
        body: {
          refreshToken: "string (requerido)"
        }
      },
      {
        method: "GET",
        path: "/api/v1/auth/me",
        description: "Devuelve el perfil del usuario autenticado.",
        authRequired: true
      },
      {
        method: "GET",
        path: "/api/v1/auth/profile",
        description: "Devuelve el perfil del usuario autenticado.",
        authRequired: true
      },
      {
        method: "PATCH",
        path: "/api/v1/auth/profile",
        description: "Actualiza los datos del perfil del usuario autenticado.",
        authRequired: true,
        body: {
          firstName: "string (opcional)",
          lastName: "string (opcional)",
          phone: "string (opcional)",
          locale: "string (opcional)",
          timezone: "string (opcional)"
        }
      },
      {
        method: "POST",
        path: "/api/v1/auth/forgot-password",
        description: "Solicita enlace de restablecimiento. Misma respuesta aunque el email no exista (anti enumeración).",
        authRequired: false,
        body: { email: "string" }
      },
      {
        method: "POST",
        path: "/api/v1/auth/verify-reset-token",
        description: "Comprueba si el token del enlace es válido (un solo uso, no caducado).",
        authRequired: false,
        body: { token: "string" }
      },
      {
        method: "POST",
        path: "/api/v1/auth/reset-password",
        description: "Establece contraseña nueva con el token del enlace. Revoca sesiones existentes del usuario.",
        authRequired: false,
        body: { token: "string", newPassword: "string", confirmPassword: "string" }
      }
    ],
    companies: [
      {
        method: "POST",
        path: "/api/v1/superadmin/companies",
        description: "Crea una nueva empresa y su administrador inicial.",
        authRequired: true,
        roles: ["SUPER_ADMIN"],
        body: {
          company: { name: "string", slug: "string" },
          initialAdmin: { email: "string", firstName: "string", lastName: "string", password: "string (misma política que reset: 8+ chars, mayúsc, minúsc, dígito, símbolo)", phone: "string (opcional)" }
        }
      },
      {
        method: "GET",
        path: "/api/v1/superadmin/companies",
        description: "Lista todas las empresas de forma paginada.",
        authRequired: true,
        roles: ["SUPER_ADMIN"],
        queryParams: { page: "number", pageSize: "number" }
      },
      {
        method: "GET",
        path: "/api/v1/superadmin/companies/:id",
        description: "Obtiene los detalles de una empresa por su ID.",
        authRequired: true,
        roles: ["SUPER_ADMIN"]
      },
      {
        method: "PATCH",
        path: "/api/v1/superadmin/companies/:id",
        description: "Actualiza los datos básicos de una empresa.",
        authRequired: true,
        roles: ["SUPER_ADMIN"],
        body: { name: "string (opcional)", slug: "string (opcional)" }
      },
      {
        method: "POST",
        path: "/api/v1/superadmin/companies/:id/suspend",
        description: "Suspende una empresa y revoca todas las sesiones de sus usuarios.",
        authRequired: true,
        roles: ["SUPER_ADMIN"],
        body: { reason: "string (opcional)" }
      },
      {
        method: "POST",
        path: "/api/v1/superadmin/companies/:id/reactivate",
        description: "Reactiva una empresa previamente suspendida.",
        authRequired: true,
        roles: ["SUPER_ADMIN"],
        body: { reason: "string (opcional)" }
      },
      {
        method: "DELETE",
        path: "/api/v1/superadmin/companies/:id",
        description: "Realiza un borrado lógico de la empresa y revoca sesiones.",
        authRequired: true,
        roles: ["SUPER_ADMIN"],
        body: { reason: "string (opcional)" }
      }
    ],
    travelCatalog: [
      {
        method: "POST",
        path: "/api/v1/travel/documents/upload",
        description:
          "Sube un PDF de catálogo. SUPER_ADMIN debe enviar `companyId` (multipart: file, field companyId).",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "POST",
        path: "/api/v1/travel/documents/:id/process",
        description: "Inicia el pipeline (extracción → segmentación → IA → importación) en segundo plano. Devuelve jobId (202).",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "DELETE",
        path: "/api/v1/travel/documents/:id",
        description:
          "Borra un PDF, sus viajes y jobs; elimina el fichero en disco y el JSON extraído. SUPER_ADMIN: query `companyId`.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "POST",
        path: "/api/v1/travel/documents/clear",
        description:
          "Vacia importaciones: todos los PDFs de la empresa, viajes con `documentId` (importados) y jobs. Conserva viajes manuales sin documento. SUPER_ADMIN: query `companyId`.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "GET",
        path: "/api/v1/travel/trips",
        description: "Lista viajes. COMPANY_USER solo ve APPROVED. Admin puede filtrar `?status=`.",
        authRequired: true
      },
      {
        method: "GET",
        path: "/api/v1/travel/trips/search",
        description: "Búsqueda (solo viajes aprobados). Filtros: q, country, minDays, maxDays, minPrice, maxPrice.",
        authRequired: true
      },
      {
        method: "POST",
        path: "/api/v1/travel/trips/manual",
        description: "Crea un viaje manual a partir de JSON (mismo esquema de extracción IA).",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "POST",
        path: "/api/v1/travel/trips/:id/approve",
        description: "Marca un viaje como aprobado para búsqueda y propuestas.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "POST",
        path: "/api/v1/travel/import-json/upload",
        description:
          "Staging: sube .json con array de ítems en formato enriquecido `{ source, trip, metadata }` (u objeto único). Planos legados se convierten automáticamente. SUPER_ADMIN: query/body `companyId`.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "POST",
        path: "/api/v1/travel/import-json/paste",
        description:
          "Igual que upload con JSON en body (`jsonContent` string). Formato oficial por ítem: `{ source, trip, metadata }`. Planos legados compatibles. `companyId` obligatorio si SUPER_ADMIN.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"],
        body: {
          jsonContent: "string (requerido)",
          fileName: "string (opcional)",
          companyId: "uuid (SUPER_ADMIN requerido)"
        }
      },
      {
        method: "GET",
        path: "/api/v1/travel/import-json/batches",
        description: "Lista lotes JSON por empresa (paginado). SUPER_ADMIN: `companyId` query.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "GET",
        path: "/api/v1/travel/import-json/batches/:batchId",
        description: "Detalle de lote con ítems. SUPER_ADMIN: `companyId` query.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "PATCH",
        path: "/api/v1/travel/import-json/items/:itemId",
        description:
          "Fusiona parche en `normalizedJson` (contrato enriquecido): preferible `{ trip: { ... } }`; también se fusionan claves del viaje en raíz si coinciden con `trip`. Revalida. SUPER_ADMIN: body/query `companyId`.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "POST",
        path: "/api/v1/travel/import-json/batches/:batchId/import",
        description:
          "Importa ítems VALID/WARNING a BD (TravelTrip + destinos + geo). Omite INVALID y slugs duplicados por tenant.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      },
      {
        method: "DELETE",
        path: "/api/v1/travel/import-json/batches/:batchId",
        description: "Elimina lote staging si aún no está IMPORTED. SUPER_ADMIN: `companyId` query.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN"]
      }
    ],
    proposals: [
      {
        method: "POST",
        path: "/api/v1/proposals/:leadId/generate",
        description:
          "Genera HTML responsive + PDF para el lead: usa TravelSearchService + motor rec-engine (catálogo APPROVED), slots recomendada/presupuesto/premium/alternativa con scoring determinista y trazas, persiste ProposalVersion + ProposalTrip + artefacto PDF y registra LeadActivity. Body opcional: intentSnapshot, trips[], useAiCopy.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "COMPANY_USER"],
        body: {
          intentSnapshot: "object (opcional, fusionado con contexto del lead)",
          trips: "array opcional de { travelTripId, score?, reasons? }",
          useAiCopy: "boolean (opcional; requiere OPENAI_API_KEY)"
        }
      },
      {
        method: "GET",
        path: "/api/v1/proposals/:proposalId",
        description: "Devuelve la propuesta con la última versión (HTML, trips enlazados, artefactos). Aislamiento por empresa.",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "COMPANY_USER"]
      },
      {
        method: "GET",
        path: "/api/v1/proposals/:proposalId/pdf",
        description: "Descarga el PDF de la última versión (si existe).",
        authRequired: true,
        roles: ["COMPANY_ADMIN", "COMPANY_USER"]
      }
    ],
    openaiAdmin: [
      {
        method: "GET",
        path: "/api/v1/admin/openai/usage",
        description:
          "Historial de uso OpenAI (logs con coste estimado, tokens, bloqueos). Query: companyId?, status?, take, skip, since.",
        authRequired: true,
        roles: ["SUPER_ADMIN"]
      },
      {
        method: "GET",
        path: "/api/v1/admin/openai/budget",
        description: "Presupuesto/flags en BD para una empresa. Query: companyId (UUID).",
        authRequired: true,
        roles: ["SUPER_ADMIN"]
      },
      {
        method: "PATCH",
        path: "/api/v1/admin/openai/budget",
        description:
          "Crea/actualiza límites por tenant (hardBlock, topes €, llamadas/hora, tokens/request). Body incluye companyId.",
        authRequired: true,
        roles: ["SUPER_ADMIN"]
      },
      {
        method: "POST",
        path: "/api/v1/admin/openai/kill-switch",
        description: "Activa/desactiva kill switch global en BD (sumado al OPENAI_GLOBAL_KILL_SWITCH de env). Body: { active: boolean }. ",
        authRequired: true,
        roles: ["SUPER_ADMIN"]
      },
      {
        method: "GET",
        path: "/api/v1/admin/openai/alerts",
        description: "Últimos eventos BLOCKED/ERROR + estado sistema + resumen env.",
        authRequired: true,
        roles: ["SUPER_ADMIN"]
      }
    ]
  }
};
