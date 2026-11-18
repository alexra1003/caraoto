import type { Config } from "tailwindcss";
export default { content: ["./src/**/*.{ts,tsx}"], darkMode: "media",
  theme: { extend: { colors: { navy: "#1e3a8a" } } }, plugins: [] } satisfies Config;
