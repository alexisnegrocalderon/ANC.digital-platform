import { useState } from "react";
import { ArrowUpRight, Boxes, Database, Layers3, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { trpc } from "./lib/trpc";
import { EventDemoPanel } from "./components/events/EventDemoPanel";
import { BookingDemoPanel } from "./components/bookings/BookingDemoPanel";
import { ModuleAdminPanel } from "./components/admin/ModuleAdminPanel";
import { MembershipAdminPanel } from "./components/admin/MembershipAdminPanel";
import { BaseModulesPanel } from "./components/base/BaseModulesPanel";
import { useAuth } from "./hooks/useAuth";

const presetLabels = ["Eventos", "Restaurante", "Retail", "Salón", "Gimnasio", "Servicios"];

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState("Eventos");
  const auth = useAuth();
  const demoAdminPreview = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.search.includes("admin_modules=1"));
  const canSeeAdmin = auth.user?.platformRole === "platform_admin" || demoAdminPreview;
  const health = trpc.system.health.useQuery(undefined, { retry: false });
  const modules = trpc.modules.list.useQuery(undefined, { retry: false });
  const business = trpc.business.current.useQuery(undefined, { retry: false });
  const enabledModules = trpc.business.enabledModules.useQuery(undefined, { retry: false });

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ANC Platform inicio">
          <span className="brand-mark">ANC</span>
          <span className="brand-name">Platform</span>
        </a>
        <span className="topbar-label">CORE / MODULAR BUSINESS SYSTEM</span>
        <span className="topbar-status">
          {health.data?.ok ? "CORE ONLINE" : "CORE EN ESPERA"}
        </span>
        <div className="auth-actions">
          {auth.user ? (
            <>
              <span className="auth-user">{auth.user.name ?? auth.user.email ?? "Usuario"}</span>
              <button type="button" className="auth-button" onClick={() => void auth.logout()} disabled={auth.loading}>
                <LogOut size={14} /> Salir
              </button>
            </>
          ) : (
            <button type="button" className="auth-button" onClick={auth.login} disabled={auth.loading}>
              <LogIn size={14} /> Ingresar
            </button>
          )}
        </div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">ANC PLATFORM / FOUNDATION 0.1</p>
          <h1>
            Una base propia.
            <br />
            <span>Muchas formas de crecer.</span>
          </h1>
          <p className="hero-lede">
            Un núcleo central para conectar sitio público, operación, clientes y módulos de negocio sin volver a construir desde cero.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#modules">
              Explorar módulos <ArrowUpRight size={17} />
            </a>
            <a className="secondary-link" href="#architecture">
              Ver la base
            </a>
          </div>
        </div>
        <div className="hero-panel" aria-label="Resumen técnico del core">
          <div className="panel-topline">
            <span>PLATFORM STATUS</span>
            <span>2026 / 01</span>
          </div>
          <div className="panel-nucleus">
            <div className="nucleus-ring" />
            <strong>CORE</strong>
            <span>BUSINESS READY</span>
          </div>
          <div className="panel-grid">
            <div>
              <Database size={17} />
              <span>Neon PostgreSQL</span>
            </div>
            <div>
              <ShieldCheck size={17} />
              <span>Tenant-safe</span>
            </div>
            <div>
              <Layers3 size={17} />
              <span>Typed modules</span>
            </div>
          </div>
        </div>
      </section>

      <section id="architecture" className="status-strip">
        <div>
          <span className="metric-label">DATABASE</span>
          <strong>{business.data?.name ?? (health.data?.database.configured ? "Neon conectado" : "Neon por configurar")}</strong>
        </div>
        <div>
          <span className="metric-label">RUNTIME</span>
          <strong>{health.data?.database.driver ?? "neon-http"}</strong>
        </div>
        <div>
          <span className="metric-label">ACTIVATION</span>
          <strong>Preset + módulos</strong>
        </div>
        <div>
          <span className="metric-label">MAINTENANCE</span>
          <strong>Una base compartida</strong>
        </div>
      </section>

      <section id="modules" className="modules-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / MODULE CATALOG</p>
            <h2>Todo lo que el negocio necesita ordenar.</h2>
          </div>
          <p>
            Los módulos se activan según el negocio. La aplicación central, los permisos y los datos permanecen compartidos.
          </p>
        </div>
        <div className="business-banner">
          <div>
            <span className="metric-label">BUSINESS CONTEXT</span>
            <strong>{business.data?.slug ?? "anc-demo"}</strong>
          </div>
          <div>
            <span className="metric-label">ACTIVE MODULES</span>
            <strong>{enabledModules.data?.length ?? 0} / 20</strong>
          </div>
          <div>
            <span className="metric-label">PRESET</span>
            <strong>Events / configured</strong>
          </div>
        </div>
        <div className="module-layout">
          <aside className="preset-panel">
            <span className="metric-label">PRESETS</span>
            <h3>Empieza por tu rubro.</h3>
            <div className="preset-list">
              {presetLabels.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={selectedPreset === preset ? "preset-button is-active" : "preset-button"}
                  onClick={() => setSelectedPreset(preset)}
                >
                  <span>{preset}</span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
            <p className="preset-note">
              Seleccionado: <strong>{selectedPreset}</strong>. La configuración reemplaza el fork por cliente.
            </p>
          </aside>
          <div className="module-grid">
            {modules.data?.map((module) => (
              <article className="module-card" key={module.key}>
                <div className="module-card-topline">
                  <span>{module.key}</span>
                  <Boxes size={16} />
                </div>
                <h3>{module.displayName}</h3>
                <p>{module.description}</p>
                <div className="module-meta">
                  <span>v{module.version}</span>
                  <span>{module.dependencies.length ? `${module.dependencies.length} depend.` : "core ready"}</span>
                </div>
              </article>
            )) ?? (
              <div className="module-empty">
                Cargando registro de módulos…
              </div>
            )}
          </div>
        </div>
      </section>

      <BaseModulesPanel enabledKeys={enabledModules.data?.map((module) => module.moduleKey) ?? []} />
      <EventDemoPanel />
      <BookingDemoPanel />
      {canSeeAdmin ? (
        <>
          <ModuleAdminPanel />
          <MembershipAdminPanel />
        </>
      ) : null}

      <footer className="footer">
        <span>ANC Platform / owned digital infrastructure</span>
        <span>{health.error ? "API pendiente de iniciar" : "Ready for the next module"}</span>
      </footer>
    </main>
  );
}
