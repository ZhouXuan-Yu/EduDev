/** Reviewed free package. Neither renderer nor model may replace this recipe. */
export const JAVASCRIPT_COMPONENT=Object.freeze({schemaVersion:1,id:'javascript',name:'本地 JavaScript 计算',version:'3.6.2',
  package:'quickjs-wasi',sourceUrl:'https://registry.npmjs.org/quickjs-wasi/-/quickjs-wasi-3.6.2.tgz',
  projectUrl:'https://github.com/vercel-labs/quickjs-wasi',license:'MIT',
  archiveBytes:568844,archiveSha256:'f1f4349f19a2d849e33ea0ae9bec2e7062b8839f4eceb17c9051ddbaa2720982',
  entry:'package/quickjs.wasm',bytes:637405,sha256:'d4c9375f2b1ca4dc95f72c8aa2982a7a9951ac8011490d79c6582df732b4bbd9',
  maximumExpandedBytes:2*1024*1024,requiredFreeBytes:8*1024*1024,platform:'wasm32',minimumNodeMajor:22,
  runtime:'isolated QuickJS, no filesystem/network/process bridges',health:'6*7===42; typeof process/require/fetch are undefined'});
