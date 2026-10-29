import json,sys,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
root=Path(sys.argv[1]);draft=json.loads((root/'draft.json').read_text(encoding='utf-8'))
NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
def parts(file):
    with zipfile.ZipFile(file) as z:
        names=sorted([n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')],key=lambda n:int(n.split('slide')[-1][:-4]))
        return [(ET.fromstring(z.read(n)),z.read(n)) for n in names]
slides=parts(root/'floating.pptx');changed=parts(root/'changed.pptx');assert len(slides)==len(changed)==8
for i,((slide,original),(updated,updated_bytes)) in enumerate(zip(slides,changed)):
    assert any(n.attrib.get('name')=='xiaozhi-page:'+draft['sections'][i]['pageId'] for n in slide.findall('.//p:cNvPr',NS))
    body=''.join(n.text or '' for n in slide.findall('.//a:t',NS))
    assert draft['sections'][i]['heading'] in body
    for paragraph in draft['sections'][i]['paragraphs']:assert paragraph.replace('\n','') in body
    assert '检查①参考答案6N' not in body and '检查②参考答案1N' not in body
    if i!=3: assert ET.tostring(slide)==ET.tostring(updated),f'Page {i+1} changed outside title scope'
    else: assert '排液体积' in ''.join(n.text or '' for n in updated.findall('.//a:t',NS))
    # Native editable text and table shapes, bounded in the actual slide coordinate system.
    for shape in slide.findall('.//p:sp',NS)+slide.findall('.//p:graphicFrame',NS):
        transform=shape.find('./p:spPr/a:xfrm',NS) if shape.tag.endswith('sp') else shape.find('./p:xfrm',NS)
        if transform is None:continue
        off=transform.find('a:off',NS);ext=transform.find('a:ext',NS)
        if off is not None and ext is not None:
            assert int(off.attrib['x'])>=0 and int(off.attrib['y'])>=0
            assert int(off.attrib['x'])+int(ext.attrib['cx'])<=12192010
            assert int(off.attrib['y'])+int(ext.attrib['cy'])<=6858010
with zipfile.ZipFile(root/'floating.pptx') as z:
    notes=[n for n in z.namelist() if n.startswith('ppt/notesSlides/notesSlide') and n.endswith('.xml')]
    assert len(notes)==8
    assert '检查①参考答案6N' in z.read('ppt/notesSlides/notesSlide7.xml').decode('utf-8')
assert slides[3][0].findall('.//a:tbl',NS),'Expected editable table on page four'
if (root/'office-edited.pptx').exists():
    modified=parts(root/'office-edited.pptx');assert len(modified)==8
    body=''.join(n.text or '' for n in modified[3][0].findall('.//a:t',NS));assert '排液体积' in body and '250–900kg/m³' in body
from PIL import Image,ImageOps,ImageDraw
images=list(root.glob('slide-*.png'))
if len(images)==8:
    # Four rows keep every rendered page visible; no drawing or presentation edits.
    grid=Image.new('RGB',(1600,1960),'#dce2df');draw=ImageDraw.Draw(grid)
    for i,p in enumerate(sorted(images)):
        im=Image.open(p).convert('RGB');im.thumbnail((790,444));x=(i%2)*800+5;y=(i//2)*490+30;grid.paste(im,(x,y));draw.text((x,y-22),f'Page {i+1}',fill='black')
    grid.save(root/'all-pages.png')
print(json.dumps({'ok':True,'slides':8,'notes':8,'editableTable':True,'unchangedOtherPages':True,'renderedPages':len(images)}))
