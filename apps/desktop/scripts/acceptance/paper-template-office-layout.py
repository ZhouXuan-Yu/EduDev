"""Independent actual-byte layout check; no app/DB/model operations."""
import sys,json,zipfile,xml.etree.ElementTree as ET,pathlib,runpy,re
from pypdf import PdfReader
foundation=runpy.run_path(str(pathlib.Path(__file__).resolve().parent.parent/'xiaozhi-agent'/'paper-layout-pdf-readback.py'))
fitz=foundation['fitz']
def main():
    m=json.load(open(sys.argv[1],encoding='utf-8'));layout=m['paper']['c2']['layout'];w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    result={'success':False,'scope':'current confirmed layout only; not four-layout Pi coverage','verified':{'docx':'A4 portrait, every section margin, final body columns and gap','pdf':'every page A4 portrait; text inside margins; observed body lines within configured columns'},'pending':['One-question Pi fixture does not prove long content flows through both columns. Four-layout foundation and actual rendered inspection remain separate.'],'files':[]}
    try:
        for f in m['files']:
            if f['format']=='docx':
                with zipfile.ZipFile(f['path']) as z: root=ET.fromstring(z.read('word/document.xml'))
                sections=list(root.iter(w+'sectPr'));assert len(sections)>=2
                for s in sections:
                    size=s.find(w+'pgSz');assert abs(int(size.get(w+'w'))/1440*25.4-210)<1 and abs(int(size.get(w+'h'))/1440*25.4-297)<1
                    margin=s.find(w+'pgMar')
                    for side,value in layout['margins'].items(): assert abs(int(margin.get(w+side))-round(value/10*1440/25.4))<=1
                cols=sections[-1].find(w+'cols');assert int(cols.get(w+'num','1'))==layout['columns'];assert abs(int(cols.get(w+'space','0'))-round(layout['columnGap']/10*1440/25.4))<=1
            else:
                pdf=PdfReader(f['path'],strict=True);assert len(pdf.pages)>0
                for page in pdf.pages: assert abs(float(page.mediabox.width)*25.4/72-210)<1 and abs(float(page.mediabox.height)*25.4/72-297)<1
                g=foundation['geometry'](layout);body_seen=False;body_lines=0
                with fitz.open(f['path']) as doc:
                    for page in doc:
                        assert page.rotation==0
                        for block in page.get_text('dict')['blocks']:
                            for line in block.get('lines',[]):
                                text=''.join(s['text'] for s in line['spans']).strip()
                                if not text: continue
                                rect=line['bbox'];assert foundation['inside_page'](rect,g), 'PDF text exceeds configured margins: '+text[:60]
                                if re.match(r'^\d+[.．]\s*[（(]',text): body_seen=True
                                if body_seen:
                                    assert foundation['column_of'](rect,g) is not None, 'PDF body crosses configured column boundary: '+text[:60]
                                    body_lines+=1
                assert body_seen and body_lines>0, 'Actual numbered body text not located; cannot claim column geometry'
            result['files'].append({'path':f['path'],'format':f['format']})
        assert len(result['files'])==6;result['success']=True
    except Exception as e: result['error']=str(e);raise
    finally:
        with open(sys.argv[2],'x',encoding='utf-8') as f: json.dump(result,f,ensure_ascii=False,indent=2)
if __name__=='__main__':
    if sys.argv[1:]==['--check']: print(json.dumps(foundation['self_check']()))
    else: main()
