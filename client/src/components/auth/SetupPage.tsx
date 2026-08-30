import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { setupAdminAccount } from "../../passwordAuth";

export function SetupPage() {
  const [secret, setSecret] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await setupAdminAccount({ secret, email, password, name });
      window.location.href = "/";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo completar el setup.");
      setSubmitting(false);
    }
  };

  return (
    <main className="setup-page">
      <form className="setup-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="setup-heading">
          <ShieldCheck size={22} />
          <h1>Configuración inicial</h1>
        </div>
        <p className="setup-lede">
          Creá la cuenta de administrador. Esto solo puede hacerse una vez.
        </p>

        <label>
          Código secreto
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            required
          />
        </label>

        <label>
          Nombre
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

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
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label>
          Confirmar contraseña
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>

        {error && <p className="setup-error">{error}</p>}

        <button type="submit" className="auth-button" disabled={submitting}>
          {submitting ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}
