import { redirect } from "next/navigation";
import Home from "@/components/Home";
import { getSpace } from "@/lib/space";

const pageSize = 10;

function cursor(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value)) return;
  if (value.length === 19 && value > "9223372036854775807") return;
  return value;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ mi?: string; compartido?: string }>;
}) {
  const { sb, user, coupleId } = await getSpace();
  if (!coupleId) redirect("/pairing");

  const params = await searchParams;
  const ownCursor = cursor(params.mi);
  const sharedCursor = cursor(params.compartido);
  const members = await sb.from("couple_members").select("user_id").eq("couple_id", coupleId);
  if (members.error || !members.data.some((member) => member.user_id === user.id)) {
    throw new Error("No se pudo cargar el espacio de pareja.");
  }
  const memberIds = members.data.map((member) => member.user_id);
  const historyQuery = () => sb.from("status_history")
    .select("entry:id::text, user_id, color, note, created_at")
    .order("id", { ascending: false })
    .limit(pageSize + 1);
  const own = historyQuery().eq("user_id", user.id);
  const shared = historyQuery().in("user_id", memberIds);

  const [statuses, ownHistory, sharedHistory, profiles] = await Promise.all([
    sb.from("current_status").select("user_id, color, note, updated_at").eq("couple_id", coupleId),
    ownCursor ? own.lt("id", ownCursor) : own,
    sharedCursor ? shared.lt("id", sharedCursor) : shared,
    sb.from("profiles").select("id, display_name").in("id", memberIds),
  ]);

  if (statuses.error || ownHistory.error || sharedHistory.error || profiles.error) {
    throw new Error("No se pudo cargar el espacio de pareja.");
  }

  const names = new Map(profiles.data.map((profile) => [profile.id, profile.display_name]));

  function historyLink(key: "mi" | "compartido", next?: string) {
    const query = new URLSearchParams();
    if (key !== "mi" && ownCursor) query.set("mi", ownCursor);
    if (key !== "compartido" && sharedCursor) query.set("compartido", sharedCursor);
    if (next) query.set(key, next);
    return query.size ? `/dashboard?${query}` : "/dashboard";
  }

  return (
    <Home key={coupleId} me={user.id} coupleId={coupleId}
      people={members.data.map(({ user_id }) => ({ id: user_id, name: names.get(user_id) ?? "Mi pareja" }))}
      statuses={statuses.data}
      ownHistory={ownHistory.data.slice(0, pageSize)}
      sharedHistory={sharedHistory.data.slice(0, pageSize)}
      ownOlder={ownHistory.data.length > pageSize ? historyLink("mi", ownHistory.data[pageSize - 1].entry) : undefined}
      sharedOlder={sharedHistory.data.length > pageSize ? historyLink("compartido", sharedHistory.data[pageSize - 1].entry) : undefined}
      ownLatest={ownCursor ? historyLink("mi") : undefined}
      sharedLatest={sharedCursor ? historyLink("compartido") : undefined}
    />
  );
}
