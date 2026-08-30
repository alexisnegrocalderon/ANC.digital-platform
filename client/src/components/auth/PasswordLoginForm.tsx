import { useState } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export function PasswordLoginForm() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.loginWithPassword(email, password);
      setPassword("");
    } catch {
      setError("Credenciales inválidas.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="password-login-form" onSubmit={(event) => void handleSubmit(event)}>
      <input
        type="email"
        name="email"
        placeholder="Email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input
        type="password"
        name="password"
        placeholder="Contraseña"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <button type="submit" className="auth-button" disabled={submitting}>
        <LogIn size={14} /> Ingresar
      </button>
      {error && <span className="auth-error">{error}</span>}
    </form>
  );
}
