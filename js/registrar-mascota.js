const SUPABASE_URL = PawIDConfig.supabaseUrl;
const SUPABASE_KEY = PawIDConfig.publishableKey;
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const petStore = PawStore.create(supabaseClient);
let usuarioActual = null;
const authWarning = document.getElementById("register-auth-warning");
const registerCard = document.getElementById("register-pet-card");
const form = document.getElementById("formMascota");
const btn = document.getElementById("btnGuardar");
const msg = document.getElementById("mensajeEstado");
const photoPicker = PawPhotos.createPicker(document.getElementById("inputFoto"), document.getElementById("preview-container"));

async function checkSession() {
  try {
    usuarioActual = await petStore.ensureSession();
    if (!usuarioActual) throw new Error('Inicia sesión para registrar a tu mascota.');
    registerCard.hidden = false; authWarning.hidden = true;
  } catch (err) {
    registerCard.hidden = true; authWarning.hidden = false;
    authWarning.querySelector('p').textContent = err.message;
  }
}
checkSession();

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!usuarioActual || !petStore.hasSession() || btn.disabled) return;
  btn.disabled = true; btn.textContent = "Guardando..."; msg.hidden = true; photoPicker.setBusy(true);
  try {
    const fotos = await photoPicker.save(file => petStore.uploadPhoto(file));
    const update = {
      nombre: document.getElementById("nombre").value.trim(),
      especie: document.getElementById("especie").value,
      raza: document.getElementById("raza").value.trim(),
      fecha_nacimiento: document.getElementById("fechaNacimiento").value || null,
      peso_kg: document.getElementById("peso").value ? Number(document.getElementById("peso").value) : null,
      vacunas: document.getElementById("vacunas").value || null,
      descripcion: document.getElementById("descripcion").value.trim() || null, fotos
    };
    await petStore.createPet(update);
    sessionStorage.setItem("mensaje_exito_mascota", "Mascota registrada correctamente.");
    location.href = "/templates/index.html#mascotas";
  } catch (err) { msg.textContent = err.message || "No fue posible registrar la mascota."; msg.className = "form-message error"; msg.hidden = false; }
  finally { btn.disabled = false; btn.textContent = "Registrar mascota"; photoPicker.setBusy(false); }
});
