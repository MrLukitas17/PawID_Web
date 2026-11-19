import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createAdminHandler } from './handler.js';

// Estos valores solo se leen en el servidor. No se envían al navegador.
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowedOrigins = (Deno.env.get('PAWID_ADMIN_ORIGINS') ??
  'http://localhost:5500,http://127.0.0.1:5500').split(',').map(origin => origin.trim());
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.');
}

// El JWT recibido se pasa únicamente a getUser(). Nunca se instala como sesión
// ni como cabecera global de este cliente privilegiado, compartido entre peticiones.
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
});

Deno.serve(createAdminHandler({admin, allowedOrigins}));
