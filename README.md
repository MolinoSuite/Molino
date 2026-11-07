<div align="center">

**Español** · [English](README.en.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/marca/molino-oscuro.svg">
  <img src=".github/marca/molino.svg" alt="Molino" width="300">
</picture>

### No son gigantes, son molinos.

Una suite ofimática gratis para tu ordenador: documentos, hojas de cálculo, presentaciones y PDF.<br>
Sin anuncios, sin cuentas, sin suscripciones, y tus archivos se quedan en tu equipo.

</div>

| | App | |
|:-:|---|---|
| <img src=".github/marca/pdf.svg" width="44" alt=""> | **Molino PDF**<br>Lee, rellena, firma, edita y organiza tus PDF. | Windows · [más abajo](#molino-pdf) |
| <img src=".github/marca/documentos.svg" width="44" alt=""> | **Molino Documentos**<br>Cartas, informes y cualquier otro documento. | En desarrollo |
| <img src=".github/marca/hojas.svg" width="44" alt=""> | **Molino Hojas**<br>Cuentas, presupuestos y listas. | En desarrollo |
| <img src=".github/marca/presentaciones.svg" width="44" alt=""> | **Molino Presentaciones**<br>Presentaciones. | En desarrollo |

Molino se llama así por los molinos de La Mancha. Primero llega Molino PDF; Documentos, Hojas y Presentaciones vienen en camino.

## Molino PDF

**Todo lo que necesitas hacer con un PDF, en un solo sitio.**<br>
Lee, rellena, firma, edita y organiza tus PDF en Windows. Gratis, sin anuncios, sin cuentas y sin subir tus documentos a ningún sitio.

> [!NOTE]
> **La primera versión sale muy pronto.** Para enterarte, pulsa arriba **Watch → Custom → Releases**, o dale una ⭐.

<div align="center">
<img src=".github/presupuesto.png" alt="Molino PDF con un presupuesto que calcula solo los importes, el IVA y el total" width="860">
</div>

### Qué puedes hacer

- **Rellenar formularios**, también los que calculan solos los importes, el IVA y el total, y escribir en cualquier PDF aunque no tenga campos para rellenar.
- **Firmar** a mano (dibujando, escribiendo tu nombre o con una foto de tu firma) o con tu **certificado digital**, como el de la FNMT, con sello de tiempo incluido.
- **Editar** el texto del propio PDF y añadir texto, imágenes y formas.
- **Anotar**: resaltar, subrayar, tachar, notas y dibujo a mano alzada.
- **Organizar páginas**: ordenar, girar, borrar, extraer, dividir y combinar documentos.
- **Imprimir** con vista previa: varias páginas por hoja (también la misma repetida, para etiquetas u octavillas), folletos para doblar, pósteres en varias hojas, otros tamaños de papel y a doble cara.
- **Digitalizar papeles** con fotos del móvil o con tu escáner o impresora multifunción: Molino PDF encuentra la hoja en cada foto, la endereza, quita las sombras y la deja como recién escaneada.
- **IA en tu equipo, opcional**: resume el documento, contesta preguntas indicando las páginas de donde sale cada respuesta, busca por significado, traduce y mejora textos y encuentra datos personales para censurarlos. Funciona sin Internet: los modelos solo se descargan si la activas, y tus documentos nunca salen de tu equipo.
- Y además: reconocer el texto de los escaneados (OCR), proteger con contraseña, censurar de verdad, comprimir y convertir a Word o a imágenes.

Molino PDF está en español y en inglés, y sigue el idioma de Windows.

<p align="center">
  <img src=".github/firma.png" alt="Una autorización rellenada y firmada a mano en Molino PDF" width="49%">
  <img src=".github/imprimir.png" alt="El cuadro de imprimir de Molino PDF, con la vista previa de cuatro páginas por hoja" width="49%">
</p>

### Tus documentos se quedan en tu equipo

Molino PDF funciona sin conexión: no sube tus PDF a ningún servidor ni te pide una cuenta. Solo usa Internet cuando tú lo pides (el sello de tiempo de una firma, que recibe una huella del documento, nunca el documento; un comentario que nos envíes, o la descarga de los modelos de la IA, desde Hugging Face) y para avisarte de versiones nuevas. La IA también funciona en tu equipo: lo que preguntas y lo que responde no sale de él.

Además, cada PDF se abre en un espacio aislado de Windows, pensado para que un archivo con trampa no pueda tocar tus otros archivos ni conectarse a Internet.

### Instalación

1. Descarga **MolinoPDF-Setup** de la [última versión](https://github.com/MolinoSuite/Molino/releases/latest).
2. Ábrelo y sigue los pasos. No hace falta ser administrador.
3. Listo. Cuando haya una versión nueva, Molino PDF te avisará.

**Versión portable:** si prefieres no instalar nada, descarga [MolinoPDF-Portable.zip](https://github.com/MolinoSuite/Molino/releases/latest/download/MolinoPDF-Portable.zip), descomprímelo en cualquier carpeta y abre `MolinoPDF.exe`. Guarda sus ajustes en esa carpeta y no cambia nada en Windows.

Para Windows 10 y 11 de 64 bits, también en portátiles con Windows 11 ARM.

## ¿Ideas o algo que no va bien?

Cuéntanoslo desde Molino PDF, en el menú **…** → **Enviar comentarios**, en [Issues](https://github.com/MolinoSuite/Molino/issues) o en [info@molinosuite.org](mailto:info@molinosuite.org). Y si Molino te resulta útil, dale una ⭐: así lo encuentra más gente.

## Apoya Molino

Molino es gratis y lo seguirá siendo, sin anuncios, sin suscripciones y sin versiones de pago. Si te resulta útil, puedes invitarme a un café en [GitHub Sponsors](https://github.com/sponsors/CuevasTech).

## Licencia

Molino es software libre con licencia [GNU AGPL, versión 3 o posterior](LICENSE), y se ofrece sin ninguna garantía. © 2026 CuevasTech.<br>
Incluye componentes de terceros con sus propias licencias: la lista está en Molino PDF, en **Acerca de Molino PDF → Componentes de terceros**.<br>
La licencia no cubre los nombres ni los logos: lo que puedes hacer con ellos está en [TRADEMARKS.md](TRADEMARKS.md#nombre-y-logo-de-molino).

<details>
<summary>Compilar desde el código</summary>

<br>

Hace falta Node 22.12 o posterior y Python 3.12 o posterior. En PowerShell:

```powershell
npm ci --ignore-scripts
npm run electron:install
py -m venv engine\.venv
engine\.venv\Scripts\python.exe -m pip install --no-deps --only-binary :all: --require-hashes -r engine\requirements.txt -r engine\requirements-nodeps.txt
engine\.venv\Scripts\python.exe -m pip install --only-binary :all: --require-hashes -r engine\requirements-build.txt
powershell -File scripts\fetch-tessdata.ps1
npm run dist
```

El instalador queda en `dist\`.

</details>
