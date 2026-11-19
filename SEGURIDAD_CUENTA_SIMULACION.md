# Seguridad de Mi cuenta PawID: simulación

Implementación solicitada como base visual el 28/10/2026. **No envía correos, no modifica credenciales reales y no constituye autorización de seguridad del servidor.** No se aplicaron migraciones ni se desplegaron funciones para este cambio.

## Flujo disponible

Mi cuenta PawID incluye Información personal y Seguridad. Para una cuenta manual se puede elegir Cambiar correo o Cambiar contraseña, solicitar un código simulado, introducir **123456** y completar una simulación. Los campos nuevos aparecen únicamente después de verificar. El resultado indica que el correo/contraseña real no cambió. Las contraseñas escritas se limpian al terminar/cancelar/cerrar. No se guardan en localStorage, Supabase ni registros.

La verificación vive solo en memoria, está ligada a la cuenta y acción elegidas, vence en diez minutos, admite cinco errores y se invalida al cancelar, cambiar pestaña o cerrar. Las cuentas Google ven el aviso de correo vinculado y no pueden acceder a las acciones manuales. El correo del formulario personal continúa siendo de solo lectura.

En la ficha de hogar temporal se retiró Editar publicación. La edición sigue disponible en Mis publicaciones.

## Punto de sustitución por servicio real

js/account-security.js exporta PawAccountSecurity.create(). El controlador del panel en js/app.js solo utiliza:

- start(user, kind): inicia email o password; devuelve destino y vencimiento.
- verify(user, code): confirma código; conserva la autorización dentro del adaptador.
- complete(user, values): solicita el cambio para la acción verificada.
- reset(): limpia el estado local del flujo.

El adaptador actual usa mode=simulation y complete devuelve changed=false. Al implementar el servidor, sustituir este adaptador por llamadas autenticadas a Edge Functions, conservar el desafío/autorización temporal en memoria y actualizar los mensajes del panel. No basta con ocultar el código de prueba ni con hacer changed=true: toda la validación debe trasladarse al servidor.

Las cuentas manuales de esta carpeta usan public.usuarios y sesiones de pawid-api; no son automáticamente usuarios de Supabase Auth. No usar auth.updateUser como sustituto sin reconciliar primero ese modelo. El servidor deberá validar la sesión, el propietario y el proveedor en cada paso; bloquear cambios de correo de Google aunque se altere el HTML; emitir códigos aleatorios, guardar solo sus hashes, limitar envíos e intentos y aplicar el cambio/consumir la autorización de manera atómica. Para correo, verificar también la nueva dirección antes de sustituir la anterior. Para contraseña, conservar la compatibilidad acordada con los clientes existentes y revocar sesiones al cambiarla.

La autorización futura no puede basarse en un booleano verificado del navegador. Es necesario revisar además las políticas heredadas que actualmente permiten acceso directo amplio a usuarios, documentadas en CONECTAR_SUPABASE.md, para que no se pueda saltar la verificación por otra vía.

## Verificación

    node tests/account-security.cjs

17 comprobaciones cubren bloqueo Google, código previo obligatorio, propiedad, caducidad, límite de intentos, uso único, confirmación de contraseña y ausencia de cambios reales. Chrome pasó 53 comprobaciones en cada ancho (1280 y 390 px), incluidas las nuevas pestañas y el flujo simulado. El servicio de cuenta y foto de perfil real anterior sigue activo sin cambios.
