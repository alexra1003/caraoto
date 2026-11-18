import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

export default function config(phase) {
  return {
    // Keep development artifacts separate while production uses the hosting default.
    ...(phase === PHASE_DEVELOPMENT_SERVER && { distDir: ".next-dev" }),
  };
}
