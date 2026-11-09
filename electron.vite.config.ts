import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    // Fecha de compilación: se muestra en «Acerca de Molino PDF» (Ajustes).
    define: { __MOLINO_BUILT__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: {
      rollupOptions: {
        // index: Molino PDF; office: las ventanas de los editores (officewin.ts).
        input: { index: resolve('src/preload/index.ts'), office: resolve('src/preload/office.ts') },
        // Un preload con sandbox activado solo puede ser CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    resolve: { alias: { '@': resolve('src/renderer/src'), '@shared': resolve('src/shared') } },
    // index: Molino PDF; office: las ventanas de Documentos, Hojas y Presentaciones (officewin.ts).
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html'), office: resolve('src/renderer/office.html') } } }
  }
})
