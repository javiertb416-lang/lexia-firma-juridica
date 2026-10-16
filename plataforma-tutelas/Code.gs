/**
 * PLATAFORMA DE SEGUIMIENTO DE ACCIONES DE TUTELA Y QUEJAS
 * PROTOTIPO: usar solo datos ficticios hasta validar el flujo.
 * Stack: Google Apps Script + Google Sheets (base de datos) + Google Drive (documentos).
 * Cuenta: inversioneshitco@gmail.com
 */

const CFG = {
  VERSION_CONSENTIMIENTO: 'v3-2026-10',
  MAX_INTENTOS: 5,
  BLOQUEO_MINUTOS: 15,
  SESION_SEGUNDOS: 1800,
  TAMANO_MAX_BYTES: 8 * 1024 * 1024,
  MIME_PERMITIDOS: ['application/pdf', 'image/jpeg', 'image/png'],
  CARPETA_RAIZ: 'Casos salud',
  CARPETA_CONSERVADAS: 'Autorizaciones conservadas',
  CATEGORIAS: ['Cédula', 'Historia clínica', 'Epicrisis', 'Patología', 'Incapacidades', 'Órdenes médicas', 'Constancia de radicado', 'Correo de la EPS', 'Facturas y soportes de pago', 'Otro'],
  CATEGORIAS_OBLIGATORIAS: ['Historia clínica', 'Cédula'],
  ESTADOS: ['Radicado', 'En reparto', 'Admitido', 'Medida provisional decidida', 'Fallo', 'En cumplimiento', 'Incidente de desacato'],
  TIPOS_ACCION: ['Tutela', 'Queja Supersalud', 'Recobro de gastos médicos'],
  HOJAS: {
    personas: ['cedula', 'nombre', 'correo', 'salt', 'hashClave', 'intentos', 'bloqueoHasta', 'versionConsentimiento', 'fechaConsentimiento', 'carpetaId'],
    casos: ['id', 'cedula', 'tipo', 'accionado', 'derechos', 'radicado', 'despacho', 'estado', 'fechaInicio', 'carpetaId'],
    actuaciones: ['id', 'casoId', 'fecha', 'actuacion', 'anotacion', 'registradoPor'],
    documentos: ['id', 'casoId', 'categoria', 'nombre', 'urlDrive', 'fechaCarga'],
    accesos: ['fecha', 'cedula', 'resultado'],
    solicitudes: ['id', 'cedula', 'fecha', 'explicacion', 'estado', 'casoId'],
    autorizaciones: ['id', 'cedula', 'tipo', 'version', 'fecha', 'huella', 'fileId', 'aceptada', 'revocada']
  }
};

const TEXTO_CONSENTIMIENTO = [
  'AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES Y DE SALUD',
  '',
  'Responsable del tratamiento: Javier Ricardo Torres Betancourt, C.C. 1.144.069.859, correo de contacto tmm.asesoriaslegales@gmail.com.',
  '',
  '1. Finalidad. Usted autoriza que sus datos personales y sus datos de salud sean recolectados, almacenados, consultados y usados por el Responsable con la única finalidad de preparar, presentar y dar seguimiento a las acciones judiciales y administrativas que se inicien para la protección de sus derechos a la salud, la vida digna y el mínimo vital, incluidas las tutelas y quejas ante la Superintendencia Nacional de Salud.',
  '',
  '2. Datos que se tratan. Identificación, nombre, datos de contacto, historia clínica, epicrisis, patología, órdenes médicas, incapacidades, constancias de radicado y demás documentos que usted cargue en la plataforma. Los datos de salud son datos sensibles. Usted no está obligado a autorizarlos, pero sin ellos no es posible preparar las acciones.',
  '',
  '3. Almacenamiento. Los datos se guardan en servicios de Google Workspace (Google Drive y Google Sheets), que actúan como proveedor de almacenamiento del Responsable. Ningún tercero distinto recibe sus datos ni los usa para otros fines.',
  '',
  '4. Límite de uso. Sus datos no serán usados para publicidad, perfilamiento, comercialización ni ningún fin distinto de la finalidad indicada. No serán cedidos a terceros, salvo que la ley o una autoridad judicial lo exija.',
  '',
  '5. Sus derechos. Usted puede conocer, actualizar, rectificar y suprimir sus datos, y revocar esta autorización en cualquier momento, escribiendo al correo tmm.asesoriaslegales@gmail.com. Si revoca la autorización, los datos se eliminarán de la plataforma, salvo los que deban conservarse por obligación legal o por un proceso judicial en curso, caso en el que se lo informaremos.',
  '',
  '6. Menores de edad. Si la persona afectada es menor de 18 años, esta autorización la otorga su representante legal, quien debe registrarse y aceptar en su nombre.',
  '',
  '7. Declaración. He leído esta autorización. Entiendo que la plataforma es un apoyo para preparar y hacer seguimiento a mis acciones, no reemplaza la asesoría de un abogado y no garantiza el resultado de ningún proceso. Autorizo expresamente el tratamiento de mis datos personales y de salud en los términos anteriores.'
].join('\n');

const TEXTO_MANDATO = [
  'MANDATO ESPECIAL PARA GESTIONES ANTE EPS Y SUPERSALUD',
  '',
  'Confiero mandato especial a Javier Ricardo Torres Betancourt, C.C. 1.144.069.859, para que me represente ante las Entidades Promotoras de Salud y la Superintendencia Nacional de Salud, únicamente para: (a) presentar peticiones, quejas y reclamos sobre mi atención en salud; (b) solicitar y recibir información de mis trámites; y (c) hacer seguimiento a esas gestiones.',
  '',
  'Este mandato no incluye firmar acuerdos, recibir dinero ni disponer de mis derechos.'
].join('\n');

const TEXTO_AGENCIA = [
  'AUTORIZACIÓN DE AGENCIA OFICIOSA PARA ACCIONES DE TUTELA',
  '',
  'Autorizo a Javier Ricardo Torres Betancourt, C.C. 1.144.069.859, para que, si es necesario, presente una acción de tutela en mi nombre como agente oficioso para proteger mis derechos a la salud.',
  '',
  'Entiendo que en la tutela se indicará que actúa en mi nombre y la razón por la que yo no puedo presentarla directamente. Si puedo presentarla yo misma, esta autorización no se usará.'
].join('\n');

// ---------------- PUNTO DE ENTRADA ----------------

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('index');
  t.modoAdmin = !!(e && e.parameter && e.parameter.admin === '1');
  return t.evaluate()
    .setTitle('TMM Asesorías Legales · Derecho a la salud')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------- CONFIGURACIÓN (ejecutar una vez desde el editor) ----------------

function setup() {
  Object.keys(CFG.HOJAS).forEach(h => hoja_(h));
  raizDrive_();
  Logger.log('Hojas y carpeta raíz listas.');
  Logger.log('Siguiente paso: en Configuración del proyecto > Propiedades de script, crear ADMIN_PASSWORD con una clave fuerte. No la escriba en el código.');
}

// ---------------- DATOS FICTICIOS (solo prototipo) ----------------

function seedFicticios() {
  setup();
  [
    { cedula: '1000000001', nombre: 'Persona Ficticia Uno', correo: 'prueba1@ejemplo.com', clave: '123456' },
    { cedula: '1000000002', nombre: 'Persona Ficticia Dos', correo: 'prueba2@ejemplo.com', clave: '654321' }
  ].forEach(p => {
    try {
      registrarPersonaInterno_(Object.assign({ aceptaTratamiento: true, aceptaMandato: true, aceptaAgencia: false, firma: p.nombre }, p));
    } catch (e) { Logger.log(p.cedula + ': ' + e.message); }
  });
  Logger.log('Datos ficticios creados. Claves de prueba: 123456 y 654321.');
}

// ---------------- CATÁLOGOS Y TEXTOS ----------------

function getConsentimiento() {
  return {
    version: CFG.VERSION_CONSENTIMIENTO,
    texto: TEXTO_CONSENTIMIENTO,
    mandato: TEXTO_MANDATO,
    agencia: TEXTO_AGENCIA
  };
}

function getCatalogos() {
  return { categorias: CFG.CATEGORIAS, estados: CFG.ESTADOS, tipos: CFG.TIPOS_ACCION, obligatorias: CFG.CATEGORIAS_OBLIGATORIAS };
}

// ---------------- PERSONAS (VÍCTIMAS) ----------------

function registrarPersona(datos) {
  return registrarPersonaInterno_(datos);
}

function registrarPersonaInterno_(datos) {
  const cedula = String(datos.cedula || '').trim();
  if (!validarCedula_(cedula)) throw new Error('La cédula no es válida.');
  if (!validarClave_(datos.clave)) throw new Error('La clave debe tener exactamente 6 dígitos.');
  if (!datos.nombre || !datos.correo) throw new Error('Nombre y correo son obligatorios.');
  if (datos.aceptaTratamiento !== true) throw new Error('Debe aceptar el tratamiento de sus datos para continuar.');
  if (datos.aceptaMandato !== true) throw new Error('Debe aceptar el mandato para gestiones ante EPS y Supersalud para continuar.');
  const firma = String(datos.firma || '').trim();
  if (firma.length < 5) throw new Error('Escriba su nombre completo como firma.');
  // Bloqueo: evita que dos clics seguidos creen la misma cuenta dos veces.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (buscarPersona_(cedula)) throw new Error('Esta cédula ya está registrada. Ingrese con su clave.');

    const salt = Utilities.getUuid();
    const ahora = new Date();
    const carpeta = carpetaPersona_(cedula, datos.nombre);

    guardarAutorizacion_(cedula, carpeta, 'tratamiento', 'Tratamiento de datos personales y de salud', TEXTO_CONSENTIMIENTO, firma, ahora, true);
    guardarAutorizacion_(cedula, carpeta, 'mandato', 'Mandato especial para gestiones ante EPS y Supersalud', TEXTO_MANDATO, firma, ahora, true);
    guardarAutorizacion_(cedula, carpeta, 'agencia', 'Agencia oficiosa para acciones de tutela', TEXTO_AGENCIA, firma, ahora, datos.aceptaAgencia === true);

    agregar_('personas', {
      cedula: cedula, nombre: datos.nombre, correo: datos.correo,
      salt: salt, hashClave: hash_(salt, datos.clave),
      intentos: 0, bloqueoHasta: '',
      versionConsentimiento: CFG.VERSION_CONSENTIMIENTO,
      fechaConsentimiento: ahora, carpetaId: carpeta.getId()
    });
    registrarAcceso_(cedula, 'registro');
    return { token: crearSesion_('persona', cedula) };
  } finally {
    lock.releaseLock();
  }
}

function guardarAutorizacion_(cedula, carpeta, tipo, titulo, texto, firma, fecha, aceptada) {
  const huella = huellaSha256_(texto);
  let fileId = '';
  if (aceptada) {
    const nombre = 'Autorización - ' + titulo + ' - ' + Utilities.formatDate(fecha, 'America/Bogota', 'yyyy-MM-dd HH-mm');
    const html = htmlAutorizacion_(titulo, texto, cedula, firma, fecha, huella);
    const pdf = Utilities.newBlob(html, 'text/html', nombre + '.html').getAs('application/pdf').setName(nombre + '.pdf');
    fileId = carpeta.createFile(pdf).getId();
  }
  agregar_('autorizaciones', {
    id: Utilities.getUuid(), cedula: cedula, tipo: tipo, version: CFG.VERSION_CONSENTIMIENTO,
    fecha: fecha, huella: huella, fileId: fileId, aceptada: aceptada ? 'sí' : 'no', revocada: ''
  });
}

function htmlAutorizacion_(titulo, texto, cedula, firma, fecha, huella) {
  const parrafos = texto.split('\n').map(l => '<p>' + esc_(l) + '</p>').join('');
  return '<html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;color:#1b2421">' +
    '<h2>' + esc_(titulo) + '</h2>' + parrafos +
    '<hr>' +
    '<p><strong>Cédula del titular:</strong> ' + esc_(cedula) + '</p>' +
    '<p><strong>Firma escrita:</strong> ' + esc_(firma) + '</p>' +
    '<p><strong>Fecha y hora de aceptación:</strong> ' + Utilities.formatDate(fecha, 'America/Bogota', 'yyyy-MM-dd HH:mm:ss') + ' (hora de Bogotá)</p>' +
    '<p><strong>Versión del texto:</strong> ' + CFG.VERSION_CONSENTIMIENTO + '</p>' +
    '<p><strong>Huella SHA-256 del texto aceptado:</strong> ' + huella + '</p>' +
    '</body></html>';
}

function ingresar(cedula, clave) {
  cedula = String(cedula || '').trim();
  const MSG = 'Cédula o clave incorrecta.';
  const p = buscarPersona_(cedula);
  if (!p) { registrarAcceso_(cedula, 'no_existe'); throw new Error(MSG); }
  if (!validarClave_(clave)) { registrarAcceso_(cedula, 'formato'); throw new Error(MSG); }

  const ahora = new Date();
  if (p.bloqueoHasta && new Date(p.bloqueoHasta) > ahora) {
    throw new Error('Cuenta bloqueada temporalmente por varios intentos fallidos. Intente de nuevo en ' + CFG.BLOQUEO_MINUTOS + ' minutos.');
  }
  if (hash_(p.salt, clave) !== p.hashClave) {
    const intentos = Number(p.intentos || 0) + 1;
    const bloquear = intentos >= CFG.MAX_INTENTOS;
    actualizar_('personas', p._fila, {
      intentos: bloquear ? 0 : intentos,
      bloqueoHasta: bloquear ? new Date(ahora.getTime() + CFG.BLOQUEO_MINUTOS * 60000) : ''
    });
    registrarAcceso_(cedula, 'fallido');
    throw new Error(MSG);
  }
  actualizar_('personas', p._fila, { intentos: 0, bloqueoHasta: '' });
  registrarAcceso_(cedula, 'exitoso');
  return { token: crearSesion_('persona', cedula) };
}

function miPerfil(token) {
  const s = sesion_(token, 'persona');
  const p = buscarPersona_(s.id);
  if (!p) throw new Error('Cuenta no encontrada.');
  return { nombre: p.nombre, cedula: String(p.cedula) };
}

function misRegistros(token) {
  const s = sesion_(token, 'persona');
  const solicitudes = filas_('solicitudes').filter(x => String(x.cedula) === s.id).map(aPlano_);
  const casos = filas_('casos').filter(c => String(c.cedula) === s.id).map(aPlano_);
  return { solicitudes: solicitudes, casos: casos };
}

function revocarTratamiento(token) {
  const s = sesion_(token, 'persona');
  const p = buscarPersona_(s.id);
  if (!p) throw new Error('Cuenta no encontrada.');
  const casos = filas_('casos').filter(c => String(c.cedula) === s.id);
  const solicitudes = filas_('solicitudes').filter(x => String(x.cedula) === s.id);
  if (casos.length || solicitudes.some(x => String(x.estado) !== 'Borrador')) {
    throw new Error('Tiene un caso o una solicitud en curso. Para revocar la autorización escriba a tmm.asesoriaslegales@gmail.com.');
  }
  const borradores = solicitudes.map(x => String(x.id));
  borrar_('documentos', 'casoId', borradores);
  borrar_('solicitudes', 'id', borradores);

  // Las autorizaciones firmadas se conservan como prueba y se sacan de la carpeta que se elimina.
  const conservadas = obtenerCarpeta_(raizDrive_(), CFG.CARPETA_CONSERVADAS);
  filas_('autorizaciones').filter(a => String(a.cedula) === s.id && a.fileId).forEach(a => {
    try { DriveApp.getFileById(a.fileId).moveTo(conservadas); } catch (e) { Logger.log('No se pudo conservar ' + a.fileId + ': ' + e.message); }
  });
  actualizarTodas_('autorizaciones', 'cedula', s.id, { revocada: hoyStr_() });

  DriveApp.getFolderById(p.carpetaId).setTrashed(true);
  borrar_('personas', 'cedula', [s.id]);
  borrar_('accesos', 'cedula', [s.id]);
  return { ok: true };
}

// ---------------- SOLICITUDES, CASOS Y DOCUMENTOS ----------------

function crearSolicitud(token, explicacion) {
  const s = sesion_(token, 'persona');
  const texto = String(explicacion || '').trim();
  if (!texto) throw new Error('Escriba una explicación de su caso.');
  const abiertas = filas_('solicitudes').filter(x => String(x.cedula) === s.id && ['Borrador', 'En revisión'].indexOf(String(x.estado)) !== -1);
  if (abiertas.length) throw new Error('Ya tiene una solicitud en curso.');
  const id = 'S' + String(nextId_('CONTADOR_SOLICITUD')).padStart(4, '0');
  agregar_('solicitudes', { id: id, cedula: s.id, fecha: new Date(), explicacion: texto, estado: 'Borrador', casoId: '' });
  return { id: id };
}

function subirDocumento(token, ref, categoria, nombre, base64, mime) {
  const s = sesion_(token);
  const reg = registroDeSesion_(s, ref);
  if (reg.tipo === 'solicitud' && String(reg.fila.estado) !== 'Borrador') throw new Error('La solicitud ya fue enviada.');
  if (CFG.MIME_PERMITIDOS.indexOf(mime) === -1) throw new Error('Solo se aceptan archivos PDF, JPG o PNG.');
  if (CFG.CATEGORIAS.indexOf(categoria) === -1) throw new Error('Categoría no válida.');
  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > CFG.TAMANO_MAX_BYTES) throw new Error('El archivo supera 8 MB.');
  const archivo = DriveApp.getFolderById(reg.carpetaId).createFile(Utilities.newBlob(bytes, mime, nombre));
  agregar_('documentos', {
    id: Utilities.getUuid(), casoId: String(ref), categoria: categoria,
    nombre: nombre, urlDrive: archivo.getUrl(), fechaCarga: hoyStr_()
  });
  return { ok: true };
}

function enviarSolicitud(token, ref) {
  const s = sesion_(token, 'persona');
  const reg = registroDeSesion_(s, ref);
  if (reg.tipo !== 'solicitud') throw new Error('Registro no válido.');
  if (String(reg.fila.estado) !== 'Borrador') throw new Error('Esta solicitud ya fue enviada.');
  const categorias = filas_('documentos').filter(d => String(d.casoId) === String(ref)).map(d => String(d.categoria));
  const faltan = CFG.CATEGORIAS_OBLIGATORIAS.filter(c => categorias.indexOf(c) === -1);
  if (faltan.length) throw new Error('Faltan documentos obligatorios: ' + faltan.join(' y ') + '.');
  actualizar_('solicitudes', reg.fila._fila, { estado: 'En revisión' });
  return { ok: true };
}

function detalleCaso(token, ref) {
  const s = sesion_(token);
  const reg = registroDeSesion_(s, ref);
  const documentos = filas_('documentos').filter(d => String(d.casoId) === String(ref)).map(d => ({
    id: d.id, categoria: d.categoria, nombre: d.nombre, fechaCarga: fmt_(d.fechaCarga)
  }));
  const actuaciones = reg.tipo === 'caso'
    ? filas_('actuaciones').filter(a => String(a.casoId) === String(ref)).map(aPlano_)
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    : [];
  return { tipo: reg.tipo, registro: aPlano_(reg.fila), actuaciones: actuaciones, documentos: documentos };
}

function descargarDocumento(token, docId) {
  const s = sesion_(token);
  const doc = filas_('documentos').find(d => String(d.id) === String(docId));
  if (!doc) throw new Error('Documento no encontrado.');
  registroDeSesion_(s, doc.casoId);
  const fileId = extraerId_(doc.urlDrive);
  if (!fileId) throw new Error('No se pudo abrir el archivo.');
  const blob = DriveApp.getFileById(fileId).getBlob();
  return { nombre: doc.nombre, mime: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

// ---------------- ADMINISTRADOR ----------------

function loginAdmin(clave) {
  const esperada = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!esperada || clave !== esperada) {
    Utilities.sleep(1500);
    throw new Error('Clave de administrador incorrecta.');
  }
  return { token: crearSesion_('admin', 'admin') };
}

function panelAdmin(token) {
  sesion_(token, 'admin');
  const ahora = new Date();
  const personas = filas_('personas').map(p => ({
    cedula: String(p.cedula), nombre: p.nombre, correo: p.correo,
    bloqueada: !!(p.bloqueoHasta && new Date(p.bloqueoHasta) > ahora),
    fechaConsentimiento: fmt_(p.fechaConsentimiento)
  }));
  const casos = filas_('casos').map(aPlano_);
  const solicitudes = filas_('solicitudes').filter(x => String(x.estado) !== 'Borrador').map(aPlano_);
  return { personas: personas, casos: casos, solicitudes: solicitudes };
}

function adminConvertirSolicitud(token, ref, datos) {
  sesion_(token, 'admin');
  const sol = filas_('solicitudes').find(x => String(x.id) === String(ref));
  if (!sol) throw new Error('Solicitud no encontrada.');
  if (String(sol.estado) !== 'En revisión') throw new Error('Solo se pueden convertir solicitudes en revisión.');
  if (CFG.TIPOS_ACCION.indexOf(datos.tipo) === -1) throw new Error('Elija si es tutela o queja.');
  const caso = crearCasoInterno_({
    cedula: sol.cedula, tipo: datos.tipo, accionado: datos.accionado, derechos: datos.derechos,
    radicado: datos.radicado, despacho: datos.despacho, estado: datos.estado, fechaInicio: datos.fechaInicio
  });
  const carpetaCaso = DriveApp.getFolderById(caso.carpetaId);
  filas_('documentos').filter(d => String(d.casoId) === String(ref)).forEach(d => {
    actualizar_('documentos', d._fila, { casoId: caso.id });
    const fid = extraerId_(d.urlDrive);
    if (fid) {
      try { DriveApp.getFileById(fid).moveTo(carpetaCaso); } catch (e) { Logger.log('No se pudo mover ' + d.nombre + ': ' + e.message); }
    }
  });
  actualizar_('solicitudes', sol._fila, { estado: 'Convertida', casoId: caso.id });
  agregar_('actuaciones', {
    id: Utilities.getUuid(), casoId: caso.id, fecha: hoyStr_(),
    actuacion: 'Solicitud convertida en ' + datos.tipo,
    anotacion: 'Documentos de la solicitud incorporados al caso.', registradoPor: 'Administrador'
  });
  return { id: caso.id };
}

function adminCrearCaso(token, datos) {
  sesion_(token, 'admin');
  return crearCasoInterno_(datos);
}

function crearCasoInterno_(datos) {
  const p = buscarPersona_(String(datos.cedula || '').trim());
  if (!p) throw new Error('No existe una persona con esa cédula.');
  const id = String(nextId_('CONTADOR_CASO')).padStart(4, '0');
  const nombreCarpeta = 'Caso ' + id + ' - ' + (datos.tipo || 'Acción') + ' ' + (datos.accionado || '');
  const carpeta = DriveApp.getFolderById(p.carpetaId).createFolder(nombreCarpeta);
  agregar_('casos', {
    id: id, cedula: String(datos.cedula).trim(), tipo: datos.tipo, accionado: datos.accionado,
    derechos: datos.derechos || '', radicado: datos.radicado || '', despacho: datos.despacho || '',
    estado: datos.estado || 'Radicado', fechaInicio: datos.fechaInicio || hoyStr_(),
    carpetaId: carpeta.getId()
  });
  return { id: id, carpetaId: carpeta.getId() };
}

function adminRegistrarRadicado(token, casoId, tipo, referencia, fecha) {
  sesion_(token, 'admin');
  if (CFG.TIPOS_ACCION.indexOf(tipo) === -1) throw new Error('Elija si es tutela o queja.');
  const caso = filas_('casos').find(c => String(c.id) === String(casoId));
  if (!caso) throw new Error('Caso no encontrado.');
  const fid = extraerId_(referencia);
  if (!fid) throw new Error('Pegue el enlace o el ID del archivo de Drive.');
  const f = fecha || hoyStr_();
  const original = DriveApp.getFileById(fid);
  const copia = original.makeCopy('Radicado ' + tipo + ' ' + f + ' - ' + original.getName(), DriveApp.getFolderById(caso.carpetaId));
  agregar_('documentos', {
    id: Utilities.getUuid(), casoId: String(casoId), categoria: 'Radicado: ' + tipo,
    nombre: copia.getName(), urlDrive: copia.getUrl(), fechaCarga: f
  });
  agregar_('actuaciones', {
    id: Utilities.getUuid(), casoId: String(casoId), fecha: f, actuacion: tipo + ' radicada',
    anotacion: 'Copia radicada incorporada a su caso.', registradoPor: 'Administrador'
  });
  return { ok: true };
}

function adminAgregarActuacion(token, datos) {
  sesion_(token, 'admin');
  if (!datos.casoId || !datos.actuacion) throw new Error('Caso y actuación son obligatorios.');
  const caso = filas_('casos').find(c => String(c.id) === String(datos.casoId));
  if (!caso) throw new Error('Caso no encontrado.');
  agregar_('actuaciones', {
    id: Utilities.getUuid(), casoId: String(datos.casoId), fecha: datos.fecha || hoyStr_(),
    actuacion: datos.actuacion, anotacion: datos.anotacion || '', registradoPor: 'Administrador'
  });
  if (datos.estado && CFG.ESTADOS.indexOf(datos.estado) !== -1) {
    actualizar_('casos', caso._fila, { estado: datos.estado });
  }
  return { ok: true };
}

function adminRestablecerClave(token, cedula, nuevaClave) {
  sesion_(token, 'admin');
  if (!validarClave_(nuevaClave)) throw new Error('La clave debe tener exactamente 6 dígitos.');
  const p = buscarPersona_(String(cedula || '').trim());
  if (!p) throw new Error('No existe una persona con esa cédula.');
  const salt = Utilities.getUuid();
  actualizar_('personas', p._fila, { salt: salt, hashClave: hash_(salt, nuevaClave), intentos: 0, bloqueoHasta: '' });
  return { ok: true };
}

// ---------------- SESIONES ----------------

function crearSesion_(rol, id) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, JSON.stringify({ rol: rol, id: id }), CFG.SESION_SEGUNDOS);
  return token;
}

function sesion_(token, rolEsperado) {
  const raw = token ? CacheService.getScriptCache().get(token) : null;
  if (!raw) throw new Error('Su sesión venció. Ingrese de nuevo.');
  const s = JSON.parse(raw);
  if (rolEsperado && s.rol !== rolEsperado) throw new Error('No autorizado.');
  return s;
}

// Devuelve el registro (solicitud o caso) si la sesión tiene permiso sobre él.
function registroDeSesion_(s, ref) {
  const id = String(ref || '');
  if (id.charAt(0) === 'S') {
    const sol = filas_('solicitudes').find(x => String(x.id) === id);
    if (!sol) throw new Error('Registro no encontrado.');
    if (s.rol === 'persona' && String(sol.cedula) !== s.id) throw new Error('No autorizado.');
    const p = buscarPersona_(sol.cedula);
    if (!p) throw new Error('Cuenta no encontrada.');
    return { tipo: 'solicitud', fila: sol, cedula: String(sol.cedula), carpetaId: p.carpetaId };
  }
  const caso = filas_('casos').find(c => String(c.id) === id);
  if (!caso) throw new Error('Caso no encontrado.');
  if (s.rol === 'persona' && String(caso.cedula) !== s.id) throw new Error('No autorizado.');
  return { tipo: 'caso', fila: caso, cedula: String(caso.cedula), carpetaId: caso.carpetaId };
}

// ---------------- UTILIDADES ----------------

function baseDatos_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  if (!id) {
    const ss = SpreadsheetApp.create('Base Plataforma Tutelas (prototipo)');
    id = ss.getId();
    props.setProperty('SHEET_ID', id);
  }
  return SpreadsheetApp.openById(id);
}

function hoja_(nombre) {
  const ss = baseDatos_();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(CFG.HOJAS[nombre]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function filas_(nombre) {
  const datos = hoja_(nombre).getDataRange().getValues();
  const cab = datos.shift();
  return datos.map((fila, i) => {
    const o = { _fila: i + 2 };
    cab.forEach((c, j) => { o[c] = fila[j]; });
    return o;
  });
}

function agregar_(nombre, obj) {
  hoja_(nombre).appendRow(CFG.HOJAS[nombre].map(c => obj[c] !== undefined ? obj[c] : ''));
}

function actualizar_(nombre, fila, campos) {
  const sh = hoja_(nombre);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  Object.keys(campos).forEach(k => sh.getRange(fila, cab.indexOf(k) + 1).setValue(campos[k]));
}

function actualizarTodas_(nombre, col, valor, campos) {
  filas_(nombre).filter(f => String(f[col]) === String(valor)).forEach(f => actualizar_(nombre, f._fila, campos));
}

// Borra las filas cuya columna "col" esté en "valores". Recorre de abajo hacia arriba.
function borrar_(nombre, col, valores) {
  const sh = hoja_(nombre);
  const datos = sh.getDataRange().getValues();
  const idx = datos[0].indexOf(col);
  for (let i = datos.length - 1; i >= 1; i--) {
    if (valores.indexOf(String(datos[i][idx])) !== -1) sh.deleteRow(i + 1);
  }
}

function buscarPersona_(cedula) {
  return filas_('personas').find(p => String(p.cedula) === String(cedula)) || null;
}

function registrarAcceso_(cedula, resultado) {
  agregar_('accesos', { fecha: new Date(), cedula: String(cedula), resultado: resultado });
}

function hash_(salt, clave) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + clave));
}

function huellaSha256_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

// Contador único: no depende del número de filas, así no se repite aunque se borren registros.
function nextId_(clave) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    let n = Number(props.getProperty(clave));
    if (!n) n = valorInicial_(clave);
    n += 1;
    props.setProperty(clave, String(n));
    return n;
  } finally {
    lock.releaseLock();
  }
}

function valorInicial_(clave) {
  const hojaNombre = clave === 'CONTADOR_CASO' ? 'casos' : 'solicitudes';
  return Math.max(0, ...filas_(hojaNombre).map(f => parseInt(String(f.id).replace(/\D/g, ''), 10) || 0));
}

function extraerId_(ref) {
  const s = String(ref || '').trim();
  const m = s.match(/\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/) || s.match(/^([-\w]{20,})$/);
  return m ? m[1] : '';
}

function obtenerCarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function validarCedula_(c) { return /^\d{5,11}$/.test(String(c)); }
function validarClave_(k) { return /^\d{6}$/.test(String(k)); }

function hoyStr_() { return Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd'); }

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt_(v) {
  return v instanceof Date ? Utilities.formatDate(v, 'America/Bogota', 'yyyy-MM-dd') : v;
}

function aPlano_(obj) {
  const o = {};
  Object.keys(obj).forEach(k => {
    if (['salt', 'hashClave', 'carpetaId', '_fila', 'intentos', 'bloqueoHasta'].indexOf(k) !== -1) return;
    o[k] = fmt_(obj[k]);
  });
  return o;
}

// Carpeta única "Casos salud" en la raíz de My Drive. Compártala como lector con la cuenta del agente.
function raizDrive_() {
  const it = DriveApp.getFoldersByName(CFG.CARPETA_RAIZ);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CFG.CARPETA_RAIZ);
}

// Una subcarpeta por persona dentro de "Casos salud". Las subcarpetas de casos viven dentro de ella.
function carpetaPersona_(cedula, nombre) {
  return raizDrive_().createFolder(cedula + ' - ' + nombre);
}
