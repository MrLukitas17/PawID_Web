/* El correo solo elige la pantalla de acceso. El permiso lo valida pawid-admin. */
(function (root) {
  'use strict';
  const ADMIN_EMAIL = 'admin.pawid@gmail.com';
  const ADMIN_LOGIN_URL = '/templates/admin.html?acceso=administrador#login';

  function isAdminEmail(value) {
    return typeof value === 'string' && value.trim().toLowerCase() === ADMIN_EMAIL;
  }

  function redirectFromLogin(email, passwordField, navigate = url => root.location.assign(url)) {
    if (!isAdminEmail(email)) return false;
    if (passwordField) passwordField.value = '';
    navigate(ADMIN_LOGIN_URL);
    return true;
  }

  function mountLogin(document, view = root) {
    const form = document.querySelector('#form-login');
    if (!form) return;
    const email = document.querySelector('#login-email');
    const password = document.querySelector('#login-password');
    const label = document.querySelector('label[for="login-password"]');
    const submit = document.querySelector('#btn-login');
    const notice = document.querySelector('#login-admin-notice');
    const error = document.querySelector('#auth-error');
    const initial = {required: password.required, disabled: password.disabled, text: submit.textContent};
    let previous = false;

    function sync() {
      const administrative = isAdminEmail(email.value);
      password.hidden = label.hidden = administrative;
      password.required = !administrative && initial.required;
      password.disabled = administrative || initial.disabled;
      notice.hidden = !administrative;
      if (administrative) password.value = '';
      if (!submit.disabled) submit.textContent = administrative ? 'Continuar como administrador' : initial.text;
      if (administrative !== previous && error) error.hidden = true;
      previous = administrative;
    }

    email.addEventListener('input', sync);
    email.addEventListener('change', sync);
    // Actualiza las restricciones antes de la validación nativa, también con autocompletado.
    submit.addEventListener('click', sync, true);
    email.addEventListener('keydown', event => { if (event.key === 'Enter') sync(); });
    form.addEventListener('reset', () => queueMicrotask(sync));
    view.addEventListener('pageshow', sync);
    sync();
  }

  function prepareAdminLogin(document, search) {
    if (new URLSearchParams(search).get('acceso') !== 'administrador') return false;
    document.querySelector('#admin-email').value = ADMIN_EMAIL;
    document.querySelector('#admin-login-description').textContent = 'Confirma tu contraseña administrativa para ingresar al panel.';
    return true;
  }

  const entry = Object.freeze({ADMIN_EMAIL, isAdminEmail, redirectFromLogin, mountLogin, prepareAdminLogin});
  if (typeof module !== 'undefined' && module.exports) { module.exports = entry; return; }
  root.PawIDAdminEntry = entry;
  mountLogin(root.document);
})(typeof window !== 'undefined' ? window : globalThis);
