"use client";

import { useState, type FormEvent } from "react";
import Logout from "@/components/Logout";
import { createClient } from "@/lib/supabase/client";

export default function PairingForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function pair(action: "create" | "join") {
    setError("");
    setPending(true);
    const sb = createClient();
    const result = action === "create"
      ? await sb.rpc("create_couple")
      : await sb.rpc("join_couple", { p_code: code.trim() });
    if (!result.error || result.error.code === "PT409") {
      window.location.replace("/dashboard");
      return;
    }
    setError(result.error.code === "P0001" ? result.error.message : "No se pudo completar la vinculación. Inténtalo de nuevo.");
    setPending(false);
  }

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void pair("join");
  }

  return (
    <div className="space-y-5 pt-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Su espacio privado 💙</h1>
        <Logout />
      </header>
      <form className="card space-y-3" onSubmit={join}>
        <h2 className="font-semibold">Unirme a un espacio</h2>
        <label className="block text-sm" htmlFor="invitation-code">Código de invitación</label>
        <input id="invitation-code" className="input uppercase" autoComplete="off" maxLength={12}
          value={code} onChange={(event) => setCode(event.target.value)} disabled={pending} required />
        <button className="btn w-full" disabled={pending || !code.trim()}>Unirme</button>
      </form>
      <section className="card space-y-3">
        <h2 className="font-semibold">Crear un espacio</h2>
        <p className="text-sm">Podrás compartir el código de invitación desde tu espacio.</p>
        <button className="btn w-full" type="button" onClick={() => void pair("create")} disabled={pending}>
          Crear espacio
        </button>
      </section>
      {pending && <p role="status">Vinculando tu espacio…</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
