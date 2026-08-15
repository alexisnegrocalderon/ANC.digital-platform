import { FormEvent, useMemo, useState } from "react";
import { Check, CalendarDays, MapPin, Ticket, ArrowUpRight } from "lucide-react";
import { trpc } from "../../lib/trpc";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function EventDemoPanel() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [success, setSuccess] = useState<{ orderId: number; orderNumber: string; codes: string[] } | null>(null);
  const [provider, setProvider] = useState<"stripe" | "mercadopago">("stripe");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const events = trpc.events.listPublished.useQuery(undefined, { retry: false });
  const event = events.data?.[0];
  const ticketTypes = trpc.events.getTicketTypes.useQuery(
    { eventId: event?.id ?? 0 },
    { enabled: Boolean(event?.id), retry: false },
  );
  const ticketType = ticketTypes.data?.[0];
  const order = trpc.events.createOrder.useMutation({
    onSuccess: (result) => {
      setSuccess({
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        codes: result.tickets.map((ticket: { code: string }) => ticket.code),
      });
      setCheckoutUrl(null);
    },
  });

  const dateLabel = useMemo(() => {
    if (!event) return "Fecha por confirmar";
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Santiago",
    }).format(new Date(event.startsAt));
  }, [event]);

  const payment = trpc.payments.createCheckout.useMutation({
    onSuccess: (result) => setCheckoutUrl(result.checkoutUrl),
  });

  const handleSubmit = (submission: FormEvent<HTMLFormElement>) => {
    submission.preventDefault();
    if (!event || !ticketType) return;
    setSuccess(null);
    order.mutate({
      eventId: event.id,
      ticketTypeId: ticketType.id,
      quantity: 1,
      customerEmail: email,
      customerName: name || undefined,
    });
  };

  return (
    <section id="events-module" className="events-demo-section">
      <div className="section-heading events-heading">
        <div>
          <p className="eyebrow">02 / VERTICAL ATTACHED</p>
          <h2>Eventos, listo para vender.</h2>
        </div>
        <p>
          El primer vertical usa el mismo core de negocio, permisos, Neon y contratos API. Solo agrega sus reglas y pantallas.
        </p>
      </div>

      <div className="events-demo-layout">
        <div className="event-card">
          <div className="event-card-topline">
            <span>PUBLIC EVENT</span>
            <span className="event-status">PUBLISHED</span>
          </div>
          {event ? (
            <>
              <h3>{event.name}</h3>
              <p className="event-description">{event.description}</p>
              <div className="event-details">
                <span><CalendarDays size={16} />{dateLabel}</span>
                <span><MapPin size={16} />{event.venue ?? "Ubicación por confirmar"}</span>
              </div>
              <div className="event-ticket-preview">
                <div>
                  <span className="metric-label">TICKET TYPE</span>
                  <strong>{ticketType?.name ?? "Cargando entrada…"}</strong>
                </div>
                <strong className="event-price">
                  {ticketType ? money.format(ticketType.priceCents) : "—"}
                </strong>
              </div>
            </>
          ) : (
            <div className="event-empty">No hay eventos publicados para este negocio.</div>
          )}
        </div>

        <form className="event-checkout" onSubmit={handleSubmit}>
          <div className="event-card-topline">
            <span>FAST CHECKOUT</span>
            <Ticket size={16} />
          </div>
          <h3>Reserva tu acceso.</h3>
          <p>Este formulario crea el pedido y permite abrir un checkout hospedado sin exponer datos de tarjeta a ANC Platform.</p>
          <label>
            Nombre
            <input value={name} onChange={(eventInput) => setName(eventInput.target.value)} placeholder="Tu nombre" />
          </label>
          <label>
            Email
            <input required type="email" value={email} onChange={(eventInput) => setEmail(eventInput.target.value)} placeholder="tu@email.com" />
          </label>
          <label>
            Pasarela
            <select value={provider} onChange={(eventInput) => setProvider(eventInput.target.value as "stripe" | "mercadopago")}>
              <option value="stripe">Stripe Checkout</option>
              <option value="mercadopago">MercadoPago Checkout Pro</option>
            </select>
          </label>
          <button className="checkout-button" disabled={!event || !ticketType || order.isPending} type="submit">
            {order.isPending ? "Creando pedido…" : "Crear pedido"} <ArrowUpRight size={16} />
          </button>
          {order.error ? <p className="form-error">{order.error.message}</p> : null}
          {success ? (
            <div className="order-success">
              <Check size={18} />
              <div>
                <strong>Pedido {success.orderNumber}</strong>
                <span>Pedido preparado: {success.orderNumber}</span>
                <span>Ticket demo: {success.codes[0]}</span>
                <button
                  className="checkout-link"
                  disabled={payment.isPending}
                  type="button"
                  onClick={() =>
                    payment.mutate({
                      provider,
                      orderId: success.orderId,
                      successUrl: `${window.location.origin}/?payment=success`,
                      cancelUrl: `${window.location.origin}/?payment=cancelled`,
                    })
                  }
                >
                  {payment.isPending ? "Preparando checkout…" : `Pagar con ${provider === "stripe" ? "Stripe" : "MercadoPago"}`}
                  <ArrowUpRight size={16} />
                </button>
                {payment.error ? <span className="form-error">{payment.error.message}</span> : null}
                {checkoutUrl ? (
                  <a className="checkout-link" href={checkoutUrl} target="_blank" rel="noreferrer">
                    Abrir checkout hospedado <ArrowUpRight size={16} />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
