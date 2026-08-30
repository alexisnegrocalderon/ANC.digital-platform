import { useState } from "react";
import { KeyRound } from "lucide-react";
import { resetAdminPassword } from "../../passwordAuth";

export function ResetPage() {
  const [secret, setSecret] = useState("");
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
      await resetAdminPassword({ secret, newPassword: password });
      window.location.href = "/";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo restablecer la contraseña.");
      setSubmitting(false);
    }
  };

  return (
    <main className="setup-page">
      <form className="setup-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="setup-heading">
          <KeyRound size={22} />
          <h1>Restablecer contraseña</h1>
        </div>
        <p className="setup-lede">
          Usá el código secreto de configuración para elegir una contraseña nueva para tu cuenta de administrador.
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
          Contraseña nueva
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
          Confirmar contraseña nueva
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
          {submitting ? "Restableciendo…" : "Restablecer contraseña"}
        </button>
      </form>
    </main>
  );
}
