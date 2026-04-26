export interface ProcessRequest {
  text: string;
}

export interface ProcessResponse {
  // KPIs Estadísticos
  maximo?: number;
  minimo?: number;
  promedio?: number;
  suma?: number;
  cantidad?: number;
  
  // Listas
  lista_desc?: number[];
  lista_asc?: number[];
  positivos?: number[];
  negativos?: number[];
  
  // NUEVO: Datos del CRM / Embudo
  crm_data?: {
    status: 'SUCCESS' | 'WARNING';
    mensaje: string;
    embudo: {
      leads: number;
      conversiones: number;
      tasa_conversion: string;
      churn_rate: string;
    };
    finanzas: {
      gross_revenue: number;
      refunds: number;
      net_revenue: number;
      ticket_promedio: number;
    };
    segmentacion: {
      high_ticket: number;
      mid_ticket: number;
      low_ticket: number;
    };
  };
  
  error?: string;
}
