import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../contexts/AuthContext";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("E-mail ou mot de passe incorrect.");
      } else if (code === "auth/too-many-requests") {
        setError("Trop de tentatives. Réessaie plus tard.");
      } else {
        setError("Connexion impossible. Vérifie la console ou la configuration Firebase.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.card}>
        <BrandLogo size="lg" className={styles.logo} />
        <p className={styles.subtitle}>Connecte-toi pour voir les données de l’iPad</p>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            E-mail
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className={styles.label}>
            Mot de passe
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.button} type="submit" disabled={submitting || loading}>
            {submitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
