# Guía: qué es la plataforma y cómo se crea desde cero

## 1. Qué es

La Plataforma de tutelas y quejas es una aplicación web interna. Sirve para que las víctimas de falta de atención en salud:

1. Creen su cuenta con su cédula y una clave de 6 números.
2. Firmen sus autorizaciones (tratamiento de datos, mandato ante EPS y Supersalud, y agencia oficiosa opcional).
3. Envíen su caso con su explicación y sus documentos (historia clínica, cédula y otros).
4. Vean el estado de su caso, las actuaciones y las copias radicadas cuando Javier las registre.

Javier es el único administrador. Desde el panel de administración convierte las solicitudes en casos, registra las actuaciones y registra las copias radicadas.

No envía correos ni notificaciones automáticas. Todo se revisa desde el panel.

## 2. Partes que la componen

| Parte | Qué es | Dónde está |
|---|---|---|
| Base de datos | Una hoja de cálculo de Google Sheets con las hojas: personas, solicitudes, casos, actuaciones, documentos, accesos y autorizaciones. | Se crea sola la primera vez que se ejecuta `setup()` y su ID queda guardado en las propiedades del script. |
| Documentos | Carpetas de Google Drive por persona y por caso. | Carpeta raíz "Casos salud" en la cuenta de Drive de la organización. |
| Aplicación | Dos archivos de Apps Script: `Código.gs` (servidor) e `index.html` (pantalla). | Proyecto de Apps Script vinculado a la cuenta de la organización. |
| Clave de administrador | Una clave guardada como propiedad del script, nunca en el código. | Configuración del proyecto > Propiedades de script. |

## 3. Cómo se crea desde cero

Estos pasos se hacen una sola vez, desde la cuenta `inversioneshitco@gmail.com`.

**Paso 1. Crear el proyecto de Apps Script.**
1. Entrar a script.google.com con la cuenta de la organización.
2. Crear un proyecto nuevo y llamarlo "Plataforma de tutelas y quejas".
3. En el archivo `Código.gs` pegar el contenido de `Code_v3.gs`.
4. Crear un archivo HTML llamado `index` y pegar el contenido de `index_v3.html`. El nombre debe quedar `index.html`.
5. Guardar.

**Paso 2. Crear la base de datos y la carpeta raíz.**
1. En el editor, seleccionar la función `setup` y presionar Ejecutar.
2. Aceptar los permisos que pida Google (Drive y hojas de cálculo).
3. Revisar el registro de ejecución: debe decir que las hojas y la carpeta raíz están listas.

**Paso 3. Crear la clave de administrador.**
1. Ir a Configuración del proyecto (ícono de engranaje).
2. En Propiedades de script, agregar `ADMIN_PASSWORD` con una clave fuerte.
3. No escribir la clave en el código ni en ningún documento del proyecto.

**Paso 4. Publicar la aplicación.**
1. Implementar > Nueva implementación > Tipo: aplicación web.
2. Ejecutar como: yo (la cuenta de la organización).
3. Quién tiene acceso: cualquier persona.
4. Implementar y copiar la URL que aparece.

**Paso 5. Probar con datos ficticios.** Ver sección 5.

## 4. Cómo se actualiza

Cada cambio en el código requiere una nueva versión. Los pasos son:

1. Pegar el código nuevo en `Código.gs` y en `index.html`.
2. Guardar.
3. Implementar > Administrar las implementaciones > editar (lápiz) > Versión: Nueva versión > agregar una descripción > Implementar.
4. La URL no cambia. Comprobar abriendo la URL pública y revisando el cambio.

## 5. Cómo se prueba sin afectar datos reales

1. Usar siempre una cédula ficticia (por ejemplo, 99999991) y datos ficticios.
2. Registrar una cuenta, enviar un caso con documentos de prueba, y revisar que se vea en el panel de administración.
3. Al terminar, borrar las filas de prueba de las hojas `personas`, `solicitudes`, `casos`, `documentos` y `autorizaciones`, y las carpetas de prueba en Drive. La función `seedFicticios` solo se usa en el prototipo y no debe quedar activa con datos reales.
4. Cambiar `ADMIN_PASSWORD` después de las pruebas.

## 6. Problema corregido: clics repetidos en "Crear cuenta"

Antes, al dar varios clics seguidos en "Crear cuenta", el servidor podía crear la misma cuenta varias veces, porque varias peticiones pasaban la revisión de cédula antes de que se escribiera la primera.

Se corrigió en dos partes (versión 4):
- **En la pantalla:** el botón "Crear cuenta" se desactiva apenas se presiona y se vuelve a activar solo si hubo un error.
- **En el servidor:** la creación de la cuenta se hace dentro de un bloqueo de script. Así, solo una petición puede crear la cuenta de una cédula; las demás reciben el mensaje "Esta cédula ya está registrada".

Si ya se crearon cuentas duplicadas en las pruebas anteriores, hay que borrar las filas repetidas de la hoja `personas` (y sus carpetas en Drive) antes de usar la plataforma con personas reales.

## 7. Reglas que no se deben romper

- La clave de administrador nunca va en el código ni en los documentos.
- Al revocar el tratamiento de datos, la persona solo puede hacerlo si no tiene casos ni solicitudes en curso. En ese caso se borran sus borradores, su fila de la hoja `personas` y su carpeta de Drive. Las autorizaciones firmadas (PDF) se mueven a la carpeta "Autorizaciones conservadas" y en la hoja `autorizaciones` queda la fecha de revocación.
- Los documentos solo se muestran a la víctima después de que Javier registre la copia radicada.
- Ninguna acción envía correos ni notificaciones automáticas.

## 8. Qué revisar si algo falla

- Si la pantalla dice "No se pudo leer" o no carga: revisar que la implementación sea de tipo aplicación web y que el acceso sea "cualquier persona".
- Si el administrador no puede entrar: revisar `ADMIN_PASSWORD` en las propiedades del script y que la URL incluya `?admin=1`.
- Si un caso no aparece: revisar la hoja `solicitudes` y el estado de la solicitud.
