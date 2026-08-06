export type TravelLeadTripType =
  | 'VACATIONAL'
  | 'HONEYMOON'
  | 'GROUP'
  | 'FAMILY'
  | 'BUSINESS'
  | 'OTHER'
  | 'UNKNOWN';

export type TravelLeadBudgetType = 'PER_PERSON' | 'TOTAL' | 'UNKNOWN';

export interface TravelProfilePayload {
  destinationText?: string | null;
  preferredDestinations?: string[] | null;
  activitiesText?: string | null;
  activityTags?: string[] | null;
  durationDays?: number | null;
  travelDateText?: string | null;
  travelDateFrom?: string | null;
  travelDateTo?: string | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  budgetType?: TravelLeadBudgetType | null;
  tripType?: TravelLeadTripType | null;
  departureAirportText?: string | null;
}

export interface CreateLeadPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  travelProfile?: TravelProfilePayload;
}

export interface ApiSuccess<T> {
  success: boolean;
  data: T;
}

/** Respuesta tras crear lead (backend devuelve el lead con travelProfile serializado). */
export interface CreatedLeadData {
  id: string;
  fullName?: string;
  email?: string | null;
  status?: string;
  travelProfile?: TravelProfilePayload | null;
}
