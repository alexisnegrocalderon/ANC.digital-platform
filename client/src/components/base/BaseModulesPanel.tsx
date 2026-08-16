import { BarChart3, BookOpen, UsersRound } from "lucide-react";
import { trpc } from "../../lib/trpc";

type Props = { enabledKeys: string[] };

export function BaseModulesPanel({ enabledKeys }: Props) {
  const catalogueEnabled = enabledKeys.includes("catalogue");
  const crmEnabled = enabledKeys.includes("crm");
  const reportingEnabled = enabledKeys.includes("reporting");
  const catalogue = trpc.catalogue.list.useQuery({ status: "active" }, { enabled: catalogueEnabled, retry: false });
  const crm = trpc.crm.list.useQuery({ status: "active" }, { enabled: crmEnabled, retry: false });
  const overview = trpc.reporting.overview.useQuery(undefined, { enabled: reportingEnabled, retry: false });

  return (
    <section className="base-modules-panel" aria-label="Módulos base runtime">
      <div className="section-heading">
        <div>
          <p className="eyebrow">02 / BASE RUNTIME</p>
          <h2>Operación común acoplada al Core.</h2>
        </div>
        <p>Catálogo, clientes y reportes comparten tenant, permisos, flags y contratos tRPC.</p>
      </div>
      <div className="base-module-grid">
        <article className="base-module-card">
          <div className="base-module-icon"><BookOpen size={18} /></div>
          <div><span className="metric-label">CATÁLOGO</span><strong>{catalogueEnabled ? `${catalogue.data?.length ?? 0} activos` : "No activado"}</strong></div>
          <p>{catalogue.error ? "Requiere habilitación o configuración." : catalogueEnabled ? "Productos y servicios listos para el vertical." : "Se activa desde el admin según el preset."}</p>
        </article>
        <article className="base-module-card">
          <div className="base-module-icon"><UsersRound size={18} /></div>
          <div><span className="metric-label">CRM</span><strong>{crmEnabled ? `${crm.data?.length ?? 0} clientes` : "No activado"}</strong></div>
          <p>{crm.error ? "Requiere habilitación o configuración." : crmEnabled ? "Clientes aislados por negocio." : "Se activa desde el admin según el preset."}</p>
        </article>
        <article className="base-module-card">
          <div className="base-module-icon"><BarChart3 size={18} /></div>
          <div><span className="metric-label">REPORTES</span><strong>{reportingEnabled ? `${overview.data?.orders?.total ?? 0} pedidos` : "No activado"}</strong></div>
          <p>{overview.error ? "Requiere habilitación o configuración." : reportingEnabled ? "KPIs básicos del negocio." : "Se activa desde el admin según el preset."}</p>
        </article>
      </div>
    </section>
  );
}
