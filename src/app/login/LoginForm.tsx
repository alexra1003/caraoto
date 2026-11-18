"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ confirmationError }: { confirmationError: boolean }) {
  const [signingUp, setSigningUp] = useState(false);
  const [error, setError] = useState(confirmationError ? "No se pudo confirmar la cuenta. Abre el enlace en el navegador donde te registraste." : "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    };
    const sb = createClient();
    const { data, error } = signingUp
      ? await sb.auth.signUp({
        ...credentials,
        options: {
          data: { display_name: String(form.get("name")).trim() },
          emailRedirectTo: new URL("/auth/callback", window.location.origin).href,
        },
      })
      : await sb.auth.signInWithPassword(credentials);

    if (error) {
      if (error.code === "email_not_confirmed") setError("Confirma tu correo antes de iniciar sesión.");
      else if (error.code === "invalid_credentials") setError("El correo o la contraseña son incorrectos.");
      else if (error.code === "weak_password") setError("Elige una contraseña más segura.");
      else setError(signingUp ? "No se pudo crear la cuenta. Revisa tus datos e inténtalo de nuevo." : "No se pudo iniciar sesión. Inténtalo de nuevo.");
    } else if (data.session) {
      window.location.replace("/dashboard");
      return;
    } else {
      setNotice("Revisa tu correo y abre el enlace de confirmación en este navegador.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6 pt-12 text-center">
      <div aria-hidden="true" className="text-6xl">🫘💙</div>
      <h1 className="text-3xl font-bold">Bienvenidos a Caraoto</h1>
      <p>A veces no hacen falta palabras. A veces, un color es suficiente.</p>
      <form onSubmit={submit} className="card space-y-3 text-left">
        {signingUp && <label className="block text-sm">Tu nombre
          <input className="input mt-1" name="name" autoComplete="name" maxLength={80} required />
        </label>}
        <label className="block text-sm">Correo
          <input className="input mt-1" name="email" type="email" autoComplete="email" required />
        </label>
        <label className="block text-sm">{signingUp ? "Contraseña (mínimo 8 caracteres)" : "Contraseña"}
          <input className="input mt-1" name="password" type="password" minLength={signingUp ? 8 : undefined}
            autoComplete={signingUp ? "new-password" : "current-password"} required />
        </label>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Un momento…" : signingUp ? "Crear cuenta" : "Entrar"}</button>
        <button type="button" className="w-full text-sm underline" disabled={busy} onClick={() => {
          setSigningUp(!signingUp);
          setError("");
          setNotice("");
        }}>
          {signingUp ? "Ya tengo cuenta" : "¿Primera vez? Crear cuenta"}
        </button>
      </form>
    </div>
  );
}
