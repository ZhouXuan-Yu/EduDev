"""Read-only WPS Presentation playback acceptance in a separate owned COM instance."""
import json,sys,time,hashlib
from pathlib import Path
import pythoncom,win32com.client
import win32con,win32gui,win32ui
from PIL import Image,ImageGrab,ImageChops,ImageStat

source=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve()
teaching=json.loads(Path(sys.argv[3]).read_text(encoding='utf8'))['correctedTeaching'] if len(sys.argv)>3 else None
assert 'test-results' in source.parts and source.suffix.lower()=='.pptx'
assert 'test-results' in output.parts
output.mkdir(parents=True,exist_ok=True)
before=hashlib.sha256(source.read_bytes()).hexdigest()
report={
    'success':False,
    'checks':[],
    'boundary':'Separate owned WPS KWPP.Application instance, read-only actual PPTX and real desktop slideshow frames. User WPS process is not activated or closed. No projector or human acceptance claim.',
    'sourceSha256':before,
}
app=presentation=show=None
topmost_handle=None

def check(name):
    report['checks'].append({'name':name,'pass':True})
    print('PASS '+name,flush=True)

def restore_topmost():
    global topmost_handle
    if not topmost_handle:
        return
    handle=topmost_handle
    topmost_handle=None
    if not win32gui.IsWindow(handle):
        report['topmostRestored']=True
        report['topmostRestore']='owned WPS slideshow already exited'
        return
    win32gui.SetWindowPos(handle,win32con.HWND_NOTOPMOST,0,0,0,0,win32con.SWP_NOMOVE|win32con.SWP_NOSIZE|win32con.SWP_NOACTIVATE)
    report['topmostRestored']=True

def activate_owned(hwnd):
    global topmost_handle
    report['slideshowWindowClass']=win32gui.GetClassName(hwnd)
    report['slideshowWindowTitle']=win32gui.GetWindowText(hwnd)
    win32gui.ShowWindow(hwnd,9)
    try:
        win32gui.SetForegroundWindow(hwnd)
        report['slideshowActivation']='native foreground'
    except Exception as error:
        report['foregroundActivationError']=str(error)
        win32gui.SetWindowPos(hwnd,win32con.HWND_TOPMOST,0,0,0,0,win32con.SWP_NOMOVE|win32con.SWP_NOSIZE|win32con.SWP_SHOWWINDOW|win32con.SWP_NOACTIVATE)
        topmost_handle=hwnd
        report['slideshowActivation']='owned topmost capture fallback'
        report['temporaryTopmost']=True
    time.sleep(.35)
    if not win32gui.IsWindowVisible(hwnd):
        raise RuntimeError('Owned WPS slideshow is not visible')
    return hwnd

def capture(hwnd):
    global topmost_handle
    if topmost_handle!=hwnd:
        win32gui.SetWindowPos(hwnd,win32con.HWND_TOPMOST,0,0,0,0,win32con.SWP_NOMOVE|win32con.SWP_NOSIZE|win32con.SWP_SHOWWINDOW|win32con.SWP_NOACTIVATE)
        topmost_handle=hwnd
        report['temporaryTopmost']=True
        time.sleep(.2)
    if not win32gui.IsWindowVisible(hwnd):
        raise RuntimeError('Refusing capture because owned WPS slideshow is not visible')
    rect=win32gui.GetWindowRect(hwnd)
    if rect[2]<=rect[0] or rect[3]<=rect[1]:
        raise RuntimeError(f'Owned WPS slideshow has no capturable area: {rect}')
    candidates=[]
    try:
        candidates.append(('window',ImageGrab.grab(window=hwnd).convert('RGB')))
    except Exception as error:
        report['windowCaptureError']=str(error)
    window_dc=source_dc=memory_dc=bitmap=None
    try:
        left,top,right,bottom=win32gui.GetClientRect(hwnd)
        width,height=right-left,bottom-top
        window_dc=win32gui.GetWindowDC(hwnd)
        source_dc=win32ui.CreateDCFromHandle(window_dc)
        memory_dc=source_dc.CreateCompatibleDC()
        bitmap=win32ui.CreateBitmap()
        bitmap.CreateCompatibleBitmap(source_dc,width,height)
        memory_dc.SelectObject(bitmap)
        rendered=win32gui.PrintWindow(hwnd,memory_dc.GetSafeHdc(),2)
        bits=bitmap.GetBitmapBits(True)
        image=Image.frombuffer('RGB',(width,height),bits,'raw','BGRX',0,1).convert('RGB')
        candidates.append((f'printwindow:{rendered}',image))
        memory_dc.BitBlt((0,0),(width,height),source_dc,(0,0),win32con.SRCCOPY)
        bits=bitmap.GetBitmapBits(True)
        image=Image.frombuffer('RGB',(width,height),bits,'raw','BGRX',0,1).convert('RGB')
        candidates.append(('window-dc-bitblt',image))
    except Exception as error:
        report['printWindowError']=str(error)
    finally:
        if bitmap:
            try:win32gui.DeleteObject(bitmap.GetHandle())
            except Exception:pass
        if memory_dc:
            try:memory_dc.DeleteDC()
            except Exception:pass
        if source_dc:
            try:source_dc.DeleteDC()
            except Exception:pass
        if window_dc:
            try:win32gui.ReleaseDC(hwnd,window_dc)
            except Exception:pass
    details=[]
    for method,image in candidates:
        stat=ImageStat.Stat(image)
        details.append({'method':method,'size':image.size,'mean':stat.mean,'stddev':stat.stddev})
        if min(image.size)>100 and max(stat.stddev)>2:
            report['captureMethod']=method
            report['captureDetails']=details
            return image
    report['captureDetails']=details
    raise RuntimeError('WPS slideshow raster capture was blank or uniform')

def window_info(hwnd):
    return {'hwnd':int(hwnd),'class':win32gui.GetClassName(hwnd),'title':win32gui.GetWindowText(hwnd)}

def com_hwnd(value):
    hwnd=value.HWND
    return int(hwnd() if callable(hwnd) else hwnd)

pythoncom.CoInitialize()
try:
    app=win32com.client.DispatchEx('KWPP.Application')
    report['version']=str(app.Version)
    report['build']=str(app.Build)
    app.Visible=True
    report['instancePresentationsBeforeOpen']=int(app.Presentations.Count)
    presentation=app.Presentations.Open(str(source),True,False,True)
    presentation.Slides.Count
    report['slides']=int(presentation.Slides.Count)
    assert report['slides']>=3
    check('Owned WPS instance opens the actual exported deck without conversion')

    texts=[]
    for index in range(1,report['slides']+1):
        slide=presentation.Slides.Item(index)
        slide.Export(str(output/f'slide-{index:02}.png'),'PNG',1600,900)
        for shape_index in range(1,slide.Shapes.Count+1):
            shape=slide.Shapes.Item(shape_index)
            if shape.HasTextFrame and shape.TextFrame.HasText:
                texts.append(str(shape.TextFrame.TextRange.Text))
    visible='\n'.join(texts)
    assert '观察结构' in visible and '结构变化演示' in visible
    if teaching:
        for text in [teaching['objective'],teaching['observation'],teaching['check']['question']]+[step[key] for step in teaching['steps'] for key in ['question','explanation']]:
            assert text in visible
    check('WPS natively renders editable Chinese teaching titles and observation prompts')

    if teaching:
        notes=[]
        for index in range(1,report['slides']+1):
            shapes=presentation.Slides.Item(index).NotesPage.Shapes
            for shape_index in range(1,shapes.Count+1):
                shape=shapes.Item(shape_index)
                if shape.HasTextFrame and shape.TextFrame.HasText:
                    notes.append(str(shape.TextFrame.TextRange.Text))
        note_text='\n'.join(notes)
        for text in [teaching['check']['answer']]+[step['notes'] for step in teaching['steps']]:
            assert text in note_text and text not in visible
        check('WPS native notes preserve the teacher answer boundary')

    try:
        report['presentationWindowsBeforeShow']=[
            window_info(com_hwnd(presentation.Windows.Item(index)))
            for index in range(1,int(presentation.Windows.Count)+1)
        ]
    except Exception as error:
        report['presentationWindowProbeError']=str(error)
    settings=presentation.SlideShowSettings
    settings.ShowType=1
    settings.ShowPresenterView=False
    known=[]
    win32gui.EnumWindows(lambda hwnd,_:known.append(hwnd),None)
    show=settings.Run()
    time.sleep(.8)
    try:
        count=int(app.SlideShowWindows.Count)
        report['slideShowWindowsCountAfterRun']=count
        if count>0:
            show=app.SlideShowWindows.Item(count)
    except Exception as error:
        report['slideShowWindowsCollectionError']=str(error)
    if show is not None:
        try:show.Activate()
        except Exception as error:report['showActivateError']=str(error)
        try:show.View.GotoSlide(2)
        except Exception as error:report['gotoSlide2Error']=str(error)
    new_visible=[]
    win32gui.EnumWindows(
        lambda hwnd,_:new_visible.append(window_info(hwnd))
        if hwnd not in known and win32gui.IsWindowVisible(hwnd)
        else None,
        None,
    )
    report['newVisibleWindowsAfterRun']=new_visible
    controlled=[]
    try:
        controlled=[
            window_info(com_hwnd(presentation.Windows.Item(index)))
            for index in range(1,int(presentation.Windows.Count)+1)
        ]
    except Exception as error:
        report['slideshowWindowProbeError']=str(error)
    report['presentationWindowsAfterRun']=controlled
    candidates=[item for item in new_visible+controlled if win32gui.IsWindow(item['hwnd']) and win32gui.IsWindowVisible(item['hwnd'])]
    preferred=[item for item in candidates if 'PPTFrame' in item['class'] or source.stem in item['title']]
    owned=[item['hwnd'] for item in preferred]
    if not owned and len(candidates)==1:
        owned=[candidates[0]['hwnd']]
    assert len(owned)==1,f'Expected one owned WPS slideshow window; found {owned} candidates={candidates}'
    handle=activate_owned(owned[0])
    first=capture(handle)
    first.save(output/'wps-slideshow-overview.png')
    time.sleep(2.4)
    second=capture(handle)
    second.save(output/'wps-slideshow-progress.png')
    assert first.size==second.size and min(first.size)>100
    width,height=first.size
    box=(int(width*.06),int(height*.23),int(width*.65),int(height*.78))
    mean=sum(ImageStat.Stat(ImageChops.difference(first.crop(box),second.crop(box))).mean)/3
    report['diagramPixelChangeMean']=mean
    assert mean>.2,f'WPS GIF did not visibly change: {mean}'
    check('Embedded GIF visibly changes in the actual WPS slideshow')

    if show is None:
        raise RuntimeError('WPS did not expose a slideshow control object')
    show.View.GotoSlide(3)
    time.sleep(.5)
    capture(handle).save(output/'wps-slideshow-step.png')
    assert int(show.View.Slide.SlideIndex)==3
    check('Teacher can advance to an independent static WPS explanation slide')

    restore_topmost()
    show.View.Exit()
    show=None
    presentation.Close()
    presentation=None
    assert hashlib.sha256(source.read_bytes()).hexdigest()==before
    check('Read-only WPS playback preserves the exact source PPTX bytes')
    report['success']=True
except Exception:
    import traceback
    report['error']=traceback.format_exc()
    print(report['error'],flush=True)
finally:
    try:
        restore_topmost()
    except Exception as error:
        report['topmostRestoreError']=str(error)
    if show:
        try:show.View.Exit()
        except Exception:pass
    if presentation:
        try:presentation.Close()
        except Exception:pass
    if app:
        try:app.Quit()
        except Exception as error:report['quitError']=str(error)
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    pythoncom.CoUninitialize()
print(json.dumps({'success':report['success'],'checks':len(report['checks']),'output':str(output)},ensure_ascii=False),flush=True)
sys.exit(0 if report['success'] else 1)
