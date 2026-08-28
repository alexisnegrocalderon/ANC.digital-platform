export type InstallmentReminderContext = {
  businessName: string;
  installmentSequence: number;
  dueDate: string;
  amountCents: number;
  currency: string;
  paymentUrl?: string;
  /** Negative = days before due date, 0 = due today, positive = days overdue. */
  offsetDays: number;
};

function formatAmount(amountCents: number, currency: string) {
  const zeroDecimalCurrencies = new Set(["CLP", "JPY", "KRW"]);
  const amount = zeroDecimalCurrencies.has(currency.toUpperCase()) ? amountCents : amountCents / 100;
  return `${amount.toLocaleString("es-CL")} ${currency.toUpperCase()}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export function buildInstallmentReminderEmail(ctx: InstallmentReminderContext) {
  const isOverdue = ctx.offsetDays > 0;
  const isDueToday = ctx.offsetDays === 0;
  const businessName = escapeHtml(ctx.businessName);

  const subject = isOverdue
    ? `Cuota vencida (#${ctx.installmentSequence}) — ${ctx.businessName}`
    : isDueToday
      ? `Tu cuota vence hoy — ${ctx.businessName}`
      : `Recordatorio: cuota próxima a vencer — ${ctx.businessName}`;

  const introLine = isOverdue
    ? `Tu cuota #${ctx.installmentSequence} de <strong>${businessName}</strong> está vencida desde el ${ctx.dueDate}.`
    : isDueToday
      ? `Tu cuota #${ctx.installmentSequence} de <strong>${businessName}</strong> vence hoy, ${ctx.dueDate}.`
      : `Tu cuota #${ctx.installmentSequence} de <strong>${businessName}</strong> vence el ${ctx.dueDate}.`;

  const introTextLine = isOverdue
    ? `Tu cuota #${ctx.installmentSequence} de ${ctx.businessName} está vencida desde el ${ctx.dueDate}.`
    : isDueToday
      ? `Tu cuota #${ctx.installmentSequence} de ${ctx.businessName} vence hoy, ${ctx.dueDate}.`
      : `Tu cuota #${ctx.installmentSequence} de ${ctx.businessName} vence el ${ctx.dueDate}.`;

  const amountLabel = formatAmount(ctx.amountCents, ctx.currency);
  const paymentButton = ctx.paymentUrl
    ? `<p style="margin:24px 0;"><a href="${ctx.paymentUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Pagar ahora</a></p>`
    : "";
  const paymentTextLine = ctx.paymentUrl ? `Pagar: ${ctx.paymentUrl}\n` : "";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;max-width:520px;margin:0 auto;">
      <p style="font-size:15px;line-height:1.5;">${introLine}</p>
      <p style="font-size:15px;line-height:1.5;"><strong>Monto:</strong> ${amountLabel}</p>
      ${paymentButton}
      <p style="color:#6b7280;font-size:12px;margin-top:32px;">Este es un recordatorio automático de facturación de ANC.</p>
    </div>
  `.trim();

  const text = `${introTextLine}\nMonto: ${amountLabel}\n${paymentTextLine}`;

  return { subject, html, text };
}
