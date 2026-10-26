"""Native PowerPoint content/merge acceptance. Does not claim GIF playback."""
import json,sys,hashlib,shutil,zipfile
from pathlib import Path
import pythoncom,win32com.client
source=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve();fixture=json.loads(Path(sys.argv[3]).read_text(encoding='utf8'))['correctedTeaching']
assert 'test-results' in source.parts and 'test-results' in output.parts
output.mkdir(parents=True,exist_ok=False)
report={'success':False,'checks':[],'boundary':'Installed PowerPoint COM native text/notes/render/InsertFromFile/reopen on owned copies. Does NOT claim visible GIF playback, WPS, actual network-off or teacher usability.'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def check(name):report['checks'].append({'name':name,'pass':True});print('PASS '+name,flush=True)
def text(pres,notes=False):
    result=[]
    for i in range(1,pres.Slides.Count+1):
        shapes=pres.Slides.Item(i).NotesPage.Shapes if notes else pres.Slides.Item(i).Shapes
        for j in range(1,shapes.Count+1):
            s=shapes.Item(j)
            if s.HasTextFrame and s.TextFrame.HasText:result.append(s.TextFrame.TextRange.Text)
    return '\n'.join(result)
app=pres=None;initial=0;before=sha(source);pythoncom.CoInitialize()
try:
    portable=output/'portable'/source.name;portable.parent.mkdir();shutil.copy2(source,portable);assert sha(portable)==before
    check('Relocated owned PPT retains exact bytes without copying original HTML or assets')
    app=win32com.client.DispatchEx('PowerPoint.Application');initial=app.Presentations.Count
    report['version']=app.Version;report['build']=app.Build
    pres=app.Presentations.Open(str(portable),True,False,True);count=pres.Slides.Count;assert count==len(fixture['steps'])+3
    for i in range(1,count+1):pres.Slides.Item(i).Export(str(output/f'slide-{i:02}.png'),'PNG',1600,900)
    check('Native PowerPoint opens and renders every relocated teaching slide')
    visible=text(pres);notes=text(pres,True)
    for s in [fixture['objective'],fixture['observation'],fixture['check']['question']]+[s[k] for s in fixture['steps'] for k in ['question','explanation']]:assert s in visible
    for s in [fixture['check']['answer']]+[s['notes'] for s in fixture['steps']]:assert s not in visible and s in notes
    check('Native editable text and teacher notes match the approved corrected teaching; student slides omit reference answers')
    pres.Close();pres=None
    pres=app.Presentations.Add(True);pres.Slides.Add(1,12)
    pres.Slides.Item(1).Shapes.AddTextbox(1,40,40,600,60).TextFrame.TextRange.Text='老师已有课件（测试副本）'
    existing=output/'teacher-existing.pptx';pres.SaveAs(str(existing),24);pres.Close();pres=None;existing_hash=sha(existing)
    copy=output/'teacher-existing-copy.pptx';shutil.copy2(existing,copy)
    pres=app.Presentations.Open(str(copy),False,False,True)
    assert pres.Slides.InsertFromFile(str(portable),1,2,count)==count-1
    merged=output/'existing-lesson-merged.pptx';pres.SaveAs(str(merged),24);pres.Close();pres=None
    check('Native InsertFromFile adds animation and teaching pages to an owned existing-lesson copy')
    pres=app.Presentations.Open(str(merged),True,False,True);assert pres.Slides.Count==count
    assert fixture['check']['question'] in text(pres) and fixture['check']['answer'] not in text(pres)
    assert fixture['check']['answer'] in text(pres,True)
    for i in range(1,count+1):pres.Slides.Item(i).Export(str(output/f'merged-{i:02}.png'),'PNG',1600,900)
    pres.Close();pres=None
    check('Merged lesson reopens and renders all pages with teacher notes intact')
    def gifs(file):
        with zipfile.ZipFile(file) as z:return {hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('ppt/media/') and n.lower().endswith('.gif')}
    assert gifs(source) and gifs(source).issubset(gifs(merged))
    assert sha(source)==before and sha(existing)==existing_hash and sha(portable)==before
    report.update({'mergedPpt':str(merged),'originalSha256':before,'existingSha256':existing_hash,'slides':count})
    check('Merge preserves original embedded GIF bytes and both original decks; this is media integrity, not playback')
    report['success']=True
except Exception:
    import traceback;report['error']=traceback.format_exc();print(report['error'],flush=True)
finally:
    if pres:
        try:pres.Close()
        except Exception:pass
    if app and initial==0:
        try:app.Quit()
        except Exception:pass
    pythoncom.CoUninitialize();(output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'success':report['success'],'checks':len(report['checks']),'output':str(output)},ensure_ascii=False),flush=True)
sys.exit(0 if report['success'] else 1)
