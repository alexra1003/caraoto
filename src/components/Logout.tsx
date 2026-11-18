"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Logout() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function signOut() {
    setPending(true);
    setError(false);
    const { error } = await createClient().auth.signOut({ scope: "local" });
    if (!error) {
      window.location.replace("/login");
      return;
    }
    setError(true);
    setPending(false);
  }

  return (
    <div className="text-sm">
      <button type="button" className="underline disabled:opacity-50" disabled={pending} onClick={signOut}>
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
      {error && <p role="alert">No se pudo cerrar la sesión.</p>}
    </div>
  );
}
