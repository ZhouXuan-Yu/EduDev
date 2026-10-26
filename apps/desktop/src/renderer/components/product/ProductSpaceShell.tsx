import type {ReactNode} from 'react';
import {EduShell} from '../../ui-system/EduShell';
/** All existing typed domain operations remain owned by the real page. */
export function ProductSpaceShell({view,children,notice}:{view:string;children:ReactNode;notice?:string}){
 return <EduShell view={view} testId="product-space-workspace" headerTestId="product-space-header">
  <main className="edu-page edu-domain" data-edu-domain="" data-testid="product-space-content">
   {notice&&<p role="status">{notice}</p>}{children}
  </main>
 </EduShell>;
}
