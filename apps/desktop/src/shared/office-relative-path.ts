export const officeRelativePath=(v:unknown):v is string=>typeof v==='string'&&!!v&&v.length<=500
 &&!/[\\:<>"|?*\x00-\x1f]/.test(v)&&!v.startsWith('/')&&v.split('/').length<=8
 &&v.split('/').every(part=>!!part&&part!=='.'&&part!=='..'&&!/[. ]$/.test(part)
 &&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part)
 &&!/^(\.pi|\.ssh|\.aws|\.azure)$/i.test(part));
