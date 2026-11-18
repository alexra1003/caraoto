"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Logout from "@/components/Logout";
import RecoverPairing from "@/components/RecoverPairing";
import { COLORS, byKey, type ColorKey } from "@/lib/colors";
import { createClient } from "@/lib/supabase/client";

let subscriptionId = 0;
type Person = { id: string; name: string };
type Emotion = { user_id: string; color: string; note: string | null };
type Status = Emotion & { updated_at: string };
type HistoryEntry = Emotion & { entry: string; created_at: string };

function EmotionDetails({ emotion, time, localTime }: { emotion: Emotion; time: string; localTime: boolean }) {
  const color = byKey(emotion.color);
  const formatted = new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: localTime ? undefined : "UTC",
  }).format(new Date(time));

  return (
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="mt-1 h-8 w-8 shrink-0 rounded-full border border-slate-500 shadow-inner"
        style={{ backgroundColor: color?.hex }} />
      <div className="min-w-0 space-y-1">
        <p><strong>{color?.name ?? "Color sin descripción"}</strong>{color && ` — ${color.desc}`}</p>
        {emotion.note && <p className="whitespace-pre-wrap break-words text-sm italic">“{emotion.note}”</p>}
        <time dateTime={time} className="block text-xs text-slate-600 dark:text-slate-300">
          {formatted}{!localTime && " UTC"}
        </time>
      </div>
    </div>
  );
}

function History({ title, entries, author, older, latest, localTime }: {
  title: string;
  entries: HistoryEntry[];
  author?: (id: string) => string;
  older?: string;
  latest?: string;
  localTime: boolean;
}) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {entries.length ? (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {entries.map((entry) => (
            <li key={entry.entry} className="space-y-1 py-3">
              {author && <p className="text-sm font-semibold">{author(entry.user_id)}</p>}
              <EmotionDetails emotion={entry} time={entry.created_at} localTime={localTime} />
            </li>
          ))}
        </ul>
      ) : <p className="text-sm">No hay estados en esta página.</p>}
      {(latest || older) && <div className="flex flex-wrap gap-4 text-sm underline">
        {latest && <Link href={latest} scroll={false}>Ver los más recientes</Link>}
        {older && <Link href={older} scroll={false}>Ver anteriores</Link>}
      </div>}
    </section>
  );
}

function Invitation() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function showCode() {
    setPending(true);
    setError("");
    const { data, error } = await createClient().rpc("get_invitation");
    setPending(false);
    if (error || typeof data !== "string") {
      setCode("");
      setError(error?.code === "P0001" ? error.message : "No se pudo obtener el código.");
      if (error?.code === "P0001") router.refresh();
      return;
    }
    setCode(data);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">Comparte un código de un solo uso con tu pareja. Caduca 48 horas después de crearse.</p>
      {code && <p role="status" className="select-all break-all text-center font-mono text-2xl tracking-wide">{code}</p>}
      <button className="btn w-full" type="button" onClick={showCode} disabled={pending}>
        {pending ? "Buscando código…" : code ? "Comprobar código" : "Mostrar código de invitación"}
      </button>
      {error && <p role="alert" className="text-sm">{error}</p>}
    </div>
  );
}

export default function Home({
  me, coupleId, people, statuses, ownHistory, sharedHistory, ownOlder, sharedOlder, ownLatest, sharedLatest,
}: {
  me: string;
  coupleId: string;
  people: Person[];
  statuses: Status[];
  ownHistory: HistoryEntry[];
  sharedHistory: HistoryEntry[];
  ownOlder?: string;
  sharedOlder?: string;
  ownLatest?: string;
  sharedLatest?: string;
}) {
  const router = useRouter();
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const [localTime, setLocalTime] = useState(false);
  const [editing, setEditing] = useState(false);
  const [color, setColor] = useState<ColorKey>();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const ownStatus = statuses.find((status) => status.user_id === me);
  const partner = people.find((person) => person.id !== me);
  const partnerStatus = statuses.find((status) => status.user_id === partner?.id);

  useEffect(() => setLocalTime(true), []);

  useEffect(() => {
    const sb = createClient();
    let stopped = false;
    let connected = false;
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      if (stopped || refreshTimer !== undefined) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        if (!stopped) router.refresh();
      }, 200);
    };
    let channel: ReturnType<typeof sb.channel> | undefined;
    let subscribing = false;
    async function subscribe() {
      if (subscribing || channel) return;
      subscribing = true;
      try {
        await sb.realtime.setAuth();
        if (stopped) return;

        const filter = `couple_id=eq.${coupleId}`;
        channel = sb.channel(`couple-${coupleId}-${++subscriptionId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "current_status", filter }, scheduleRefresh)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "current_status", filter }, scheduleRefresh)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "couple_members", filter }, scheduleRefresh)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "couple_members", filter }, scheduleRefresh)
          .subscribe((status) => {
            if (stopped) return;
            connected = status === "SUBSCRIBED";
            setConnection(connected ? "live" : "offline");
            if (connected) scheduleRefresh();
          });
      } catch {
        if (!stopped) setConnection("offline");
      } finally {
        subscribing = false;
      }
    }

    void subscribe();
    const fallback = window.setInterval(() => {
      if (!connected && document.visibilityState === "visible") {
        void subscribe();
        scheduleRefresh();
      }
    }, 15000);
    function onVisible() {
      if (document.visibilityState === "visible") scheduleRefresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", scheduleRefresh);

    return () => {
      stopped = true;
      window.clearTimeout(refreshTimer);
      window.clearInterval(fallback);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", scheduleRefresh);
      if (channel) void sb.removeChannel(channel);
    };
  }, [coupleId, router]);

  function startEditing() {
    setColor(ownStatus ? byKey(ownStatus.color)?.key : undefined);
    setNote(ownStatus?.note ?? "");
    setMessage("");
    setError("");
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!color || saving) return;
    setSaving(true);
    setError("");
    const { error } = await createClient().rpc("set_status", { p_color: color, p_note: note });
    setSaving(false);
    if (error) {
      setError("No se pudo guardar tu estado. Inténtalo de nuevo.");
      return;
    }
    setEditing(false);
    setMessage("Tu estado se guardó 💙");
    router.refresh();
  }

  return (
    <div className="space-y-4 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Nuestra conexión 🫘</h1>
        <Logout />
      </header>
      {connection !== "live" && <p role="status" className="text-center text-xs">
        {connection === "connecting" ? "Conectando con tu pareja…" : "Reconectando. Buscaremos cambios automáticamente."}
      </p>}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Mi estado actual</h2>
        {ownStatus ? <EmotionDetails emotion={ownStatus} time={ownStatus.updated_at} localTime={localTime} /> : <p>Aún no has elegido un color.</p>}
        {!editing && <button className="btn w-full" type="button" onClick={startEditing}>Actualizar mi estado</button>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {editing && (
          <form className="space-y-3" onSubmit={save}>
            <fieldset disabled={saving}>
              <legend className="mb-2 font-medium">¿Cómo te sientes?</legend>
              <div className="grid gap-2 min-[420px]:grid-cols-2">
                {COLORS.map((item) => (
                  <label key={item.key} className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-300 p-2 text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 dark:border-slate-600 dark:has-[:checked]:bg-slate-700">
                    <input className="mt-1" type="radio" name="color" value={item.key}
                      checked={color === item.key} onChange={() => setColor(item.key)} required />
                    <span aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-slate-500" style={{ backgroundColor: item.hex }} />
                    <span><strong>{item.name}</strong><span className="block text-xs">{item.desc}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm">Nota (opcional)
              <textarea className="input mt-1" rows={2} maxLength={200} value={note} disabled={saving}
                onChange={(event) => setNote(event.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex gap-2">
              <button className="btn flex-1" disabled={!color || saving}>{saving ? "Guardando…" : "Guardar"}</button>
              <button type="button" className="rounded-2xl px-4" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </section>
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Estado actual de mi pareja</h2>
        {partner ? <>
          <p className="font-medium break-words">{partner.name}</p>
          {partnerStatus
            ? <EmotionDetails emotion={partnerStatus} time={partnerStatus.updated_at} localTime={localTime} />
            : <p>Aún no ha elegido un color.</p>}
        </> : <>
          <Invitation />
          <RecoverPairing coupleId={coupleId} />
        </>}
      </section>
      <History title="Mi historial emocional" entries={ownHistory} older={ownOlder} latest={ownLatest} localTime={localTime} />
      <History title="Nuestro historial compartido" entries={sharedHistory} older={sharedOlder} latest={sharedLatest} localTime={localTime}
        author={(id) => id === me ? "Yo" : partner?.name ?? "Mi pareja"} />
    </div>
  );
}
