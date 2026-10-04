import json,sys,pathlib,re
import pypdfium2 as pdfium
from pypdf import PdfReader
root=pathlib.Path(sys.argv[1]).resolve()
expected=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8-sig'))
results=[]
for kind,markers in expected.items():
    file=root/('embedded-pdf.pdf' if kind=='pdf' else kind+'-wps.pdf')
    reader=PdfReader(file)
    document=pdfium.PdfDocument(file)
    texts=[]
    pages=[]
    try:
        for index in range(len(document)):
            page=document[index]
            text=page.get_textpage()
            try:
                texts.append(text.get_text_range())
                png=root/f'{kind}-page-{index+1}.png'
                page.render(scale=1.3).to_pil().save(png)
                w,h=page.get_size()
                outside=0
                for char in range(text.count_chars()):
                    if not text.get_text_range(char,1).strip(): continue
                    left,bottom,right,top=text.get_charbox(char)
                    outside+=int(left < -1 or bottom < -1 or right>w+1 or top>h+1)
                pages.append({'page':index+1,'width':w,'height':h,'outsideGlyphs':outside,'png':png.name})
            finally: text.close();page.close()
    finally: document.close()
    joined='\n'.join(texts)
    # PDF extractor emits layout CR/LF and inferred CJK/digit spacing. Only marker
    # presence uses these allowances; actual input identity is checked through WPS COM.
    layout=''.join(joined.splitlines())
    missing=[marker for marker in markers if not re.search(''.join(r' *'+re.escape(c)+r' *' if c.isascii() and c.isdigit() else re.escape(c) for c in marker),layout)]
    if kind in ['docx','xlsx','pdf']: assert all(all(abs(a-b)<2 for a,b in zip(sorted([float(p.mediabox.width),float(p.mediabox.height)]),[595.28,841.89])) for p in reader.pages)
    results.append({'kind':kind,'engine':'Original Hana/embedded Chromium' if kind=='pdf' else 'Actual WPS COM','pages':pages,'missing':missing,'allMarkersPresent':not missing})
report={'success':all(not r['missing'] and not any(p['outsideGlyphs'] for p in r['pages']) for r in results),'files':results,'boundary':'Real WPS exported page marker presence (layout CR/LF and inferred spaces adjacent to marker digits allowed) and glyph bounds; actual exact content requires COM/OOXML readback, images need visual inspection.'}
(root/'render-readback.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
if not report['success']: sys.exit(1)
