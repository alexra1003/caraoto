import LoginForm from "./LoginForm";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ confirmacion?: string }>;
}) {
  const { confirmacion } = await searchParams;
  return <LoginForm confirmationError={confirmacion === "error"} />;
}
