// viewer-3d.ts imports 3Dmol.js's prebuilt minified bundle rather than the
// package's `main`, a 5.4 MB development build. Same API, same typings.
declare module '3dmol/build/3Dmol-min.js' {
  export * from '3dmol'
}
