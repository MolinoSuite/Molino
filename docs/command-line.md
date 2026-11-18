# Molino from the command line

*[Versión en español](linea-de-ordenes.md)*

With the `molino` command you can use every Molino app without opening any window: convert documents, spreadsheets and presentations, merge PDFs, compress them, run OCR on them, sign them, fill in forms or print. It's for automating tasks with PowerShell scripts, `.bat` files or Windows Task Scheduler. And inside Docs, Sheets and Slides you can also [write your own scripts](#your-own-scripts-in-docs-sheets-and-slides).

Everything happens on your computer, with the same engine the apps use. Nothing is uploaded to the internet. It only goes online to add a timestamp to a signature (the service gets a fingerprint of the document, never the document itself; turn it off with `--no-timestamp`) and to check whether a certificate is still valid, with `--long-term` or `verify --online`.

## Before you start

- The command comes with Molino PDF and with Molino Suite from the Microsoft Store. Open **PowerShell** or **Command Prompt** and type `molino help`.
- If Windows can't find `molino`, check that it's turned on in *Settings → Apps → Advanced app settings → App execution aliases*.
- Commands work in English or in Spanish: `molino merge` is the same as `molino unir`. The same goes for options (`--pages` and `--paginas`).
- Converting and printing Word, Excel, PowerPoint and OpenDocument files needs **Molino Suite**. Everything else also works with Molino PDF.
- If a file name has spaces, put it in quotes: `"My report.pdf"`.

## Common options

| Option | What it does |
| --- | --- |
| `-o`, `--output` | Where the result is saved. |
| `-y`, `--overwrite` | Lets Molino overwrite a file that already exists, including the input file. Without this option, Molino never overwrites a file. |
| `--password` | The password of the input PDF, if it has one. |
| `--pages` | Which pages: `1-3,5,8-` (from 8 to the end). Without this option, all of them. |
| `--json` | Output in JSON (for `info`, `certificates`, `verify`, `fields` and `printers`), to read it from another program. |

**Exit codes:** 0 if everything went well, 1 if there was an error, 2 if the command is written wrong, and 3 if `verify` finds signatures that aren't valid (or none at all).

## Converting

```
molino convert letter.docx letter.pdf
molino convert accounts.xlsx accounts.pdf
molino convert talk.pptx talk.pdf
molino convert letter.docx letter.odt
molino convert accounts.xlsx accounts.csv
molino convert report.pdf report.docx
molino convert report.pdf report.txt
molino convert report.pdf page.png        (one image per page: page-1.png, page-2.png…)
molino convert photo1.jpg photo2.jpg -o photos.pdf
```

- **Office documents** (`.docx`, `.doc`, `.odt`, `.rtf`, `.xlsx`, `.xls`, `.ods`, `.csv`, `.pptx`, `.ppt`, `.odp`): they're converted to PDF or to another format of the same kind. Documents, to `.docx`, `.odt`, `.rtf`, `.txt`, `.html` or `.epub`; spreadsheets, to `.xlsx`, `.ods` or `.csv`; presentations, to `.pptx`, `.odp` or `.ppsx`.
- **PDF**: converted to Word (`.docx`), to text (`.txt`) or to images (`.png`, `.jpg`). With images, `--dpi 300` sets the resolution.
- **Images**: put together into one PDF.

## Working with PDFs

| Command | Example |
| --- | --- |
| Merge | `molino merge a.pdf b.pdf c.pdf -o all.pdf` |
| Extract pages | `molino extract book.pdf --pages 10-20 -o chapter.pdf` |
| Split | `molino split book.pdf -o parts` (one per page), `--every 5` or `--ranges 1-3,4-9` |
| Rotate | `molino rotate scan.pdf --degrees 90 --pages 2 -o straight.pdf` |
| Delete pages | `molino delete-pages report.pdf --pages 1 -o no-cover.pdf` |
| Compress | `molino compress big.pdf -o small.pdf --level strong` (`light`, `balanced` or `strong`; `--grayscale` turns it black and white) |
| Recognize text (OCR) | `molino ocr scan.pdf -o searchable.pdf --languages spa,eng` |
| Watermark | `molino watermark contract.pdf --text "DRAFT" -o draft.pdf` (`--position center`, `--opacity 0.25`) |
| Number pages | `molino page-numbers report.pdf -o numbered.pdf --format "{page} of {pages}" --position bottom-right --start 1` |
| Protect | `molino protect payslips.pdf --password 1234 -o protected.pdf` |
| Remove protection | `molino unprotect protected.pdf --password <the owner password> -o unlocked.pdf` |
| Remove hidden data | `molino sanitize to-send.pdf -o clean.pdf` (removes metadata, attachments, JavaScript and hidden text) |
| Get the text | `molino text report.pdf` (on screen) or `-o report.txt` |
| Information | `molino info report.pdf` |

**Watermark positions:** `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left` and `bottom-right`.
**Page number positions:** `bottom-center`, `bottom-left`, `bottom-right`, `top-center`, `top-left` and `top-right`.

### Passwords when protecting

- `--password` is the password to open the PDF.
- `--no-print`, `--no-copy` and `--no-modify` restrict what can be done with it. If you use any of them, also add `--owner-password`, which you'll need to lift the restrictions.
- If you don't give an owner password, Molino makes one up and shows it at the end. Keep it, because `unprotect` asks for it.

## Signing with a certificate

```
molino certificates
molino sign contract.pdf -o signed.pdf --certificate "John Smith"
molino sign contract.pdf -o signed.pdf --certificate A1B2C3D4E5F6…   (the thumbprint that `certificates` shows)
molino sign contract.pdf -o signed.pdf --pfx my-certificate.pfx
molino verify signed.pdf
```

**Which certificate to sign with:**
- `--certificate` uses one of the certificates installed in Windows (for example, the one from the FNMT or the Spanish electronic ID card, DNIe, with its reader). You can give its thumbprint or part of its name. If several match, Molino shows you their thumbprints so you can pick one.
- `--pfx` signs with a certificate file. Molino asks for its password without showing it. In scripts, you can pass it with `--certificate-password`, although then it's written in the command.

**Signature options:**
- `--reason` and `--location` add the reason and the place to the signature.
- By default, the signature has a **timestamp**, from the service chosen in *Settings → Signature*. `--no-timestamp` leaves it out, and then signing works offline.
- `--long-term` makes a long-term signature (PAdES B-LTA), which needs a timestamp and a connection.
- The signature is **invisible** unless you give `--page N`. Then it shows on that page, by default at the bottom left. `--area x0,y0,x1,y1` picks another area, in points from the top left corner.

**Checking signatures:** `verify` tells you whether each signature is valid and why. With `--online`, it also checks whether the certificate has been revoked. It exits with 0 if every signature is valid.

## PDF forms

```
molino fields application.pdf
molino fill application.pdf --data data.json -o filled.pdf
```

`data.json` has the names of the fields (the ones `fields` shows) with their values:

```json
{ "name": "Ana García", "id": "12345678Z", "mode": "Online", "accept": true }
```

Checkboxes are ticked with `true`. For radio buttons, write the option you want to select.

## Printing

```
molino printers
molino print invoice.pdf
molino print letter.docx --printer "KYOCERA" --copies 2 --duplex
molino print report.pdf --pages 1-3 --grayscale
```

- Without `--printer`, the Windows default printer is used, the one marked with `*` in `printers`.
- The printer name can be just part of it.
- Office documents print exactly as they look in Docs, Sheets or Slides.

## Opening files

`molino open letter.docx report.pdf` (or just `molino letter.docx`) opens each file in its app.

## Automation examples

**Convert every Word file in a folder to PDF (PowerShell):**

```powershell
Get-ChildItem *.docx | ForEach-Object { molino convert $_.FullName ($_.BaseName + ".pdf") }
```

**Sign all the invoices and check them:**

```powershell
foreach ($f in Get-ChildItem .\invoices\*.pdf) {
  molino sign $f.FullName -o ".\signed\$($f.Name)" --certificate "My company"
  molino verify ".\signed\$($f.Name)"
  if ($LASTEXITCODE -ne 0) { Write-Warning "Check $($f.Name)" }
}
```

**Compress the scans every night** with Task Scheduler. The action is the program `molino` with the arguments `compress C:\Scans\today.pdf -o C:\Scans\today-small.pdf -y`.

**Turn every Excel file in a folder into CSV:**

```powershell
Get-ChildItem *.xlsx | ForEach-Object { molino convert $_.FullName ($_.BaseName + ".csv") }
```

## Your own scripts in Docs, Sheets and Slides

To automate what you do inside an open document, Docs, Sheets and Slides (with **Molino Suite**) have **My scripts**: you save your own JavaScript scripts and run them on the document you have open.

- They're in the **Advanced** tab in Docs and Sheets, and in the **Scripts** tab in Slides. That tab is hidden at first: you turn it on in **Settings**.
- In Docs, the **Advanced** tab also has form controls (text, checkboxes, lists, dates…) and **Fill-in only**. In Sheets, data validation, cell locking and sheet protection.
- Scripts use the [ONLYOFFICE document API](https://api.onlyoffice.com/docs/office-api/get-started/overview/) (`Api.GetDocument()`, `Api.GetActiveSheet()`…), and `print()` writes the result in the script box itself. There are examples to get you started.
- They only run on that document, with no access to your files or the internet, and **Ctrl+Z** undoes what they do.
- They're saved in Molino, not in the document. Macros that come inside documents **never** run.

An example for Docs, the one called "Count paragraphs":

```js
var doc = Api.GetDocument();
print('Paragraphs:', doc.GetElementsCount());
```

## Privacy and security

- Documents are opened inside the same isolated space the apps use.
- The command line works in its own temporary folder, which is deleted when it finishes.
- It doesn't change Molino's settings. It only reads them: the language and the timestamp service.
- It doesn't need the internet, except for signature timestamps, long-term signatures (`--long-term`) and `verify --online`.
- More details in the [privacy policy](https://molinosuite.org/en/privacy/).
