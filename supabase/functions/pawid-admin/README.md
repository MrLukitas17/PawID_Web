# PawID Admin — implementación local, sin desplegar

Función independiente de `pawid-api`. No modifica el inicio de sesión normal, cuentas,
relaciones, políticas antiguas, Storage, historial médico ni calendario.

## Autenticación

Todas las operaciones requieren `POST`, `Content-Type: application/json` y
`Authorization: Bearer <JWT de usuario de Supabase Auth>`.
La clave pública del proyecto puede viajar en `apikey`, pero no reemplaza al JWT.

En cada petición se ejecuta `admin.auth.getUser(jwt)` contra Supabase Auth y luego
se comprueba el UUID obtenido en `public.pawid_admins`. Solo entonces se procesa la
acción. No se autoriza por correo, metadatos, sesión normal de PawID ni localStorage.
La configuración local agrega `verify_jwt = true` únicamente para esta función;
la comprobación dentro del handler sigue siendo obligatoria.

El JWT entrante nunca se instala como sesión o cabecera global del cliente
privilegiado. El cliente no persiste ni renueva sesiones. Quitar un UUID de
`pawid_admins` impide su siguiente operación administrativa.

`OPTIONS` con un origen permitido solo responde al preflight CORS y no opera sobre
datos. Si no contiene `Origin`, también exige JWT y comprobación en `pawid_admins`.
Las respuestas usan `Cache-Control: no-store`. Los errores internos no se devuelven al navegador.

## Variables del servidor

| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto, proporcionada por el entorno de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secreto del servidor para consultar las tablas originales y moderar publicaciones. Nunca se incluye su valor en el código ni en respuestas. |
| `PAWID_ADMIN_ORIGINS` | Lista de orígenes exactos separados por comas. Por defecto: `http://localhost:5500,http://127.0.0.1:5500`. |

No necesita contraseñas, correo administrativo hardcodeado, claves de Google,
secretos de recuperación ni variables del login normal.

## CORS: desarrollo y producción

Configuración de desarrollo:

```dotenv
PAWID_ADMIN_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

La variable nueva reemplaza a `PAWID_ADMIN_ORIGIN`. Se admiten espacios alrededor
de cada entrada y se eliminan al leer la configuración. Una variable vacía, entradas
vacías o valores inválidos impiden iniciar la función. Los orígenes deben incluir
solo esquema HTTP(S), host y puerto cuando corresponda: sin ruta, barra final,
consulta, fragmento, credenciales ni comodines.

Cada `Origin` recibido se compara exactamente contra la lista. Solo si coincide,
la respuesta incluye `Access-Control-Allow-Origin` con ese mismo origen. Un origen
no autorizado recibe `403`, sin esa cabecera, antes de consultar Auth o las tablas.
Las cabeceras se crean de nuevo en cada petición y conservan `Vary: Origin`.
No se usa `*` ni se autoriza automáticamente ningún subdominio de Vercel.

Las solicitudes sin `Origin` no reciben `Access-Control-Allow-Origin`; para continuar
deben superar JWT y membresía administrativa. CORS no reemplaza esa autorización.

Cuando se conozca el dominio de producción de PawID, agregar su origen HTTPS exacto
como otra entrada separada por coma. No agregar `*.vercel.app`: los dominios de
preview u otros proyectos permanecen bloqueados salvo inclusión explícita.

## Contrato de acciones

El cuerpo es un objeto JSON con `action` y solamente los parámetros indicados.
No se admiten tablas, columnas, filtros arbitrarios, SQL, orden ni acciones adicionales.

| Acción | Parámetros adicionales | Operación |
| --- | --- | --- |
| `dashboard` | Ninguno | Totales de perfiles, mascotas, adopciones, hogares y artículos; identidad mínima del administrador. |
| `listar_usuarios` | `pagina`, `tamano_pagina`, `busqueda` opcionales | Datos básicos de `usuarios`, búsqueda por nombre/correo. |
| `listar_mascotas` | `pagina`, `tamano_pagina` opcionales | Mascotas y datos mínimos de su responsable. |
| `listar_adopciones` | `pagina`, `tamano_pagina` opcionales | Todas las adopciones, incluidas adoptadas, y responsable. |
| `eliminar_adopcion` | `id`, `confirmar: true` | Elimina exclusivamente la publicación identificada. |
| `listar_hogares` | `pagina`, `tamano_pagina` opcionales | Todos los hogares y su responsable. |
| `eliminar_hogar` | `id`, `confirmar: true` | Elimina exclusivamente el hogar identificado. |
| `listar_articulos` | `pagina`, `tamano_pagina` opcionales | Artículos publicados y borradores. |
| `crear_articulo` | `articulo` | Crea un artículo; devuelve `201`. |
| `editar_articulo` | `id`, `articulo` | Modifica solo los campos enviados y establece `updated_at` en el servidor. |
| `eliminar_articulo` | `id`, `confirmar: true` | Elimina exclusivamente el artículo identificado. |

Los IDs deben ser UUID. La interfaz futura deberá mostrar una confirmación antes
de enviar `confirmar: true`; el booleano expresa esa confirmación, no sustituye la autorización.
Las eliminaciones no borran propietarios, mascotas ni fotografías de Storage.

Los listados devuelven `{ok: true, items: [], pagina, tamano_pagina, total}`.
Página inicial: `1`; tamaño predeterminado: `25`; máximo: `100` por página.
La interfaz debe recorrer las páginas para mostrar más registros. El dashboard
utiliza conteos exactos sin descargar todas las filas. El total de usuarios cuenta
perfiles en `usuarios`, no cuentas de `auth.users`.

Ejemplo de artículo:

```json
{
  "action": "crear_articulo",
  "articulo": {
    "titulo": "Cuidados cotidianos",
    "contenido": "Texto informativo del artículo.",
    "imagen_url": "https://ejemplo.cl/imagen.jpg",
    "publicado": false
  }
}
```

`titulo` y `contenido` son obligatorios al crear (máximos de 180 y 30000 caracteres).
`imagen_url` es opcional: URL HTTP(S) absoluta sin credenciales; `null` o `""` la
eliminan. `publicado` es booleano y por defecto `false`. Al editar, los campos
omitidos se conservan. El contenido es texto: la futura interfaz debe renderizarlo
con `textContent`, sin interpretarlo como HTML. No se descargan imágenes en el servidor.

Errores: `400` parámetros/acción inválidos o falta de confirmación; `401` sin sesión
válida; `403` sin permiso/origen no permitido; `404` registro inexistente;
`405` método incorrecto; `413` cuerpo mayor de 128 KiB; `415` formato incorrecto;
`500` fallo interno con mensaje genérico. Cualquier error de Auth o de la consulta
de permisos impide operar sobre las tablas administrativas.

## Tablas y campos permitidos

- `pawid_admins`: solo consulta de `auth_user_id` para autorización.
- `usuarios`: `id`, `nombre`, `email`, `telefono`, `foto_path`, `foto_google`,
  `proveedor`, `created_at`. Los responsables asociados solo incluyen `id`, `nombre`, `email`.
- `mascotas`: identidad, propietario, especie, raza, nacimiento, fotos, peso,
  vacunas descriptivas y descripción existentes; solo lectura, sin consultar `historial_medico`.
- `publicacion_adopcion`: ficha, fotos, responsable y estado; lectura/eliminación.
- `publicaciones_hogares__temporales`: ficha, responsable y disponibilidad; lectura/eliminación.
- `articulos_sitio`: `id`, `titulo`, `contenido`, `imagen_url`, `publicado`,
  `created_at`, `updated_at`; lectura y gestión.

Las selecciones tienen columnas explícitas y las respuestas vuelven a aplicar una
lista de campos permitidos. No se consulta `usuarios.password`, tablas de sesiones,
tokens de recuperación, `auth.admin.listUsers`, `historial_medico` ni `calendario`.

## Preparación y pruebas locales

`scripts/Preparar-Admin.ps1` genera únicamente `supabase/dashboard/pawid-admin.ts`
para una futura revisión en el editor. No despliega y no genera ni modifica archivos
de `pawid-api`. El script existente `Preparar-Funciones.ps1` permanece igual.

Con Node.js 18 o posterior, ejecutar `node --test tests/admin.cjs` después de preparar
la copia. En este equipo también puede usarse el runtime Node integrado en VS Code:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Preparar-Admin.ps1
$env:ELECTRON_RUN_AS_NODE = '1'
& "$env:LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test tests/admin.cjs
```

La opción `ExecutionPolicy Bypass` solo se aplica al proceso que genera el archivo;
no cambia la política de ejecución del equipo.

Las pruebas usan Auth y tablas simuladas: no se conectan a Supabase, no necesitan
secretos y no modifican datos reales. Incluyen rechazo de usuarios sin permiso,
revocación de membresía entre peticiones, protección de campos, paginación,
moderación confirmada, validaciones y ciclo de artículos con imagen.
También verifican ambos orígenes de desarrollo, un origen HTTPS configurado de
prueba, rechazo de dominios y puertos ajenos, respuestas sin cabecera CORS cuando
corresponde, solicitudes sin `Origin` y aislamiento entre peticiones concurrentes.

Esta entrega no incluye despliegue, pruebas con credenciales reales ni la interfaz administrativa.
