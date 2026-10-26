import {atRule, type Plugin} from 'postcss';

// Migration adapter: retain existing domain geometry, never old cosmetics.
// Exit: remove each source as its real page is migrated; legacy-test stays isolated.
const geometry=/^(display|grid.*|flex.*|gap|row-gap|column-gap|align-.*|justify-.*|place-.*|width|min-width|max-width|height|min-height|max-height|padding.*|margin.*|overflow.*|position|inset.*|top|bottom|left|right|z-index|box-sizing|white-space|word-break|overflow-wrap|vertical-align|aspect-ratio|list-style.*|text-align|visibility|resize|object-fit)$/;
// Vite 6 CSS Modules splits @scope parameters on literal "to", even inside "button".
// Token-prefix attributes protect the same native button classes without that parser bug.
const nativeEnds='[data-heroui-native],[data-slot],[class*="__"],[class*="--"],[class^="but"],[class*=" but"],'+['input','textarea','text-field','select','search-field','switch','checkbox','tabs','modal','popover'].map(name=>`[class~="${name}"]`).join(',');

/** Application CSS stops at explicitly protected HeroUI roots. Vendor CSS is untouched. */
export function nativeComponentBoundary(rendererRoot: string): Plugin {
  const base=rendererRoot.replaceAll('\\','/')+'/';
  return {
    postcssPlugin:'xiaozhi-native-component-boundary',
    Once(root){
      const file=root.source?.input.file?.replaceAll('\\','/')||'';
      if(!file.startsWith(base)||file.includes('/heroui-pro/')||file.includes('/ui-system/')||file.includes('/design-review/')||file.endsWith('/components/office/prompt-input.utilities.css'))return;
      // Attribute boundaries also survive CSS Modules without selector renaming.
      const domain=atRule({name:'scope',params:`([data-edu-domain]) to (${nativeEnds})`});
      for(const original of [...root.nodes]){
        if(original.type==='atrule'&&['charset','import','property','font-face','keyframes','-webkit-keyframes'].includes(original.name))continue;
        const copy=original.clone();
        if(copy.type==='decl'){if(!geometry.test(copy.prop)||copy.important)continue;}
        else if('walkDecls' in copy)copy.walkDecls(decl=>{if(!geometry.test(decl.prop)||decl.important)decl.remove();});
        if(copy.type==='rule'&&!copy.nodes.length)continue;
        if('walkRules' in copy)copy.walkRules(rule=>{if(!rule.nodes.length)rule.remove();});
        domain.append(copy);
      }
      const scope=atRule({name:'scope',params:`(:root:not([data-edu-modern])) to (${nativeEnds})`});
      for(const node of [...root.nodes]){
        // Registrations and import/layer ordering stay at stylesheet level.
        if(node.type==='atrule'&&['charset','import','property','font-face','keyframes','-webkit-keyframes'].includes(node.name))continue;
        if(node.type==='atrule'&&node.name==='layer'&&!node.nodes)continue;
        scope.append(node);
      }
      root.append(scope);
      if(domain.nodes?.length)root.append(domain);
    },
  };
}
