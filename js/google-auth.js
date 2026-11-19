// ============================================================
// PawID Web - Acceso con Google
//
// Misma lógica que la app móvil:
//  1. Google verifica la cuenta (Supabase Auth, con redirección).
//  2. Se busca o crea la cuenta con proveedor 'google' en la tabla usuarios.
//  3. Cuenta nueva      -> el usuario crea su contraseña de PawID.
//     Cuenta existente  -> el usuario escribe su contraseña de PawID.
//
// Este archivo se carga DESPUÉS de app.js y usa sus variables y funciones:
// supabaseClient, currentUser, hashPassword, normalize, $, showView y
// updateSessionUI.
// ============================================================

const GOOGLE_PENDING_KEY = "pawid_google_pending";
const GOOGLE_PASSWORD_MARKER = "GOOGLE"; // contraseña aún no creada
const GOOGLE_MAX_ATTEMPTS = 5;
const GOOGLE_MIN_PASSWORD = 6; // igual que el registro de la web

// Se captura al cargar la página, ANTES de que Supabase limpie la dirección.
// Si Google o Supabase devolvieron un error, viene en estos parámetros.
const GOOGLE_RETURN_PARAMS = new URLSearchParams(
  window.location.search + "&" + window.location.hash.replace(/^#/, "")
);

let googleUserRow = null;
let googleMode = "crear";
let googleAttempts = 0;

// --------------------------- Mensajes ---------------------------

function showGoogleMessage(text) {
  const registerVisible = $("#view-registro")?.classList.contains("active-view");
  const target = registerVisible ? $("#register-message") : $("#auth-error");
  if (!target) return;
  target.textContent = text;
  target.className = "form-message error";
  target.hidden = false;
}

// --------------------------- Paso 1: ir a Google ---------------------------

async function startGoogleLogin() {
  try {
    // Marca para saber, al volver de Google, que hay que terminar el acceso
    localStorage.setItem(GOOGLE_PENDING_KEY, "1");

    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Vuelve a esta misma página (debe estar autorizada en Supabase)
        redirectTo: window.location.origin + window.location.pathname,
        // Siempre muestra el selector de cuentas
        queryParams: { prompt: "select_account" }
      }
    });
    if (error) throw error;
  } catch (err) {
    localStorage.removeItem(GOOGLE_PENDING_KEY);
    showGoogleMessage(
      "No se pudo iniciar el acceso con Google. " + (err.message || "")
    );
  }
}

// --------------------------- Paso 2: al volver de Google ---------------------------

// Espera a que Supabase termine de procesar la sesión al volver de Google.
async function waitForSupabaseSession(timeoutMs = 10000) {
  const { data } = await supabaseClient.auth.getSession();
  if (data?.session) return data.session;

  return new Promise((resolve) => {
    let subscription = null;
    const timer = setTimeout(() => {
      subscription?.unsubscribe();
      resolve(null);
    }, timeoutMs);

    const { data: listener } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          clearTimeout(timer);
          subscription?.unsubscribe();
          resolve(session);
        }
      }
    );
    subscription = listener.subscription;
  });
}

// Busca la cuenta de Google con ese correo en la tabla usuarios, o la crea.
// Es la misma lógica que usa la app móvil, así que una persona que entra con
// Google en el celular y en la web llega a la MISMA cuenta.
async function findOrCreateGoogleUser({ email, nombre, foto }) {
  if(await pawStore.ready())return pawStore.googleProfile();
  if (!email) throw new Error("No se pudo obtener el correo de Google.");

  const { data: existing, error: findError } = await supabaseClient
    .from("usuarios")
    .select("id, nombre, email, telefono, foto_path")
    .eq("email", email)
    .eq("proveedor", "google")
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    // ¿Todavía no eligió contraseña? (sin traer el hash al navegador)
    const { data: pending, error: pendingError } = await supabaseClient
      .from("usuarios")
      .select("id")
      .eq("id", existing.id)
      .eq("password", GOOGLE_PASSWORD_MARKER)
      .maybeSingle();
    if (pendingError) throw pendingError;
    return { user: existing, needsPassword: !!pending };
  }

  const { data: created, error: createError } = await supabaseClient
    .from("usuarios")
    .insert([{
      nombre: nombre || email.split("@")[0],
      email,
      password: GOOGLE_PASSWORD_MARKER,
      telefono: "",
      foto_path: "",
      proveedor: "google",
      foto_google: foto || ""
    }])
    .select("id, nombre, email, telefono, foto_path")
    .single();
  if (createError) throw createError;

  return { user: created, needsPassword: true };
}

async function resumeGoogleLogin() {
  if (!localStorage.getItem(GOOGLE_PENDING_KEY)) return;
  // Se consume la marca de inmediato para no entrar en un bucle si algo falla
  localStorage.removeItem(GOOGLE_PENDING_KEY);

  // Parámetros capturados al cargar la página (solo se muestran los nombres)
  const urlError =
    GOOGLE_RETURN_PARAMS.get("error_description") || GOOGLE_RETURN_PARAMS.get("error");
  const hasCode = GOOGLE_RETURN_PARAMS.has("code");
  const hasTokens = GOOGLE_RETURN_PARAMS.has("access_token");
  console.log("Google: parámetros al volver ->", [...GOOGLE_RETURN_PARAMS.keys()]);

  showView("login");

  // Google o Supabase devolvieron un error explícito
  if (urlError) {
    console.error("Google: error en la dirección de retorno ->", urlError);
    showGoogleMessage("Google respondió: " + urlError);
    return;
  }

  try {
    const session = await waitForSupabaseSession();
    if (!session) {
      let motivo;
      if (hasCode) {
        motivo =
          "Se recibió el código de Google, pero Supabase no pudo crear la sesión. " +
          "Revisa el Client Secret de Google en Supabase y abre la web siempre desde la misma dirección.";
      } else if (hasTokens) {
        motivo = "La sesión llegó en la dirección pero no se pudo guardar.";
      } else {
        motivo =
          "Google no devolvió ningún código. Probablemente la dirección de esta página " +
          "no está en Redirect URLs de Supabase.";
      }
      console.error("Google: no se creó la sesión.", { hasCode, hasTokens });
      showGoogleMessage("No se pudo completar el inicio de sesión con Google. " + motivo);
      return;
    }

    const meta = session.user.user_metadata || {};
    const result = await findOrCreateGoogleUser({
      email: normalize(session.user.email || ""),
      nombre: (meta.full_name || meta.name || "").toString().trim(),
      foto: (meta.avatar_url || meta.picture || "").toString()
    });

    googleUserRow = result.user;
    openGooglePasswordModal(result.needsPassword ? "crear" : "verificar");
  } catch (err) {
    showGoogleMessage("Error con Google: " + (err.message || err));
    try { await supabaseClient.auth.signOut(); } catch { /* sin acción */ }
  }
}

// --------------------------- Paso 3: contraseña de PawID ---------------------------

function openGooglePasswordModal(mode) {
  googleMode = mode;
  googleAttempts = 0;
  const creating = mode === "crear";

  $("#google-password-title").textContent =
    creating ? "Crea tu contraseña" : "Ingresa tu contraseña";

  $("#google-password-description").textContent = creating
    ? `Tu cuenta de Google (${googleUserRow.email}) fue verificada. Crea una contraseña para PawID: la usarás cada vez que entres con Google.`
    : `Cuenta: ${googleUserRow.email}. Escribe la contraseña que creaste en PawID.`;

  $("#google-name-label").style.display = creating ? "" : "none";
  $("#google-confirm-label").style.display = creating ? "" : "none";
  $("#google-name").value = creating ? (googleUserRow.nombre || "") : "";
  $("#google-name").required = creating;

  $("#google-password").value = "";
  $("#google-password").autocomplete = creating ? "new-password" : "current-password";
  $("#google-password-confirm").value = "";
  $("#google-password-confirm").required = creating;

  $("#google-password-message").hidden = true;
  $("#google-password-submit").textContent = creating ? "Guardar y entrar" : "Entrar";
  $("#google-password-modal").hidden = false;
}

function setGoogleModalError(text) {
  const msg = $("#google-password-message");
  msg.textContent = text;
  msg.hidden = false;
}

function finishGoogleLogin(user) {
  user = pawStore.setUser(user);
  currentUser = user;
  localStorage.setItem("pawid_user", JSON.stringify(user));
  googleUserRow = null;
  $("#google-password-modal").hidden = true;
  updateSessionUI();
  loadAdoptions();
  showView("mascotas");
}

// Cancela: cierra la sesión de Supabase para que Google vuelva a mostrar el
// selector de cuentas la próxima vez.
async function cancelGoogleLogin() {
  $("#google-password-modal").hidden = true;
  googleUserRow = null;
  try { await supabaseClient.auth.signOut(); } catch { /* sin acción */ }
}

async function submitGooglePassword(e) {
  e.preventDefault();
  if (!googleUserRow) return;

  const btn = $("#google-password-submit");
  const password = $("#google-password").value;
  $("#google-password-message").hidden = true;

  btn.disabled = true;
  try {
    if(await pawStore.ready()){
      if(googleMode==='crear'){
        if(password!==$('#google-password-confirm').value)throw new Error('Las contraseñas no coinciden.');
        finishGoogleLogin(await pawStore.googlePassword(password,$('#google-name').value.trim()||googleUserRow.nombre));
      }else{finishGoogleLogin(await pawStore.login(googleUserRow.email,password,'google'));}
      return;
    }
    if (googleMode === "crear") {
      if (password.length < GOOGLE_MIN_PASSWORD) throw new Error(`La contraseña debe tener al menos ${GOOGLE_MIN_PASSWORD} caracteres.`);
      if (password !== $("#google-password-confirm").value) {
        throw new Error("Las contraseñas no coinciden.");
      }
      const nombre = $("#google-name").value.trim() || googleUserRow.nombre;

      // Solo funciona si la cuenta sigue marcada como "sin contraseña", así no
      // se puede pisar la contraseña de una cuenta que ya la tiene.
      const { data, error } = await supabaseClient
        .from("usuarios")
        .update({ password: hashPassword(password), nombre })
        .eq("id", googleUserRow.id)
        .eq("password", GOOGLE_PASSWORD_MARKER)
        .select("id");
      if (error) throw error;
      if (!data || !data.length) {
        throw new Error("Esta cuenta ya tiene una contraseña. Cierra e inicia sesión de nuevo.");
      }

      const { data: profile } = await supabaseClient
        .from("usuarios")
        .select("id, nombre, email, telefono, foto_path")
        .eq("id", googleUserRow.id)
        .maybeSingle();
      finishGoogleLogin(profile || { ...googleUserRow, nombre });
    } else {
      if (!password) throw new Error("Ingresa tu contraseña.");

      // La comparación se hace en la base de datos: el hash no viaja al navegador.
      const { data: ok, error } = await supabaseClient
        .from("usuarios")
        .select("id")
        .eq("id", googleUserRow.id)
        .eq("password", hashPassword(password))
        .maybeSingle();
      if (error) throw error;

      if (ok) {
        finishGoogleLogin(googleUserRow);
        return;
      }

      googleAttempts += 1;
      if (googleAttempts >= GOOGLE_MAX_ATTEMPTS) {
        await cancelGoogleLogin();
        showGoogleMessage("Demasiados intentos. Vuelve a intentarlo.");
        return;
      }
      throw new Error(
        `Contraseña incorrecta. Intentos restantes: ${GOOGLE_MAX_ATTEMPTS - googleAttempts}`
      );
    }
  } catch (err) {
    setGoogleModalError(err.message || "No fue posible continuar.");
  } finally {
    btn.disabled = false;
  }
}

// --------------------------- Inicio ---------------------------

// Quita el manejador antiguo del botón de Google (el de app.js) para que no se
// inicien dos accesos a la vez, y deja solo el de este archivo.
const oldGoogleButton = $("#btn-google");
if (oldGoogleButton) {
  const freshButton = oldGoogleButton.cloneNode(true);
  oldGoogleButton.replaceWith(freshButton);
  freshButton.addEventListener("click", startGoogleLogin);
}
$("#btn-google-register")?.addEventListener("click", startGoogleLogin);
$("#google-password-close")?.addEventListener("click", cancelGoogleLogin);
$("#google-password-cancel")?.addEventListener("click", cancelGoogleLogin);
$("#google-password-form")?.addEventListener("submit", submitGooglePassword);

resumeGoogleLogin();
