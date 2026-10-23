import {atRule, type Plugin} from 'postcss';

/** Application CSS stops at explicitly protected HeroUI roots. Vendor CSS is untouched. */
export function nativeComponentBoundary(rendererRoot: string): Plugin {
  const base=rendererRoot.replaceAll('\\','/')+'/';
  return {
    postcssPlugin:'xiaozhi-native-component-boundary',
    Once(root){
      const file=root.source?.input.file?.replaceAll('\\','/')||'';
      if(!file.startsWith(base)||file.includes('/heroui-pro/')||file.endsWith('/native-component-boundary.css'))return;
      const scope=atRule({name:'scope',params:'(:root) to ([data-heroui-native])'});
      for(const node of [...root.nodes]){
        // Registrations and import/layer ordering stay at stylesheet level.
        if(node.type==='atrule'&&['charset','import','property','font-face','keyframes','-webkit-keyframes'].includes(node.name))continue;
        if(node.type==='atrule'&&node.name==='layer'&&!node.nodes)continue;
        scope.append(node);
      }
      root.append(scope);
    },
  };
}
