# Caraoto 🫘

Un espacio privado para que dos personas compartan cómo se sienten.

## Ejecutar el proyecto

1. Instala Node.js 22 o posterior y ejecuta `npm ci`.
2. En un proyecto de Supabase existente **que ya tenga el esquema original**, abre **SQL Editor**, crea una consulta y ejecuta el contenido de `supabase/migrations/002_pairing_and_privacy.sql` una sola vez. En un proyecto nuevo, ejecuta primero `001_core.sql` y después `002_pairing_and_privacy.sql`.
3. Conserva tu archivo `.env.local` si ya está configurado. Para una instalación nueva, copia `.env.example` a `.env.local`. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con la URL del proyecto y su clave publicable (`sb_publishable_…` o la clave pública `anon`).
4. Si está activada la confirmación por correo, agrega `http://localhost:3000/auth/callback` en **Authentication → URL Configuration → Redirect URLs**. Para producción, configura la URL del sitio y agrega también la ruta `/auth/callback` de su dominio HTTPS. Abre el enlace de confirmación en el navegador que usaste para registrarte.
5. Ejecuta `npm run dev` y abre http://localhost:3000. Para producción, ejecuta `npm run build` y luego `npm start`.

Tu espacio se abre en `/dashboard`. Si todavía no perteneces a uno, puedes crearlo o unirte con un código en `/pairing`. Si el espacio tiene un solo miembro, el código vigente se muestra en el panel con **Mostrar código de invitación**.
