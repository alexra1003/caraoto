export const COLORS = [
  { key: "azul", name: "Azul", hex: "#3b82f6", desc: "Todo está bien." },
  { key: "verde", name: "Verde", hex: "#22c55e", desc: "Algo me pasa, pero no sé qué es." },
  { key: "naranja", name: "Naranja", hex: "#f97316", desc: "Algo me pasa y sí sé qué es." },
  { key: "rojo", name: "Rojo", hex: "#ef4444", desc: "Estoy enojado contigo." },
  { key: "amarillo", name: "Amarillo", hex: "#facc15", desc: "Estoy enojado, pero no contigo." },
  { key: "blanco", name: "Blanco", hex: "#f8fafc", desc: "Llámame, te necesito, hablemos." },
  { key: "negro", name: "Negro", hex: "#1f2937", desc: "Llámame, pero no tengo ganas de hablar. Solo hazme compañía." },
  { key: "marron", name: "Marrón", hex: "#92400e", desc: "Estoy de mal humor, no por tu culpa." },
  { key: "morado", name: "Morado", hex: "#a855f7", desc: "Estoy de mal humor, por tu culpa." },
  { key: "rosado", name: "Rosado", hex: "#f9a8d4", desc: "Necesito cariño, atención o un abrazo." },
  { key: "gris", name: "Gris", hex: "#9ca3af", desc: "Estoy emocionalmente agotado. Necesito descansar." },
  { key: "celeste", name: "Celeste", hex: "#7dd3fc", desc: "Me gustaría hablar de algo contigo, pero me cuesta empezar." },
] as const;
export type ColorKey = (typeof COLORS)[number]["key"];
export const byKey = (k: string) => COLORS.find((c) => c.key === k);
