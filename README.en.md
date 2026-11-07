<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/marca/banner-en-oscuro.svg">
    <img src=".github/marca/banner-en.svg" width="100%" alt="Molino. They’re not giants, they’re windmills. The free, open-source office suite for your computer.">
  </picture>
</p>

<p align="center"><a href="README.md">Español</a> · <b>English</b> · <a href="https://molinosuite.org/en/">molinosuite.org</a></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-2F40A8?style=for-the-badge" alt="AGPL-3.0 license"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%C2%B7%2011-2F40A8?style=for-the-badge" alt="Windows 10 and 11">
  <img src="https://img.shields.io/badge/free-forever-2A9358?style=for-the-badge" alt="Free forever">
  <img src="https://img.shields.io/badge/telemetry-none-2A9358?style=for-the-badge" alt="No telemetry">
  <a href="https://github.com/sponsors/CuevasTech"><img src="https://img.shields.io/badge/support-Sponsors-C4505A?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Support Molino on GitHub Sponsors"></a>
</p>

<h3 align="center">Documents, spreadsheets, presentations and PDF.<br>No subscriptions, no accounts and no uploading your files to anyone’s cloud.</h3>

<br>

## The apps

Each sail of the windmill is an app. Install only the ones you need: the others can be added for free to the same installation.

<table>
  <tr>
    <td align="center" width="25%" valign="top">
      <a href="docs/pdf.en.md"><img src=".github/marca/pdf.svg" width="96" alt=""></a>
      <h3><a href="docs/pdf.en.md">Molino PDF</a></h3>
      <p>Read, fill in, sign, edit and organize your PDFs.</p>
      <img src="https://img.shields.io/badge/-coming%20soon-B92B32?style=flat-square" alt="Coming soon">
    </td>
    <td align="center" width="25%" valign="top">
      <a href="https://molinosuite.org/en/docs/"><img src=".github/marca/documentos.svg" width="96" alt=""></a>
      <h3><a href="https://molinosuite.org/en/docs/">Molino Docs</a></h3>
      <p>Letters, reports and any document, Word files included.</p>
      <img src="https://img.shields.io/badge/-on%20the%20way-7B766B?style=flat-square" alt="On the way">
    </td>
    <td align="center" width="25%" valign="top">
      <a href="https://molinosuite.org/en/sheets/"><img src=".github/marca/hojas.svg" width="96" alt=""></a>
      <h3><a href="https://molinosuite.org/en/sheets/">Molino Sheets</a></h3>
      <p>Accounts, budgets, lists and tables, Excel files included.</p>
      <img src="https://img.shields.io/badge/-on%20the%20way-7B766B?style=flat-square" alt="On the way">
    </td>
    <td align="center" width="25%" valign="top">
      <a href="https://molinosuite.org/en/slides/"><img src=".github/marca/presentaciones.svg" width="96" alt=""></a>
      <h3><a href="https://molinosuite.org/en/slides/">Molino Slides</a></h3>
      <p>For class, for work or for an idea, PowerPoint files included.</p>
      <img src="https://img.shields.io/badge/-on%20the%20way-7B766B?style=flat-square" alt="On the way">
    </td>
  </tr>
</table>

## The same rules, for all four

<table>
  <tr>
    <td width="33%" valign="top"><h3>🎁 Free forever</h3>No paid version, no trial periods and no subscriptions. Ever.</td>
    <td width="33%" valign="top"><h3>🏠 Your files stay with you</h3>Everything runs on your computer, even offline. Nothing is uploaded to anyone’s cloud.</td>
    <td width="33%" valign="top"><h3>🙅 No accounts</h3>No email, no sign-up, no logging in. Install it and use it.</td>
  </tr>
  <tr>
    <td valign="top"><h3>📂 Opens what people send you</h3>Designed for Office documents and for open formats.</td>
    <td valign="top"><h3>🧠 AI on your computer, if you want</h3>Optional and off by default. What you ask never leaves your computer.</td>
    <td valign="top"><h3>🔍 Open source</h3>Free software: anyone can review it, and no one can take it away from you.</td>
  </tr>
</table>

## The first one: Molino PDF

<p align="center">
  <a href="docs/pdf.en.md"><img src=".github/presupuesto.png" width="860" alt="Molino PDF with a quote that calculates the amounts, the tax and the total by itself"></a>
</p>

<p align="center">Forms that do the math for you, digital certificate signatures, scanning with your phone and AI that never leaves your computer.<br><b><a href="docs/pdf.en.md">Everything Molino PDF does →</a></b></p>

## Download

**The first version of Molino PDF is coming very soon.** To hear about it on day one, click **Watch → Custom → Releases** at the top, or give it a ⭐.

## Support Molino

Molino is free and will stay free. If you find it useful, tell someone about it, give it a ⭐ or buy me a coffee on [GitHub Sponsors](https://github.com/sponsors/CuevasTech). Ideas or something not working? Tell us in [Issues](https://github.com/MolinoSuite/Molino/issues) or at [info@molinosuite.org](mailto:info@molinosuite.org).

## License

Molino is free software under the [GNU AGPL, version 3 or later](LICENSE), and comes with no warranty. © 2026 CuevasTech. The names and logos aren’t covered by the license: what you can do with them is in [TRADEMARKS.md](TRADEMARKS.md#molino-name-and-logo).

<details>
<summary><b>For developers: build from source</b></summary>

<br>

Today the repository holds Molino PDF. You need Node 22.12 or later and Python 3.12 or later. In PowerShell:

```powershell
npm ci --ignore-scripts
npm run electron:install
py -m venv engine\.venv
engine\.venv\Scripts\python.exe -m pip install --no-deps --only-binary :all: --require-hashes -r engine\requirements.txt -r engine\requirements-nodeps.txt
engine\.venv\Scripts\python.exe -m pip install --only-binary :all: --require-hashes -r engine\requirements-build.txt
powershell -File scripts\fetch-tessdata.ps1
npm run dist
```

The installer ends up in `dist\`.

</details>
