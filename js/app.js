// ============================================================



// PawID Web - versión alineada con el alcance de Evaluación 1



// Web: landing + panel mascotas + adopciones + hogares temporales



// Mapa, historial clínico completo, QR y recordatorios: app móvil.



// ============================================================



const SUPABASE_URL = PawIDConfig.supabaseUrl;



const SUPABASE_KEY = PawIDConfig.publishableKey;



const BUCKET_NAME = PawIDConfig.bucket;



// PKCE evita que el retorno de Google choque con las vistas por hash (#mascotas, #login, etc.).
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
});



const pawStore = PawStore.create(supabaseClient);
const pendingAdoptionStates = new Set();
const $ = (selector) => document.querySelector(selector);



const $$ = (selector) => Array.from(document.querySelectorAll(selector));



const normalize = (value = "") => value.toString().trim().toLowerCase();



const uid = () => (window.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);



const hashPassword = (password) => CryptoJS.SHA256(password).toString();



let currentUser = null;



let mascotasUsuario = [];



let editingPublicationId = null;

let adoptionViewMode = "all";
let homeViewMode = "all";
let adoptionCarouselState = { images: [], index: 0, name: "" };



const CHILE_LOCATIONS = {

  "Región de Arica y Parinacota": [

    "Arica",

    "Camarones",

    "Putre",

    "General Lagos"

  ],

  "Región de Tarapacá": [

    "Iquique",

    "Alto Hospicio",

    "Pozo Almonte",

    "Camiña",

    "Colchane",

    "Huara",

    "Pica"

  ],

  "Región de Antofagasta": [

    "Antofagasta",

    "Mejillones",

    "Sierra Gorda",

    "Taltal",

    "Calama",

    "Ollagüe",

    "San Pedro de Atacama",

    "Tocopilla",

    "María Elena"

  ],

  "Región de Atacama": [

    "Copiapó",

    "Caldera",

    "Tierra Amarilla",

    "Chañaral",

    "Diego de Almagro",

    "Vallenar",

    "Alto del Carmen",

    "Freirina",

    "Huasco"

  ],

  "Región de Coquimbo": [

    "La Serena",

    "Coquimbo",

    "Andacollo",

    "La Higuera",

    "Vicuña",

    "Paihuano",

    "Ovalle",

    "Combarbalá",

    "Monte Patria",

    "Punitaqui",

    "Río Hurtado",

    "Illapel",

    "Canela",

    "Los Vilos",

    "Salamanca"

  ],

  "Región de Valparaíso": [

    "Valparaíso",

    "Casablanca",

    "Concón",

    "Juan Fernández",

    "Puchuncaví",

    "Quintero",

    "Viña del Mar",

    "Isla de Pascua",

    "Los Andes",

    "Calle Larga",

    "Rinconada",

    "San Esteban",

    "La Ligua",

    "Cabildo",

    "Papudo",

    "Petorca",

    "Zapallar",

    "Quillota",

    "La Calera",

    "Hijuelas",

    "La Cruz",

    "Nogales",

    "San Antonio",

    "Algarrobo",

    "Cartagena",

    "El Quisco",

    "El Tabo",

    "Santo Domingo",

    "San Felipe",

    "Catemu",

    "Llay-Llay",

    "Panquehue",

    "Putaendo",

    "Santa María",

    "Quilpué",

    "Limache",

    "Olmué",

    "Villa Alemana"

  ],

  "Región Metropolitana de Santiago": [

    "Santiago",

    "Cerrillos",

    "Cerro Navia",

    "Conchalí",

    "El Bosque",

    "Estación Central",

    "Huechuraba",

    "Independencia",

    "La Cisterna",

    "La Florida",

    "La Granja",

    "La Pintana",

    "La Reina",

    "Las Condes",

    "Lo Barnechea",

    "Lo Espejo",

    "Lo Prado",

    "Macul",

    "Maipú",

    "Ñuñoa",

    "Pedro Aguirre Cerda",

    "Peñalolén",

    "Providencia",

    "Pudahuel",

    "Quilicura",

    "Quinta Normal",

    "Recoleta",

    "Renca",

    "San Joaquín",

    "San Miguel",

    "San Ramón",

    "Vitacura",

    "Puente Alto",

    "Pirque",

    "San José de Maipo",

    "Colina",

    "Lampa",

    "Tiltil",

    "San Bernardo",

    "Buin",

    "Calera de Tango",

    "Paine",

    "Melipilla",

    "Alhué",

    "Curacaví",

    "María Pinto",

    "San Pedro",

    "Talagante",

    "El Monte",

    "Isla de Maipo",

    "Padre Hurtado",

    "Peñaflor"

  ],

  "Región del Libertador General Bernardo O'Higgins": [

    "Rancagua",

    "Codegua",

    "Coinco",

    "Coltauco",

    "Doñihue",

    "Graneros",

    "Las Cabras",

    "Machalí",

    "Malloa",

    "Mostazal",

    "Olivar",

    "Peumo",

    "Pichidegua",

    "Quinta de Tilcoco",

    "Rengo",

    "Requínoa",

    "San Vicente",

    "Pichilemu",

    "La Estrella",

    "Litueche",

    "Marchigüe",

    "Navidad",

    "Paredones",

    "San Fernando",

    "Chépica",

    "Chimbarongo",

    "Lolol",

    "Nancagua",

    "Palmilla",

    "Peralillo",

    "Placilla",

    "Pumanque",

    "Santa Cruz"

  ],

  "Región del Maule": [

    "Talca",

    "Constitución",

    "Curepto",

    "Empedrado",

    "Maule",

    "Pelarco",

    "Pencahue",

    "Río Claro",

    "San Clemente",

    "San Rafael",

    "Cauquenes",

    "Chanco",

    "Pelluhue",

    "Curicó",

    "Hualañé",

    "Licantén",

    "Molina",

    "Rauco",

    "Romeral",

    "Sagrada Familia",

    "Teno",

    "Vichuquén",

    "Linares",

    "Colbún",

    "Longaví",

    "Parral",

    "Retiro",

    "San Javier",

    "Villa Alegre",

    "Yerbas Buenas"

  ],

  "Región de Ñuble": [

    "Chillán",

    "Chillán Viejo",

    "Bulnes",

    "El Carmen",

    "Pemuco",

    "Pinto",

    "Quillón",

    "San Ignacio",

    "Yungay",

    "Quirihue",

    "Cobquecura",

    "Coelemu",

    "Ninhue",

    "Portezuelo",

    "Ránquil",

    "Treguaco",

    "San Carlos",

    "Coihueco",

    "Ñiquén",

    "San Fabián",

    "San Nicolás"

  ],

  "Región del Biobío": [

    "Concepción",

    "Coronel",

    "Chiguayante",

    "Florida",

    "Hualqui",

    "Lota",

    "Penco",

    "San Pedro de la Paz",

    "Santa Juana",

    "Talcahuano",

    "Tomé",

    "Hualpén",

    "Arauco",

    "Cañete",

    "Contulmo",

    "Curanilahue",

    "Lebu",

    "Los Álamos",

    "Tirúa",

    "Los Ángeles",

    "Antuco",

    "Cabrero",

    "Laja",

    "Mulchén",

    "Nacimiento",

    "Negrete",

    "Quilaco",

    "Quilleco",

    "San Rosendo",

    "Santa Bárbara",

    "Tucapel",

    "Yumbel",

    "Alto Biobío"

  ],

  "Región de La Araucanía": [

    "Temuco",

    "Carahue",

    "Cunco",

    "Curarrehue",

    "Freire",

    "Galvarino",

    "Gorbea",

    "Lautaro",

    "Loncoche",

    "Melipeuco",

    "Nueva Imperial",

    "Padre Las Casas",

    "Perquenco",

    "Pitrufquén",

    "Pucón",

    "Saavedra",

    "Teodoro Schmidt",

    "Toltén",

    "Vilcún",

    "Villarrica",

    "Cholchol",

    "Angol",

    "Collipulli",

    "Curacautín",

    "Ercilla",

    "Lonquimay",

    "Los Sauces",

    "Lumaco",

    "Purén",

    "Renaico",

    "Traiguén",

    "Victoria"

  ],

  "Región de Los Ríos": [

    "Valdivia",

    "Corral",

    "Lanco",

    "Los Lagos",

    "Máfil",

    "Mariquina",

    "Paillaco",

    "Panguipulli",

    "La Unión",

    "Futrono",

    "Lago Ranco",

    "Río Bueno"

  ],

  "Región de Los Lagos": [

    "Puerto Montt",

    "Calbuco",

    "Cochamó",

    "Fresia",

    "Frutillar",

    "Los Muermos",

    "Llanquihue",

    "Maullín",

    "Puerto Varas",

    "Castro",

    "Ancud",

    "Chonchi",

    "Curaco de Vélez",

    "Dalcahue",

    "Puqueldón",

    "Queilén",

    "Quellón",

    "Quemchi",

    "Quinchao",

    "Osorno",

    "Puerto Octay",

    "Purranque",

    "Puyehue",

    "Río Negro",

    "San Juan de la Costa",

    "San Pablo",

    "Chaitén",

    "Futaleufú",

    "Hualaihué",

    "Palena"

  ],

  "Región de Aysén del General Carlos Ibáñez del Campo": [

    "Coyhaique",

    "Lago Verde",

    "Aysén",

    "Cisnes",

    "Guaitecas",

    "Cochrane",

    "O'Higgins",

    "Tortel",

    "Chile Chico",

    "Río Ibáñez"

  ],

  "Región de Magallanes y de la Antártica Chilena": [

    "Punta Arenas",

    "Laguna Blanca",

    "Río Verde",

    "San Gregorio",

    "Cabo de Hornos",

    "Antártica",

    "Porvenir",

    "Primavera",

    "Timaukel",

    "Natales",

    "Torres del Paine"

  ]

};





function inferRegionByCommune(commune) {

  const target = normalize(commune);

  if (!target) return "";

  for (const [region, comunas] of Object.entries(CHILE_LOCATIONS)) {

    if (comunas.some(c => normalize(c) === target)) return region;

  }

  return "";

}



function populateRegionSelect(select, { filter = false, selected = "" } = {}) {

  if (!select) return;

  const firstLabel = filter ? "Todas las regiones" : "Selecciona una región";

  select.innerHTML = `<option value="">${firstLabel}</option>` +

    Object.keys(CHILE_LOCATIONS)

      .map(region => `<option value="${escapeAttr(region)}">${escapeHtml(region)}</option>`)

      .join("");

  select.value = selected && CHILE_LOCATIONS[selected] ? selected : "";

}



function populateCommuneSelect(
  select,
  region,
  { filter = false, selected = "", allWhenNoRegion = false } = {}
) {

  if (!select) return;

  const firstLabel = filter ? "Todas las comunas" : "Selecciona una comuna";

  const comunas = region
    ? (CHILE_LOCATIONS[region] || [])
    : (allWhenNoRegion
        ? Array.from(new Set(Object.values(CHILE_LOCATIONS).flat()))
            .sort((a, b) => a.localeCompare(b, "es"))
        : []);

  select.innerHTML = `<option value="">${firstLabel}</option>` +
    comunas.map(comuna => `<option value="${escapeAttr(comuna)}">${escapeHtml(comuna)}</option>`).join("");

  select.disabled = !region && !allWhenNoRegion;

  select.value = comunas.includes(selected) ? selected : "";

}



function initializeLocationControls() {

  const adoptionRegion = $("#adoption-region-filter");

  const adoptionComuna = $("#adoption-comuna-filter");

  const homeRegion = $("#home-region-filter");

  const homeComuna = $("#home-comuna-filter");

  const publicationRegion = $("#publication-region");

  const publicationComuna = $("#publication-comuna");



  populateRegionSelect(adoptionRegion, { filter: true });

  populateCommuneSelect(adoptionComuna, "", { filter: true, allWhenNoRegion: true });



  populateRegionSelect(homeRegion, { filter: true });

  populateCommuneSelect(homeComuna, "", { filter: true, allWhenNoRegion: true });



  populateRegionSelect(publicationRegion);

  populateCommuneSelect(publicationComuna, "");



  adoptionRegion?.addEventListener("change", () => {

    populateCommuneSelect(adoptionComuna, adoptionRegion.value, { filter: true, allWhenNoRegion: true });

    renderAdoptions();

  });



  adoptionComuna?.addEventListener("change", renderAdoptions);



  homeRegion?.addEventListener("change", () => {

    populateCommuneSelect(homeComuna, homeRegion.value, { filter: true, allWhenNoRegion: true });

    renderHomes();

  });



  homeComuna?.addEventListener("change", renderHomes);



  publicationRegion?.addEventListener("change", () => {

    populateCommuneSelect(publicationComuna, publicationRegion.value);

  });

}



// Cachés de esta visita. Los datos persistentes provienen de Supabase.
let remoteAdoptions=[],remoteHomes=[],publicationLoadId=0;
function getAdoptions(){return remoteAdoptions.map(item=>({...item,region:item.region||inferRegionByCommune(item.comuna||'')}));}
function getHomes(){return remoteHomes.map(item=>({...item,region:item.region||inferRegionByCommune(item.comuna||'')}));}
function mergePetExtras(pet){return pet;}
function setPublicationStatus(message){for(const selector of ['#adoption-status-message','#home-status-message']){const node=$(selector);if(node){node.textContent=message;node.hidden=!message;}}}


// --------------------------- Navegación SPA ---------------------------



function showView(name) {



  $$(".view-section").forEach(v => v.classList.remove("active-view"));



  const target = $(`#view-${name}`) || $("#view-inicio");



  target.classList.add("active-view");



  $$(".nav-link").forEach(btn => btn.classList.toggle("active", btn.dataset.view === name));



  window.scrollTo({ top: 0, behavior: "smooth" });



  if (name === "mascotas") refreshPetsView();



  if (name === "adopciones") renderAdoptions();



  if (name === "hogares") renderHomes();



  window.location.hash = name === "inicio" ? "" : name;



}



$$('[data-view]').forEach(el => el.addEventListener('click', () => showView(el.dataset.view)));



window.addEventListener("hashchange", () => {



  const hash = location.hash.replace("#", "");



  if (["login","mascotas","adopciones","hogares","registro"].includes(hash)) showView(hash);



});



// --------------------------- Menú cuenta ---------------------------



const accountButton = $("#account-button");



const accountMenu = $("#account-menu");



accountButton.addEventListener("click", () => accountMenu.hidden = !accountMenu.hidden);



document.addEventListener("click", (e) => {



  if (!accountMenu.contains(e.target) && !accountButton.contains(e.target)) accountMenu.hidden = true;



});



$("#account-login").addEventListener("click", () => { accountMenu.hidden = true; showView("login"); });



$("#account-logout").addEventListener("click", logout);



// --------------------------- Editar perfil ---------------------------
const profileModal=$('#profile-modal');
let profileReturnFocus=null;
let profilePhotoFile=null,profilePhotoPreview='',profilePhotoSaved='',profilePhotoUploaded='',profilePhotoChanged=false,profilePhotoVersion=0;
function releaseProfilePreview(){if(profilePhotoPreview)URL.revokeObjectURL(profilePhotoPreview);profilePhotoPreview='';profilePhotoVersion++;}
function renderProfileAvatar(){
  const name=$('#profile-name').value.trim()||'Tu nombre';
  const avatar=$('#profile-avatar'),url=profilePhotoPreview||profilePhotoSaved;
  avatar.replaceChildren();
  if(url){const img=document.createElement('img');img.src=url;img.alt='Foto de perfil';img.onerror=()=>{avatar.textContent=name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();};avatar.append(img);}
  else avatar.textContent=name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  $('#profile-summary-name').textContent=name;
  $('#profile-summary-email').textContent=$('#profile-email').value;
  $('#profile-photo-select').textContent=url?'Cambiar foto':'Agregar foto';
  $('#profile-photo-remove').disabled=!url;
}
$('#profile-name').addEventListener('input',renderProfileAvatar);
$('#profile-photo-select').addEventListener('click',()=>$('#profile-photo').click());
$('#profile-photo').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file||$('#profile-save').disabled)return;
  const message=$('#profile-message');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||file.size===0){message.textContent='Elige una imagen JPG, PNG o WebP de hasta 5 MB.';message.className='form-message error';message.hidden=false;return;}
  const version=++profilePhotoVersion,url=URL.createObjectURL(file),image=new Image();
  const valid=await new Promise(resolve=>{image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=url;});
  if(version!==profilePhotoVersion||profileModal.hidden){URL.revokeObjectURL(url);return;}
  if(!valid){URL.revokeObjectURL(url);message.textContent='No pudimos leer esa imagen. Selecciona otra foto.';message.className='form-message error';message.hidden=false;return;}
  releaseProfilePreview();profilePhotoPreview=url;profilePhotoFile=file;profilePhotoUploaded='';profilePhotoChanged=true;message.hidden=true;renderProfileAvatar();
});
$('#profile-photo-remove').addEventListener('click',()=>{if($('#profile-save').disabled)return;releaseProfilePreview();profilePhotoFile=null;profilePhotoSaved='';profilePhotoUploaded='';profilePhotoChanged=true;renderProfileAvatar();});
function closeProfile(){if($('#profile-save').disabled)return;profileModal.hidden=true;resetSecurity();releaseProfilePreview();profilePhotoFile=null;profilePhotoUploaded='';profileReturnFocus?.focus();}
async function openProfile(){
  accountMenu.hidden=true;
  if(!currentUser||!pawStore.hasSession()){showView('login');return;}
  profileReturnFocus=accountButton;selectAccountTab('personal');
  $('#profile-name').value=currentUser.nombre||'';
  $('#profile-email').value=currentUser.email||'';
  $('#profile-phone').value=normalizePhone(currentUser.telefono||'');
  releaseProfilePreview();profilePhotoFile=null;profilePhotoUploaded='';profilePhotoChanged=false;profilePhotoSaved=currentUser.foto_path||'';renderProfileAvatar();
  $('#profile-message').hidden=true;
  profileModal.hidden=false;$('#profile-name').focus();
}
$('#account-edit-profile').addEventListener('click',openProfile);
$('#profile-close').addEventListener('click',closeProfile);
$('#profile-cancel').addEventListener('click',closeProfile);
profileModal.addEventListener('click',event=>{if(event.target===profileModal)closeProfile();});
profileModal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeProfile();}
  if(event.key==='Tab'){
    const controls=[...profileModal.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type="file"])')].filter(node=>node.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
$('#profile-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!currentUser||!pawStore.hasSession()){closeProfile();showView('login');return;}
  const button=$('#profile-save'),message=$('#profile-message');if(button.disabled)return;
  const profile={nombre:$('#profile-name').value.trim(),telefono:normalizePhone($('#profile-phone').value)};
  if(!profile.nombre){message.textContent='Indica tu nombre.';message.className='form-message error';message.hidden=false;return;}
  if(profile.telefono&&!/^9\d{8}$/.test(profile.telefono)){message.textContent='El teléfono debe tener 9 dígitos y empezar con 9.';message.className='form-message error';message.hidden=false;return;}
  button.disabled=true;button.textContent='Guardando…';message.hidden=true;$('#profile-photo-select').disabled=true;$('#profile-photo-remove').disabled=true;
  try{
    if(profilePhotoChanged){
      if(profilePhotoFile&&!profilePhotoUploaded)profilePhotoUploaded=await pawStore.uploadPhoto(profilePhotoFile);
      profile.foto_path=profilePhotoFile?profilePhotoUploaded:'';
    }
    currentUser=await pawStore.saveProfile(profile);updateSessionUI();
    profilePhotoSaved=currentUser.foto_path||'';profilePhotoFile=null;profilePhotoUploaded='';profilePhotoChanged=false;releaseProfilePreview();renderProfileAvatar();
    message.textContent='Perfil actualizado.';message.className='form-message';
  }catch(error){message.textContent=error.message||'No se pudo actualizar el perfil.';message.className='form-message error';}
  finally{button.disabled=false;button.textContent='Guardar cambios';message.hidden=false;$('#profile-photo-select').disabled=false;renderProfileAvatar();}
});

// --------------------------- Seguridad: simulación de verificación ---------------------------
const accountSecurity=PawAccountSecurity.create();
let securityKind='';
function securityMessage(text,error=false){const node=$('#security-message');node.textContent=text;node.className=error?'form-message error':'form-message';node.hidden=!text;}
function resetSecurity(){accountSecurity.reset();securityKind='';$('#security-options').hidden=false;$('#security-code-form').hidden=true;$('#security-change-form').hidden=true;$('#security-code-form').reset();$('#security-change-form').reset();securityMessage('');}
function selectAccountTab(tab){
 resetSecurity();const isSecurity=tab==='security';
 $('#account-personal-pane').hidden=isSecurity;$('#account-security-pane').hidden=!isSecurity;
 $('#account-personal-tab').setAttribute('aria-selected',String(!isSecurity));$('#account-security-tab').setAttribute('aria-selected',String(isSecurity));
 $('#account-personal-tab').tabIndex=isSecurity?-1:0;$('#account-security-tab').tabIndex=isSecurity?0:-1;
 const google=String(currentUser?.proveedor||'email').toLowerCase()==='google';
 $('#account-google-lock').hidden=!google;$('#account-manual-security').hidden=google;
}
$('#account-personal-tab').addEventListener('click',()=>selectAccountTab('personal'));
$('#account-security-tab').addEventListener('click',()=>selectAccountTab('security'));
for(const id of ['account-personal-tab','account-security-tab'])$('#'+id).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const security=event.key==='End'||(event.key!=='Home'&&id==='account-personal-tab');selectAccountTab(security?'security':'personal');$('#'+(security?'account-security-tab':'account-personal-tab')).focus();}});
async function beginSecurity(kind){
 try{const result=await accountSecurity.start(currentUser,kind);securityKind=kind;$('#security-options').hidden=true;$('#security-change-form').hidden=true;$('#security-code-form').hidden=false;$('#security-code-title').textContent=kind==='email'?'Verificar antes de cambiar el correo':'Verificar antes de cambiar la contraseña';$('#security-code-description').textContent='En el flujo real, el código llegará a '+result.email+'. En esta prueba usa el código indicado abajo.';securityMessage('');$('#security-code').focus();}catch(error){securityMessage(error.message,true);}
}
$('#security-email-choice').addEventListener('click',()=>beginSecurity('email'));
$('#security-password-choice').addEventListener('click',()=>beginSecurity('password'));
$('#security-back').addEventListener('click',resetSecurity);$('#security-change-cancel').addEventListener('click',resetSecurity);
$('#security-code-form').addEventListener('submit',async event=>{
 event.preventDefault();try{await accountSecurity.verify(currentUser,$('#security-code').value);$('#security-code-form').hidden=true;$('#security-change-form').hidden=false;const email=securityKind==='email';$('#security-new-email-label').hidden=!email;$('#security-new-email').required=email;$('#security-password-fields').hidden=email;$('#security-new-password').required=!email;$('#security-confirm-password').required=!email;securityMessage('');$('#'+(email?'security-new-email':'security-new-password')).focus();}catch(error){securityMessage(error.message,true);}
});
$('#security-change-form').addEventListener('submit',async event=>{
 event.preventDefault();try{const result=await accountSecurity.complete(currentUser,{email:$('#security-new-email').value,password:$('#security-new-password').value,confirmPassword:$('#security-confirm-password').value});resetSecurity();securityMessage(result.kind==='email'?'Simulación completada. Tu correo real no se modificó.':'Simulación completada. Tu contraseña real no se modificó.');}catch(error){securityMessage(error.message,true);}
});

// --------------------------- Estado de sesión ---------------------------



async function hydrateSession(){
  try{currentUser=await pawStore.ensureSession();}catch(error){setPublicationStatus(error.message);currentUser=null;}
  updateSessionUI();await loadAdoptions();
}

function setAdoptionSessionControls() {
  const signedIn = !!currentUser && pawStore.hasSession();
  $("#adoption-show-mine").hidden = !signedIn; $("#new-adoption").hidden = !signedIn;
  if (!signedIn) adoptionViewMode = "all";
}
async function loadAdoptions(){
  const id=++publicationLoadId;
  setPublicationStatus('Consultando publicaciones en Supabase…');
  const results=await Promise.allSettled([pawStore.listPublications('adoption'),pawStore.listPublications('home')]);
  if(id!==publicationLoadId)return;
  remoteAdoptions=results[0].status==='fulfilled'?results[0].value:[];
  remoteHomes=results[1].status==='fulfilled'?results[1].value:[];
  renderAdoptions();renderHomes();
  const failures=results.filter(result=>result.status==='rejected');
  setPublicationStatus(failures.length?failures[0].reason.message:'Publicaciones actualizadas.');
}

function updateSessionUI() {



  const accountName = $("#account-name");



  const loginBtn = $("#account-login");



  const logoutBtn = $("#account-logout");



  const welcomeAction = $("#welcome-action");
  const newPetLink = $("#new-pet-link");
  $('#account-edit-profile').hidden=!currentUser;
  accountButton.replaceChildren();
  if(currentUser?.foto_path){const avatar=document.createElement('img');avatar.src=currentUser.foto_path;avatar.alt='';avatar.onerror=()=>{accountButton.textContent='♙';};accountButton.append(avatar);}else accountButton.textContent='♙';




  if (currentUser) {
    if (newPetLink) newPetLink.hidden = false;



    accountName.textContent = currentUser.nombre || currentUser.email || "Usuario";



    loginBtn.hidden = true;



    logoutBtn.hidden = false;



    if (welcomeAction) {



      welcomeAction.textContent = "Ver mis mascotas";



      welcomeAction.dataset.view = "mascotas";



    }



  } else {
    if (newPetLink) newPetLink.hidden = true;



    accountName.textContent = "Invitado";



    loginBtn.hidden = false;



    logoutBtn.hidden = true;



    if (welcomeAction) {



      welcomeAction.textContent = "Iniciar sesión";



      welcomeAction.dataset.view = "login";



    }



  }



  refreshPetsView();
  const importButton=$('#import-browser-data');
  if(importButton)importButton.hidden=!currentUser||!['pawid_adoptions','pawid_homes','pawid_pet_extras'].some(key=>localStorage.getItem(key));
  setAdoptionSessionControls();renderAdoptions();renderHomes();
}



async function logout() {



  try{await pawStore.logout();}catch(error){console.warn(error.message);}
  $("#publication-modal").hidden = true; $("#modal-editar").hidden = true;
  $("#profile-modal").hidden = true; $("#profile-form").reset();resetSecurity();releaseProfilePreview();profilePhotoFile=null;profilePhotoUploaded="";
  localStorage.removeItem("pawid_user");

  // También cerrar la sesión OAuth para permitir escoger otra cuenta de Google.
  supabaseClient.auth.signOut().catch(() => {});



  currentUser = null;
  remoteAdoptions=[];remoteHomes=[];publicationLoadId++;



  mascotasUsuario = [];
  adoptionViewMode = "all";
  homeViewMode = "all";



  accountMenu.hidden = true;



  updateSessionUI();



  showView("inicio");
  await loadAdoptions();



}



// --------------------------- Inicio de sesión con correo ---------------------------
// Las cuentas manuales se identifican con proveedor "email". Se conserva
// compatibilidad con cuentas antiguas cuyo proveedor todavía esté vacío.

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = normalize($("#login-email").value);
  if (window.PawIDAdminEntry?.redirectFromLogin(email, $("#login-password"))) return;
  const password = $("#login-password").value;
  const msg = $("#auth-error");
  const btn = $("#btn-login");

  msg.hidden = true;
  btn.disabled = true;
  btn.textContent = "Verificando...";

  try {
    const usuario = await pawStore.login(email, password);

    currentUser = usuario;
    localStorage.setItem("pawid_user", JSON.stringify(usuario));
    e.target.reset();
    updateSessionUI(); loadAdoptions();
    showView("mascotas");
  } catch (err) {
    msg.textContent = err.message || "No fue posible iniciar sesión.";
    msg.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Iniciar Sesión";
  }
});

const recoveryModal=$('#password-recovery-modal');
// Pasos del BPMN "Cambiar Contraseña": 0 correo, 1 código, 2 nueva contraseña.
let recoveryStep=0,recoveryEmail='';
const RECOVERY_RULES=[[/.{10,}/,'10 caracteres'],[/[A-Z]/,'una mayúscula'],[/[a-z]/,'una minúscula'],[/\d/,'un número'],[/[^A-Za-z0-9]/,'un carácter especial']];
function showRecoveryStep(step,text){
  recoveryStep=step;const message=$('#recovery-message');
  $('#recovery-email-label').hidden=step!==0;$('#recovery-email').required=step===0;
  $('#recovery-code-label').hidden=step!==1;$('#recovery-code').required=step===1;
  $('#recovery-new-fields').hidden=step!==2;$('#recovery-password').required=step===2;$('#recovery-password-confirm').required=step===2;
  $('#recovery-resend').hidden=step!==1;
  $('#recovery-submit').hidden=step>2;$('#recovery-submit').textContent=['Enviar código','Validar código','Cambiar contraseña'][step]||'';
  message.hidden=false;message.className='form-message';message.textContent=text;
}
function openPasswordRecovery(){
  recoveryModal.hidden=false;recoveryEmail='';$('#password-recovery-form').reset();
  showRecoveryStep(0,'Ingresa el correo de tu cuenta PawID. Te enviaremos un código de recuperación.');
}
$('#show-password-recovery').addEventListener('click',openPasswordRecovery);
$('#password-recovery-close').addEventListener('click',()=>{recoveryModal.hidden=true;});
async function sendRecoveryCode(){
  await pawStore.recoveryRequest(recoveryEmail);
  showRecoveryStep(1,'Enviamos un código a '+recoveryEmail+'. Revisa también la carpeta de spam.');
}
$('#recovery-resend').addEventListener('click',async()=>{try{await sendRecoveryCode();}catch(error){const m=$('#recovery-message');m.textContent=error.message;m.className='form-message error';}});
$('#password-recovery-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#recovery-submit'),message=$('#recovery-message');if(button.disabled)return;button.disabled=true;
  try{
    if(recoveryStep===0){
      recoveryEmail=normalize($('#recovery-email').value);
      if(!await pawStore.recoveryEmailExists(recoveryEmail))throw new Error('Correo no encontrado.');
      await sendRecoveryCode();
    }else if(recoveryStep===1){
      const code=$('#recovery-code').value.trim();
      if(!/^\d{6,10}$/.test(code))throw new Error('Ingresa el código que recibiste.');
      await pawStore.recoveryVerify(recoveryEmail,code);
      showRecoveryStep(2,'Código validado. Ingresa tu nueva contraseña.');
    }else{
      const password=$('#recovery-password').value;
      const missing=RECOVERY_RULES.filter(([rule])=>!rule.test(password)).map(([,label])=>label);
      if(missing.length)throw new Error('La contraseña necesita: '+missing.join(', ')+'.');
      if(password!==$('#recovery-password-confirm').value)throw new Error('Las contraseñas no coinciden.');
      await pawStore.recoveryReset(password);
      pawStore.clear();currentUser=null;updateSessionUI();
      showRecoveryStep(3,'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.');
    }
  }catch(error){message.textContent=error.message;message.className='form-message error';message.hidden=false;}
  finally{button.disabled=false;}
});

function normalizePhone(value) {
  let digits = (value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("56")) digits = digits.slice(2);
  return digits;
}

$("#form-register").addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = $("#register-message");
  const btn = $("#btn-register");

  message.hidden = true;
  btn.disabled = true;
  btn.textContent = "Creando cuenta...";

  try {
    const telefono = normalizePhone($("#register-phone").value);

    if (telefono && !/^9\d{8}$/.test(telefono)) {
      throw new Error("El teléfono debe tener 9 dígitos y empezar con 9 (ej. 9 1234 5678).");
    }

    const payload = {
      id: uid(),
      nombre: $("#register-name").value.trim(),
      email: normalize($("#register-email").value),
      password: $("#register-password").value,
      telefono,
      foto_path: "",
      proveedor: "email"
    };

    await pawStore.register({id:payload.id,nombre:payload.nombre,email:payload.email,telefono:payload.telefono},payload.password);


    message.textContent = "Cuenta creada correctamente. Ya puedes iniciar sesión.";
    message.className = "form-message";
    message.hidden = false;
    e.target.reset();
    setTimeout(() => showView("login"), 1000);
  } catch (err) {
    message.textContent = err.message || "No fue posible crear la cuenta.";
    message.className = "form-message error";
    message.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear cuenta";
  }
});

// --------------------------- Panel de mascotas ---------------------------



function refreshPetsView() {



  const warning = $("#mascotas-auth-warning");



  const panel = $("#mascotas-panel");



  if (!warning || !panel) return;



  if (!currentUser) {



    warning.hidden = false;



    panel.hidden = true;



    return;



  }



  warning.hidden = true;



  panel.hidden = false;



  cargarMascotas(currentUser.id);



  const successText = sessionStorage.getItem("mensaje_exito_mascota");



  const banner = $("#mensaje-alerta-mascota");



  if (successText && banner) {



    banner.textContent = successText;



    banner.hidden = false;



    sessionStorage.removeItem("mensaje_exito_mascota");



  }



}



async function cargarMascotas(userId) {



  const list = $("#lista-mascotas");



  if (!list || !userId) return;



  list.innerHTML = `<div class="empty-state"><p>Cargando tus mascotas...</p></div>`;



  try {



    const data = await pawStore.listPets();



    mascotasUsuario = (data || []).map(mergePetExtras);



    if (!mascotasUsuario.length) {



      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🐾</div><h3>Aún no tienes mascotas registradas</h3><p>Registra tu primera mascota para verla en este panel.</p><a class="btn btn-green" href="/templates/registrar-mascota.html">Registrar mascota</a></div>`;



      return;



    }



    list.innerHTML = mascotasUsuario.map(m => {



      const edad = calcularEdadMascota(m.fecha_nacimiento);



      return `



        <article class="pet-card pet-card-catalog">



          <div class="pet-photo pet-photo-large">



            ${PawPhotos.petImages(m)[0]



              ? `<img src="${escapeAttr(PawPhotos.petImages(m)[0])}" alt="${escapeAttr(m.nombre || "Mascota")}">`



              : `<div class="pet-photo-placeholder">🐾</div>`}



          </div>



          <div class="pet-card-body">



            <div class="pet-card-heading">



              <div>



                <span class="pet-species-label">${escapeHtml(m.especie || "Mascota")}</span>



                <h3>${escapeHtml(m.nombre || "Sin nombre")}</h3>



                <p class="pet-breed">${escapeHtml(m.raza || "Raza no especificada")}</p>
                <p class="pet-public-id">ID: ${escapeHtml(m.public_id || m.id)}</p>



              </div>



            



            </div>



            <div class="pet-quick-info">



              <span>🐾 ${escapeHtml(m.especie || "No especificada")}</span>



              <span>🧬 ${escapeHtml(m.raza || "No especificada")}</span>



              <span>🎂 ${escapeHtml(edad)}</span>

              ${m.peso_kg ? `<span>⚖️ ${escapeHtml(String(m.peso_kg))} kg</span>` : ""}

              ${m.vacunas ? `<span>💉 Vacunas: ${escapeHtml(m.vacunas)}</span>` : ""}



            </div>



            <div class="pet-actions pet-actions-catalog">



              <button class="btn btn-green" type="button" data-view-pet="${escapeAttr(m.id)}">



                Ver ficha



              </button>



              <button class="btn btn-outline" type="button" data-edit-pet="${escapeAttr(m.id)}">



                Editar



              </button>



              <button class="btn btn-coral" type="button" data-delete-pet="${escapeAttr(m.id)}">



                Eliminar



              </button>



            </div>



          </div>



        </article>`;



    }).join("");



  } catch (err) {



    list.innerHTML = `<div class="empty-state"><h3>No pudimos cargar tus mascotas</h3><p>${escapeHtml(err.message || "Error desconocido")}</p></div>`;



  }



}



$("#lista-mascotas").addEventListener("click", (e) => {



  const view = e.target.closest("[data-view-pet]");



  const edit = e.target.closest("[data-edit-pet]");



  const del = e.target.closest("[data-delete-pet]");



  if (view) openPetDetail(view.dataset.viewPet);



  if (edit) openPetModal(edit.dataset.editPet);



  if (del) deletePet(del.dataset.deletePet);



});



function calcularEdadMascota(fechaNacimiento) {



  if (!fechaNacimiento) return "Edad no indicada";



  const fecha = formatDate(fechaNacimiento);



  if (!fecha) return "Edad no indicada";



  const nacimiento = new Date(`${fecha}T00:00:00`);



  if (Number.isNaN(nacimiento.getTime())) return "Edad no indicada";



  const hoy = new Date();



  let anios = hoy.getFullYear() - nacimiento.getFullYear();



  let meses = hoy.getMonth() - nacimiento.getMonth();



  if (hoy.getDate() < nacimiento.getDate()) meses--;



  if (meses < 0) {



    anios--;



    meses += 12;



  }



  if (anios > 0) return anios === 1 ? "1 año" : `${anios} años`;



  if (meses > 0) return meses === 1 ? "1 mes" : `${meses} meses`;



  return "Menos de 1 mes";



}



function ensurePetDetailModal() {

  if ($("#modal-detalle-mascota")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="modal-detalle-mascota" class="modal-overlay" hidden>
      <div class="modal-box adoption-detail-modal-box">

        <button
          class="modal-close"
          id="btn-cerrar-detalle-mascota"
          type="button"
          aria-label="Cerrar"
        >×</button>

        <div class="adoption-detail-layout">

          <div id="detalle-mascota-foto" class="adoption-detail-image">
            <div class="adoption-image-placeholder">🐾</div>
          </div>

          <div class="adoption-detail-content">

            <span id="detalle-mascota-especie" class="adoption-detail-kicker"></span>

            <h2 id="detalle-mascota-nombre">Mascota</h2>

            <p id="detalle-mascota-raza" class="adoption-detail-breed"></p>

            <p id="detalle-mascota-descripcion" class="adoption-detail-description"></p>

            <div class="adoption-detail-grid">

              <div>
                <span>Edad</span>
                <strong id="detalle-mascota-edad">No indicada</strong>
              </div>

              <div>
                <span>Fecha de nacimiento</span>
                <strong id="detalle-mascota-nacimiento">No indicada</strong>
              </div>

              <div>
                <span>Peso</span>
                <strong id="detalle-mascota-peso">No indicado</strong>
              </div>

              <div>
                <span>Vacunas al día</span>
                <strong id="detalle-mascota-vacunas">No informado</strong>
              </div>

              <div>
                <span>Contacto</span>
                <strong id="detalle-mascota-contacto">No indicado</strong>
              </div>

            </div>

            <button id="btn-editar-desde-detalle" class="btn btn-green" type="button">
              Editar mascota
            </button>

          </div>

        </div>

      </div>
    </div>
  `);

  $("#btn-cerrar-detalle-mascota").addEventListener("click", () => {
    $("#modal-detalle-mascota").hidden = true;
  });

  $("#modal-detalle-mascota").addEventListener("click", (e) => {
    if (e.target.id === "modal-detalle-mascota") {
      $("#modal-detalle-mascota").hidden = true;
    }
  });

}



function openPetDetail(id) {



  const pet = mascotasUsuario.find(m => String(m.id) === String(id));



  if (!pet) return;



  ensurePetDetailModal();



  PawPhotos.mountCarousel($("#detalle-mascota-foto"), PawPhotos.petImages(pet), pet.nombre);

  $("#detalle-mascota-especie").textContent = pet.especie || "Mascota";



  $("#detalle-mascota-nombre").textContent = (pet.nombre || "Sin nombre") + " · ID: " + (pet.public_id || pet.id);



  $("#detalle-mascota-raza").textContent = pet.raza || "Raza no especificada";

  $("#detalle-mascota-descripcion").textContent =
    pet.descripcion || "Sin descripción u observaciones registradas.";



  $("#detalle-mascota-edad").textContent = calcularEdadMascota(pet.fecha_nacimiento);



  $("#detalle-mascota-nacimiento").textContent = pet.fecha_nacimiento || "No indicada";

  $("#detalle-mascota-peso").textContent =
    pet.peso_kg ? `${pet.peso_kg} kg` : "No indicado";

  $("#detalle-mascota-vacunas").textContent =
    pet.vacunas || "No informado";



  $("#detalle-mascota-contacto").textContent =



    pet.dueno_telefono || currentUser?.telefono || "No indicado";



  $("#btn-editar-desde-detalle").onclick = () => {



    $("#modal-detalle-mascota").hidden = true;



    openPetModal(pet.id);



  };



  $("#modal-detalle-mascota").hidden = false;



}



const editPhotoPicker = PawPhotos.createPicker($("#edit-foto"), $("#edit-photo-previews"));
function openPetModal(id) {
  if (!currentUser || !pawStore.hasSession()) { showView("login"); return; }



  const pet = mascotasUsuario.find(m => String(m.id) === String(id));



  if (!pet) return;



  $("#edit-id").value = pet.id;



  $("#edit-nombre").value = pet.nombre || "";



  $("#edit-especie").value = pet.especie || "Otro";



  $("#edit-raza").value = pet.raza || "";



  $("#edit-fecha").value = formatDate(pet.fecha_nacimiento);

  $("#edit-peso").value = pet.peso_kg ?? "";
  $("#edit-vacunas").value = pet.vacunas || "";
  $("#edit-descripcion").value = pet.descripcion || "";



  $("#edit-contacto").value = pet.dueno_telefono || currentUser?.telefono || "";



  editPhotoPicker.reset(PawPhotos.petImages(pet));



  $("#modal-editar").hidden = false;



}



$("#btn-cancelar-modal").addEventListener("click", () => $("#modal-editar").hidden = true);



$("#form-editar-mascota").addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser || !pawStore.hasSession()) { showView("login"); return; }
  const button = $("#btn-guardar-modal"); if (button.disabled) return;
  button.disabled = true; editPhotoPicker.setBusy(true);
  try {
    const id = $("#edit-id").value;
    const fotos = await editPhotoPicker.save(file => uploadPetPhoto(file, id));
    const update = {
      nombre: $("#edit-nombre").value.trim(), especie: $("#edit-especie").value,
      raza: $("#edit-raza").value.trim(), fecha_nacimiento: $("#edit-fecha").value || null,
      dueno_telefono: $("#edit-contacto").value.trim(), peso_kg: $("#edit-peso").value ? Number($("#edit-peso").value) : null,
      vacunas: $("#edit-vacunas").value || null, descripcion: $("#edit-descripcion").value.trim() || null, fotos
    };
    await pawStore.savePet(id, update);
    $("#modal-editar").hidden = true; await cargarMascotas(currentUser.id);
  } catch (err) { alert("No fue posible modificar la mascota: " + err.message); }
  finally { button.disabled = false; editPhotoPicker.setBusy(false); }
});

async function deletePet(id) {



  const pet = mascotasUsuario.find(m => String(m.id) === String(id));



  if (!confirm(`¿Eliminar a ${pet?.nombre || "esta mascota"}?`)) return;



  try {



    await pawStore.deletePet(id);





    await cargarMascotas(currentUser.id);



  } catch (err) { alert("No fue posible eliminar la mascota: " + err.message); }



}



async function uploadPetPhoto(file) {
  return pawStore.uploadPhoto(file);
}

// --------------------------- Adopciones ---------------------------



function getAdoptionImages(item) {
  const images = Array.isArray(item?.images)
    ? item.images.filter(Boolean)
    : [];

  if (!images.length && item?.image) images.push(item.image);

  return images;
}

function getPrimaryAdoptionImage(item) {
  return getAdoptionImages(item)[0] || "";
}

function updateAdoptionScopeButtons() {
  $("#adoption-show-all")?.classList.toggle("active", adoptionViewMode === "all");
  $("#adoption-show-mine")?.classList.toggle("active", adoptionViewMode === "mine");
}

function renderAdoptions() {

  const q = normalize($("#adoption-search")?.value || "");
  const species = normalize($("#adoption-species-filter")?.value || "");
  const breed = normalize($("#adoption-breed-filter")?.value || "");
  const size = normalize($("#adoption-size-filter")?.value || "");
  const region = normalize($("#adoption-region-filter")?.value || "");
  const comuna = normalize($("#adoption-comuna-filter")?.value || "");

  updateAdoptionScopeButtons();

  let items = getAdoptions();

  if (adoptionViewMode === "mine") {
    if (!currentUser) {
      $("#adoption-list").innerHTML =
        `<div class="empty-state adoption-empty"><h3>Inicia sesión para ver tus publicaciones</h3><p>Desde aquí podrás editar, eliminar o cambiar el estado de tus avisos.</p></div>`;
      return;
    }

    items = items.filter(x => String(x.ownerId || "") === String(currentUser.id));
  } else {
    items = items.filter(x => !x.adopted);
  }

  items = items
    .filter(x => !species || normalize(x.species) === species)
    .filter(x => !breed || normalize(x.breed || "").includes(breed))
    .filter(x => !size || normalize(x.size || "") === size)
    .filter(x => !region || normalize(x.region || "") === region)
    .filter(x => !comuna || normalize(x.comuna || "") === comuna)
    .filter(x => !q || normalize(
      `${x.name || ""} ${x.breed || ""} ${x.age || ""} ${x.description || ""} ${x.species || ""} ${x.size || ""} ${x.region || ""} ${x.comuna || ""} ${x.vaccines || ""}`
    ).includes(q));

  const list = $("#adoption-list");

  if (!items.length) {
    list.innerHTML = adoptionViewMode === "mine"
      ? `<div class="empty-state adoption-empty"><h3>No tienes publicaciones con esos filtros</h3><p>Puedes crear una nueva publicación o limpiar los filtros actuales.</p></div>`
      : `<div class="empty-state adoption-empty"><h3>No encontramos mascotas con esos filtros</h3><p>Todos los filtros son opcionales. Puedes buscar solo por comuna, especie, raza, tamaño o combinarlos.</p></div>`;
    return;
  }

  list.innerHTML = items.map(x => {

    const shortDescription = (x.description || "").length > 95
      ? `${x.description.slice(0, 95).trim()}…`
      : (x.description || "Sin descripción disponible.");

    const primaryImage = getPrimaryAdoptionImage(x);
    const imageCount = getAdoptionImages(x).length;

    return `
      <article class="adoption-card ${x.adopted ? "is-inactive" : ""}">
        <div class="adoption-card-image">
          ${primaryImage
            ? `<img src="${escapeAttr(primaryImage)}" alt="${escapeAttr(x.name || "Mascota")}">`
            : `<div class="adoption-image-placeholder">🐾</div>`}

          <span class="adoption-type-badge">${escapeHtml(x.species || "Mascota")}</span>

          ${imageCount > 1
            ? `<span class="adoption-photo-count" title="${imageCount} fotos">📷 ${imageCount}</span>`
            : ""}

          ${adoptionViewMode === "mine"
            ? `<span class="publication-status ${x.adopted ? "inactive" : "active"}">${x.adopted ? "Adoptada" : "Publicada"}</span>`
            : ""}
        </div>

        <div class="adoption-card-body">
          <div class="adoption-card-title-row">
            <div>
              <h2>${escapeHtml(x.name || "Sin nombre")}</h2>
              <p class="adoption-breed">${escapeHtml(x.breed || "Raza no especificada")}</p>
            </div>
            ${x.age ? `<span class="adoption-age">${escapeHtml(x.age)}</span>` : ""}
          </div>

          <p class="adoption-description">${escapeHtml(shortDescription)}</p>

          <div class="adoption-card-meta">
            <span>📍 ${escapeHtml([x.comuna, x.region].filter(Boolean).join(", ") || "Ubicación no indicada")}</span>
            <span>📏 ${escapeHtml(x.size || "Tamaño no informado")}</span>
            ${x.vaccines ? `<span>💉 ${escapeHtml(x.vaccines)}</span>` : ""}
          </div>

          <button class="adoption-view-button" type="button" data-view-adoption="${escapeAttr(x.id)}">
            Ver ficha <span aria-hidden="true">→</span>
          </button>

          ${adoptionViewMode === "mine" && currentUser && String(x.ownerId) === String(currentUser.id) ? `
            <div class="adoption-owner-actions">
              <button type="button" data-edit-publication="adoption:${escapeAttr(x.id)}">Editar</button>
              <button type="button" class="${x.adopted ? "action-reactivate" : "action-adopt"}" data-adopted="${escapeAttr(x.id)}">${x.adopted ? "Reactivar publicación" : "Marcar como adoptada"}</button>
              <button type="button" data-delete-publication="adoption:${escapeAttr(x.id)}">Eliminar</button>
            </div>` : '<div class="adoption-owner-actions" aria-hidden="true"></div>'}
        </div>
      </article>`;

  }).join("");

}

function ensureAdoptionDetailModal() {

  if ($("#adoption-detail-modal")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="adoption-detail-modal" class="modal-overlay" hidden>
      <div class="modal-box adoption-detail-modal-box">

        <button class="modal-close" id="adoption-detail-close" type="button" aria-label="Cerrar">×</button>

        <div class="adoption-detail-layout">

          <div class="adoption-detail-media">
            <div id="adoption-detail-image" class="adoption-detail-image"></div>

            <button id="adoption-carousel-prev" class="adoption-carousel-arrow prev" type="button" aria-label="Foto anterior">‹</button>
            <button id="adoption-carousel-next" class="adoption-carousel-arrow next" type="button" aria-label="Foto siguiente">›</button>

            <div id="adoption-carousel-dots" class="adoption-carousel-dots"></div>
          </div>

          <div class="adoption-detail-content">

            <span id="adoption-detail-species" class="adoption-detail-kicker"></span>
            <h2 id="adoption-detail-name"></h2>
            <p id="adoption-detail-breed" class="adoption-detail-breed"></p>
            <p id="adoption-detail-description" class="adoption-detail-description"></p>

            <div class="adoption-detail-grid">
              <div><span>Edad</span><strong id="adoption-detail-age"></strong></div>
              <div><span>Ubicación</span><strong id="adoption-detail-comuna"></strong></div>
              <div><span>Tamaño</span><strong id="adoption-detail-size"></strong></div>
              <div><span>Esterilizado/a</span><strong id="adoption-detail-sterilized"></strong></div>
              <div><span>Vacunas</span><strong id="adoption-detail-vaccines"></strong></div>
            </div>

            <button id="adoption-detail-contact" class="btn btn-green" type="button">Contactar</button>

          </div>
        </div>
      </div>
    </div>
  `);

  $("#adoption-detail-close").addEventListener("click", () => {
    $("#adoption-detail-modal").hidden = true;
  });

  $("#adoption-detail-modal").addEventListener("click", (e) => {
    if (e.target.id === "adoption-detail-modal") $("#adoption-detail-modal").hidden = true;
  });

  $("#adoption-carousel-prev").addEventListener("click", () => {
    if (!adoptionCarouselState.images.length) return;
    adoptionCarouselState.index =
      (adoptionCarouselState.index - 1 + adoptionCarouselState.images.length) %
      adoptionCarouselState.images.length;
    renderAdoptionCarousel();
  });

  $("#adoption-carousel-next").addEventListener("click", () => {
    if (!adoptionCarouselState.images.length) return;
    adoptionCarouselState.index =
      (adoptionCarouselState.index + 1) %
      adoptionCarouselState.images.length;
    renderAdoptionCarousel();
  });

  $("#adoption-carousel-dots").addEventListener("click", (e) => {
    const dot = e.target.closest("[data-carousel-index]");
    if (!dot) return;

    const index = Number(dot.dataset.carouselIndex);
    if (!Number.isInteger(index)) return;

    adoptionCarouselState.index = index;
    renderAdoptionCarousel();
  });

}

function renderAdoptionCarousel() {
  const imageBox = $("#adoption-detail-image");
  const prev = $("#adoption-carousel-prev");
  const next = $("#adoption-carousel-next");
  const dots = $("#adoption-carousel-dots");

  if (!imageBox || !prev || !next || !dots) return;

  const images = adoptionCarouselState.images || [];
  const hasMany = images.length > 1;

  if (!images.length) {
    imageBox.innerHTML = `<div class="adoption-image-placeholder">🐾</div>`;
  } else {
    const current = images[adoptionCarouselState.index] || images[0];
    imageBox.innerHTML =
      `<img src="${escapeAttr(current)}" alt="${escapeAttr(adoptionCarouselState.name || "Mascota")}">`;
  }

  prev.hidden = !hasMany;
  next.hidden = !hasMany;

  let position = $("#adoption-carousel-position");
  if (!position) { position = document.createElement("p"); position.id = "adoption-carousel-position"; position.setAttribute("aria-live", "polite"); dots.after(position); }
  position.textContent = images.length ? (adoptionCarouselState.index + 1) + " / " + images.length : "";
  dots.innerHTML = hasMany
    ? images.map((_, index) =>
        `<button
          type="button"
          class="${index === adoptionCarouselState.index ? "active" : ""}"
          data-carousel-index="${index}"
          aria-label="Ver foto ${index + 1}"
        ></button>`
      ).join("")
    : "";
}

function openAdoptionDetail(id) {

  const item = getAdoptions().find(x => String(x.id) === String(id));

  if (!item) return;

  ensureAdoptionDetailModal();

  adoptionCarouselState = {
    images: getAdoptionImages(item),
    index: 0,
    name: item.name || "Mascota"
  };

  renderAdoptionCarousel();

  $("#adoption-detail-species").textContent = item.species || "Mascota";
  $("#adoption-detail-name").textContent = item.name || "Sin nombre";
  $("#adoption-detail-breed").textContent = item.breed || "Raza no especificada";
  $("#adoption-detail-description").textContent = item.description || "Sin descripción disponible.";
  $("#adoption-detail-age").textContent = item.age || "No indicada";
  $("#adoption-detail-comuna").textContent =
    [item.comuna, item.region].filter(Boolean).join(", ") || "No indicada";
  $("#adoption-detail-size").textContent = item.size || "No informado";
  $("#adoption-detail-sterilized").textContent = item.sterilized || "No informado";
  $("#adoption-detail-vaccines").textContent = item.vaccines || "No informado";

  $("#adoption-detail-contact").onclick = () => {
    $("#adoption-detail-modal").hidden = true;
    openContact("adoption", item.id);
  };

  $("#adoption-detail-modal").hidden = false;

}

$("#adoption-list").addEventListener("click", (e) => {



  const view = e.target.closest("[data-view-adoption]");



  const adopted = e.target.closest("[data-adopted]");



  const edit = e.target.closest("[data-edit-publication]");



  const del = e.target.closest("[data-delete-publication]");



  if (view) openAdoptionDetail(view.dataset.viewAdoption);



  if (adopted) markAdopted(adopted.dataset.adopted);



  if (edit) openPublicationEditor(edit.dataset.editPublication);



  if (del) deletePublication(del.dataset.deletePublication);



});



async function markAdopted(id){
  if(!currentUser||!pawStore.hasSession()||pendingAdoptionStates.has(id))return;
  const item=getAdoptions().find(row=>row.id===id);
  if(!item||String(item.ownerId)!==String(currentUser.id))return;
  pendingAdoptionStates.add(id);
  try{await pawStore.changePublicationState('adoption',id,!item.adopted);await loadAdoptions();}
  catch(error){alert('No se pudo cambiar el estado: '+error.message);}
  finally{pendingAdoptionStates.delete(id);}
}

// --------------------------- Hogares temporales ---------------------------



function updateHomeScopeButtons() {
  $("#home-show-all")?.classList.toggle("active", homeViewMode === "all");
  $("#home-show-mine")?.classList.toggle("active", homeViewMode === "mine");
}

function renderHomes() {

  const q = normalize($("#home-search")?.value || "");
  const species = normalize($("#home-species-filter")?.value || "");
  const size = normalize($("#home-size-filter")?.value || "");
  const region = normalize($("#home-region-filter")?.value || "");
  const comuna = normalize($("#home-comuna-filter")?.value || "");

  updateHomeScopeButtons();

  let items = getHomes();

  if (homeViewMode === "mine") {
    if (!currentUser) {
      $("#temporary-home-list").innerHTML =
        `<div class="empty-state"><h3>Inicia sesión para ver tus publicaciones</h3><p>Desde aquí podrás editar, eliminar o cambiar la disponibilidad de tus hogares temporales.</p></div>`;
      return;
    }

    items = items.filter(x => String(x.ownerId || "") === String(currentUser.id));
  } else {
    items = items.filter(x => normalize(x.availability) === "disponible");
  }

  items = items
    .filter(x => !species || normalize(x.species) === species)
    .filter(x => !size || normalize(x.size || "") === size)
    .filter(x => !region || normalize(x.region || "") === region)
    .filter(x => !comuna || normalize(x.comuna || "") === comuna)
    .filter(x => !q || normalize(
      `${x.name || ""} ${x.description || ""} ${x.species || ""} ${x.size || ""} ${x.region || ""} ${x.comuna || ""}`
    ).includes(q));

  const list = $("#temporary-home-list");

  if (!items.length) {
    list.innerHTML = homeViewMode === "mine"
      ? `<div class="empty-state"><h3>No tienes publicaciones con esos filtros</h3><p>Puedes ofrecer un nuevo hogar temporal o limpiar los filtros actuales.</p></div>`
      : `<div class="empty-state"><h3>No encontramos hogares temporales disponibles</h3><p>Todos los filtros son opcionales. Puedes buscar solo por comuna, especie, tamaño o combinar criterios.</p></div>`;
    return;
  }

  list.innerHTML = items.map(x => `
    <article class="home-card ${normalize(x.availability) !== "disponible" ? "is-inactive" : ""}">

      <div class="home-avatar">⌂</div>

      <div class="home-card-content">
        <div class="home-card-heading">
          <div>
            <h3>${escapeHtml(x.name || "Hogar temporal")}</h3>
            <div class="status ${normalize(x.availability) === "disponible" ? "" : "inactive"}">${escapeHtml(x.availability || "Disponible")}</div>
          </div>

          ${homeViewMode === "mine"
            ? `<span class="publication-status ${normalize(x.availability) === "disponible" ? "active" : "inactive"}">${escapeHtml(x.availability || "Disponible")}</span>`
            : ""}
        </div>

        <p>${escapeHtml((x.description || "").length > 150
          ? `${x.description.slice(0, 150).trim()}…`
          : (x.description || "Sin descripción disponible."))}</p>

        <div class="home-meta">
          <span class="tag">${escapeHtml(x.species || "Especie no indicada")}</span>
          <span class="tag">${escapeHtml(x.size || "Tamaño no indicado")}</span>
          <span class="tag">${escapeHtml([x.comuna, x.region].filter(Boolean).join(", ") || "Ubicación no indicada")}</span>
        </div>

        <div class="home-actions">
          <button class="btn btn-outline" type="button" data-view-home="${escapeAttr(x.id)}">Ver ficha</button>
          ${homeViewMode === "mine" ? `<button class="btn btn-coral" type="button" data-contact-home="${escapeAttr(x.id)}">Contactar</button>` : ""}

          ${homeViewMode === "mine" && currentUser && String(x.ownerId) === String(currentUser.id) ? `
            <button class="btn btn-green" type="button" data-toggle-home="${escapeAttr(x.id)}">Cambiar disponibilidad</button>
            <button class="btn btn-green" type="button" data-edit-publication="home:${escapeAttr(x.id)}">Editar</button>
            <button class="btn btn-coral" type="button" data-delete-publication="home:${escapeAttr(x.id)}">Eliminar</button>
          ` : ""}
        </div>
      </div>

    </article>`).join("");

}

function ensureHomeDetailModal() {

  if ($("#home-detail-modal")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="home-detail-modal" class="modal-overlay" hidden>
      <div class="modal-box home-detail-modal-box">

        <button class="modal-close" id="home-detail-close" type="button" aria-label="Cerrar">×</button>

        <div class="home-detail-header">
          <div class="home-detail-icon" aria-hidden="true">⌂</div>
          <div>
            <span class="adoption-detail-kicker">Hogar temporal</span>
            <h2 id="home-detail-name">Hogar temporal</h2>
            <span id="home-detail-status" class="home-detail-status">Disponible</span>
          </div>
        </div>

        <p id="home-detail-description" class="home-detail-description"></p>

        <div class="adoption-detail-grid home-detail-grid">
          <div><span>Especie aceptada</span><strong id="home-detail-species"></strong></div>
          <div><span>Tamaño aceptado</span><strong id="home-detail-size"></strong></div>
          <div><span>Ubicación</span><strong id="home-detail-location"></strong></div>
          <div><span>Disponibilidad</span><strong id="home-detail-availability"></strong></div>
        </div>

        <div class="home-detail-actions">
          <button id="home-detail-contact" class="btn btn-green" type="button">Contactar por WhatsApp</button>

        </div>

      </div>
    </div>
  `);

  $("#home-detail-close").addEventListener("click", () => {
    $("#home-detail-modal").hidden = true;
  });

  $("#home-detail-modal").addEventListener("click", (e) => {
    if (e.target.id === "home-detail-modal") $("#home-detail-modal").hidden = true;
  });

}

function openHomeDetail(id) {

  const item = getHomes().find(x => String(x.id) === String(id));

  if (!item) return;

  ensureHomeDetailModal();

  $("#home-detail-name").textContent = item.name || "Hogar temporal";
  $("#home-detail-status").textContent = item.availability || "Disponible";
  $("#home-detail-status").classList.toggle(
    "inactive",
    normalize(item.availability) !== "disponible"
  );

  $("#home-detail-description").textContent =
    item.description || "Sin descripción disponible.";

  $("#home-detail-species").textContent = item.species || "No indicada";
  $("#home-detail-size").textContent = item.size || "No indicado";
  $("#home-detail-location").textContent =
    [item.comuna, item.region].filter(Boolean).join(", ") || "No indicada";
  $("#home-detail-availability").textContent =
    item.availability || "Disponible";

  $("#home-detail-contact").onclick = () => {
    $("#home-detail-modal").hidden = true;
    openContact("home", item.id);
  };

  $("#home-detail-modal").hidden = false;

}

$("#temporary-home-list").addEventListener("click", (e) => {

  const view = e.target.closest("[data-view-home]");



  const contact = e.target.closest("[data-contact-home]");



  const toggle = e.target.closest("[data-toggle-home]");



  const edit = e.target.closest("[data-edit-publication]");



  const del = e.target.closest("[data-delete-publication]");



  if (view) openHomeDetail(view.dataset.viewHome);

  if (contact) openContact("home", contact.dataset.contactHome);



  if (toggle) toggleHomeAvailability(toggle.dataset.toggleHome);



  if (edit) openPublicationEditor(edit.dataset.editPublication);



  if (del) deletePublication(del.dataset.deletePublication);



});



async function toggleHomeAvailability(id){
  const item=getHomes().find(row=>row.id===id);
  if(!item||!currentUser||String(item.ownerId)!==String(currentUser.id)||pendingAdoptionStates.has(id))return;
  pendingAdoptionStates.add(id);
  try{await pawStore.changePublicationState('home',id,item.availability==='Disponible'?'No disponible':'Disponible');await loadAdoptions();}
  catch(error){alert('No se pudo cambiar la disponibilidad: '+error.message);}
  finally{pendingAdoptionStates.delete(id);}
}

// --------------------------- Mascota registrada para adopción ---------------------------

function getPublicationPetById(id) {
  return mascotasUsuario.find(m => String(m.id) === String(id)) || null;
}

function getPublicationSpeciesValue(species) {
  const select = $("#publication-species");
  if (!select) return species || "Otro";

  const normalized = normalize(species);
  const exact = Array.from(select.options).find(opt => normalize(opt.value) === normalized);
  if (exact) return exact.value;

  const legacyAliases = {
    "aves": "Ave",
    "reptiles": "Reptil",
    "peces": "Pez",
    "roedores": "Otro"
  };

  return legacyAliases[normalized] || "Otro";
}

function setPublicationPetFieldsLocked(locked) {
  const name = $("#publication-name");
  const species = $("#publication-species");
  const breed = $("#publication-breed");
  const age = $("#publication-age");

  if (name) name.readOnly = locked;
  if (species) species.disabled = locked;
  if (breed) breed.readOnly = locked;
  if (age) age.readOnly = locked;

  [name, species, breed, age].forEach(field => {
    if (!field) return;
    field.style.opacity = locked ? ".78" : "";
    field.title = locked ? "Dato cargado desde la ficha de la mascota" : "";
  });
}

function clearPublicationPetPreview() {
  const preview = $("#publication-pet-preview");
  const photoWrap = $("#publication-pet-photo-wrap");

  if (preview) preview.hidden = true;
  if (photoWrap) photoWrap.innerHTML = "🐾";
}

function showPublicationPetPreview(pet) {
  const preview = $("#publication-pet-preview");
  const photoWrap = $("#publication-pet-photo-wrap");
  const name = $("#publication-pet-preview-name");
  const info = $("#publication-pet-preview-info");

  if (!preview || !pet) return;

  if (photoWrap) {
    photoWrap.innerHTML = pet.foto_path
      ? `<img src="${escapeAttr(pet.foto_path)}" alt="${escapeAttr(pet.nombre || "Mascota")}" style="width:100%;height:100%;object-fit:cover;">`
      : "🐾";
  }

  if (name) name.textContent = pet.nombre || "Mascota";

  if (info) {
    const edad = calcularEdadMascota(pet.fecha_nacimiento);
    const peso = pet.peso_kg ? `${pet.peso_kg} kg` : "";
    const vacunas = pet.vacunas ? `Vacunas: ${pet.vacunas}` : "";
    info.textContent = [pet.especie, pet.raza, edad, peso, vacunas]
      .filter(Boolean)
      .join(" · ");
  }

  preview.hidden = false;
}

async function cargarMascotasParaPublicacion(selectedId = "") {
  const select = $("#publication-pet");
  const message = $("#publication-pet-message");

  if (!select || !currentUser) return;

  select.disabled = true;
  select.innerHTML = '<option value="">Cargando tus mascotas...</option>';

  if (message) message.hidden = true;

  try {
    const data = await pawStore.listPets();

    mascotasUsuario = (data || []).map(mergePetExtras);

    if (!mascotasUsuario.length) {
  select.innerHTML = '<option value="">No tienes mascotas registradas</option>';
  select.disabled = true;

  if (message) {
    message.textContent =
      "Primero debes registrar una mascota antes de crear una publicación de adopción.";
    message.className = "form-message";
    message.hidden = false;
  }

  clearPublicationPetPreview();
  return;
}

    select.innerHTML = '<option value="">Selecciona una mascota</option>' +
      mascotasUsuario.map(m =>
        `<option value="${escapeAttr(m.id)}">${escapeHtml(m.nombre || "Sin nombre")} · ${escapeHtml(m.especie || "Mascota")}</option>`
      ).join("");

    select.disabled = false;

    if (selectedId && mascotasUsuario.some(m => String(m.id) === String(selectedId))) {
      select.value = String(selectedId);
    }
  } catch (err) {
    select.innerHTML = '<option value="">No fue posible cargar tus mascotas</option>';
    select.disabled = true;

    if (message) {
      message.textContent = err.message || "No fue posible consultar las mascotas registradas.";
      message.className = "form-message error";
      message.hidden = false;
    }

    clearPublicationPetPreview();
  }
}

function applyRegisteredPetToPublication(petId, { clearWhenEmpty = true } = {}) {
  const pet = getPublicationPetById(petId);

  if (!pet) {
    clearPublicationPetPreview();
    setPublicationPetFieldsLocked(false);

    if (clearWhenEmpty && !editingPublicationId) {
      $("#publication-name").value = "";
      $("#publication-breed").value = "";
      $("#publication-age").value = "";
    }

    return;
  }

  $("#publication-name").value = pet.nombre || "";
  $("#publication-species").value = getPublicationSpeciesValue(pet.especie);
  $("#publication-breed").value = pet.raza || "";
  $("#publication-age").value = calcularEdadMascota(pet.fecha_nacimiento);

  if (["Sí", "No"].includes(pet.vacunas)) {
    $("#publication-vaccines").value = pet.vacunas;
  }

  setPublicationPetFieldsLocked(true);
  showPublicationPetPreview(pet);
}

$("#publication-pet")?.addEventListener("change", (e) => {
  applyRegisteredPetToPublication(e.target.value);
  if (!editingPublicationId) publicationPhotoPicker.reset(PawPhotos.petImages(getPublicationPetById(e.target.value)));
});

// --------------------------- Publicar / editar ---------------------------

$("#new-adoption").addEventListener("click", () => openPublicationEditor("adoption:new"));

$("#new-home").addEventListener("click", () => openPublicationEditor("home:new"));

$("#adoption-show-all")?.addEventListener("click", () => {
  adoptionViewMode = "all";
  renderAdoptions();
});

$("#adoption-show-mine")?.addEventListener("click", () => {
  if (!currentUser) {
    alert("Debes iniciar sesión para ver tus publicaciones.");
    showView("login");
    return;
  }

  adoptionViewMode = "mine";
  renderAdoptions();
});

$("#home-show-all")?.addEventListener("click", () => {
  homeViewMode = "all";
  renderHomes();
});

$("#home-show-mine")?.addEventListener("click", () => {
  if (!currentUser) {
    alert("Debes iniciar sesión para ver tus publicaciones.");
    showView("login");
    return;
  }

  homeViewMode = "mine";
  renderHomes();
});

$("#publication-close").addEventListener("click", () => {
  $("#publication-modal").hidden = true;
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#publication-modal").hidden) {
    $("#publication-modal").hidden = true;
    if (!$("#new-adoption").hidden) $("#new-adoption").focus();
  }
});

const publicationPhotoPicker = PawPhotos.createPicker($("#publication-image"), $("#publication-photo-previews"));
async function openPublicationEditor(key) {
  if (!currentUser || !pawStore.hasSession()) {
    alert("Debes iniciar sesión para crear o administrar publicaciones.");
    showView("login");
    return;
  }

  const [type, id] = key.split(":");
  const isAdoption = type === "adoption";
  const isHome = type === "home";

  editingPublicationId = id === "new" ? null : id;
  $("#publication-type").value = type;

  $("#publication-title").textContent = isAdoption
    ? (editingPublicationId ? "Editar publicación de adopción" : "Publicar mascota en adopción")
    : (editingPublicationId ? "Editar hogar temporal" : "Ofrecer hogar temporal");

  $("#publication-description").textContent = isAdoption
    ? "Selecciona una mascota registrada y completa los datos necesarios para publicarla en adopción."
    : "Indica la ubicación, mascotas que puedes recibir y tu disponibilidad.";

  $("#publication-name-label").textContent = isAdoption
    ? "Nombre de la mascota"
    : "Título del hogar temporal";

  $("#publication-size-label").textContent = isAdoption
    ? "Tamaño (opcional)"
    : "Tamaño aceptado";

  $("#publication-size").required = isHome;

  const petSelectorBox = $("#adoption-pet-selector");
  const petSelect = $("#publication-pet");

  /* Mascota registrada: obligatoria SOLO en adopciones */
  if (petSelectorBox) {
    petSelectorBox.style.display = isAdoption ? "block" : "none";
  }

  if (petSelect) {
    petSelect.required = isAdoption;
    petSelect.disabled = !isAdoption;

    if (!isAdoption) {
      petSelect.value = "";
    }
  }

  /* Campos exclusivos de adopción */
  $("#adoption-extra-fields").style.display = isAdoption ? "block" : "none";

  $("#publication-breed").required = isAdoption;
  $("#publication-breed").disabled = !isAdoption;

  $("#publication-age").required = isAdoption;
  $("#publication-age").disabled = !isAdoption;

  $("#publication-sterilized").disabled = !isAdoption;
  $("#publication-vaccines").disabled = !isAdoption;
  $("#publication-image").disabled = !isAdoption;

  /* Campo exclusivo de hogar temporal */
  $("#availability-label").style.display = isHome ? "block" : "none";
  $("#publication-availability").disabled = !isHome;

  if (!isAdoption) {
    clearPublicationPetPreview();
    setPublicationPetFieldsLocked(false);
  }

  const items = isAdoption ? getAdoptions() : getHomes();

  const item = editingPublicationId
    ? items.find(x => x.id === editingPublicationId && String(x.ownerId) === String(currentUser.id))
    : null;

  if (editingPublicationId && !item) { alert("No puedes editar esta publicación."); return; }
  $("#publication-name").value = item?.name || "";
  $("#publication-text").value = item?.description || "";
  $("#publication-species").value = item?.species || "Gato";
  $("#publication-size").value =
    item?.size || (isHome ? "Pequeño" : "");

  const publicationRegion =
    item?.region || inferRegionByCommune(item?.comuna || "");

  $("#publication-region").value = publicationRegion || "";

  populateCommuneSelect(
    $("#publication-comuna"),
    publicationRegion,
    { selected: item?.comuna || "" }
  );

  $("#publication-breed").value = item?.breed || "";
  $("#publication-age").value = item?.age || "";
  $("#publication-sterilized").value = item?.sterilized || "No informado";
  $("#publication-vaccines").value = item?.vaccines || "";
  publicationPhotoPicker.reset(isAdoption && item ? getAdoptionImages(item) : []);
  $("#publication-availability").value = item?.availability || "Disponible";

  /* WhatsApp: se puede modificar manualmente para cada publicación */
  $("#publication-phone").value =
    item?.contactPhone ||
    currentUser?.telefono ||
    currentUser?.phone ||
    "";

  if (isAdoption) {
    await cargarMascotasParaPublicacion(item?.petId || "");

    if (item?.petId) {
      applyRegisteredPetToPublication(item.petId, { clearWhenEmpty: false });
    } else {
      clearPublicationPetPreview();
      setPublicationPetFieldsLocked(false);
    }
  }

  $("#publication-modal").hidden = false;
}

$("#publication-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || !pawStore.hasSession()) { showView("login"); return; }
  const submit = e.target.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  try {

  const type = $("#publication-type").value;
  const isAdoption = type === "adoption";
  const items = isAdoption ? getAdoptions() : getHomes();

  const selectedPetId = isAdoption
    ? ($("#publication-pet")?.value || "")
    : "";

  const selectedPet = selectedPetId
    ? getPublicationPetById(selectedPetId)
    : null;

  if (isAdoption && !selectedPetId) {
    alert("Debes seleccionar una mascota registrada para publicarla en adopción.");
    return;
  }

  let item = editingPublicationId
    ? items.find(x =>
        x.id === editingPublicationId &&
        currentUser && String(x.ownerId) === String(currentUser.id)
      )
    : null;

  if (item) item={...item};
  if (!item) {
    item = {
      id: uid(),
      ownerId: currentUser.id,
      contact: `Contacto asociado a ${currentUser.email || currentUser.nombre}.`
    };


  }

  Object.assign(item, {
    name: $("#publication-name").value.trim(),
    description: $("#publication-text").value.trim(),
    species: $("#publication-species").value,
    size: $("#publication-size").value,
    region: $("#publication-region").value,
    comuna: $("#publication-comuna").value,
    contactPhone: $("#publication-phone").value.trim()
  });

  if (isAdoption) {
    item.petId = selectedPetId;
    item.breed = $("#publication-breed").value.trim();
    item.age = $("#publication-age").value.trim();
    item.sterilized = $("#publication-sterilized").value;
    item.vaccines = $("#publication-vaccines").value;
    item.adopted = item.adopted || false;

    publicationPhotoPicker.setBusy(true);
    const photos = await publicationPhotoPicker.save(file => pawStore.uploadPhoto(file));

    if (photos.length > 8) {
      alert("Puedes seleccionar hasta 8 fotos por publicación.");
      return;
    }

    item.images = photos; item.image = photos[0] || "";
  } else {
    item.availability = $("#publication-availability").value;
  }

  await pawStore.savePublication(type,item);
  await loadAdoptions();

  $("#publication-modal").hidden = true;
  editingPublicationId = null;

  if (isAdoption) {
    renderAdoptions();
  } else {
    renderHomes();
  }
  } catch (err) {
    alert(err.message || "No fue posible procesar las fotografías. Intenta nuevamente.");
  } finally {
    submit.disabled = false; publicationPhotoPicker.setBusy(false);
  }
});



async function deletePublication(key){
  if(!currentUser||!pawStore.hasSession())return;
  const separator=key.indexOf(':'),type=key.slice(0,separator),id=key.slice(separator+1);
  if(!['adoption','home'].includes(type)||!id)return;
  if(!confirm('¿Eliminar esta publicación?'))return;
  try{await pawStore.deletePublication(type,id);await loadAdoptions();}
  catch(error){alert('No se pudo eliminar la publicación: '+error.message);}
}

// --------------------------- Contacto ---------------------------

$("#contact-close").addEventListener("click", closeContact);

function closeContact() {
  $("#contact-modal").hidden = true;
}

function normalizeWhatsAppPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  // Chile: si viene como 9XXXXXXXX, agregar código país 56.
  if (/^9\d{8}$/.test(digits)) digits = `56${digits}`;

  return digits;
}

function buildWhatsAppMessage(type, item) {
  const subject = type === "adoption"
    ? `la adopción de ${item.name || "la mascota"}`
    : `el hogar temporal ${item.name || ""}`.trim();

  return `Hola, vi tu publicación en PawID y quisiera consultar por ${subject}.`;
}

function openContact(type, id) {
  const item = (type === "adoption" ? getAdoptions() : getHomes())
    .find(x => String(x.id) === String(id));

  if (!item) return;

  const phone = normalizeWhatsAppPhone(
    item.contactPhone ||
    item.phone ||
    item.telefono ||
    ""
  );

  const whatsappButton = $("#contact-ok");

  $("#contact-title").textContent =
    type === "adoption"
      ? `Contactar por ${item.name}`
      : `Contactar a ${item.name}`;

  if (!phone) {
    $("#contact-text").textContent =
      "Esta publicación todavía no tiene un número de WhatsApp asociado.";

    whatsappButton.textContent = "WhatsApp no disponible";
    whatsappButton.disabled = true;
    whatsappButton.onclick = null;
  } else {
    $("#contact-text").textContent =
      "Presiona el botón para conversar directamente por WhatsApp con la persona responsable.";

    whatsappButton.textContent = "Abrir WhatsApp";
    whatsappButton.disabled = false;

    whatsappButton.onclick = () => {
      const message = encodeURIComponent(buildWhatsAppMessage(type, item));
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

      const url = isMobile
        ? `https://wa.me/${phone}?text=${message}`
        : `https://web.whatsapp.com/send?phone=${phone}&text=${message}`;

      window.open(url, "_blank", "noopener,noreferrer");
      closeContact();
    };
  }

  $("#contact-modal").hidden = false;
}

// --------------------------- Búsqueda / filtros ---------------------------



["#adoption-species-filter","#adoption-size-filter"].forEach(sel => $(sel)?.addEventListener("change", renderAdoptions));



$("#adoption-breed-filter")?.addEventListener("input", renderAdoptions);



["#home-species-filter","#home-size-filter"].forEach(sel => $(sel)?.addEventListener("change", renderHomes));



$("#adoption-search")?.addEventListener("input", renderAdoptions);



$("#home-search")?.addEventListener("input", renderHomes);



// --------------------------- Utilidades ---------------------------



function escapeHtml(value) {



  return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));



}



function escapeAttr(value) { return escapeHtml(value); }



function formatDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // También entiende dd/mm/aaaa para registros provenientes de la app móvil.
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value).trim());
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
}



async function importBrowserData(){
  if(!currentUser)return;
  try{if(!await pawStore.ready()){alert('Primero activa la conexión con Supabase.');return;}}catch(error){alert(error.message);return;}
  if(!confirm('Se copiarán a Supabase los datos de tus mascotas y publicaciones de este navegador. Los originales se conservarán. ¿Continuar?'))return;
  const button=$('#import-browser-data');button.disabled=true;
  let imported=0,failed=0,skipped=0;
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
  async function storedImage(url){
    if(!String(url).startsWith('data:image/'))return url;
    const blob=await (await fetch(url)).blob();
    return pawStore.uploadPhoto(new File([blob],'importada.'+(blob.type.split('/')[1]||'jpg'),{type:blob.type}));
  }
  try{
    const owned=await pawStore.listPets(),extras=read('pawid_pet_extras',{});
    for(const pet of owned){
      const local=extras[pet.id];if(!local)continue;
      try{
        const existing=pet.fotos?.length?pet.fotos:(pet.foto_path?[pet.foto_path]:[]);
        const urls=[...new Set([...existing,...(Array.isArray(local.fotos)?local.fotos:[])])].slice(0,8);
        const fotos=[];for(const url of urls)fotos.push(await storedImage(url));
        await pawStore.savePet(pet.id,{...pet,peso_kg:pet.peso_kg??local.peso_kg??null,vacunas:pet.vacunas||local.vacunas||'',descripcion:pet.descripcion||local.descripcion||'',fotos});imported++;
      }catch{failed++;}
    }
    await loadAdoptions();
    for(const [key,type] of [['pawid_adoptions','adoption'],['pawid_homes','home']]){
      const locals=read(key,[]);if(!Array.isArray(locals))continue;
      for(const item of locals){
        if(String(item.ownerId)!==String(currentUser.id)||String(item.id).startsWith('demo-')){skipped++;continue;}
        const list=type==='adoption'?remoteAdoptions:remoteHomes;
        if(list.some(row=>row.id===item.id)){skipped++;continue;}
        if(type==='adoption'&&!owned.some(pet=>String(pet.id)===String(item.petId))){skipped++;continue;}
        try{
          const copy={...item};
          if(type==='adoption'){copy.images=[];for(const url of getAdoptionImages(item).slice(0,8))copy.images.push(await storedImage(url));copy.image=copy.images[0]||'';}
          await pawStore.savePublication(type,copy);imported++;
        }catch{failed++;}
      }
    }
    await loadAdoptions();refreshPetsView();
    alert('Importados: '+imported+'. Omitidos (ejemplos, ajenos o existentes): '+skipped+'. Pendientes por error: '+failed+'. Los originales siguen en este navegador.');
  }catch(error){alert('No se completó la importación: '+error.message);}
  finally{button.disabled=false;}
}
$('#import-browser-data')?.addEventListener('click',importBrowserData);

// --------------------------- Inicio ---------------------------



initializeLocationControls();



hydrateSession();



renderAdoptions();



renderHomes();



const initialHash = location.hash.replace("#", "").split("?")[0];



if (["login","mascotas","adopciones","hogares","registro"].includes(initialHash)) showView(initialHash);


