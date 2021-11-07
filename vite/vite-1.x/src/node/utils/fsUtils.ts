import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import LRUCache from 'lru-cache'
import { RawSourceMap } from 'source-map'
import { Context } from '../server'
import { Readable } from 'stream'
import { seenUrls } from '../server/serverPluginServeStatic'
import mime from 'mime-types'
import { HMRWatcher } from '../server/serverPluginHmr'

const getETag = require('etag')

interface CacheEntry {
  lastModified: number
  etag: string
  content: Buffer
}

const fsReadCache = new LRUCache<string, CacheEntry>({
  max: 10000
})

/**
 * Read a file with in-memory cache.
 * Also sets appropriate headers and body on the Koa context.
 * This is exposed on middleware context as `ctx.read` with the `ctx` already
 * bound, so it can be used as `ctx.read(file)`.
 */
export async function cachedRead(
  ctx: Context | null,
  file: string,
  poll = false
): Promise<Buffer> {
  const lastModified = fs.statSync(file).mtimeMs
  const cached = fsReadCache.get(file)
  if (ctx) {
    ctx.set('Cache-Control', 'no-cache')
    ctx.type = mime.lookup(path.extname(file)) || 'application/octet-stream'
  }
  if (cached && cached.lastModified === lastModified) {
    if (ctx) {
      // a private marker in case the user ticks "disable cache" during dev
      ctx.__notModified = true
      ctx.etag = cached.etag
      ctx.lastModified = new Date(cached.lastModified)
      if (ctx.get('If-None-Match') === ctx.etag && seenUrls.has(ctx.url)) {
        ctx.status = 304
      }
      seenUrls.add(ctx.url)
      ctx.body = cached.content
    }
    return cached.content
  }
  // #395 some file is an binary file, eg. font
  let content = await fs.readFile(file)
  if (poll && !content.length) {
    await untilModified(file)
    content = await fs.readFile(file)
  }
  // Populate the "sourcesContent" array and resolve relative paths in the
  // "sources" array, so the debugger can trace back to the original source.
  if (file.endsWith('.map')) {
    const map: RawSourceMap = JSON.parse(content.toString('utf8'))
    if (!map.sourcesContent || !map.sources.every(path.isAbsolute)) {
      const sourcesContent = map.sourcesContent || []
      const sourceRoot = path.resolve(path.dirname(file), map.sourceRoot || '')
      map.sources = await Promise.all(
        map.sources.map(async (source, i) => {
          const originalPath = path.resolve(sourceRoot, source)
          if (!sourcesContent[i]) {
            try {
              sourcesContent[i] = (
                await cachedRead(null, originalPath)
              ).toString('utf8')
            } catch (err) {
              if (err.code === 'ENOENT') {
                console.error(
                  chalk.red(
                    `[vite] Sourcemap "${file}" points to non-existent source: "${originalPath}"`
                  )
                )
                return source
              }
              throw err
            }
          }
          return originalPath
        })
      )
      map.sourcesContent = sourcesContent
      content = Buffer.from(JSON.stringify(map))
    }
  }
  const etag = getETag(content)
  fsReadCache.set(file, {
    content,
    etag,
    lastModified
  })
  if (ctx) {
    ctx.etag = etag
    ctx.lastModified = new Date(lastModified)
    ctx.body = content
    ctx.status = 200

    // watch the file if it's out of root.
    const { root, watcher } = ctx
    watchFileIfOutOfRoot(watcher, root, file)
  }
  return content
}

// #610 when hot-reloading Vue files, we read immediately on file change event
// and sometimes this can be too early and get an empty buffer. Poll until the
// file's modified time has changed before reading again.
async function untilModified(file: string) {
  const mtime = (await fs.stat(file)).mtimeMs
  return new Promise((r) => {
    let n = 0
    const poll = async () => {
      n++
      const newMtime = (await fs.stat(file)).mtimeMs
      if (newMtime !== mtime || n > 10) {
        r(0)
      } else {
        setTimeout(poll, 10)
      }
    }
    setTimeout(poll, 10)
  })
}

/**
 * Read already set body on a Koa context and normalize it into a string.
 * Useful in post-processing middlewares.
 */
export async function readBody(
  stream: Readable | Buffer | string | null
): Promise<string | null> {
  if (stream instanceof Readable) {
    return new Promise((resolve, reject) => {
      let res = ''
      stream
        .on('data', (chunk) => (res += chunk))
        .on('error', reject)
        .on('end', () => {
          resolve(res)
        })
    })
  } else {
    return !stream || typeof stream === 'string' ? stream : stream.toString()
  }
}

export function lookupFile(
  dir: string,
  formats: string[],
  pathOnly = false
): string | undefined {
  for (const format of formats) {
    const fullPath = path.join(dir, format)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return pathOnly ? fullPath : fs.readFileSync(fullPath, 'utf-8')
    }
  }
  const parentDir = path.dirname(dir)
  if (parentDir !== dir) {
    return lookupFile(parentDir, formats, pathOnly)
  }
}

/**
 * Files under root are watched by default, but with user aliases we can still
 * serve files out of root. Add such files to the watcher (if not node_modules)
 */
export function watchFileIfOutOfRoot(
  watcher: HMRWatcher,
  root: string,
  file: string
) {
  if (!file.startsWith(root) && !/node_modules/.test(file)) {
    watcher.add(file)
  }
}
