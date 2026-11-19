import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const appUrl = Deno.env.get("PAWID_APP_URL") || "http://localhost:5500/templates/index.html";
const headers = {
  "Access-Control-Allow-Origin": new URL(appUrl).origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Content-Type": "application/json"
};
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest(
  "SHA-256", new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, "0")).join("");
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "GET") {
    const configured=!!Deno.env.get('RESEND_API_KEY') && !!Deno.env.get('PAWID_EMAIL_FROM');
    const result=await admin.from('password_reset_tokens').select('token_hash').limit(0);
    return reply({ok:true,ready:configured && !result.error});
  }
  if (req.method !== "POST") return reply({ ok: false }, 405);
  try {
    if(!Deno.env.get('RESEND_API_KEY') || !Deno.env.get('PAWID_EMAIL_FROM'))return reply({ok:false},503);
    const body = await req.json();
    if (body.action === "reset") {
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token) ||
          typeof body.password !== "string" || body.password.length < 6 || body.password.length > 128)
        return reply({ ok: false }, 400);
      const { data, error } = await admin.rpc("consume_password_reset", {
        p_token_hash: await hash(body.token), p_password_hash: await hash(body.password)
      });
      if (error) throw error;
      return reply({ ok: data === true }, data ? 200 : 400);
    }
    if (body.action !== "request" || typeof body.email !== "string" ||
        body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return reply({ ok: false }, 400);
    const email = body.email.trim().toLowerCase();
    const { data: users, error: userError } = await admin.from("usuarios").select("id").eq("email", email).limit(1);
    if (userError) throw userError;
    if (!users?.length) return reply({ ok: true });
    const { data: recent, error: recentError } = await admin.from("password_reset_tokens")
      .select("token_hash").eq("email", email).gte("created_at", new Date(Date.now() - 60000).toISOString()).limit(1);
    if (recentError) throw recentError;
    if (recent?.length) return reply({ ok: true });
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x => x.toString(16).padStart(2, "0")).join("");
    const tokenHash = await hash(token);
    const { error: insertError } = await admin.from("password_reset_tokens").insert({ email, token_hash: tokenHash });
    if (insertError) throw insertError;
    const url = new URL(appUrl); url.hash = "login?token=" + token;
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + Deno.env.get("RESEND_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("PAWID_EMAIL_FROM"), to: [email], subject: "Recupera tu contraseña de PawID",
        text: "Abre este enlace (vence en 30 minutos y se puede usar una vez):\n" + url.href
      })
    });
    if (!sent.ok) {
      await admin.from("password_reset_tokens").delete().eq("token_hash", tokenHash);
      throw new Error("mail_failed");
    }
    return reply({ ok: true });
  } catch { return reply({ ok: false }, 503); }
});