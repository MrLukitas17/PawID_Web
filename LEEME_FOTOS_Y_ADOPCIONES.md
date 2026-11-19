> Actualización 28/10/2026: la integración real ya está aplicada. Consultar CONECTAR_SUPABASE.md para el estado vigente; el resto de este archivo es histórico.

Cambios del 20 de octubre de 2026: fotos y adopciones

VERSIÓN ACTUAL SIN MIGRACIONES: ver LEEME_SIN_CAMBIOS_EN_SUPABASE.md. Se retiró la dependencia de pawid-api y se restauró el acceso compatible. El resto de este documento describe la alternativa de servidor anterior, inactiva; no ejecutar sus pasos para usar la versión actual.

Puesta en marcha posterior: seguir PUESTA_EN_MARCHA_PAWID.md. Se detectaron funciones no disponibles (404) y columnas nuevas rechazadas por la API del proyecto configurado. Aún no se ha identificado ese proyecto como real o de pruebas. La conexión pública se centralizó en js/config.js; la lectura de mascotas y autorización de subidas pasan ahora por pawid-api, sin requerir permisos anónimos de carga. Los archivos de supabase/dashboard se generan localmente para el editor del panel. No se ejecutaron migraciones ni despliegues.

Esta actualización completa y reemplaza las indicaciones anteriores sobre almacenamiento local de adopciones. No se publicó el sitio ni se ejecutó SQL contra Supabase.

Archivos de la aplicación modificados:

- js/app.js: conserva las fotos al editar, carrusel de mascotas, publicación y estados en servidor, controles según sesión y cierre con Escape.
- js/registrar-mascota.js: registro con varias fotos y vista previa; propietario comprobado por el servidor.
- js/google-auth.js: obtiene una sesión de servidor después de verificar el acceso de Google y su contraseña adicional de PawID.
- templates/index.html: controles ocultos inicialmente para invitados, recuperación al final del formulario, encabezado con X y galería en edición.
- templates/registrar-mascota.html: selector múltiple y vista previa.
- css/styles.css: acciones centradas, colores de hover/foco, tarjetas uniformes y encabezado sin superposiciones.
- supabase/config.toml: configuración de la nueva función pawid-api.

Archivos nuevos:

- js/photos.js: único selector compartido por registro, modificación y publicación; conserva URLs existentes, añade nuevas y elimina solo por acción explícita. Incluye carrusel reutilizable para fichas de mascotas.
- js/adoptions-api.js: comunicación con el servidor y sesión persistente.
- supabase/functions/pawid-api/index.ts y handler.js: validación de credenciales y propietario, consultas públicas y privadas, registro/edición de mascotas, publicación, eliminación y cambios de estado. Solo se actualiza adopted al adoptar/reactivar; no se toca el contenido ni las fotos.
- supabase/migrations/202610200002_photos_adoptions.sql: fotos JSON, adopciones persistentes y sesiones de servidor, con tablas protegidas por RLS y acceso exclusivo de service_role. Conserva foto_path como portada para clientes antiguos. Al cambiar contraseña se revocan las sesiones nuevas.
- tests/adoptions.cjs: pruebas de autorización, persistencia y visibilidad con base simulada.
- tests/browser-mocks.js, browser-checks.js y browser-checks.ps1: verificaciones en Chrome con la interfaz real y servicios simulados, sin acceso al backend real. Generan capturas locales en tests/browser-artifacts/.
- .gitignore: excluye los perfiles y resultados temporales del navegador.
- tests/checks.cjs: actualizado para probar el selector compartido y conservar las comprobaciones anteriores.

Configuración y migración pendientes

1. Revisar y aplicar las migraciones 202610200001 y 202610200002 en orden en una base de pruebas. Si la primera ya fue aplicada, ejecutar solo la segunda. No repetir migraciones que ya estén registradas. No hay borrados ni conversiones de IDs de mascotas existentes.
2. Configurar PAWID_APP_URL con la URL completa del index del entorno de pruebas. Supabase provee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY al servidor; nunca incluir la clave de servicio en JS público. Desplegar pawid-api con la configuración verify_jwt=false incluida. Las acciones privadas validan su propio token porque las cuentas existentes usan public.usuarios y no una sesión Supabase Auth para el acceso por correo.
3. El login por correo conserva las cuentas existentes y compara su SHA-256 en el servidor. Google sigue verificándose mediante Supabase Auth y su contraseña adicional de PawID. Las sesiones previas guardadas únicamente como pawid_user requieren iniciar sesión otra vez. Sin desplegar pawid-api, no estarán disponibles el login ni las escrituras nuevas.
4. Revisar las políticas existentes de usuarios, mascotas y el bucket mascotas-fotos en pruebas: el esquema remoto y sus políticas no están en el repositorio. La carga de fotos conserva el bucket existente y usa una autorización firmada por archivo, emitida tras validar la sesión; no requiere cargas anónimas. La lectura de mascotas también pasa por el servidor. Las tablas nuevas no permiten acceso directo de anon/authenticated; la API no acepta ownerId como prueba de identidad. Configurar límites de solicitudes del entorno para el endpoint de login y limpieza periódica de sesiones vencidas. Se conserva el sistema de autenticación heredado; no es una migración integral de sus políticas.
5. Las publicaciones locales con petId válido se importan al iniciar sesión, solo después de verificar que la mascota pertenece al usuario. El respaldo local no se borra. Los identificadores importados se registran para evitar que reaparezca una publicación eliminada. Las publicaciones antiguas sin una mascota asociada necesitan revisión manual; no se asigna un propietario por confianza en localStorage.
6. La recuperación conserva la función password-recovery previa y su configuración de correo pendiente (Resend); esta actualización solo mueve el enlace.

Pruebas

- node tests/checks.cjs: selector múltiple, conservación de fotos existentes, eliminación/adición, límites, carrusel, compatibilidad de una foto y recuperación con servidor simulado.
- node tests/adoptions.cjs: invitado, propietario ajeno, adoptar/reactivar, permanencia en una instancia nueva, conservación del contenido, edición de fotos, login/logout y controles según sesión.
- node tests/api.cjs: errores reales del servidor, función no desplegada, sesión y subida firmada.
- powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/browser-checks.ps1 -Width 1280
- powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/browser-checks.ps1 -Width 390

Las pruebas de Chrome cargan JS y CSS reales con servicios totalmente simulados. Hacen una recarga real para verificar la reactivación, comparan alturas, comprueban colores finales de foco, visibilidad por sesión, galerías, carrusel, posición de la X y ausencia de desbordamiento. Se desactivan las transiciones solo en el entorno de prueba para medir los colores finales. El área de contenido se fija exactamente al ancho solicitado mediante un iframe; no depende del tamaño mínimo de ventana de Chrome en Windows.

Resultados actualizados: 24 comprobaciones de JavaScript, 29 del servidor simulado y 5 de la API cliente correctas; 32 comprobaciones de navegador a 1280 px y 32 a 390 px, incluyendo selección de archivos y guardado desde los formularios de publicación y modificación. Las suites CJS se ejecutaron en el motor JavaScript de las herramientas porque no hay Node instalado. El archivo generado para el editor también se compiló y su GET health se ejecutó con dependencias simuladas, tras quitar únicamente imports y aserciones TypeScript para esa comprobación. No hay Deno instalado para la comprobación de tipos. No se ejecutaron migraciones, login ni escrituras contra Supabase, almacenamiento o correo reales. Sí se realizaron consultas reales de solo lectura con cero filas y lecturas de configuración pública; sus resultados se detallan en PUESTA_EN_MARCHA_PAWID.md. No se probó en un teléfono físico ni el flujo externo de OAuth de Google.

Prueba pendiente en el entorno de pruebas: registrar con varias fotos, editar conservando algunas y agregando otras, recargar desde otra sesión o navegador y confirmar contenido; adoptar y reactivar, verificar disponibilidad desde un navegador invitado y comprobar rechazo de una solicitud de otro propietario. Confirmar también subida al bucket con las políticas reales.
