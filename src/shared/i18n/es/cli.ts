/** La línea de órdenes (`molino …`, src/main/cli.ts). El manual completo está en docs/linea-de-ordenes.md. */
export const cli = {
  usage: `Molino desde la línea de órdenes. Todo se hace en tu equipo, sin internet ni ventanas.

Uso: molino <orden> [archivos] [opciones]

Archivos
  convertir <entrada> <salida>       Word, Excel, PowerPoint, ODF ↔ PDF; PDF → Word, texto o imágenes; imágenes → PDF
  unir <a.pdf> <b.pdf>… -o <salida>  Une varios PDF en uno
  extraer <pdf> --paginas 1-3,5 -o <salida>
  dividir <pdf> -o <carpeta> [--cada N | --rangos 1-3,4-9]
  girar <pdf> --grados 90|180|270 [--paginas …] -o <salida>
  borrar-paginas <pdf> --paginas … -o <salida>
  comprimir <pdf> -o <salida> [--nivel ligero|equilibrado|fuerte] [--grises]
  ocr <pdf> -o <salida> [--idiomas spa,eng]
  marca-agua <pdf> --texto "CONFIDENCIAL" -o <salida> [--posicion centro] [--opacidad 0.25]
  numerar <pdf> -o <salida> [--formato "{page} de {pages}"] [--posicion abajo-centro] [--inicio 1]
  proteger <pdf> --contrasena <clave> -o <salida> [--sin-imprimir] [--sin-copiar] [--sin-modificar]
  desproteger <pdf> --contrasena <clave> -o <salida>
  limpiar <pdf> -o <salida>          Quita metadatos, adjuntos, JavaScript y datos ocultos
  texto <pdf> [-o <salida.txt>]      El texto del PDF (sin -o, en la pantalla)
  info <pdf>                         Páginas, título, autor, protección y firmas

Firmas y formularios
  firmar <pdf> -o <salida> (--certificado <huella o nombre> | --pfx <archivo.pfx>)
         [--motivo …] [--lugar …] [--sin-sello] [--larga-duracion] [--pagina N --zona x0,y0,x1,y1]
  certificados                       Tus certificados de Windows con los que se puede firmar
  verificar <pdf> [--en-linea]       Comprueba las firmas (sale con 3 si alguna no es válida)
  campos <pdf>                       Los campos del formulario
  rellenar <pdf> --datos <datos.json> -o <salida>

Imprimir
  imprimir <archivo> [--impresora …] [--copias N] [--paginas …] [--grises] [--doble-cara]
  impresoras                         Las impresoras instaladas

Otras
  abrir <archivos…>                  Los abre en su app
  version · ayuda [orden]

Opciones comunes: -o/--salida, -y/--sobrescribir, --contrasena (la del PDF de entrada), --json.
Manual: https://github.com/MolinoSuite/Molino/blob/main/docs/linea-de-ordenes.md`,
  unknownCommand: 'No conozco la orden «{name}». Escribe «molino ayuda» para ver las que hay.',
  missingInput: 'Falta el archivo de entrada.',
  missingOutput: 'Falta dónde guardar el resultado: -o <archivo>.',
  missingOption: 'Falta la opción --{name}.',
  badOption: 'El valor de --{name} no es válido: «{value}».',
  notFound: 'No existe el archivo «{path}».',
  exists: 'Ya existe «{path}». Usa -y para sobrescribirlo.',
  sameFile: 'La salida es el mismo archivo que la entrada. Usa -y si quieres sobrescribirlo.',
  badPages: 'Las páginas «{value}» no son válidas (el documento tiene {count}). Ejemplo: 1-3,5,8-',
  passwordNeeded: 'El PDF tiene contraseña: indícala con --contrasena.',
  officeMissing: 'Para convertir documentos de oficina hace falta Molino Suite.',
  cantConvert: 'No sé convertir de {from} a {to}.',
  done: 'Hecho: {path}',
  doneFolder: 'Hecho: {count} archivos en {path}',
  printed: 'Enviado a {printer}.',
  noPrinter: 'No hay ninguna impresora con ese nombre: «{name}». Mira las que hay con «molino impresoras».',
  noPrinters: 'No hay impresoras instaladas.',
  noCertificate: 'No hay ningún certificado con el que firmar que coincida con «{name}». Mira los tuyos con «molino certificados».',
  manyCertificates: 'Hay varios certificados que coinciden con «{name}»; usa su huella:',
  noCertificates: 'No tienes certificados con los que firmar en Windows.',
  signed: 'Firmado: {path}',
  noSignatures: 'El PDF no tiene firmas.',
  noFields: 'El PDF no tiene campos de formulario.',
  badData: 'No se pudo leer «{path}»: tiene que ser un JSON con los nombres de los campos y sus valores.',
  unknownField: 'Aviso: el PDF no tiene ningún campo «{name}».',
  filled: 'Rellenados {count} campos: {path}',
  ownerPassword: 'Contraseña de propietario (guárdala: hace falta para quitar la protección): {password}',
  readPassword: 'Contraseña del certificado: ',
  failed: 'Error: {message}',
  info: {
    pages: 'Páginas',
    title: 'Título',
    author: 'Autor',
    protected: 'Protegido con contraseña',
    signed: 'Firmado',
    yes: 'sí',
    no: 'no'
  },
  status: { valid: 'válida', warning: 'con avisos', invalid: 'no válida', unknown: 'sin comprobar' }
}
