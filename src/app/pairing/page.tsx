import { redirect } from "next/navigation";
import { getSpace } from "@/lib/space";
import PairingForm from "./PairingForm";

export default async function Pairing() {
  const { coupleId } = await getSpace();
  if (coupleId) redirect("/dashboard");
  return <PairingForm />;
}
