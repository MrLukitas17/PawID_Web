> Documento histórico anterior al cambio del 28/10/2026. Para la integración actual consultar CONECTAR_SUPABASE.md; no seguir las migraciones de esta guía.

Versión actual: compatible con el Supabase existente

Esta versión sustituye las instrucciones anteriores de instalación de pawid-api. NO es necesario ejecutar migraciones, desplegar funciones ni cambiar políticas, tablas, claves o contraseñas en el panel de Supabase.

Se restauró el inicio de sesión del proyecto original: consulta public.usuarios con el hash SHA-256 que ya usaba PawID y conserva el perfil en pawid_user. Google mantiene su verificación y contraseña adicional anterior. La web ya no carga js/adoptions-api.js ni llama a pawid-api o password-recovery. El código opcional de esas funciones permanece en la carpeta, sin instalarse ni ejecutarse.

Qué hacer ahora

1. Abrir esta carpeta con el servidor local habitual, por ejemplo la dirección localhost:5500 que ya se usaba.
2. Recargar con Ctrl+F5 para recibir los scripts actualizados.
3. Iniciar sesión con la cuenta habitual en la web, sin enviar su contraseña por el chat. No hay que cambiar nada en Supabase para esta corrección.

La web sigue usando las tablas y el bucket existentes para las operaciones normales que realiza la persona al utilizarla: consultar, registrar, editar, eliminar mascotas y subir fotos. Esta corrección no hizo esas operaciones contra el proyecto real. Se conserva el sistema de autenticación anterior y sus límites; no se añade la validación de propietario mediante una sesión nueva de servidor.

Qué se conserva

- El diseño, las tarjetas uniformes, sus botones centrados y colores, el cierre del formulario y la visibilidad de opciones según sesión.
- La selección de varias fotografías, vista previa, eliminación individual y carrusel.
- Las cuentas y contraseñas existentes. No se cambian ni migran a otro sistema de autenticación.
- Los identificadores guardados y las asociaciones existentes. El código no modifica tipos, defaults o relaciones de la base.
- Las publicaciones locales que ya estaban en pawid_adoptions y los datos en pawid_pet_extras; no se borran ni se intenta importarlos a una tabla nueva.
- Las fotos existentes: quitar una foto de una galería no borra el archivo del bucket ni las referencias de otras publicaciones.

Límites al conservar el esquema actual

La portada se guarda en el campo foto_path que ya existía. Si la tabla no contiene las nuevas columnas, la lista de fotos adicionales, el peso, vacunas y descripción se conserva en pawid_pet_extras en ESTE navegador. Los archivos de fotos pueden estar en el bucket existente, pero su asociación adicional no queda en una columna nueva de la base. Si esas columnas ya existen en una mascota, la edición puede utilizarlas sin cambiar el esquema. No se requiere agregar ninguna.

Las adopciones siguen guardándose en pawid_adoptions, como en el proyecto original. Marcar como adoptada o reactivar cambia el estado y conserva fotos y datos después de recargar en el mismo navegador. Esto no actualiza una tabla de adopciones compartida ni publica el cambio en los navegadores de los compañeros. La interfaz lo indica. No se promete sincronización entre dispositivos con este almacenamiento.

No se crea un ID público numérico global sin soporte del esquema. Se muestra el identificador público si ya existe y, en su defecto, el ID guardado por el sistema actual. Para mascotas nuevas se utiliza un identificador compatible sin cambiar los registros anteriores.

La recuperación automática por correo queda sin activar: el botón informa que se debe contactar al equipo de PawID. No se simula un envío ni se cambia una contraseña validando solo correo y teléfono. Hacer el flujo de correo completo para las cuentas heredadas requiere soporte de servidor que no se instalará con esta restricción.

Estas limitaciones son la consecuencia de no modificar el backend existente. Las instrucciones de PUESTA_EN_MARCHA_PAWID.md y las migraciones describen otra alternativa, ahora inactiva. No seguirlas para usar esta versión.

Archivos de esta corrección

- js/store.js: acceso compartido compatible con usuarios, mascotas y bucket existentes; extras locales y manejo de errores sin borrar datos previos.
- js/app.js: restaura sesión y adopciones locales; elimina la API nueva; conserva galerías, interfaz y protección de acciones del sistema anterior.
- js/registrar-mascota.js: usa el esquema original, la galería compartida y los extras locales.
- js/google-auth.js: termina el acceso verificado sin pedir la nueva sesión de servidor.
- templates/index.html y templates/registrar-mascota.html: cargan store.js y versiones nuevas para evitar caché.
- tests/store.cjs y tests/checks.cjs: pruebas del sistema actual; tests/browser-mocks.js y browser-checks.js prueban el flujo en navegador sin contactar Supabase.
- Documentación anterior: marcada como alternativa inactiva para evitar que se ejecuten sus pasos por confusión.

Comprobaciones

Pasaron 22 comprobaciones de interfaz/JavaScript y 20 de almacenamiento compatible. Cubren login correcto e incorrecto, sesión al recargar, fotos con un esquema que no tiene columnas nuevas, conservación de fotos al editar, errores de guardado, falta de espacio y registro con el formato de ID anterior. Se ejecutaron en el motor JavaScript de las herramientas porque Node no está instalado. Se pueden repetir con node tests/checks.cjs y node tests/store.cjs.

Pasaron 32 comprobaciones en Chrome a 1280 px y otras 32 a 390 px. Incluyen acceso, guardar y editar fotos, adoptar/reactivar, recarga, controles por sesión, colores, carrusel y cierre. Todas usan servicios simulados. El mock produce un error si la web intenta llamar a una Edge Function.

No se hicieron consultas reales, login real, guardados, migraciones ni despliegues en Supabase durante esta corrección. La validación final con la cuenta habitual se realiza desde la web por su propietario. No se publicó el sitio.
