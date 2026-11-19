Cambios implementados el 20 de octubre de 2026

Versión actual: consultar LEEME_SIN_CAMBIOS_EN_SUPABASE.md. Las instrucciones siguientes son históricas; no se requieren migraciones ni funciones nuevas para iniciar sesión en la versión actual.

Actualización posterior: consultar LEEME_FOTOS_Y_ADOPCIONES.md para la implementación actual de fotos, adopciones persistentes y sesiones. Sus indicaciones sustituyen las de almacenamiento local de adopciones de este documento.

Este documento reemplaza las notas anteriores sobre IDs y recuperación por teléfono. No se ejecutaron migraciones, envíos de correo ni despliegues.

- `js/app.js`: ID público en listado y ficha; recuperación por enlace; selección acumulativa, vista previa y eliminación de fotos nuevas y existentes; errores de almacenamiento y lectura; indicador del carrusel y reserva de espacio para acciones.
- `js/registrar-mascota.js`: deja el ID interno a PostgreSQL y usa un UUID independiente solo para el nombre de la foto.
- `templates/index.html`: solicitud de enlace y formulario de nueva contraseña; galería de selección.
- `templates/registrar-mascota.html`: una invitación al inicio de sesión y formulario oculto para invitados.
- `css/styles.css`: respeta hidden, iguala márgenes de invitados y tamaños de tarjetas, controla textos y evita deformar imágenes.
- `supabase/migrations/202610200001_public_ids_recovery.sql`: asigna un public_id de dígitos a mascotas existentes y nuevas; secuencia, índice único y trigger para impedir cambios; conserva la PK y sus relaciones. Tokens de recuperación con hash, vencimiento y consumo de una sola vez.
- `supabase/functions/password-recovery/index.ts` y `supabase/config.toml`: función de servidor para enviar enlaces y guardar contraseñas usando el sistema actual de usuarios.
- `tests/checks.cjs`: comprobaciones sin dependencias; ejecutables con `node tests/checks.cjs`.

Configuración pendiente

1. Revisar y aplicar primero la migración en una base de pruebas. No se proporcionó el esquema remoto completo: el SQL inspecciona el tipo y default de mascotas.id, conserva defaults existentes y solo agrega generación UUID a columnas UUID/text sin default. Si encuentra otro tipo sin generador, cancela la transacción para revisión. No convierte ni reemplaza IDs existentes. Aplicar también SUPABASE_MIGRACION_MASCOTAS.sql si faltan los campos extra.
2. Configurar la función con PAWID_APP_URL (URL completa de templates/index.html), RESEND_API_KEY y PAWID_EMAIL_FROM (remitente con dominio verificado en Resend). SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY pertenecen exclusivamente al servidor. Nunca colocar la clave de servicio en los archivos web.
3. Desplegar password-recovery en el entorno de pruebas usando supabase/config.toml. verify_jwt=false permite que un usuario sin sesión solicite recuperación; el cambio de clave exige un token aleatorio de 256 bits, cuyo hash se guarda en una tabla sin acceso para anon/authenticated. La RPC solo se concede a service_role. La implementación de CORS sigue https://supabase.com/docs/guides/functions/cors.
4. Revisar en pruebas las políticas existentes de usuarios: las contraseñas no deben poder actualizarse anónimamente fuera de la función. El repositorio no incluye esas políticas ni el esquema original. El login heredado sigue usando SHA-256 en usuarios; no se migraron las cuentas a Supabase Auth. Para Google se recupera la contraseña adicional de PawID, no la contraseña de Google. Las sesiones locales ya abiertas en otros dispositivos mantienen el comportamiento heredado.
5. Los enlaces vencen a los 30 minutos. Se limita el envío a uno por minuto por correo; configurar límites adicionales del servicio de correo para el entorno publicado y limpieza periódica de tokens vencidos. Esta implementación conserva el almacenamiento local de adopciones: las fotos de publicaciones persisten en ese navegador, no se sincronizan entre dispositivos.

Cómo probar

1. ID: registrar dos mascotas en la base de pruebas y comprobar IDs públicos distintos, de dígitos, persistentes al recargar y editar. Confirmar que las mascotas anteriores recibieron public_id y conservan id, propietario y asociaciones de adopción. Probar inserciones simultáneas y rechazo al modificar public_id.
2. Contraseña: abrir ¿Olvidaste tu contraseña?, solicitar enlace, recibir el correo, abrirlo y confirmar la clave. Entrar con la nueva; verificar rechazo de la anterior, confirmación diferente, token alterado, vencido y reutilizado. Un correo desconocido debe mostrar la misma confirmación de solicitud. Requiere configurar la función y Resend.
3. Invitado: cerrar sesión, abrir Mis mascotas y luego templates/registrar-mascota.html. Debe verse una sola invitación arriba, del mismo ancho, enlace funcional a login y ningún formulario ni botón duplicado + Registrar mascota. Iniciar sesión y comprobar que reaparece el registro.
4. Tarjetas: probar a 390 px y 1280 px con nombres y ubicaciones largos, descripciones vacías/extensas, publicaciones propias y ajenas, fotos verticales y horizontales. Comparar alturas, alineación de Ver ficha y ausencia de fotos deformadas.
5. Fotos: seleccionar varias, agregar otra selección, quitar fotos y publicar. Recargar, abrir ficha y recorrer anterior/siguiente, puntos e indicador. Editar sin cambiar fotos; quitar fotos guardadas y guardar; verificar publicaciones antiguas con image. Probar más de ocho fotos, archivos mayores de 10 MB y almacenamiento lleno.

Validación y límites

Resultado: 21 comprobaciones correctas. Cubren sintaxis JavaScript, selección y eliminación, compatibilidad de una foto, carrusel y flujo del formulario de recuperación con servidor simulado. Se ejecutaron en el motor JavaScript de herramientas de Codex porque Node no está instalado. Las comprobaciones estáticas de SQL no sustituyen ejecutar la migración. No se probaron contra Supabase, Resend ni una base de producción; tampoco se verificaron visualmente en navegador real ni en un teléfono. No se pudo ejecutar Deno para verificar la función TypeScript. No hay package.json ni suite de pruebas previa en este proyecto.
