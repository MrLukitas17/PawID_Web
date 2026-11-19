import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createHandler } from './handler.js';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: {persistSession: false, autoRefreshToken: false}
});
const appUrl = Deno.env.get('PAWID_APP_URL') || 'http://localhost:5500/templates/index.html';

Deno.serve(createHandler({admin, appUrl, bucket: Deno.env.get('PAWID_PHOTO_BUCKET') || 'mascotas-fotos'}));
