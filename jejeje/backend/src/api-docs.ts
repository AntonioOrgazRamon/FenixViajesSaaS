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
          initialAdmin: { email: "string", firstName: "string", lastName: "string", password: "string", phone: "string (opcional)" }
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
    ]
  }
};
