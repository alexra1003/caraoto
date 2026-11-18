import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getSpace = cache(async () => {
  const sb = await createClient();
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError" &&
      (!authError.status || authError.status >= 500 || authError.status === 429)) {
    throw new Error("No se pudo verificar la sesión.");
  }
  if (!user) redirect("/login");

  const { data: coupleId, error } = await sb.rpc("my_couple_id");
  if (error || (coupleId !== null && typeof coupleId !== "string")) {
    throw new Error("No se pudo consultar el espacio de pareja.");
  }
  return { sb, user, coupleId };
});

