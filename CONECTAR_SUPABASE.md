# PawID conectado a Supabase

Integración aplicada el **28/10/2026** al proyecto existente **ujsokaxksqwqojvctvtx**, compartido con la app móvil.

## Estado comprobado

- Migración pawid_conexion_web_tablas_existentes aplicada.
- pawid-api desplegada y activa (versión de despliegue 3; protocolo 3). Diagnóstico ready=true con seis componentes preparados.
- password-recovery desplegada y activa, pero ready=false: faltan la configuración de correo y el remitente. El formulario no ofrece recuperar mientras el servicio no esté listo.
- Origen de la web permitido: http://localhost:5500. PAWID_APP_URL permite cambiarlo cuando se publique en otro dominio. No se habilitó CORS universal.
- La configuración pública exige requireBackend=true: si el servidor falla, se informa el error; no se guardan datos nuevos solo en este navegador.

## Datos de la web

Usuarios usan usuarios; mascotas y sus antecedentes usan mascotas; adopciones usan publicacion_adopcion; hogares usan publicaciones_hogares__temporales. Las fotografías nuevas se suben a mascotas-fotos mediante autorización firmada por archivo. Las sesiones propias de PawID se verifican en pawid_web_sessions, protegida frente al acceso directo de anon/authenticated.

Las tablas de publicaciones originales se ampliaron; no se crearon tablas paralelas de adopciones ni hogares. Se corrigieron las FK que confundían publicación.id con usuario.id: el propietario se relaciona mediante usuario_id. Se conservan los nombres, IDs y datos existentes. La aplicación móvil no fue editada; para usar campos nuevos como fotos múltiples debe leer esas columnas adicionales.

Los textos educativos y el diseño continúan en HTML/CSS; no requieren base de datos para mostrarse.

## Conservación de registros y pruebas reales

Se verificaron cantidades y huellas de todos los campos originales antes y después: **24 usuarios y 17 mascotas permanecen exactamente iguales**. Adopciones y hogares empezaron y terminaron vacíos.

Pasaron 26 comprobaciones reales con dos cuentas temporales: registro, login, sesión, subida de foto, alta/edición de mascota, galería y antecedentes, adopción, estado, hogar, disponibilidad, visibilidad pública, rechazo de acciones de otra cuenta y revocación de sesión. Se retiraron exclusivamente las cuentas, mascota, avisos y archivo temporales. No se cambiaron registros de usuarios existentes.

También pasaron 50 comprobaciones del servidor simulado, 17 de la capa de conexión, 21 de formularios/fotografías, 8 de importación y 7 del formulario de recuperación. Chrome pasó 32 comprobaciones a 1280 px y otras 32 a 390 px. La comprobación CORS devolvió 200 y el origen esperado. Estas pruebas no prueban el retorno OAuth real de Google con una cuenta del usuario ni el envío de correo, que sigue sin configurar.

## Abrir y recuperar datos antiguos

1. Abrir http://localhost:5500/templates/index.html con Live Server.
2. Recargar con Ctrl + F5 e iniciar sesión de nuevo: la sesión antigua del navegador no autoriza operaciones del servidor.
3. Si había publicaciones o antecedentes guardados solo en el navegador, ir a Adopciones y usar **Importar datos de este navegador** en el mismo origen y navegador donde se crearon. Se copian solo publicaciones propias y antecedentes de mascotas de la cuenta, se omiten ejemplos/IDs ya existentes y se conservan los originales locales.
4. Revisar el resumen de importación. Los avisos sin una mascota propia válida requieren revisión; no se asignan a otra cuenta automáticamente.

El asistente no puede leer el almacenamiento del navegador personal desde el terminal. Los datos antiguos no se consideran migrados hasta ejecutar esa importación y revisar su resultado.

## Pendientes concretos

**Correo:** configurar RESEND_API_KEY y PAWID_EMAIL_FROM con un remitente verificado en Edge Functions > Secrets. Configurar PAWID_APP_URL con la URL pública cuando corresponda. No compartir claves en el chat ni colocarlas en el JS del navegador.

**Permisos heredados:** se detectaron políticas ALL con condición true en usuarios, mascotas y otros módulos, además de acceso amplio a Storage. La función de la web valida propietarios, pero esas políticas dejan otras vías directas de acceso abiertas. No se retiraron sin adaptar también el cliente móvil. Se requiere una revisión del modelo de acceso compartido antes de exponerlo públicamente. [Documentación RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

El Advisor mantiene avisos informativos de RLS sin políticas en tablas operadas solo por servidor (intencional: no se abre acceso anónimo a sesiones/tokens/publicaciones) y en veterinarias. [Explicación del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). También informó protección de contraseñas filtradas de Supabase Auth desactivada; no se alteró su configuración: [detalle](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Archivos y mantenimiento

La fuente del servidor está en supabase/functions/pawid-api/. Preparar-Funciones.ps1 regenera las copias pegables en supabase/dashboard y no despliega nada. Las dependencias Supabase JS están fijadas en 2.118.0. La clave pública existente fue validada contra el proyecto; no se solicitaron ni guardaron claves administrativas en el navegador.

La migración local 202610280001_conexion_web.sql representa la ampliación aplicada. No ejecutar las antiguas 202610200001/002 ni usar db push sin reconciliar primero el historial de migraciones remoto. La aplicación y la migración ya están activadas: no es necesario copiar SQL para usar la web.

Las pruebas locales se ejecutan con Node:

    node tests/checks.cjs
    node tests/store.cjs
    node tests/adoptions.cjs
    node tests/import.cjs
    node tests/recovery.cjs

Las pruebas Chrome se ejecutan con tests/browser-checks.ps1. tests/supabase-live.cjs requiere confirmación explícita por argumento porque crea registros reales de prueba; no forma parte de las pruebas rutinarias y requiere retirar las cuentas temporales identificadas en su resultado. No ejecutarlo contra datos personales existentes.

## Perfil y acciones por pestaña (28/10)

Cuenta incluye Editar perfil para cambiar nombre y teléfono. El correo se muestra como identificador de cuenta de solo lectura. El servidor guarda únicamente esos dos campos en el usuario de la sesión: no acepta un ID de propietario enviado por el navegador.

En Todas de adopciones no se muestran editar, eliminar ni cambiar estado. En Todos de hogares solo aparece Ver ficha. Contactar y las acciones de administración están en Mis publicaciones. La ficha conserva sus opciones de consulta.

Esta revisión pasó 56 comprobaciones del servidor y 41 de navegador en cada ancho (1280 y 390 px). El cambio de perfil requiere pawid-api versión de despliegue 2, ya desplegada.

## Foto de perfil

El panel de cuenta incluye foto con vista previa, nombre, correo de solo lectura y teléfono. Admite JPG, PNG y WebP de hasta 5 MB. Seleccionar o quitar una foto no cambia el perfil hasta Guardar cambios. Cancelar conserva la foto anterior. El avatar de la barra superior se actualiza después de guardar.

Las imágenes nuevas se guardan en Storage con autorización firmada; usuarios.foto_path guarda la URL. El servidor valida que la nueva URL corresponda a la carpeta de la cuenta. No hay cambios de esquema adicionales. Quitar/reemplazar la foto cambia la referencia del perfil y no elimina archivos anteriores de otras publicaciones.

Esta revisión pasó 62 comprobaciones de servidor y 47 de navegador en escritorio y móvil. pawid-api versión de despliegue 3 está activa.

## Mi cuenta PawID y simulación de Seguridad

El panel ahora se llama Mi cuenta PawID y tiene una pestaña Seguridad de demostración para cuentas manuales. No envía correos ni cambia credenciales: consultar SEGURIDAD_CUENTA_SIMULACION.md para el alcance y los puntos de integración futuros. Google conserva el correo de solo lectura. No se modificó el backend en este cambio.

## Autenticación con Supabase Auth (19/11/2026)

El sitio usa ahora las mismas cuentas que la aplicación móvil:

- **Crear cuenta e iniciar sesión:** `pawid-api` valida con Supabase Auth (ya no compara SHA-256 en `usuarios`). El perfil de `usuarios` queda ligado con la columna `auth_id`.
- **Google:** sin contraseña PawID adicional; la cuenta se liga a la que tenga el mismo correo (un correo = una cuenta).
- **Recuperar contraseña:** código de 6 dígitos enviado por Supabase Auth (SMTP del proyecto). La función `password-recovery` y la tabla `password_reset_tokens` ya no se usan.
- **PAWID_APP_URL** acepta varias direcciones separadas por coma.
- `pawid-api` versión 4. Requiere haber ejecutado la Parte 1 (`20261118_1_auth.sql`) del repositorio de la app.

Las cuentas antiguas de correo y contraseña deben registrarse de nuevo con el mismo correo: al hacerlo recuperan su perfil y sus mascotas.
