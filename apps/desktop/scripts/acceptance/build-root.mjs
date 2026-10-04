import fs from 'node:fs';import path from 'node:path';
export function testMain(desktop) {
  const base=fs.realpathSync(desktop),root=fs.realpathSync(process.env.OMNI_EDU_TEST_BUILD_ROOT||path.join(base,'out'));
  if(root!==path.join(base,'out')&&!root.startsWith(path.join(base,'test-results')+path.sep))throw new Error('Test build must be everyday out or owned test-results');
  const main=path.join(root,'main/index.js');if(!fs.existsSync(main))throw new Error('Test build missing main');return main;
}
