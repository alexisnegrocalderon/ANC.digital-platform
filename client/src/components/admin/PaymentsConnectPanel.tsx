import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { trpc } from "../../lib/trpc";

export function PaymentsConnectPanel() {
  const business = trpc.business.current.useQuery(undefined, { retry: false });
  const status = trpc.payments.mercadoPagoConnectionStatus.useQuery(undefined, { retry: false });

  const handleConnect = () => {
    const businessId = business.data?.id;
    if (!businessId) return;
    // A real browser navigation (not a fetch) — MercadoPago's OAuth authorize screen has to
    // load in the top-level document, and the resulting redirect back to /api/payments/
    // mercadopago/callback needs the __Host- state cookie this request sets.
    window.location.href = `/api/payments/mercadopago/authorize?businessId=${businessId}`;
  };

  return (
    <section className="admin-modules-section" id="payments-connect">
      <div className="section-heading">
        <div>
          <p className="eyebrow">06 / COBROS</p>
          <h2>Conectá tu cuenta de Mercado Pago.</h2>
        </div>
        <p>
          Autorizá tu propia cuenta de Mercado Pago para recibir los pagos de tus clientes directamente. La
          conexión pasa siempre por el backend — tus credenciales nunca llegan al navegador.
        </p>
      </div>

      <div className="admin-control-bar">
        <div className="admin-summary">
          {status.data?.connected ? (
            <span><CheckCircle2 size={15} /> Mercado Pago conectado</span>
          ) : (
            <span><XCircle size={15} /> Mercado Pago no conectado</span>
          )}
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={!business.data?.id || status.isLoading}
          onClick={handleConnect}
        >
          <CreditCard size={14} /> {status.data?.connected ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
        </button>
      </div>
      {status.error ? <p className="admin-error">{status.error.message}</p> : null}
    </section>
  );
}
