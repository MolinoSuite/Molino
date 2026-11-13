# Molino desde la línea de órdenes

Con el comando `molino` puedes usar todas las apps de Molino sin abrir ninguna ventana: convertir documentos, hojas de cálculo y presentaciones, unir PDF, comprimirlos, pasarles el OCR, firmarlos, rellenar formularios o imprimir. Sirve para automatizar tareas con scripts de PowerShell, archivos `.bat` o el Programador de tareas de Windows. Y dentro de Documentos, Hojas y Presentaciones puedes además [escribir tus propios scripts](#tus-scripts-en-documentos-hojas-y-presentaciones).

Todo se hace en tu equipo, con el mismo motor que usan las apps. Nada se sube a internet. Solo se conecta para firmar con sello de tiempo (el servicio recibe una huella del documento, nunca el documento; se quita con `--sin-sello`) y para consultar si un certificado sigue siendo válido, con `--larga-duracion` o `verificar --en-linea`.

*English summary at the end.*

## Antes de empezar

- El comando llega con Molino PDF y con Molino Suite de la Microsoft Store. Abre **PowerShell** o **Símbolo del sistema** y escribe `molino ayuda`.
- Si Windows no encuentra `molino`, comprueba que está activado en *Configuración → Aplicaciones → Configuración avanzada de aplicaciones → Alias de ejecución de aplicaciones*.
- Las órdenes se escriben en español o en inglés: `molino unir` es lo mismo que `molino merge`. Lo mismo pasa con las opciones (`--paginas` y `--pages`).
- Convertir e imprimir documentos de Word, Excel, PowerPoint y OpenDocument necesita **Molino Suite**. Todo lo demás funciona también con Molino PDF.
- Si un nombre de archivo lleva espacios, ponlo entre comillas: `"Mi informe.pdf"`.

## Opciones comunes

| Opción | Para qué sirve |
| --- | --- |
| `-o`, `--salida` | Dónde se guarda el resultado. |
| `-y`, `--sobrescribir` | Permite sobrescribir un archivo que ya existe, incluido el de entrada. Sin esta opción, Molino nunca pisa un archivo. |
| `--contrasena` | La contraseña del PDF de entrada, si la tiene. |
| `--paginas` | Qué páginas: `1-3,5,8-` (del 8 al final). Sin esta opción, todas. |
| `--json` | Salida en JSON (en `info`, `certificados`, `verificar`, `campos` e `impresoras`), para leerla desde otro programa. |

**Códigos de salida:** 0 si todo ha ido bien, 1 si ha habido un error, 2 si la orden está mal escrita, y 3 si `verificar` encuentra firmas que no son válidas (o ninguna).

## Convertir

```
molino convertir carta.docx carta.pdf
molino convertir cuentas.xlsx cuentas.pdf
molino convertir charla.pptx charla.pdf
molino convertir carta.docx carta.odt
molino convertir cuentas.xlsx cuentas.csv
molino convertir informe.pdf informe.docx
molino convertir informe.pdf informe.txt
molino convertir informe.pdf pagina.png        (una imagen por página: pagina-1.png, pagina-2.png…)
molino convertir foto1.jpg foto2.jpg -o fotos.pdf
```

- **Documentos de oficina** (`.docx`, `.doc`, `.odt`, `.rtf`, `.xlsx`, `.xls`, `.ods`, `.csv`, `.pptx`, `.ppt`, `.odp`): se convierten a PDF o a otro formato del mismo tipo. Los documentos, a `.docx`, `.odt`, `.rtf`, `.txt`, `.html` o `.epub`; las hojas de cálculo, a `.xlsx`, `.ods` o `.csv`; las presentaciones, a `.pptx`, `.odp` o `.ppsx`.
- **PDF**: se convierte a Word (`.docx`), a texto (`.txt`) o a imágenes (`.png`, `.jpg`). Con imágenes, `--ppp 300` fija la resolución.
- **Imágenes**: se juntan en un PDF.

## Trabajar con PDF

| Orden | Ejemplo |
| --- | --- |
| Unir | `molino unir a.pdf b.pdf c.pdf -o todo.pdf` |
| Extraer páginas | `molino extraer libro.pdf --paginas 10-20 -o capitulo.pdf` |
| Dividir | `molino dividir libro.pdf -o partes` (una por página), `--cada 5` o `--rangos 1-3,4-9` |
| Girar | `molino girar escaneo.pdf --grados 90 --paginas 2 -o derecho.pdf` |
| Borrar páginas | `molino borrar-paginas informe.pdf --paginas 1 -o sin-portada.pdf` |
| Comprimir | `molino comprimir grande.pdf -o ligero.pdf --nivel fuerte` (`ligero`, `equilibrado` o `fuerte`; `--grises` lo pasa a blanco y negro) |
| Reconocer texto (OCR) | `molino ocr escaneo.pdf -o buscable.pdf --idiomas spa,eng` |
| Marca de agua | `molino marca-agua contrato.pdf --texto "BORRADOR" -o borrador.pdf` (`--posicion centro`, `--opacidad 0.25`) |
| Numerar páginas | `molino numerar informe.pdf -o numerado.pdf --formato "{page} de {pages}" --posicion abajo-derecha --inicio 1` |
| Proteger | `molino proteger nominas.pdf --contrasena 1234 -o protegido.pdf` |
| Quitar la protección | `molino desproteger protegido.pdf --contrasena <la de propietario> -o libre.pdf` |
| Limpiar datos ocultos | `molino limpiar enviar.pdf -o limpio.pdf` (quita metadatos, adjuntos, JavaScript y texto oculto) |
| Sacar el texto | `molino texto informe.pdf` (en la pantalla) o `-o informe.txt` |
| Información | `molino info informe.pdf` |

**Posiciones de la marca de agua:** `centro`, `arriba`, `abajo`, `izquierda`, `derecha`, `arriba-izquierda`, `arriba-derecha`, `abajo-izquierda` y `abajo-derecha`.
**Posiciones de los números:** `abajo-centro`, `abajo-izquierda`, `abajo-derecha`, `arriba-centro`, `arriba-izquierda` y `arriba-derecha`.

### Contraseñas al proteger

- `--contrasena` es la contraseña para abrir el PDF.
- `--sin-imprimir`, `--sin-copiar` y `--sin-modificar` restringen lo que se puede hacer con él. Si usas alguna, añade también `--contrasena-propietario`, que hará falta para quitar las restricciones.
- Si no indicas la contraseña de propietario, Molino genera una y la muestra al terminar. Guárdala, porque `desproteger` la pide.

## Firmar con certificado

```
molino certificados
molino firmar contrato.pdf -o firmado.pdf --certificado "Juan Español"
molino firmar contrato.pdf -o firmado.pdf --certificado A1B2C3D4E5F6…   (la huella que da «certificados»)
molino firmar contrato.pdf -o firmado.pdf --pfx mi-certificado.pfx
molino verificar firmado.pdf
```

**Con qué certificado firmar:**
- `--certificado` usa uno de los certificados instalados en Windows (por ejemplo, el de la FNMT o el DNIe con su lector). Se puede indicar por la huella o por parte del nombre. Si coinciden varios, Molino te enseña sus huellas para que elijas una.
- `--pfx` firma con un archivo de certificado. Molino te pide su contraseña sin mostrarla. En scripts, se puede pasar con `--contrasena-certificado`, aunque así queda escrita en la orden.

**Opciones de la firma:**
- `--motivo` y `--lugar` añaden el motivo y el lugar a la firma.
- Por defecto, la firma lleva **sello de tiempo**, con el servicio elegido en *Ajustes → Firma*. `--sin-sello` lo quita, y entonces la firma funciona sin conexión.
- `--larga-duracion` hace una firma de larga duración (PAdES B-LTA), que necesita sello de tiempo y conexión.
- La firma es **invisible** salvo que indiques `--pagina N`. Entonces se ve en esa página, por defecto abajo a la izquierda. `--zona x0,y0,x1,y1` elige otra zona, en puntos desde la esquina superior izquierda.

**Comprobar firmas:** `verificar` dice si cada firma es válida y por qué. Con `--en-linea`, además consulta si el certificado está revocado. Sale con 0 si todas las firmas son válidas.

## Formularios PDF

```
molino campos solicitud.pdf
molino rellenar solicitud.pdf --datos datos.json -o rellena.pdf
```

`datos.json` contiene los nombres de los campos (los que muestra `campos`) con sus valores:

```json
{ "nombre": "Ana García", "dni": "12345678Z", "modalidad": "En línea", "acepto": true }
```

Las casillas se marcan con `true`. En los botones de opción se escribe la opción que se quiere marcar.

## Imprimir

```
molino impresoras
molino imprimir factura.pdf
molino imprimir carta.docx --impresora "KYOCERA" --copias 2 --doble-cara
molino imprimir informe.pdf --paginas 1-3 --grises
```

- Sin `--impresora`, se usa la predeterminada de Windows, la que lleva `*` en `impresoras`.
- El nombre de la impresora puede ser solo una parte.
- Los documentos de oficina se imprimen tal como se ven en Documentos, Hojas o Presentaciones.

## Abrir archivos

`molino abrir carta.docx informe.pdf` (o solo `molino carta.docx`) abre cada archivo en su app.

## Ejemplos de automatización

**Convertir a PDF todos los Word de una carpeta (PowerShell):**

```powershell
Get-ChildItem *.docx | ForEach-Object { molino convertir $_.FullName ($_.BaseName + ".pdf") }
```

**Firmar todas las facturas y comprobarlas:**

```powershell
foreach ($f in Get-ChildItem .\facturas\*.pdf) {
  molino firmar $f.FullName -o ".\firmadas\$($f.Name)" --certificado "Mi empresa"
  molino verificar ".\firmadas\$($f.Name)"
  if ($LASTEXITCODE -ne 0) { Write-Warning "Revisar $($f.Name)" }
}
```

**Comprimir cada noche los escaneos** con el Programador de tareas. La acción es el programa `molino` con los argumentos `comprimir C:\Escaneos\hoy.pdf -o C:\Escaneos\hoy-ligero.pdf -y`.

**Pasar a CSV todos los archivos de Excel de una carpeta:**

```powershell
Get-ChildItem *.xlsx | ForEach-Object { molino convertir $_.FullName ($_.BaseName + ".csv") }
```

## Tus scripts en Documentos, Hojas y Presentaciones

Para automatizar lo que haces dentro de un documento abierto, Documentos, Hojas y Presentaciones (con **Molino Suite**) tienen **Mis scripts**: guardas tus propios scripts en JavaScript y los ejecutas sobre el documento que tienes abierto.

- Están en la pestaña **Programador** de Documentos y Hojas, y en la pestaña **Scripts** de Presentaciones. Esa pestaña viene oculta: se activa en **Ajustes**.
- En Documentos, la pestaña **Programador** trae también los controles de formulario (texto, casillas, listas, fechas…) y **Solo rellenar**. En Hojas, validar datos, bloquear celdas y proteger la hoja.
- Los scripts usan la [API de documentos de ONLYOFFICE](https://api.onlyoffice.com/docs/office-api/get-started/overview/) (`Api.GetDocument()`, `Api.GetActiveSheet()`…), y `print()` escribe el resultado en el propio cuadro. Hay ejemplos para empezar.
- Se ejecutan solo sobre ese documento, sin acceso a tus archivos ni a internet, y **Ctrl+Z** deshace lo que hacen.
- Se guardan en Molino, no en el documento. Las macros que traen los documentos **nunca** se ejecutan.

Un ejemplo para Documentos, el de «Contar los párrafos»:

```js
var doc = Api.GetDocument();
print('Párrafos:', doc.GetElementsCount());
```

## Privacidad y seguridad

- Los documentos se abren dentro del mismo espacio aislado que usan las apps.
- La línea de órdenes trabaja en su propia carpeta temporal, que se borra al terminar.
- No cambia los ajustes de Molino. Solo los lee: el idioma y el servicio de sello de tiempo.
- No necesita internet, salvo para el sello de tiempo de las firmas, para las firmas de larga duración (`--larga-duracion`) y para `verificar --en-linea`.
- Más detalles en la [política de privacidad](https://molinosuite.org/privacidad/).

---

## English summary

`molino` lets you use every Molino app from PowerShell or the Command Prompt, with no windows open: Word, Excel, PowerPoint and OpenDocument files (with Molino Suite), PDFs and images. Every command and option also has an English name. It all happens on your computer; it only goes online for signature timestamps (`--no-timestamp` turns them off), long-term signatures (`--long-term`) and `verify --online`.

**Commands:**
- **Files:** `convert`, `merge`, `extract`, `split`, `rotate`, `delete-pages`, `compress`, `ocr`, `watermark`, `page-numbers`, `protect`, `unprotect`, `sanitize`, `text`, `info`.
- **Signatures and forms:** `sign`, `certificates`, `verify`, `fields`, `fill`.
- **Printing:** `print`, `printers`.
- **Other:** `open`, `version`, `help`.

**Options:**
- **General:** `-o/--output`, `-y/--overwrite`, `--password`, `--pages`, `--json`.
- **Page tools:** `--every`, `--ranges`, `--degrees`, `--level`, `--grayscale`, `--languages`, `--text`, `--position`, `--opacity`, `--format`, `--start`.
- **Protection:** `--owner-password`, `--no-print`, `--no-copy`, `--no-modify`.
- **Signing:** `--certificate`, `--pfx`, `--certificate-password`, `--reason`, `--location`, `--no-timestamp`, `--long-term`, `--page`, `--area`, `--online`.
- **Forms and printing:** `--data`, `--printer`, `--copies`, `--duplex`.

Run `molino help` for the full list in your language.

**Your own scripts:** inside Docs, Sheets and Slides (Molino Suite), **My scripts** runs your own JavaScript on the open document, with the [ONLYOFFICE document API](https://api.onlyoffice.com/docs/office-api/get-started/overview/), no access to your files or the internet, and Ctrl+Z to undo it. It lives in the **Developer** tab (**Scripts**, in Slides), which is hidden by default and turned on in **Settings**; in Docs the tab also has form controls, and in Sheets, data validation, cell locking and sheet protection. Macros that come inside documents never run.
