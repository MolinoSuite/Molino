<p align="center">
  <img src="../.github/marca/pdf.svg" width="120" alt="">
</p>

<h1 align="center">Molino PDF</h1>

<p align="center"><b>Everything you need to do with a PDF, in one place.</b><br>
Read, fill in, sign, edit and organize your PDFs on Windows. Free, no ads, no account, and your documents are never uploaded anywhere.</p>

<p align="center"><a href="../README.en.md">← Molino</a> · <a href="pdf.md">Español</a> · <b>English</b> · <a href="https://molinosuite.org/en/pdf/">molinosuite.org/en/pdf</a></p>

<p align="center">
  <img src="../.github/presupuesto.png" width="860" alt="Molino PDF with a quote that calculates the amounts, the tax and the total by itself">
</p>

> [!NOTE]
> **It’s in the [Microsoft Store](https://apps.microsoft.com/detail/9NRTWZFHG67N).** Also with `winget install 9NRTWZFHG67N`.

## ✍️ Fill in and sign

- **Forms that do the math for you:** they add up the amounts, apply the tax and work out the total. Does the PDF have no fields? Type on top of it, wherever you like.
- **Sign by hand**, by drawing, typing your name or using a photo of your signature.
- **Sign with your digital certificate**, such as Spain’s FNMT, with the European standard for PDF (PAdES) and a timestamp included.

<p align="center">
  <img src="../.github/firma.png" width="49%" alt="A permission form filled in and signed by hand in Molino PDF">
  <img src="../.github/imprimir.png" width="49%" alt="Molino PDF’s print dialog, with the preview of four pages per sheet">
</p>

## 🗂️ Edit and organize

- **Edit** the text of the PDF itself and add text, images and shapes.
- **Annotate:** highlight, underline, strike through, add notes or draw freehand.
- **Organize pages:** reorder, rotate, delete, extract, split and combine documents.
- **Print** with a preview: several pages per sheet, booklets to fold, posters across several sheets and two-sided.

## 📷 From paper to PDF

- **Scan paper documents** with photos from your phone or with your scanner or all-in-one printer: it finds the sheet, straightens it, removes the shadows and makes it look freshly scanned.
- **Recognize the text** of scanned documents (OCR) so you can search and copy it.

## 🔒 Protect and share

- **True redaction:** removes from the file the data you black out, not just covers it.
- **Password-protect** (256-bit AES encryption) and **remove hidden data** before sharing.
- **Compress** and **convert** to Word or images.

## 🧠 AI on your computer, optional

Summarizes the document, answers your questions pointing to the pages each answer comes from, searches by meaning, translates and improves texts, and finds personal data to redact. It’s off by default, works offline and your documents never leave your computer. It’s the same AI in every Molino app. More at [molinosuite.org/en/ai](https://molinosuite.org/en/ai/).

## ⚙️ Automate tasks

With the `molino` command, the same for the whole suite, you convert, merge, compress, run OCR on, sign with your certificate and fill in many PDFs at once from PowerShell or a `.bat` file, without opening any windows:

```powershell
molino merge january.pdf february.pdf march.pdf -o quarter.pdf
molino sign quarter.pdf -o signed.pdf --certificate "John Smith"
```

It’s all in the [command-line manual](linea-de-ordenes.md) (in Spanish, with an [English summary](linea-de-ordenes.md#english-summary)).

## 🏠 Your documents stay on your computer

Molino PDF works offline and doesn’t ask you for an account. It only uses the Internet when you ask it to (the timestamp of a signature, which receives a fingerprint of the document, never the document itself; a certificate check; feedback you send us; or downloading the AI models, from Hugging Face) and to check for new versions, which you can turn off in Settings. Each PDF opens in an isolated Windows sandbox, so a booby-trapped file can’t touch your other files or connect to the Internet. It’s all in the [privacy policy](https://molinosuite.org/en/privacy/).

## 💻 Installation

For 64-bit Windows 10 and 11, including Windows 11 on Arm laptops. In English and Spanish: it follows the language of Windows.

1. Open [Molino PDF in the Microsoft Store](https://apps.microsoft.com/detail/9NRTWZFHG67N) and click **Get**. You don’t need to be an administrator or have an account.
2. Done. New versions arrive on their own through the Store.

Also with winget: `winget install 9NRTWZFHG67N`.

## 💬 Ideas or something not working?

Tell us from Molino PDF, in the **…** menu → **Send feedback**, or in [Issues](https://github.com/MolinoSuite/Molino/issues). It includes third-party components with their own licenses: the list is in **About Molino PDF → Third-party components**.
