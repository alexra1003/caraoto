"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RecoverPairing({ coupleId }: { coupleId: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !code.trim()) return;
    setError("");
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setPending(true);
    const { error } = await createClient().rpc("recover_pairing", {
      p_code: code.trim(),
      p_source: coupleId,
    });
    if (!error) {
      window.location.replace("/dashboard");
      return;
    }

    setError(error.code === "P0001" ? error.message : "No se pudo unir tu espacio. Inténtalo de nuevo.");
    setConfirming(false);
    setPending(false);
  }

  if (!open) {
    return <button className="text-sm font-medium underline" type="button" onClick={() => setOpen(true)}>
      Ya tengo un código de mi pareja
    </button>;
  }

  return (
    <form className="space-y-3 border-t border-slate-300 pt-4 dark:border-slate-600" onSubmit={submit}>
      <label className="block text-sm" htmlFor="recovery-code">Código de invitación de mi pareja</label>
      <input id="recovery-code" className="input uppercase" autoComplete="off" maxLength={12}
        value={code} onChange={(event) => setCode(event.target.value)} readOnly={confirming} required />
      {confirming && <p role="status" className="text-sm">
        Al unirte, tu pareja podrá ver tu estado actual, tus notas y tu historial disponible en este espacio, incluido el que trajiste de otro espacio.
        Conservarás tu historial y los códigos de tu espacio anterior dejarán de funcionar.
      </p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" key={confirming ? "confirm" : "review"} disabled={pending || !code.trim()}>
          {pending ? "Uniéndote…" : confirming ? "Confirmar y unirme" : "Continuar"}
        </button>
        <button className="px-2 text-sm underline" type="button" disabled={pending} onClick={() => {
          setError("");
          if (confirming) setConfirming(false);
          else {
            setOpen(false);
            setCode("");
          }
        }}>
          {confirming ? "Volver" : "Cancelar"}
        </button>
      </div>
    </form>
  );
}
