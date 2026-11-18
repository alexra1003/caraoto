import "./globals.css";
export const metadata = { title: "Caraoto 🫘", description: "A veces no hacen falta palabras." };
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" as const };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body><main className="mx-auto max-w-md p-4">{children}</main></body></html>;
}
