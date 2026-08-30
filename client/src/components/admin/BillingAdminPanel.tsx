import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Mail,
  Plus,
  Receipt,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import { useSelectedBusiness } from "../../hooks/useSelectedBusiness";

const collectionModeLabels: Record<string, string> = {
  manual_link: "Link manual por cuota",
  mp_subscription: "Suscripción Mercado Pago",
};

const installmentStatusLabels: Record<string, string> = {
  scheduled: "Programada",
  reminder_sent: "Recordatorio enviado",
  overdue: "Vencida",
  paid: "Pagada",
  waived: "Condonada",
  cancelled: "Cancelada",
};

function formatAmount(amountCents: number, currency: string) {
  const zeroDecimal = new Set(["CLP", "JPY", "KRW"]);
  const amount = zeroDecimal.has(currency.toUpperCase()) ? amountCents : amountCents / 100;
  return `${amount.toLocaleString("es-CL")} ${currency.toUpperCase()}`;
}

type DraftInstallment = { dueDate: string; amountCents: string };

export function BillingAdminPanel() {
  const { selectedBusinessId } = useSelectedBusiness();
  const [isCreatingAgreement, setIsCreatingAgreement] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCurrency, setNewCurrency] = useState("CLP");
  const [newCollectionMode, setNewCollectionMode] = useState<"manual_link" | "mp_subscription">("manual_link");
  const [newInstallments, setNewInstallments] = useState<DraftInstallment[]>([{ dueDate: "", amountCents: "" }]);
  const [selectedAgreementId, setSelectedAgreementId] = useState<number | null>(null);
  const [editingInstallmentId, setEditingInstallmentId] = useState<number | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editAmountCents, setEditAmountCents] = useState("");
  const [addDraftDueDate, setAddDraftDueDate] = useState("");
  const [addDraftAmount, setAddDraftAmount] = useState("");

  const utils = trpc.useUtils();
  const agreements = trpc.admin.billing.agreements.list.useQuery(undefined, { retry: false });
  const agreementDetail = trpc.admin.billing.agreements.get.useQuery(
    { agreementId: selectedAgreementId ?? 0 },
    { enabled: selectedAgreementId !== null, retry: false },
  );

  const invalidateAll = async () => {
    await Promise.all([
      utils.admin.billing.agreements.list.invalidate(),
      selectedAgreementId ? utils.admin.billing.agreements.get.invalidate({ agreementId: selectedAgreementId }) : Promise.resolve(),
    ]);
  };

  const createAgreement = trpc.admin.billing.agreements.create.useMutation({
    onSuccess: async (result) => {
      await invalidateAll();
      setIsCreatingAgreement(false);
      setNewTitle("");
      setNewInstallments([{ dueDate: "", amountCents: "" }]);
      setSelectedAgreementId(result.agreement.id);
    },
  });
  const setCollectionMode = trpc.admin.billing.agreements.setCollectionMode.useMutation({
    onSuccess: () => invalidateAll(),
  });
  const updateInstallment = trpc.admin.billing.installments.update.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      setEditingInstallmentId(null);
    },
  });
  const markPaid = trpc.admin.billing.installments.markPaid.useMutation({ onSuccess: () => invalidateAll() });
  const waiveInstallment = trpc.admin.billing.installments.waive.useMutation({ onSuccess: () => invalidateAll() });
  const deleteInstallment = trpc.admin.billing.installments.delete.useMutation({ onSuccess: () => invalidateAll() });
  const resendReminder = trpc.admin.billing.installments.resendReminder.useMutation({ onSuccess: () => invalidateAll() });
  const createPaymentLink = trpc.admin.billing.installments.createPaymentLink.useMutation();
  const processReminders = trpc.admin.billing.jobs.processReminders.useMutation({ onSuccess: () => invalidateAll() });
  const addInstallment = trpc.admin.billing.installments.add.useMutation({ onSuccess: () => invalidateAll() });
  const cancelSubscription = trpc.admin.billing.subscriptions.cancel.useMutation({ onSuccess: () => invalidateAll() });
  const recreateSubscription = trpc.admin.billing.subscriptions.recreate.useMutation({ onSuccess: () => invalidateAll() });

  const handleAddDraftRow = () => {
    setNewInstallments((rows) => [...rows, { dueDate: "", amountCents: "" }]);
  };

  const handleCreateAgreement = () => {
    if (selectedBusinessId === null || !newTitle.trim()) return;
    const installments = newInstallments
      .filter((row) => row.dueDate && row.amountCents)
      .map((row) => ({ dueDate: row.dueDate, amountCents: Math.round(Number(row.amountCents) * 100) }));
    createAgreement.mutate({
      businessId: selectedBusinessId,
      title: newTitle.trim(),
      currency: newCurrency,
      collectionMode: newCollectionMode,
      installments,
    });
  };

  const startEditingInstallment = (installment: { id: number; dueDate: string; amountCents: number }) => {
    setEditingInstallmentId(installment.id);
    setEditDueDate(installment.dueDate);
    setEditAmountCents(String(installment.amountCents / 100));
  };

  const saveEditingInstallment = () => {
    if (editingInstallmentId === null) return;
    updateInstallment.mutate({
      installmentId: editingInstallmentId,
      dueDate: editDueDate,
      amountCents: Math.round(Number(editAmountCents) * 100),
    });
  };

  return (
    <section className="admin-panel" id="billing-admin">
      <div className="admin-panel-head">
        <div className="admin-panel-head-copy">
          <span className="admin-panel-head-icon"><Receipt size={18} /></span>
          <p className="admin-eyebrow">04 · Cobros a clientes</p>
          <h2>Lo que cada cliente te debe, ordenado y con recordatorios</h2>
        </div>
        <p>
          Un acuerdo por cliente, cuotas con fecha y monto editables a mano, y recordatorios automáticos por mail. El registro manual siempre manda.
        </p>
      </div>

      <div className="admin-control-bar">
        <div className="admin-summary">
          <span><Receipt size={15} /> {agreements.data?.length ?? 0} acuerdos</span>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={processReminders.isPending}
          onClick={() => processReminders.mutate({})}
        >
          <Mail size={14} /> {processReminders.isPending ? "Procesando…" : "Disparar recordatorios ahora"}
        </button>
      </div>

      {agreements.error ? <p className="admin-error"><AlertTriangle size={15} /> {agreements.error.message}</p> : null}
      {processReminders.error ? <p className="admin-error"><AlertTriangle size={15} /> {processReminders.error.message}</p> : null}

      <div className="membership-list">
        {(agreements.data ?? []).map((row: any) => (
          <article className="membership-row" key={row.agreement.id}>
            <div>
              <strong>{row.agreement.title}</strong>
              <span>
                {row.businessName} ({row.businessSlug}) · {collectionModeLabels[row.agreement.collectionMode]} ·{" "}
                {formatAmount(row.agreement.totalAmountCents, row.agreement.currency)}
              </span>
            </div>
            <button
              type="button"
              className="auth-button"
              onClick={() => setSelectedAgreementId(row.agreement.id)}
            >
              <ChevronRight size={14} /> Ver detalle
            </button>
          </article>
        ))}
        {!agreements.isLoading && agreements.data?.length === 0 ? (
          <p className="booking-muted"><Receipt size={16} /> Todavía no hay acuerdos de facturación.</p>
        ) : null}
      </div>

      <div className="admin-control-bar">
        <button
          type="button"
          className="admin-primary-button"
          disabled={selectedBusinessId === null}
          onClick={() => setIsCreatingAgreement((current) => !current)}
        >
          <Plus size={14} /> {isCreatingAgreement ? "Cancelar nuevo acuerdo" : "Nuevo acuerdo para el cliente seleccionado"}
        </button>
        {selectedBusinessId === null ? (
          <p className="booking-muted">
            <AlertTriangle size={16} /> Selecciona un cliente arriba para crear un acuerdo.
          </p>
        ) : null}
      </div>

      {isCreatingAgreement && selectedBusinessId !== null ? (
        <div className="membership-list">
          <article className="membership-row">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
              <label>
                Título del acuerdo
                <input
                  type="text"
                  value={newTitle}
                  placeholder="Plataforma web + mantenciones 2026"
                  onChange={(event) => setNewTitle(event.target.value)}
                />
              </label>
              <label>
                Moneda
                <input type="text" maxLength={3} value={newCurrency} onChange={(event) => setNewCurrency(event.target.value.toUpperCase())} />
              </label>
              <label>
                Modo de cobro
                <select value={newCollectionMode} onChange={(event) => setNewCollectionMode(event.target.value as "manual_link" | "mp_subscription")}>
                  <option value="manual_link">Link manual por cuota</option>
                  <option value="mp_subscription">Suscripción Mercado Pago</option>
                </select>
              </label>
              {newInstallments.map((row, index) => (
                <div key={index} style={{ display: "flex", gap: "0.5rem" }}>
                  <label>
                    Vencimiento cuota {index + 1}
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNewInstallments((rows) => rows.map((r, i) => (i === index ? { ...r, dueDate: value } : r)));
                      }}
                    />
                  </label>
                  <label>
                    Monto
                    <input
                      type="number"
                      min={0}
                      value={row.amountCents}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNewInstallments((rows) => rows.map((r, i) => (i === index ? { ...r, amountCents: value } : r)));
                      }}
                    />
                  </label>
                </div>
              ))}
              <button type="button" className="auth-button" onClick={handleAddDraftRow}>
                <Plus size={14} /> Agregar cuota
              </button>
              <button
                type="button"
                className="admin-primary-button"
                disabled={createAgreement.isPending || !newTitle.trim()}
                onClick={handleCreateAgreement}
              >
                {createAgreement.isPending ? "Creando…" : "Crear acuerdo"}
              </button>
              {createAgreement.error ? <p className="admin-error"><AlertTriangle size={15} /> {createAgreement.error.message}</p> : null}
            </div>
          </article>
        </div>
      ) : null}

      {selectedAgreementId !== null && agreementDetail.data ? (
        <div className="admin-plan-preview">
          <span className="metric-label">DETALLE DEL ACUERDO</span>
          <p>
            <strong>{agreementDetail.data.agreement.title}</strong> · {agreementDetail.data.agreement.status}
          </p>

          <label>
            Modo de cobro
            <select
              value={agreementDetail.data.agreement.collectionMode}
              onChange={(event) =>
                setCollectionMode.mutate({
                  agreementId: agreementDetail.data!.agreement.id,
                  collectionMode: event.target.value as "manual_link" | "mp_subscription",
                })
              }
              disabled={setCollectionMode.isPending}
            >
              <option value="manual_link">Link manual por cuota</option>
              <option value="mp_subscription">Suscripción Mercado Pago</option>
            </select>
          </label>

          {resendReminder.error ? <p className="admin-error"><AlertTriangle size={15} /> {resendReminder.error.message}</p> : null}
          {markPaid.error ? <p className="admin-error"><AlertTriangle size={15} /> {markPaid.error.message}</p> : null}

          <div className="membership-list">
            {agreementDetail.data.installments.map((installment: any) => (
              <article className="membership-row" key={installment.id}>
                {editingInstallmentId === installment.id ? (
                  <>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <label>
                        Vencimiento
                        <input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} />
                      </label>
                      <label>
                        Monto
                        <input
                          type="number"
                          min={0}
                          value={editAmountCents}
                          onChange={(event) => setEditAmountCents(event.target.value)}
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" className="admin-primary-button" onClick={saveEditingInstallment} disabled={updateInstallment.isPending}>
                        Guardar
                      </button>
                      <button type="button" className="auth-button" onClick={() => setEditingInstallmentId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>Cuota #{installment.sequence} — {formatAmount(installment.amountCents, installment.currency)}</strong>
                      <span>
                        Vence {installment.dueDate} · {installmentStatusLabels[installment.status] ?? installment.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" className="auth-button" onClick={() => startEditingInstallment(installment)}>
                        <CalendarClock size={14} /> Editar
                      </button>
                      {installment.status !== "paid" ? (
                        <button
                          type="button"
                          className="auth-button"
                          onClick={() => markPaid.mutate({ installmentId: installment.id })}
                          disabled={markPaid.isPending}
                        >
                          <CheckCircle2 size={14} /> Marcar pagada
                        </button>
                      ) : null}
                      {installment.status !== "paid" && installment.status !== "waived" ? (
                        <button
                          type="button"
                          className="auth-button"
                          onClick={() => waiveInstallment.mutate({ installmentId: installment.id })}
                          disabled={waiveInstallment.isPending}
                        >
                          <XCircle size={14} /> Condonar
                        </button>
                      ) : null}
                      {installment.status !== "paid" ? (
                        <button
                          type="button"
                          className="auth-button"
                          onClick={() => resendReminder.mutate({ installmentId: installment.id })}
                          disabled={resendReminder.isPending}
                        >
                          <Mail size={14} /> Reenviar recordatorio
                        </button>
                      ) : null}
                      {installment.status !== "paid" ? (
                        <button
                          type="button"
                          className="auth-button"
                          onClick={async () => {
                            const result = await createPaymentLink.mutateAsync({
                              installmentId: installment.id,
                              provider: "mercadopago",
                            });
                            if (typeof window !== "undefined") window.open(result.checkoutUrl, "_blank");
                          }}
                          disabled={createPaymentLink.isPending}
                        >
                          <CreditCard size={14} /> Link de pago
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="auth-button"
                        onClick={() => deleteInstallment.mutate({ installmentId: installment.id })}
                        disabled={deleteInstallment.isPending}
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <label>
              Nueva cuota — vencimiento
              <input type="date" value={addDraftDueDate} onChange={(event) => setAddDraftDueDate(event.target.value)} />
            </label>
            <label>
              Monto
              <input
                type="number"
                min={0}
                value={addDraftAmount}
                onChange={(event) => setAddDraftAmount(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="auth-button"
              disabled={addInstallment.isPending || !addDraftDueDate || !addDraftAmount || Number(addDraftAmount) <= 0}
              onClick={() => {
                addInstallment.mutate(
                  {
                    agreementId: agreementDetail.data!.agreement.id,
                    dueDate: addDraftDueDate,
                    amountCents: Math.round(Number(addDraftAmount) * 100),
                  },
                  {
                    onSuccess: () => {
                      setAddDraftDueDate("");
                      setAddDraftAmount("");
                    },
                  },
                );
              }}
            >
              <Plus size={14} /> Agregar cuota
            </button>
          </div>
          {addInstallment.error ? <p className="admin-error"><AlertTriangle size={15} /> {addInstallment.error.message}</p> : null}

          {agreementDetail.data.agreement.collectionMode === "mp_subscription" ? (
            <div className="membership-list">
              <span className="metric-label">SUSCRIPCIÓN MERCADO PAGO</span>
              {agreementDetail.data.subscriptions.map((subscription: any) => (
                <article className="membership-row" key={subscription.id}>
                  <div>
                    <strong>{subscription.status}</strong>
                    <span>
                      {formatAmount(subscription.amountCents, subscription.currency)} / {subscription.frequency} {subscription.frequencyType}
                    </span>
                  </div>
                  {subscription.status !== "cancelled" ? (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="auth-button"
                        onClick={() => cancelSubscription.mutate({ subscriptionId: subscription.id })}
                        disabled={cancelSubscription.isPending}
                      >
                        <XCircle size={14} /> Cancelar
                      </button>
                      <button
                        type="button"
                        className="auth-button"
                        onClick={() => recreateSubscription.mutate({ subscriptionId: subscription.id })}
                        disabled={recreateSubscription.isPending}
                      >
                        <RefreshCw size={14} /> Recrear
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {agreementDetail.data.subscriptions.length === 0 ? (
                <p className="booking-muted"><RefreshCw size={16} /> Sin suscripción activa todavía.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
