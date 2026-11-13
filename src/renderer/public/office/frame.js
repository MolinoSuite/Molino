// Una pestaña de Documentos, Hojas o Presentaciones: arranca el editor de
// ONLYOFFICE para un documento, con la API de sus editores (api.js). Los datos
// van en la dirección de esta página, que pone la interfaz de Molino
// (renderer/src/office); el puente (bridge.js) los lee de aquí.
;(() => {
  'use strict'
  const q = new URLSearchParams(location.search)
  const kind = ['word', 'cell', 'slide'].includes(q.get('kind')) ? q.get('kind') : 'word'
  // eslint-disable-next-line no-new
  new window.DocsAPI.DocEditor('editor', {
    type: 'desktop',
    width: '100%',
    height: '100%',
    documentType: kind,
    document: {
      key: `molino-${q.get('doc') || ''}`,
      url: '_offline_',
      title: q.get('name') || '',
      fileType: q.get('ext') || '',
      permissions: { edit: true, download: true }
    },
    editorConfig: {
      mode: 'edit',
      lang: q.get('lang') === 'en' ? 'en' : 'es',
      createUrl: 'desktop://create.new',
      customization: { uiTheme: q.get('dark') === '1' ? 'theme-dark' : 'theme-light' },
      // Quien firma los comentarios y los cambios: el nombre de Ajustes de Molino o el usuario de Windows.
      user: { id: '1', name: (q.get('author') || '').slice(0, 100) || 'Molino' }
    }
  })
})()
