import { FormEvent, useMemo, useState } from "react";
import { CalendarCheck2, Check, Clock3, MessageCircle, UserRound } from "lucide-react";
import { trpc } from "../../lib/trpc";

const formatter = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Santiago",
});

export function BookingDemoPanel() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+56 9 ");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: number; startsAt: string } | null>(null);
  const services = trpc.reservations.listServices.useQuery(undefined, { retry: false });
  const staff = trpc.reservations.listStaff.useQuery(undefined, { retry: false });
  const service = services.data?.[0];
  const professional = staff.data?.[0];
  const dateWindow = useMemo(() => {
    const from = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const to = new Date(Date.now() + 10 * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const availability = trpc.reservations.getAvailability.useQuery(
    { serviceId: service?.id ?? 0, staffId: professional?.id, ...dateWindow },
    { enabled: Boolean(service?.id && professional?.id), retry: false },
  );
  const appointment = trpc.reservations.createAppointment.useMutation({
    onSuccess: (result) => {
      setSuccess({ id: result.appointment.id, startsAt: result.appointment.startsAt.toString() });
      setSelectedSlot(null);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!service || !professional || !selectedSlot) return;
    appointment.mutate({
      serviceId: service.id,
      staffId: professional.id,
      customerName: name,
      customerEmail: email || undefined,
      customerPhoneE164: phone,
      startsAt: selectedSlot,
      idempotencyKey: `demo-${service.id}-${professional.id}-${selectedSlot}`,
      source: "platform-demo",
    });
  };

  return (
    <section className="bookings-demo-section" id="bookings-module">
      <div className="section-heading bookings-heading">
        <div>
          <p className="eyebrow">03 / MODULE ATTACHED</p>
          <h2>Agenda que trabaja mientras tú atiendes.</h2>
        </div>
        <p>
          Servicios, profesionales, disponibilidad, reserva segura y una outbox lista para confirmar por WhatsApp sin bloquear la experiencia.
        </p>
      </div>

      <div className="booking-demo-layout">
        <div className="booking-calendar-card">
          <div className="booking-topline">
            <span>AVAILABLE SLOTS</span>
            <CalendarCheck2 size={17} />
          </div>
          <div className="booking-service-summary">
            <div>
              <span className="metric-label">SERVICE</span>
              <h3>{service?.name ?? "Cargando servicio…"}</h3>
            </div>
            <div className="booking-staff-badge">
              <UserRound size={15} />
              {professional?.name ?? "Asignando profesional…"}
            </div>
          </div>
          <div className="booking-slots">
            {availability.isLoading ? <p className="booking-muted">Calculando disponibilidad…</p> : null}
            {availability.data?.slice(0, 12).map((slot) => (
              <button
                className={selectedSlot === slot.startsAt ? "booking-slot is-selected" : "booking-slot"}
                key={`${slot.staffId}-${slot.startsAt}`}
                type="button"
                onClick={() => setSelectedSlot(slot.startsAt)}
              >
                <Clock3 size={15} />
                {formatter.format(new Date(slot.startsAt))}
              </button>
            ))}
            {!availability.isLoading && availability.data?.length === 0 ? (
              <p className="booking-muted">No hay slots en el rango demo.</p>
            ) : null}
          </div>
        </div>

        <form className="booking-form-card" onSubmit={handleSubmit}>
          <div className="booking-topline">
            <span>BOOK AN APPOINTMENT</span>
            <MessageCircle size={17} />
          </div>
          <h3>Reserva un horario.</h3>
          <p>La cita se guarda en Neon y crea tres tareas WhatsApp: confirmación, recordatorio de 24 horas y recordatorio de 2 horas.</p>
          <label>
            Nombre
            <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" />
          </label>
          <label>
            WhatsApp E.164
            <input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+56912345678" />
          </label>
          <button className="checkout-button" disabled={!selectedSlot || appointment.isPending} type="submit">
            {appointment.isPending ? "Reservando…" : selectedSlot ? "Confirmar reserva" : "Elige un horario"}
            <CalendarCheck2 size={16} />
          </button>
          {appointment.error ? <p className="form-error">{appointment.error.message}</p> : null}
          {success ? (
            <div className="booking-success">
              <Check size={18} />
              <div>
                <strong>Reserva #{success.id} confirmada</strong>
                <span>{formatter.format(new Date(success.startsAt))}</span>
                <span>WhatsApp quedó en cola de envío.</span>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
