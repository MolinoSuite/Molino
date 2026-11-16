import type { sign as source } from '../es/sign'

export const sign: typeof source = {
  tools: {
    select: 'Select',
    signature: 'Signature',
    signatureTip: 'Place your handwritten signature',
    signatureItem: 'Signature {n}',
    initialsItem: 'Initials {n}',
    newSignature: 'New signature…',
    manage: 'Manage saved signatures…',
    text: 'Text',
    textTip: 'Write on the document',
    check: 'Check',
    cross: 'Cross',
    date: 'Today’s date',
    cert: 'With certificate',
    certTip: 'Sign with your digital certificate',
    signatures: 'Signatures',
    signaturesTip: 'Verify the document’s digital signatures',
    tramite: 'Submission',
    tramiteTip: 'Check whether the document is ready to submit to a government website'
  },
  options: {
    format: 'Format',
    dateFormat: 'Date format',
    size: 'Size',
    color: 'Color',
    clickToPlace: 'Click on the document where you want to place it',
    placeSignature: 'Click or drag where you want to place the signature',
    createFirst: 'First create your signature in the Signature menu',
    drawCertBox: 'Draw the box where the signature will appear',
    signInvisible: 'Sign without a visible mark'
  },
  pad: {
    title: 'New signature',
    saveForReuse: 'Save it for later',
    use: 'Use this signature',
    draw: 'Draw',
    type: 'Type',
    image: 'Image',
    signature: 'Signature',
    initials: 'Initials',
    drawHint: 'Sign here with your mouse or finger',
    yourName: 'Your name',
    importedAlt: 'Imported signature',
    imageHint: 'Choose a photo or scan of your signature on white paper',
    noStrokes: 'No signature strokes were found in the image',
    pickImage: 'Choose image…',
    whiteRemoved: 'The white background is removed automatically.',
    ink: 'Ink',
    inkBlue: 'Blue',
    inkBlack: 'Black'
  },
  saved: {
    title: 'Saved signatures',
    done: 'Done',
    empty: 'You don’t have any saved signatures.',
    alt: 'Saved signature',
    remove: 'Delete this signature',
    privacy: 'Signatures are stored encrypted with your Windows account and never leave this computer.'
  },
  cert: {
    title: 'Sign with a digital certificate',
    usePfx: 'Use a .pfx file…',
    sign: 'Sign',
    signing: 'Signing…',
    certificate: 'Certificate',
    pfxFile: 'Certificate file',
    change: 'Change',
    issuedBy: 'Issued by {issuer}',
    validUntil: 'valid until {date}',
    notValid: 'expired or not yet valid',
    hardware: 'on a smart card or token',
    password: 'Certificate password',
    passwordHint: 'Used only for this signature; it isn’t saved.',
    wrongPassword: 'The certificate password is incorrect.',
    searching: 'Looking for certificates on this computer…',
    none: 'There are no certificates with a private key installed in your Windows account. You can use a .pfx or .p12 file.',
    issue: {
      expired: 'expired',
      notYetValid: 'not valid yet',
      weakKey: 'key too weak',
      unsupportedKey: 'unsupported key type',
      noSigningUsage: 'key usage doesn’t include signing',
      other: 'can’t be used for signing'
    },
    reason: 'Reason (optional)',
    reasonPlaceholder: 'Approved',
    location: 'Location (optional)',
    appearance: {
      signedBy: 'Digitally signed by',
      date: 'Date: {date}',
      reason: 'Reason: {text}',
      location: 'Location: {text}'
    },
    includeHandwritten: 'Include my handwritten signature',
    includeHandwrittenNone: 'Include my handwritten signature (create one first in the Signature menu)',
    invisible: 'The signature won’t leave a visible mark on the pages, but it will be embedded in the document and can be verified.',
    level: 'Signature type',
    levels: {
      basic: {
        title: 'Basic',
        text: 'Like AutoFirma or Adobe with default settings: the signing time comes from your computer’s clock. No internet needed.'
      },
      timestamp: {
        title: 'With timestamp · recommended',
        text: '{service} certifies the exact date and time of signing, instead of your computer’s clock. Needs internet and only receives a hash, never the document.',
        anyService: 'A trusted timestamp service'
      },
      longTerm: {
        title: 'Long-term (LTV)',
        text: 'Also embeds in the PDF proof that your certificate was valid at signing time (long-term validation), so the signature can still be verified many years from now, even after the certificate expires. Needs internet and takes a few more seconds.'
      }
    },
    noTimestampService: 'To sign with a timestamp, choose a service in Settings → Timestamp service.',
    lock: 'Lock the document: it can’t be changed or signed afterward',
    unlockedHint: 'If it isn’t locked, more signatures can be added (by someone else, for example), and any later change will show up when the signature is verified.',
    withoutTimestamp: 'Sign without timestamp',
    timestampOnly: 'Sign with timestamp only',
    done: 'Document signed. Save it to keep the signature.',
    notLocked: 'Signed, but not locked: the document already had signatures and this field can’t be locked. To lock it, sign in a new area.',
    fileName: '{name}-signed.pdf',
    checkTramite: 'Check'
  },
  check: {
    title: 'Digital signatures in this document',
    revocation: 'Check revocation online',
    revocationTip: 'Ask the certificate authority whether the certificates have been revoked',
    checking: 'Verifying signatures…',
    none: 'This document has no digital signatures.',
    timestampAuthority: 'Timestamp authority',
    unknownSigner: 'Unknown signer',
    issuedBy: 'issued by {issuer}',
    status: {
      valid: 'Valid signature',
      timestampValid: 'Valid timestamp',
      timestampWarning: 'Timestamp with warnings',
      warning: 'Valid signature with warnings',
      unverified: 'Signature intact, identity not verified',
      invalid: 'Invalid signature',
      timestampInvalid: 'Invalid timestamp',
      unknown: 'Couldn’t be verified'
    }
  },
  tramite: {
    title: 'Check for an official submission',
    checking: 'Checking the document…',
    offer: 'Check it before submitting it online?',
    verdict: {
      ready: 'Ready to submit',
      readyText: 'Nothing stops you from submitting it. Still, check the requirements of the website you submit it to: each one sets its own.',
      review: 'Review the warnings before submitting it',
      reviewText: 'Some things might not be accepted everywhere. Below is what they are and how to fix them.',
      notReady: 'Not ready to submit yet',
      notReadyText: 'Some problems stop you from submitting it. Below is what’s missing and how to fix it.'
    },
    toReview: 'To review',
    passed: 'Checked',
    signaturesTitle: 'Signatures',
    details: 'More details',
    note: 'This is a basic, automatic check: it doesn’t replace the requirements of each website or a full PDF/A validation.',
    fix: {
      save: 'Save',
      saveAs: 'Save as…',
      rename: 'Save with another name…',
      sign: 'Sign…',
      compress: 'Compress…',
      clean: 'Clean up…',
      unprotect: 'Remove protection'
    },
    saved: {
      saved: 'Saved: the file is checked exactly as you’ll submit it.',
      changes: 'It has unsaved changes. What you submit is the saved file: save it first.',
      new: 'It isn’t a file yet: save it so you can submit it.'
    },
    signatures: {
      none: 'It has no digital signature. If the procedure asks for a signed document, sign it with your certificate.',
      valid: { one: 'It has {n} valid signature.', other: 'It has {n} valid signatures.' },
      invalid: 'A signature isn’t valid or couldn’t be verified: see the details below.',
      modified: 'The document was changed after it was signed: what you see may not be what was signed.',
      untrusted: 'The signatures are intact, but this computer doesn’t recognize the authority that issued a certificate: it might not be accepted.',
      expired: 'A certificate has expired and there’s no timestamp proving it was signed while it was valid.',
      warning: 'The signatures have warnings: see the details below.',
      stamped: 'With a timestamp.',
      notStamped: 'No timestamp: the date is the signer’s computer clock.'
    },
    signature: {
      unchanged: 'No changes after signing',
      allowed: 'Only signatures or form fields were added afterwards',
      changed: 'Changed after signing',
      stamp: 'Timestamp from {date}',
      noStamp: 'No timestamp',
      validUntil: 'Certificate valid until {date}',
      expiredOn: 'Certificate expired on {date}'
    },
    protection: {
      none: 'No password or restrictions.',
      password: 'It needs a password to open: the website won’t be able to read it. Remove it before submitting.',
      restricted: 'It’s protected with usage restrictions (printing, copying…). Some websites don’t accept protected PDFs.'
    },
    pdfa: {
      none: 'It isn’t PDF/A. If you’re asked for PDF/A, save it that way from Docs, Sheets or Slides (Molino PDF doesn’t convert an existing PDF).',
      ok: 'It says it’s {version}, and the basics that can be checked here are fine.',
      problems: 'It says it’s {version}, but {list}.',
      problem: {
        outputIntent: 'it lacks the color profile',
        fonts: 'some fonts aren’t embedded',
        encrypted: 'it’s encrypted',
        javascript: 'it contains JavaScript code'
      }
    },
    fonts: {
      ok: 'All fonts are embedded in the file.',
      missing: {
        one: '{n} font isn’t embedded in the file ({names}): it may look different on another computer.',
        other: '{n} fonts aren’t embedded in the file ({names}): it may look different on another computer.'
      }
    },
    javascript: {
      ok: 'No JavaScript code.',
      found: 'It contains JavaScript code. Some websites reject PDFs with code: remove it with “Remove hidden data”.'
    },
    attachments: {
      ok: 'No attached files.',
      found: {
        one: 'It has {n} attached file inside. Some websites don’t accept that: submit it separately if needed.',
        other: 'It has {n} attached files inside. Some websites don’t accept that: submit them separately if needed.'
      }
    },
    size: {
      ok: 'It’s {size}.',
      unsaved: 'It will be about {size}.',
      large: 'It’s {size}. Each website sets its own size limit (or none): check yours and, if it’s over, compress it.',
      largeSigned: 'It’s {size}. Each website sets its own size limit (or none): check yours. If it’s over, compress the unsigned document and sign it afterwards.'
    },
    name: {
      ok: 'The file name won’t cause problems.',
      issues: 'The name has {list}, which some websites don’t accept. Better: “{suggestion}”.',
      issue: {
        accents: 'accented letters',
        spaces: 'spaces',
        symbols: 'symbols',
        dots: 'more than one dot',
        long: 'too many characters',
        extension: 'an extension other than .pdf'
      }
    },
    signedHint: 'Fixing it now would void the signature: do it on the unsigned document and sign it afterwards.'
  }
}
