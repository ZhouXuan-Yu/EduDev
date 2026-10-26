/** Legacy Node type resolution bridge to pinned editor 0.0.9 declarations.
 * Runtime imports still use the package's public export map in the sandbox bundle.
 */
declare module '@openmaic/editor/core' {
 export * from '@openmaic/editor';
}
declare module '@openmaic/editor/react' {
 export {EMPTY_SELECTION,type Selection} from '@openmaic/editor/dist/react/index';
}
declare module '@openmaic/editor/ui' {
 export {EditableSlideCanvasWithUI} from '@openmaic/editor/dist/ui/index';
}
