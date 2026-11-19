# 🐾 PawID — Plataforma web

Sitio web de PawID: landing informativa, cuenta del usuario, mascotas, adopciones, hogares temporales, noticias y panel de administración. Comparte el backend (Supabase) y las cuentas con la aplicación móvil.

Proyecto de Título · Ingeniería en Informática · INACAP · Grupo G04 · 2026

- **Producción:** https://beta2-flax-one.vercel.app
- **Aplicación móvil:** https://github.com/MrLukitas17/PawID_V2

---

## 1. Componentes

| Componente | Tecnología | Dónde se ejecuta |
|---|---|---|
| Páginas | HTML5, CSS3 y JavaScript (sin compilación) | Vercel |
| Noticias (`api/news.js`) | Función serverless de Node.js (consulta RSS) | Vercel |
| API del sitio (`pawid-api`) | Edge Function de Supabase (Deno) con `service_role` | Supabase |
| Panel de administración (`pawid-admin`) | Edge Function de Supabase | Supabase |
| Base de datos, autenticación y fotos | Supabase: PostgreSQL, Auth y Storage (`mascotas-fotos`) | Supabase (compartido con la app) |

El navegador solo usa la clave **pública** (`publishable`). Las lecturas y escrituras de mascotas, publicaciones, perfil y fotos pasan por `pawid-api`, que valida al propietario en el servidor. Por eso las políticas RLS de las tablas no afectan al sitio.

## 2. Estructura

```
templates/            Páginas: index.html, registrar-mascota.html, admin.html, conocer-mas.html
css/  img/            Estilos e imágenes
js/
├── config.js         Configuración PÚBLICA (URL de Supabase y clave publishable)
├── store.js          Conexión con pawid-api y Supabase Auth
├── app.js            Lógica de la interfaz (cuenta, mascotas, adopciones, hogares)
├── google-auth.js    Inicio de sesión con Google
├── admin.js          Panel de administración
└── news.js           Noticias
api/news.js           Función serverless de noticias (Vercel)
supabase/
├── functions/        Código fuente de las Edge Functions
├── dashboard/        Copias listas para pegar en el editor de Supabase
└── migrations/       Cambios de esquema ya aplicados
tests/                Pruebas automatizadas (Node.js)
vercel.json           "/" abre templates/index.html
```

## 3. Autenticación (igual que la app móvil)

| Proceso (BPMN) | Cómo funciona |
|---|---|
| Crear cuenta | `pawid-api` crea la cuenta en **Supabase Auth** (contraseña con bcrypt) y su perfil en `usuarios`; si el correo existe: "Ya existe una cuenta asociada a ese correo" |
| Iniciar sesión | Supabase Auth valida correo y contraseña; `pawid-api` emite la sesión del sitio |
| Google | Supabase Auth (OAuth) verifica la identidad; la cuenta se liga a la que tenga el mismo correo (**un correo = una cuenta**), sin contraseña adicional |
| Cambiar contraseña | Correo registrado → código de 6 dígitos al correo → se valida → nueva contraseña |

Requisitos de contraseña: mínimo 10 caracteres, con una mayúscula, una minúscula, un número y un carácter especial (los mismos que la app).

## 4. Despliegue

### 4.1 Requisitos previos (una vez)

En Supabase ya deben estar aplicados los scripts del repositorio de la app (`supabase/migrations` de PawID_V2: `ficha_publica`, Parte 1 de autenticación y, al final, la Parte 2 de RLS) y la configuración de Auth (Confirm email desactivado, Google, SMTP y plantilla del código).

### 4.2 Edge Function `pawid-api`

1. Supabase → **Edge Functions → pawid-api** → editar el código.
2. Reemplazar todo por el contenido de `supabase/dashboard/pawid-api.ts` y presionar **Deploy**.
3. En la configuración de la función, **Verify JWT** debe quedar **desactivado** (equivale a `verify_jwt = false`).
4. **Edge Functions → Secrets:** `PAWID_APP_URL` con las direcciones autorizadas, separadas por coma:
   ```
   https://beta2-flax-one.vercel.app,http://localhost:5500
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las entrega Supabase automáticamente; no se copian a ningún archivo.
5. Comprobar: abrir `https://<proyecto>.supabase.co/functions/v1/pawid-api` → debe responder `"ready": true` y `"version": 4`.

Si se modifica `supabase/functions/pawid-api/`, regenerar la copia con `scripts/Preparar-Funciones.ps1`.

### 4.3 Sitio en Vercel

1. Vercel → **Add New → Project** → importar este repositorio.
2. **Framework Preset:** Other. Sin comando de compilación ni variables de entorno (`js/config.js` solo tiene datos públicos).
3. **Deploy.** Cada *push* a `main` publica la nueva versión.
4. En Supabase → **Authentication → URL Configuration → Redirect URLs** debe estar la dirección del sitio (`https://beta2-flax-one.vercel.app/#login`) para el retorno de Google.

### 4.4 Ejecutar en local

Abrir la carpeta con un servidor estático en el puerto 5500 (por ejemplo, Live Server de VS Code) y entrar a `http://localhost:5500/templates/index.html`.

## 5. Pruebas automatizadas

```
node tests/adoptions.cjs     # servidor pawid-api: sesiones, permisos, autenticación
node tests/checks.cjs        # interfaz
node tests/recovery.cjs      # cambio de contraseña con código
node tests/store.cjs
node tests/import.cjs
node tests/admin.cjs
```

## 6. Problemas frecuentes

| Problema | Solución |
|---|---|
| "No se pudo conectar con Supabase" en el sitio publicado | Revisar que `PAWID_APP_URL` incluya la dirección exacta del sitio (sin "/" al final) |
| Google vuelve al login sin entrar | Agregar la dirección del sitio en *Redirect URLs* de Supabase |
| No llega el código de recuperación | Revisar spam y la configuración SMTP de Supabase |
| Los cambios no se ven | Recargar con Ctrl + F5 (los scripts tienen versión `?v=` para evitar la caché) |
