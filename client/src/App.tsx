import { useEffect, useState } from "react";
import { Fingerprint, LogIn, LogOut } from "lucide-react";
import { trpc } from "./lib/trpc";
import { isPasskeySupported } from "./webauthn";
import { NewClientWizard } from "./components/admin/NewClientWizard";
import { ModuleAdminPanel } from "./components/admin/ModuleAdminPanel";
import { MembershipAdminPanel } from "./components/admin/MembershipAdminPanel";
import { BillingAdminPanel } from "./components/admin/BillingAdminPanel";
import { PasswordLoginForm } from "./components/auth/PasswordLoginForm";
import { SetupPage } from "./components/auth/SetupPage";
import { useAuth } from "./hooks/useAuth";
import { SelectedBusinessProvider, useSelectedBusiness } from "./hooks/useSelectedBusiness";

function BusinessSelector() {
  const { selectedBusinessId, setSelectedBusinessId } = useSelectedBusiness();
  const businesses = trpc.admin.businesses.list.useQuery(undefined, { retry: false }) as {
    data?: { id: number; name: string; slug: string }[];
    isLoading: boolean;
  };

  useEffect(() => {
    if (selectedBusinessId === null && businesses.data && businesses.data.length > 0) {
      setSelectedBusinessId(businesses.data[0].id);
    }
  }, [businesses.data, selectedBusinessId, setSelectedBusinessId]);

  if (!businesses.isLoading && (businesses.data?.length ?? 0) === 0) {
    return (
      <section className="admin-modules-section" id="business-selector">
        <p className="booking-muted">Todavía no hay clientes cargados — usa el wizard de arriba para crear el primero.</p>
      </section>
    );
  }

  return (
    <section className="admin-modules-section" id="business-selector">
      <div className="admin-control-bar">
        <label>
          Cliente / negocio
          <select
            value={selectedBusinessId ?? ""}
            onChange={(event) => setSelectedBusinessId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Selecciona un negocio…</option>
            {(businesses.data ?? []).map((business) => (
              <option key={business.id} value={business.id}>{business.name}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function AdminDashboard() {
  return (
    <SelectedBusinessProvider>
      <NewClientWizard />
      <BusinessSelector />
      <ModuleAdminPanel />
      <MembershipAdminPanel />
      <BillingAdminPanel />
    </SelectedBusinessProvider>
  );
}

export default function App() {
  const isSetupPage = typeof window !== "undefined" && window.location.pathname === "/setup";
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const auth = useAuth();
  const passkeySupported = isPasskeySupported();

  const handlePasskeyLogin = async () => {
    setPasskeyError(null);
    try {
      await auth.loginWithPasskey();
    } catch (error) {
      setPasskeyError(error instanceof Error ? error.message : "No se pudo iniciar sesión con Face ID.");
    }
  };

  const handlePasskeyRegister = async () => {
    setPasskeyError(null);
    try {
      await auth.registerPasskey();
    } catch (error) {
      setPasskeyError(error instanceof Error ? error.message : "No se pudo activar Face ID en este dispositivo.");
    }
  };
  const demoAdminPreview = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.search.includes("admin_modules=1"));
  const canSeeAdmin = auth.user?.platformRole === "platform_admin" || demoAdminPreview;
  const health = trpc.system.health.useQuery(undefined, { retry: false });

  if (isSetupPage) {
    return <SetupPage />;
  }

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
              {passkeySupported && (
                <button
                  type="button"
                  className="auth-button auth-button-secondary"
                  onClick={() => void handlePasskeyRegister()}
                  disabled={auth.loading}
                >
                  <Fingerprint size={14} /> Activar Face ID en este dispositivo
                </button>
              )}
              <button type="button" className="auth-button" onClick={() => void auth.logout()} disabled={auth.loading}>
                <LogOut size={14} /> Salir
              </button>
            </>
          ) : (
            <>
              <PasswordLoginForm />
              <button
                type="button"
                className="auth-button auth-button-secondary"
                onClick={auth.login}
                disabled={auth.loading}
              >
                <LogIn size={14} /> Ingresar con Manus
              </button>
              {passkeySupported && (
                <button
                  type="button"
                  className="auth-button auth-button-secondary"
                  onClick={() => void handlePasskeyLogin()}
                  disabled={auth.loading}
                >
                  <Fingerprint size={14} /> Face ID / Touch ID
                </button>
              )}
            </>
          )}
          {passkeyError && <span className="auth-error">{passkeyError}</span>}
        </div>
      </header>

      {canSeeAdmin ? (
        <AdminDashboard />
      ) : auth.user ? (
        <section className="admin-modules-section" id="access-restricted">
          <div className="section-heading">
            <div>
              <h2>Acceso restringido</h2>
            </div>
            <p>Tu cuenta no tiene permisos de administración de esta plataforma.</p>
          </div>
        </section>
      ) : (
        <section className="admin-modules-section" id="login-gate">
          <div className="section-heading">
            <div>
              <h2>Iniciá sesión para continuar</h2>
            </div>
            <p>Usá las opciones de acceso de arriba (contraseña, Face ID/Touch ID o Manus).</p>
          </div>
        </section>
      )}

      <footer className="footer">
        <span>ANC Platform / owned digital infrastructure</span>
        <span>{health.error ? "API pendiente de iniciar" : "Ready for the next module"}</span>
      </footer>
    </main>
  );
}
