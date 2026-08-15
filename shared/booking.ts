export const APPOINTMENT_STATES = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "expired",
  "no_show",
  "rescheduled",
] as const;
export type AppointmentState = (typeof APPOINTMENT_STATES)[number];

export const APPOINTMENT_ACTIVE_STATES: readonly AppointmentState[] = [
  "pending",
  "confirmed",
  "checked_in",
  "rescheduled",
];

export const APPOINTMENT_NOTIFICATION_EVENTS = [
  "appointment.confirmed",
  "appointment.reminder_24h",
  "appointment.reminder_2h",
  "appointment.cancelled",
  "appointment.rescheduled",
] as const;
export type AppointmentNotificationEvent = (typeof APPOINTMENT_NOTIFICATION_EVENTS)[number];

const ALLOWED_TRANSITIONS: Record<AppointmentState, readonly AppointmentState[]> = {
  pending: ["confirmed", "cancelled", "expired"],
  confirmed: ["checked_in", "completed", "cancelled", "no_show", "rescheduled"],
  checked_in: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  expired: [],
  no_show: [],
  rescheduled: ["confirmed", "cancelled"],
};

export function canTransitionAppointment(from: AppointmentState, to: AppointmentState) {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertAppointmentTransition(from: string, to: AppointmentState) {
  if (!APPOINTMENT_STATES.includes(from as AppointmentState)) {
    throw new Error(`Unknown appointment state: ${from}`);
  }
  if (!canTransitionAppointment(from as AppointmentState, to)) {
    throw new Error(`Invalid appointment state transition: ${from} -> ${to}`);
  }
}

export function normalizePhoneE164(value: string) {
  const normalized = value.replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Phone number must be in international E.164 format.");
  }
  return normalized;
}

export function appointmentIdempotencyKey(businessId: number, inputKey: string) {
  return `booking-${businessId}-${inputKey.trim()}`;
}

export type BookingSlot = {
  startsAt: string;
  endsAt: string;
  timezone: string;
  staffId: number;
};
