import type { cli as es } from '../es/cli'

/** The command line (`molino …`, src/main/cli.ts). Full manual in docs/linea-de-ordenes.md. */
export const cli: typeof es = {
  usage: `Molino from the command line. Everything happens on your computer, with no internet and no windows.

Usage: molino <command> [files] [options]
(Spanish and English command names both work: convert = convertir, merge = unir…)

Files
  convert <input> <output>           Word, Excel, PowerPoint, ODF ↔ PDF; PDF → Word, text or images; images → PDF
  merge <a.pdf> <b.pdf>… -o <output> Merge several PDFs into one
  extract <pdf> --pages 1-3,5 -o <output>
  split <pdf> -o <folder> [--every N | --ranges 1-3,4-9]
  rotate <pdf> --degrees 90|180|270 [--pages …] -o <output>
  delete-pages <pdf> --pages … -o <output>
  compress <pdf> -o <output> [--level light|balanced|strong] [--grayscale]
  ocr <pdf> -o <output> [--languages spa,eng]
  watermark <pdf> --text "CONFIDENTIAL" -o <output> [--position center] [--opacity 0.25]
  page-numbers <pdf> -o <output> [--format "{page} of {pages}"] [--position bottom-center] [--start 1]
  protect <pdf> --password <pw> -o <output> [--no-print] [--no-copy] [--no-modify]
  unprotect <pdf> --password <pw> -o <output>
  sanitize <pdf> -o <output>         Removes metadata, attachments, JavaScript and hidden data
  text <pdf> [-o <output.txt>]       The PDF's text (without -o, on screen)
  info <pdf>                         Pages, title, author, protection and signatures

Signatures and forms
  sign <pdf> -o <output> (--certificate <thumbprint or name> | --pfx <file.pfx>)
       [--reason …] [--location …] [--no-timestamp] [--long-term] [--page N --area x0,y0,x1,y1]
  certificates                       Your Windows certificates that can sign
  verify <pdf> [--online]            Checks the signatures (exits with 3 if any is not valid)
  fields <pdf>                       The form fields
  fill <pdf> --data <data.json> -o <output>

Printing
  print <file> [--printer …] [--copies N] [--pages …] [--grayscale] [--duplex]
  printers                           The installed printers

Other
  open <files…>                      Opens them in their app
  version · help [command]

Common options: -o/--output, -y/--overwrite, --password (the input PDF's), --json.
Manual: https://github.com/MolinoSuite/Molino/blob/main/docs/linea-de-ordenes.md`,
  unknownCommand: 'Unknown command «{name}». Type «molino help» to see them.',
  missingInput: 'The input file is missing.',
  missingOutput: 'Where to save the result is missing: -o <file>.',
  missingOption: 'The --{name} option is missing.',
  badOption: 'The value of --{name} is not valid: «{value}».',
  notFound: '«{path}» does not exist.',
  exists: '«{path}» already exists. Use -y to overwrite it.',
  sameFile: 'The output is the same file as the input. Use -y if you want to overwrite it.',
  badPages: 'The pages «{value}» are not valid (the document has {count}). Example: 1-3,5,8-',
  passwordNeeded: 'The PDF has a password: give it with --password.',
  officeMissing: 'Converting office documents needs Molino Suite.',
  cantConvert: 'Cannot convert from {from} to {to}.',
  done: 'Done: {path}',
  doneFolder: 'Done: {count} files in {path}',
  printed: 'Sent to {printer}.',
  noPrinter: 'No printer is called «{name}». See them with «molino printers».',
  noPrinters: 'There are no printers installed.',
  noCertificate: 'No signing certificate matches «{name}». See yours with «molino certificates».',
  manyCertificates: 'Several certificates match «{name}»; use its thumbprint:',
  noCertificates: 'You have no Windows certificates that can sign.',
  signed: 'Signed: {path}',
  noSignatures: 'The PDF has no signatures.',
  noFields: 'The PDF has no form fields.',
  badData: 'Could not read «{path}»: it must be a JSON with the field names and their values.',
  unknownField: 'Warning: the PDF has no field «{name}».',
  filled: 'Filled {count} fields: {path}',
  ownerPassword: 'Owner password (keep it: it is needed to remove the protection): {password}',
  readPassword: 'Certificate password: ',
  failed: 'Error: {message}',
  info: {
    pages: 'Pages',
    title: 'Title',
    author: 'Author',
    protected: 'Password protected',
    signed: 'Signed',
    yes: 'yes',
    no: 'no'
  },
  status: { valid: 'valid', warning: 'with warnings', invalid: 'not valid', unknown: 'not checked' }
}
