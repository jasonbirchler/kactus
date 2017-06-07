// import * as Path from 'path'
// import * as Fs from 'fs'

// const fileUriToPath: (uri: string) => string = require('file-uri-to-path')
// const sourceMapSupport = require('source-map-support')

/**
 * This array tells the source map logic which files that we can expect to
 * be able to resolve a source map for and they should reflect the chunks
 * entry names from our webpack config.
 *
 * Note that we explicitly don't enable source maps for the crash process
 * since it's possible that the error which caused us to spawn the crash
 * process was related to source maps.
 */
// const knownFilesWithSourceMap = [ 'renderer.js', 'main.js', 'shared.js' ]

// function retrieveSourceMap(source: string) {
//   // This is a happy path in case we know for certain that we won't be
//   // able to resolve a source map for the given location.
//   if (!knownFilesWithSourceMap.some(file => source.endsWith(file))) {
//     return null
//   }

//   // We get a file uri when we're inside a renderer, convert to a path
//   if (source.startsWith('file://')) {
//     source = fileUriToPath(source)
//   }

//   // We store our source maps right next to the bundle
//   const path = `${source}.map`

//   if (__DEV__ && path.startsWith('http://')) {
//     try {
//       const xhr = new XMLHttpRequest()
//       xhr.open('GET', path, false)
//       xhr.send(null)
//       if (xhr.readyState === 4 && xhr.status === 200) {
//         return { url: Path.basename(path), map: xhr.responseText }
//       }
//     } catch (error) {
//       return
//     }
//     return
//   }

//   // We don't have an option here, see
//   //  https://github.com/v8/v8/wiki/Stack-Trace-API#customizing-stack-traces
//   // This happens on-demand when someone accesses the stack
//   // property on an error object and has to be synchronous :/
//   // tslint:disable-next-line:no-sync-functions
//   if (!Fs.existsSync(path)) {
//     return
//   }

//   try {
//     // tslint:disable-next-line:no-sync-functions
//     const map = Fs.readFileSync(path, 'utf8')
//     return { url: Path.basename(path), map }
//   } catch (error) {
//     return
//   }
// }

/** A map from errors to their stack frames. */
const stackFrameMap = new WeakMap<Error, ReadonlyArray<any>>()

/**
 * The `prepareStackTrace` that comes from the `source-map-support` module.
 * We'll use this when the user explicitly wants the stack source mapped.
 */
let prepareStackTraceWithSourceMap: (error: Error, frames: ReadonlyArray<any>) => string

/**
 * Capture the error's stack frames and return a standard, un-source mapped
 * stack trace.
 */
function prepareStackTrace(error: Error, frames: ReadonlyArray<any>) {
  stackFrameMap.set(error, frames)

  // Ideally we'd use the default `Error.prepareStackTrace` here but it's
  // undefined so V8 must doing something fancy. Instead we'll do a decent
  // impression.
  return error + frames
    .map(frame => `\n    at ${frame}`)
    .join('')
}

/** Enable source map support in the current process. */
export function enableSourceMaps() {
  // sourceMapSupport.install({
  //   environment: 'node',
  //   handleUncaughtExceptions: false,
  //   retrieveSourceMap,
  // })

  const AnyError = Error as any
  // We want to keep `source-map-support`s `prepareStackTrace` around to use
  // later, but our cheaper `prepareStackTrace` should be the default.
  prepareStackTraceWithSourceMap = AnyError.prepareStackTrace
  AnyError.prepareStackTrace = prepareStackTrace
}

/**
 * Make a copy of the error with a source-mapped stack trace. If it couldn't
 * perform the source mapping, it'll use the original error stack.
 */
export function withSourceMappedStack(error: Error): Error {
  return {
    name: error.name,
    message: error.message,
    stack: sourceMappedStackTrace(error),
  }
}

/** Get the source mapped stack trace for the error. */
function sourceMappedStackTrace(error: Error): string | undefined {
  const frames = stackFrameMap.get(error)
  if (!frames) {
    return error.stack
  }

  return prepareStackTraceWithSourceMap(error, frames)
}
