import { join } from 'node:path'
import { app } from 'electron'
import type { EngineLaunch } from './engine'

/**
 * Cómo se arranca el motor (el ejecutable empaquetado o, sin empaquetar, el
 * Python del entorno virtual). Lo usan las ventanas de Molino (index.ts) y la
 * línea de órdenes (cli.ts), cada una con su carpeta de trabajo.
 */
export interface EngineFolders {
  workDir: string
  modelsRoot: string
  officeRoot: string
  /** La pieza de oficina que trae el paquete (Molino Suite), o null. */
  officeBundled: string | null
}

export function engineLaunchFor(folders: EngineFolders): EngineLaunch {
  const { workDir, modelsRoot, officeRoot, officeBundled } = folders
  if (app.isPackaged) {
    const dir = join(process.resourcesPath, 'engine')
    return {
      command: join(dir, 'molino-engine.exe'),
      args: [
        '--workdir', workDir, '--resources', join(process.resourcesPath, 'assets'), '--models', modelsRoot, '--office', officeRoot,
        ...(officeBundled ? ['--office-bundled', officeBundled] : [])
      ],
      cwd: dir
    }
  }
  const root = app.getAppPath()
  return {
    command: join(root, 'engine', '.venv', 'Scripts', 'python.exe'),
    // -E y -s: el intérprete ignora las variables PYTHON* y los paquetes del
    // perfil del usuario, de modo que el entorno no puede inyectarle código.
    args: [
      '-E', '-s', '-m', 'molino_engine', '--workdir', workDir, '--resources', join(root, 'resources'), '--models', modelsRoot, '--office', officeRoot,
      ...(officeBundled ? ['--office-bundled', officeBundled] : [])
    ],
    cwd: join(root, 'engine')
  }
}
