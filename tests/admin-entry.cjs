const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const entry = require('../js/admin-entry.js');

test('Solo el correo administrativo exacto elige el acceso separado', () => {
  assert.ok(entry.isAdminEmail(' ADMIN.PAWID@GMAIL.COM '));
  for (const value of ['', null, {}, 'usuario@gmail.com', 'admin.pawid+otro@gmail.com',
    'admin.pawid@gmail.com.otro.cl', 'admin.pawid@gmail.co']) assert.equal(entry.isAdminEmail(value), false);
});

test('La redirección no transporta la contraseña ni acepta destinos externos', () => {
  const password = {value: 'valor-de-prueba-no-transmitido'};
  const destinations = [];
  assert.ok(entry.redirectFromLogin(entry.ADMIN_EMAIL, password, url => destinations.push(url)));
  assert.equal(password.value, '');
  assert.deepEqual(destinations, ['/templates/admin.html?acceso=administrador#login']);
  assert.ok(!destinations[0].includes('valor-de-prueba'));
  assert.ok(!destinations[0].includes(entry.ADMIN_EMAIL));
  password.value = 'clave-normal';
  assert.equal(entry.redirectFromLogin('normal@example.test', password, url => destinations.push(url)), false);
  assert.equal(password.value, 'clave-normal');
  assert.equal(destinations.length, 1);
});

test('El acceso de destino completa solo el correo y no toma identidad ni privilegios de la URL', () => {
  const email = {value: ''}, description = {textContent: ''};
  const document = {querySelector: selector => selector === '#admin-email' ? email : description};
  assert.equal(entry.prepareAdminLogin(document, '?email=otro@example.test&admin=true'), false);
  assert.equal(email.value, '');
  assert.ok(entry.prepareAdminLogin(document, '?acceso=administrador&email=otro@example.test&redirect=https://otro.test'));
  assert.equal(email.value, entry.ADMIN_EMAIL);
  assert.ok(description.textContent.includes('contraseña administrativa'));
});

test('El envío administrativo se resuelve antes de leer la contraseña o llamar al login normal', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  const start = source.indexOf('$("#form-login").addEventListener("submit"');
  const end = source.indexOf('const recoveryModal=', start);
  let handler, normalCalls = 0, preventions = 0, destination;
  const password = {set value(value) { assert.equal(value, ''); }, get value() { throw new Error('La contraseña administrativa no debe leerse aquí'); }};
  const nodes = {'#form-login': {addEventListener: (_event, fn) => { handler = fn; }},
    '#login-email': {value: entry.ADMIN_EMAIL}, '#login-password': password};
  new Function('$', 'window', 'normalize', 'pawStore', source.slice(start, end))(
    selector => nodes[selector],
    {PawIDAdminEntry: {...entry, redirectFromLogin: (email, field) => entry.redirectFromLogin(email, field, url => { destination = url; })}},
    value => value.trim().toLowerCase(), {login: async () => { normalCalls++; }});
  await handler({preventDefault() { preventions++; }});
  assert.equal(preventions, 1); assert.equal(normalCalls, 0);
  assert.equal(destination, '/templates/admin.html?acceso=administrador#login');
});
