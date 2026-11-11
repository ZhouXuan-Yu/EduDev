import type {ReactNode} from 'react';
import {WorkbenchPageNavigation,isStudentPage,isTeachingPage} from './WorkbenchPageNavigation';
import {EduShell} from '../../ui-system/EduShell';
import paperStyles from '../../ui-system/paper-studio/paper-studio.module.css';
import teachingStyles from '../../ui-system/workbench-page-navigation.module.css';
/** All existing typed domain operations remain owned by the real page. */
export function ProductSpaceShell({view,children,notice}:{view:string;children:ReactNode;notice?:string}){
 const pageNavigation = (isStudentPage(view)||isTeachingPage(view)) ? <WorkbenchPageNavigation view={view}/> : null;
 const teachingPage = isTeachingPage(view) && view !== 'paper';
 const alignedPage = teachingPage || ['teaching','student_workbench','students'].includes(view);
 return <EduShell view={view} testId="product-space-workspace" headerTestId="product-space-header">
  <main className={`edu-page edu-domain ${view === 'paper' ? paperStyles.page : ''} ${alignedPage ? teachingStyles.page : ''}`} data-edu-domain="" data-testid="product-space-content">
   {notice&&<p role="status">{notice}</p>}
   {teachingPage && <header className={teachingStyles.heading} data-testid="teaching-page-heading">
    <h1>教学工作台</h1><p>围绕教学文件与课堂成果继续工作。</p>
   </header>}
   {view === 'paper' ? <div className={paperStyles.pageNavigation}>{pageNavigation}</div> : pageNavigation}
   {children}
  </main>
 </EduShell>;
}
