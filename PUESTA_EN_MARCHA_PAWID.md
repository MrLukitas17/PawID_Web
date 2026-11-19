> Documento histórico anterior al cambio del 28/10/2026. Para la integración actual consultar CONECTAR_SUPABASE.md; no seguir las migraciones de esta guía.

PawID: puesta en marcha, un paso a la vez

ALTERNATIVA INACTIVA. La versión actual vuelve a utilizar el sistema existente y no necesita estos cambios externos. Consultar LEEME_SIN_CAMBIOS_EN_SUPABASE.md. No ejecutar las migraciones ni despliegues de esta guía para usar la carpeta actual.

Estado revisado el 20 de octubre de 2026. No se ejecutaron migraciones ni despliegues. No se solicitaron contraseñas ni claves secretas.

1. PRIMER PASO: identificar el proyecto

Entrar a https://supabase.com/dashboard y abrir el proyecto cuya referencia es ujsokaxksqwqojvctvtx. La referencia se ve en la dirección del navegador. En Project Settings > General, revisar el nombre. Confirmar si la web o la app con usuarios reales usa ese proyecto. El nombre por sí solo no demuestra que sea de pruebas.

El código actual apunta a esa única referencia. No hay un proyecto de pruebas identificado ni un enlace de Supabase CLI instalado. Hasta confirmar su uso, se considera potencialmente real. No ejecutar migraciones, crear proyectos pagos ni desplegar funciones durante este primer paso. No cambiar todavía js/config.js.

2. Qué se comprobó realmente y por qué no entra el login

Se hicieron únicamente GET de lectura con la clave pública existente y consultas select con limit=0. No se descargaron filas de usuarios, contraseñas ni mascotas.

| Comprobación contra Supabase | Resultado |
| --- | --- |
| GET /functions/v1/pawid-api | HTTP 404: función no disponible en esa dirección |
| GET /functions/v1/password-recovery | HTTP 404: función no disponible en esa dirección |
| Consultar mascotas.id sin filas | HTTP 200 |
| Consultar public_id, fotos, peso_kg, vacunas y descripcion por separado, sin filas | HTTP 400 en las cinco columnas; la consulta inicial devolvió 42703, columna inexistente |
| Columnas que usa el login en usuarios, sin filas | HTTP 200 |
| Configuración pública de Auth: Google | Proveedor habilitado; no prueba que su callback o credenciales externas funcionen |

El siguiente diagnóstico SQL confirma el esquema de la base, sus defaults y políticas; evita confundir una falta de columnas con un problema de esquema expuesto o caché. Las tablas de sesiones y adopciones, sus permisos y el bucket no se pudieron verificar con acceso administrativo.

El login original comparaba el SHA-256 de la contraseña consultando public.usuarios desde el navegador. En el cambio anterior lo trasladé a pawid-api para que el servidor verifique la contraseña y emita una sesión. Esa sesión permite comprobar al propietario al guardar, editar y reactivar. Google también necesita esa sesión después de verificar Google y la contraseña adicional de PawID. El cambio se dejó sin desplegar el backend, por eso el inicio de sesión ahora falla. El código nuevo conserva las cuentas y hashes existentes; no requiere crear las cuentas de nuevo ni cambiar sus contraseñas.

3. Inspeccionar sin modificar nada

Después de confirmar el proyecto, entrar a SQL Editor > New query. Abrir supabase/diagnostics/01_revisar_sin_cambiar.sql en este proyecto, copiar su contenido al editor y ejecutar solamente ese diagnóstico. Todos sus comandos son SELECT. Revisar en particular el tipo/default/longitud de mascotas.id, las columnas existentes, las relaciones, los triggers y el bucket mascotas-fotos. No ejecutar aún los archivos de migrations.

Se puede compartir el resultado de estructura para revisar el siguiente paso; no compartir filas de usuarios, archivos de respaldo, contraseñas, claves ni secretos. El diagnóstico no selecciona esos datos. Los scripts locales Comprobar-Supabase.ps1 y Preparar-Funciones.ps1 no requieren claves secretas en el chat.

4. Antes de cualquier cambio en el proyecto real: respaldar

Confirmar primero un respaldo recuperable y probar su restauración en un entorno separado. No pulsar Restore en el proyecto real para hacer esta prueba: una restauración cambia la base.

Base de datos: abrir Database > Backups y revisar la fecha del respaldo disponible. Las opciones dependen del plan. Un backup físico puede no ofrecer descarga. Si no hay un respaldo recuperable, preparar un volcado lógico con las herramientas oficiales antes de continuar. Las credenciales necesarias se introducen únicamente en el terminal local o en Supabase. Un CSV de una tabla no reemplaza un respaldo completo: faltan relaciones, funciones, políticas y otras tablas. Ver https://supabase.com/docs/guides/platform/backups y https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore.

Fotos: abrir Storage > Files > mascotas-fotos y descargar los archivos, conservando carpetas y nombres. Para pocos archivos se pueden seleccionar desde el panel; para muchos, usar el procedimiento oficial de descarga/migración. El respaldo de PostgreSQL NO contiene los archivos de Storage, solo sus metadatos. Ver https://supabase.com/docs/guides/storage/management/download-objects.

Publicaciones locales: las adopciones que todavía solo están en el navegador no aparecen en el respaldo de Supabase. Abrir la web PawID en el navegador y dominio donde se publicaron, abrir su consola de desarrollador y ejecutar scripts/Respaldar-Publicaciones-Navegador.js. Descarga pawid-publicaciones-respaldo.json sin enviarlo a ningún servicio ni incluir sesiones. Conservar ese archivo privadamente; puede contener fotografías y datos de contacto. No borrar datos del navegador ni cambiar de dominio antes del respaldo. Este paso puede hacerse acompañado si no se conoce la consola.

Código y funciones: conservar una copia de esta carpeta. En Edge Functions, descargar las funciones existentes antes de reemplazarlas. Guardar localmente sus valores de configuración si ya existen, sin pegarlos en el chat ni versionarlos. Los respaldos privados se guardan fuera del repositorio o en backups/, que está excluido.

5. Preparar pruebas sin tocar la base real

Si el proyecto confirmado es real, acordar primero un proyecto separado de pruebas y cómo copiar el esquema, las funciones y los archivos necesarios. Una base vacía no tiene public.usuarios ni public.mascotas: estas migraciones amplían esas tablas, no crean todo PawID. Las ramas de Supabase tampoco garantizan copiar los datos o fotos; no asumirlo. No copiar datos personales reales a pruebas sin decidir qué se necesita. No crear un proyecto con costo sin autorización.

Una vez identificado el destino de pruebas, editar únicamente los valores públicos de js/config.js: supabaseUrl, publishableKey y environment='pruebas'. La clave publishable del nuevo proyecto se obtiene en Project Settings > API Keys. Jamás usar secret o service_role en ese archivo. Esta separación evita tener que editar dos scripts con referencias distintas.

6. Qué cambiarán las migraciones, antes de ejecutarlas

202610200001_public_ids_recovery.sql agrega el ID público numérico a las mascotas, rellena los registros anteriores y prepara la recuperación por enlace. Conserva los IDs existentes y sus relaciones. Si falta generador del ID interno, solo agrega UUID cuando el tipo y longitud lo permiten; en otros casos cancela para revisión. No cambia contraseñas existentes. Agrega una secuencia, un índice único, un trigger y una tabla/función de recuperación.

202610200002_photos_adoptions.sql agrega fotos, peso, vacunas y descripción. Copia la foto actual a la galería de cada mascota sin borrar el archivo. Crea pawid_web_sessions y adopciones_web, protegidas sin acceso directo de anon/authenticated. Agrega un trigger que revoca las sesiones nuevas cuando se cambia una contraseña. La tabla nueva de adopciones empieza vacía; las publicaciones locales con mascota y propietario válidos se importan después del login. Los originales locales se conservan. Las publicaciones sin petId no se asignan a nadie automáticamente.

Ninguna migración borra tablas, mascotas, fotos, relaciones o cuentas. Ambas modifican estructura y pueden bloquear brevemente las tablas mientras se ejecutan: en el proyecto real, elegir un momento acordado. No ejecutar una migración ya aplicada, ni corregir errores eliminando tablas o columnas.

Después de revisar el diagnóstico y el respaldo, en el proyecto DE PRUEBAS abrir SQL Editor, ejecutar la migración 001 que falte y luego la 002 que falte, una por vez. Si hay error, detenerse y conservar el mensaje; no ejecutar SQL correctivo improvisado. Si el esquema real tiene particularidades, adaptar los archivos antes de aplicarlos. Las migraciones aún no se han probado contra PostgreSQL.

7. Configurar las funciones en pruebas

Entrar a Edge Functions > Secrets. Agregar PAWID_APP_URL con la dirección completa desde la que se abre PawID, por ejemplo http://localhost:8080/templates/index.html si ese es el servidor local usado realmente. No usar ese ejemplo si la web se abre en otro puerto o dominio. Este valor controla el origen permitido por CORS y los enlaces de recuperación. Supabase inyecta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY; no copiarlas a JS ni al chat. PAWID_PHOTO_BUCKET es opcional y por defecto vale mascotas-fotos.

En Storage revisar que el bucket original existe y cómo está configurada su privacidad. El proyecto usa URLs públicas para mostrar fotos. Si el bucket es privado, detenerse y decidir la solución antes de cambiar su privacidad: hacerlo público puede exponer fotos existentes. La función nueva detecta este caso y no lo cambia automáticamente. Las nuevas subidas usan autorización firmada por archivo y propietario; no es necesario permitir INSERT anónimo en Storage. Ver https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl.

La recuperación necesita además RESEND_API_KEY y PAWID_EMAIL_FROM, con un remitente verificado. Se configuran solo en el panel de secretos. Esta función no es necesaria para el login normal, pero sí para que funcione ¿Olvidaste tu contraseña?.

8. Preparar y desplegar la función en pruebas

Los archivos supabase/dashboard/pawid-api.ts y password-recovery.ts están preparados para copiarse completos, sin imports de archivos locales. Si se modifica el código fuente, regenerarlos desde el terminal de la carpeta del proyecto con:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Preparar-Funciones.ps1

Este comando solo escribe esos dos archivos locales. No inicia sesión, no conecta con Supabase y no despliega.

En Edge Functions seleccionar Deploy a new function > Via Editor. Usar el nombre exacto pawid-api y reemplazar el ejemplo por el contenido completo de supabase/dashboard/pawid-api.ts. Desplegar en el proyecto de pruebas. En la configuración de ESA función, desactivar la verificación automática de JWT heredado, equivalente a verify_jwt=false de supabase/config.toml. La clave publishable no es la sesión del usuario: esta API valida su propia sesión emitida después de comprobar la contraseña. No desactivar JWT globalmente para otras funciones.

Repetir con nombre password-recovery y su archivo cuando esté configurado el correo; también usa verify_jwt=false porque quien recupera todavía no tiene sesión y el cambio requiere un token de un solo uso. El editor del panel no aplica automáticamente el config.toml local. Referencia: https://supabase.com/docs/guides/functions/quickstart-dashboard.

Si ya existe una función con ese nombre, descargarla y comparar primero: Deploy updates reemplaza la versión anterior. El despliegue por sí solo no ejecuta migraciones ni rellena tablas, pero habilita operaciones de lectura/escritura para las solicitudes autorizadas y puede activar la importación local al iniciar sesión. Por eso tampoco se despliega en el proyecto real antes del respaldo y la aprobación del cambio concreto.

9. Verificar antes de usar cuentas reales

Abrir la URL https://REFERENCIA-DE-PRUEBAS.supabase.co/functions/v1/pawid-api. GET ahora ejecuta un diagnóstico de solo lectura. Debe devolver ready=true y checks preparados. ready=false muestra qué tabla o bucket falta; no solicitar contraseñas para diagnosticarlo. También se puede usar Edge Functions > pawid-api > Test con POST y cuerpo {"action":"health"}. Nunca poner una contraseña en una URL ni en el chat.

Con una cuenta de prueba existente, entrar desde la web y escribir la contraseña allí. Registrar una mascota de prueba con dos fotos, editar sin cambiar fotos, luego quitar una y agregar otra. Recargar y abrir la ficha. Publicarla, marcarla adoptada y reactivarla. Comprobar su regreso desde una ventana invitada después de recargar. Con otra cuenta de prueba, verificar que no puede modificar la publicación. Estas comprobaciones escriben datos: hacerlas solo en el proyecto de pruebas confirmado.

Si todo pasa, revisar juntos el diagnóstico y los respaldos del proyecto real. Antes de aplicar cada migración o despliegue real se confirma su efecto específico y el momento. No subir la web hasta esa revisión. Se conservan los pasos anteriores como evidencia y forma de recuperación; no se propone un rollback que borre datos nuevos.

10. Qué quedó comprobado aquí

SIMULADO: las suites de JavaScript, API, servidor y Chrome verifican login, sesión, permisos, fotos múltiples, guardar/editar, adoptar/reactivar, recarga, controles por sesión y diseño. Los servicios de Chrome se reemplazan por mocks. Los uploads firmados también se prueban simulados. Los resultados actuales se registran en LEEME_FOTOS_Y_ADOPCIONES.md.

SUPABASE REAL, SOLO LECTURA: disponibilidad de las funciones, columnas con cero filas y configuración pública de Google, contra la referencia indicada. El uso real o de pruebas de esa referencia aún requiere confirmación del usuario.

NO REALIZADO CONTRA SUPABASE: login con una contraseña real, creación o edición de mascotas, carga de fotos, publicación, adoptar/reactivar, recuperación por correo, SQL de diagnóstico administrativo, migraciones y despliegues. Tampoco se comprobó el callback real de Google. No hay credenciales administrativas ni conexión del panel disponibles en esta sesión.
