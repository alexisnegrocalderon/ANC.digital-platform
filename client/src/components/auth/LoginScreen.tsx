import { useState } from "react";
import { Fingerprint, KeyRound, LogIn } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { isPasskeySupported } from "../../webauthn";

export function LoginScreen() {
  const auth = useAuth();
  const passkeySupported = isPasskeySupported();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setSubmitting(true);
    try {
      await auth.loginWithPassword(email, password);
    } catch {
      setPasswordError("Credenciales inválidas.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyError(null);
    try {
      await auth.loginWithPasskey();
    } catch (error) {
      setPasskeyError(error instanceof Error ? error.message : "No se pudo iniciar sesión con Face ID.");
    }
  };

  return (
    <section className="dashboard-gate" id="login-gate">
      <div className="dashboard-gate-card login-card">
        <span className="login-card-icon">
          <KeyRound size={20} />
        </span>
        <h2>Iniciá sesión</h2>
        <p>Entrá a la administración de ANC Platform.</p>

        <form className="login-form" onSubmit={(event) => void handlePasswordSubmit(event)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {passwordError && <p className="setup-error">{passwordError}</p>}
          <button type="submit" className="admin-primary-button login-submit" disabled={submitting}>
            <LogIn size={16} /> {submitting ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <div className="login-divider">
          <span>o continuá con</span>
        </div>

        <div className="login-alt-actions">
          <button type="button" className="auth-button login-alt-button" onClick={auth.login} disabled={auth.loading}>
            Manus
          </button>
          {passkeySupported && (
            <button
              type="button"
              className="auth-button login-alt-button"
              onClick={() => void handlePasskeyLogin()}
              disabled={auth.loading}
            >
              <Fingerprint size={15} /> Face ID / Touch ID
            </button>
          )}
        </div>
        {passkeyError && <p className="setup-error">{passkeyError}</p>}
      </div>
    </section>
  );
}
