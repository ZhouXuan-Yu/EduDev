"""Acceptance via the installed PowerPoint object model and its own live window.
Never modifies the input presentation or other user presentations.
"""
import json,sys,time,hashlib,shutil
from pathlib import Path
import pythoncom,win32com.client
import win32api,win32con,win32gui,win32process
from PIL import ImageGrab,ImageChops,ImageStat

source=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve()
assert 'test-results' in source.parts and source.suffix.lower()=='.pptx'
assert 'test-results' in output.parts
output.mkdir(parents=True,exist_ok=True)
before=hashlib.sha256(source.read_bytes()).hexdigest()
teaching=json.loads(Path(sys.argv[3]).read_text(encoding='utf8'))['correctedTeaching'] if len(sys.argv)>3 else None
report={'success':False,'checks':[],'boundary':'Installed Microsoft PowerPoint COM open/export plus screenshots of its actual windowed slideshow. No WPS claim, no direct manipulation of slide XML, no saved changes to input.'}
app=presentation=show=None;initial=0;slideshow_handle=None;topmost_handle=None
def check(name):
    report['checks'].append({'name':name,'pass':True});print('PASS '+name,flush=True)
def restore_topmost():
    global topmost_handle
    if not topmost_handle:
        return
    handle=topmost_handle;topmost_handle=None
    if not win32gui.IsWindow(handle):
        report['topmostRestored']=True
        report['topmostRestore']='owned slideshow already exited'
        return
    win32gui.SetWindowPos(handle,win32con.HWND_NOTOPMOST,0,0,0,0,win32con.SWP_NOMOVE|win32con.SWP_NOSIZE|win32con.SWP_NOACTIVATE)
    report['topmostRestored']=True
def owned_foreground(hwnd,allowed_stems):
    foreground=win32gui.GetForegroundWindow()
    if foreground==hwnd:
        return foreground
    if not foreground:
        return None
    title=win32gui.GetWindowText(foreground)
    if win32process.GetWindowThreadProcessId(foreground)[1]!=win32process.GetWindowThreadProcessId(hwnd)[1]:
        return None
    return foreground if any(stem in title for stem in allowed_stems) else None
def activate_owned_show(hwnd,allowed_stems):
    """Accept the COM foreground and make a best-effort activation without stealing unrelated windows."""
    foreground=owned_foreground(hwnd,allowed_stems)
    if foreground:
        report['slideshowActivation']='com-owned foreground already active'
        return foreground
    global topmost_handle
    def describe(window):
        return {'hwnd':window,'class':win32gui.GetClassName(window),'title':win32gui.GetWindowText(window)} if window else None
    report['foregroundBeforeActivation']=describe(win32gui.GetForegroundWindow())
    report['slideshowActivationWindow']=describe(hwnd)
    win32gui.ShowWindow(hwnd,9)
    try:
        win32gui.SetForegroundWindow(hwnd)
    except Exception as error:
        time.sleep(.35)
        foreground=owned_foreground(hwnd,allowed_stems)
        if foreground:
            report['slideshowActivation']='COM-owned foreground after activation call'
            report['foregroundActivationError']=str(error)
            return foreground
        try:
            win32gui.BringWindowToTop(hwnd)
            win32gui.SetForegroundWindow(hwnd)
        except Exception as second_error:
            time.sleep(.35)
            foreground=owned_foreground(hwnd,allowed_stems)
            if foreground:
                report['slideshowActivation']='bring-to-top fallback with owned foreground'
                report['foregroundActivationError']=f'{error}; {second_error}'
                return foreground
            foreground_handle=win32gui.GetForegroundWindow()
            current_thread=win32api.GetCurrentThreadId()
            foreground_thread=win32process.GetWindowThreadProcessId(foreground_handle)[0]
            attached=False
            try:
                if foreground_thread and foreground_thread!=current_thread:
                    attached=win32process.AttachThreadInput(current_thread,foreground_thread,True)
                win32api.keybd_event(win32con.VK_MENU,0,0,0)
                win32api.keybd_event(win32con.VK_MENU,0,win32con.KEYEVENTF_KEYUP,0)
                win32gui.SetForegroundWindow(hwnd)
            except Exception as third_error:
                time.sleep(.35)
                foreground=owned_foreground(hwnd,allowed_stems)
                if not foreground:
                    raise RuntimeError(f'Owned slideshow did not become capturable foreground: {error}; {second_error}; {third_error}')
                report['slideshowActivation']='thread-input and Alt activation fallback'
                report['foregroundActivationError']=f'{error}; {second_error}; {third_error}'
                return foreground
            finally:
                if attached:
                    win32process.AttachThreadInput(current_thread,foreground_thread,False)
            time.sleep(.35)
            foreground=owned_foreground(hwnd,allowed_stems)
            if foreground:
                report['slideshowActivation']='thread-input and Alt activation'
                report['foregroundActivationError']=f'{error}; {second_error}'
                return foreground
            if not win32gui.IsWindowVisible(hwnd):
                raise RuntimeError(f'Owned slideshow did not become capturable foreground: {error}; {second_error}')
            win32gui.SetWindowPos(hwnd,win32con.HWND_TOPMOST,0,0,0,0,win32con.SWP_NOMOVE|win32con.SWP_NOSIZE|win32con.SWP_SHOWWINDOW|win32con.SWP_NOACTIVATE)
            topmost_handle=hwnd;time.sleep(.35)
            rect=win32gui.GetWindowRect(hwnd)
            if rect[2]<=rect[0] or rect[3]<=rect[1]:
                raise RuntimeError(f'Owned topmost slideshow has no capturable area: {rect}')
            report['slideshowActivation']='owned topmost desktop capture fallback'
            report['foregroundActivationError']=f'{error}; {second_error}'
            report['temporaryTopmost']=True
            return hwnd
    time.sleep(.35)
    foreground=owned_foreground(hwnd,allowed_stems)
    if not foreground:
        raise RuntimeError('Owned slideshow window exists but foreground ownership could not be established')
    report['slideshowActivation']='native foreground activation'
    return foreground
def capture_show(hwnd,allowed_stems):
    # Capture the real visible desktop region. PrintWindow can return an all-white
    # surface for PowerPoint's accelerated slideshow and cannot prove playback.
    global topmost_handle
    foreground=owned_foreground(hwnd,allowed_stems)
    if foreground:
        hwnd=foreground
    if topmost_handle!=hwnd:
        try:
            win32gui.SetWindowPos(hwnd,win32con.HWND_TOPMOST,0,0,0,0,win32con.SWP_NOMOVE|win32con.SWP_NOSIZE|win32con.SWP_SHOWWINDOW|win32con.SWP_NOACTIVATE)
            topmost_handle=hwnd
            report['temporaryTopmost']=True
            time.sleep(.2)
        except Exception as error:
            report['captureTopmostError']=str(error)
    if not win32gui.IsWindowVisible(hwnd):
        raise RuntimeError('Refusing desktop capture because the owned slideshow is not visible')
    report['capturedWindowClass']=win32gui.GetClassName(hwnd)
    rect=win32gui.GetWindowRect(hwnd)
    return ImageGrab.grab(bbox=rect,all_screens=True).convert('RGB')
pythoncom.CoInitialize()
try:
    app=win32com.client.DispatchEx('PowerPoint.Application');initial=app.Presentations.Count
    report['version']=app.Version;report['build']=app.Build
    portable=source
    if teaching:
        portable=output/'portable'/source.name;portable.parent.mkdir(exist_ok=True);shutil.copy2(source,portable)
        assert hashlib.sha256(portable.read_bytes()).hexdigest()==before
    presentation=app.Presentations.Open(str(portable),True,False,True)
    assert presentation.Slides.Count>=3
    report['slides']=presentation.Slides.Count
    check('Installed PowerPoint opens the actual exported deck without conversion')
    texts=[]
    for i in range(1,presentation.Slides.Count+1):
        slide=presentation.Slides.Item(i)
        slide.Export(str(output/f'slide-{i:02}.png'),'PNG',1600,900)
        for j in range(1,slide.Shapes.Count+1):
            shape=slide.Shapes.Item(j)
            if shape.HasTextFrame and shape.TextFrame.HasText:texts.append(shape.TextFrame.TextRange.Text)
    assert any('观察结构' in s for s in texts) and any('结构变化演示' in s for s in texts)
    check('Native slides render with editable Chinese teaching titles and observation prompts')
    if teaching:
        visible='\n'.join(texts);notes=[]
        for i in range(1,presentation.Slides.Count+1):
            shapes=presentation.Slides.Item(i).NotesPage.Shapes
            for j in range(1,shapes.Count+1):
                shape=shapes.Item(j)
                if shape.HasTextFrame and shape.TextFrame.HasText:notes.append(shape.TextFrame.TextRange.Text)
        for text in [teaching['objective'],teaching['observation'],teaching['check']['question']]+[s[k] for s in teaching['steps'] for k in ['question','explanation']]:assert text in visible
        for text in [teaching['check']['answer']]+[s['notes'] for s in teaching['steps']]:assert text not in visible and text in '\n'.join(notes)
        check('PowerPoint native text/notes confirm corrected teaching and hide reference answers from student slides')
    settings=presentation.SlideShowSettings;settings.ShowType=2;settings.ShowPresenterView=False
    known=[];win32gui.EnumWindows(lambda hwnd,_:known.append(hwnd),None)
    show=settings.Run();show.Activate();show.View.GotoSlide(2)
    time.sleep(.5)
    own=[]
    win32gui.EnumWindows(lambda hwnd,_:own.append(hwnd) if hwnd not in known and win32gui.IsWindowVisible(hwnd) and source.stem in win32gui.GetWindowText(hwnd) else None,None)
    assert len(own)==1, f'Expected one new slideshow window for this owned sample; found {len(own)}'
    slideshow_handle=own[0];report['slideshowWindowClass']=win32gui.GetClassName(slideshow_handle)
    capture_handle=activate_owned_show(slideshow_handle,[source.stem]);time.sleep(.5)
    a=capture_show(capture_handle,[source.stem]);a.save(output/'slideshow-overview.png')
    time.sleep(2.3)
    b=capture_show(capture_handle,[source.stem]);b.save(output/'slideshow-progress.png')
    assert a.size==b.size and min(a.size)>100
    # Restrict the comparison to the diagram, excluding slideshow controls/cursor.
    w,h=a.size;box=(int(w*.06),int(h*.23),int(w*.65),int(h*.78))
    diff=ImageChops.difference(a.crop(box),b.crop(box));mean=sum(ImageStat.Stat(diff).mean)/3
    report['diagramPixelChangeMean']=mean
    assert mean>0.2, f'GIF failed to change in actual slideshow: {mean}'
    check('Embedded GIF visibly changes in the actual offline PowerPoint slideshow')
    show.View.GotoSlide(3);time.sleep(.4);capture_show(capture_handle,[source.stem]).save(output/'slideshow-step.png')
    assert show.View.Slide.SlideIndex==3
    check('Teacher can advance to an independent static step for explanation')
    restore_topmost();show.View.Exit();show=None;presentation.Close();presentation=None
    assert hashlib.sha256(source.read_bytes()).hexdigest()==before
    check('Read-only Office acceptance preserves exact original PPT bytes')
    if teaching:
        # Model an existing teacher deck entirely inside owned test results.
        base=app.Presentations.Add(True);base.Slides.Add(1,12)
        base.Slides.Item(1).Shapes.AddTextbox(1,40,40,600,60).TextFrame.TextRange.Text='老师已有课件（测试副本）'
        existing=output/'teacher-existing.pptx';base.SaveAs(str(existing),24);base.Close()
        base_hash=hashlib.sha256(existing.read_bytes()).hexdigest();copy=output/'teacher-existing-copy.pptx';shutil.copy2(existing,copy)
        base=app.Presentations.Open(str(copy),False,False,True)
        inserted=base.Slides.InsertFromFile(str(portable),1,2,report['slides']);assert inserted==report['slides']-1
        merged=output/'existing-lesson-merged.pptx';base.SaveAs(str(merged),24);base.Close()
        assert hashlib.sha256(existing.read_bytes()).hexdigest()==base_hash
        presentation=app.Presentations.Open(str(merged),True,False,True)
        assert presentation.Slides.Count==report['slides']
        presentation.Slides.Item(3).Export(str(output/'merged-step.png'),'PNG',1600,900)
        settings=presentation.SlideShowSettings;settings.ShowType=2;settings.ShowPresenterView=False
        known=[];win32gui.EnumWindows(lambda hwnd,_:known.append(hwnd),None)
        show=settings.Run();show.Activate();show.View.GotoSlide(2);time.sleep(.5)
        own=[];win32gui.EnumWindows(lambda hwnd,_:own.append(hwnd) if hwnd not in known and win32gui.IsWindowVisible(hwnd) and merged.stem in win32gui.GetWindowText(hwnd) else None,None)
        assert len(own)==1;slideshow_handle=own[0]
        capture_handle=activate_owned_show(slideshow_handle,[merged.stem]);time.sleep(.5)
        a=capture_show(capture_handle,[merged.stem]);a.save(output/'merged-animation-a.png');time.sleep(2.3)
        b=capture_show(capture_handle,[merged.stem]);b.save(output/'merged-animation-b.png')
        w,h=a.size;box=(int(w*.06),int(h*.23),int(w*.65),int(h*.78))
        mean=sum(ImageStat.Stat(ImageChops.difference(a.crop(box),b.crop(box))).mean)/3
        assert mean>.2;report['mergedDiagramPixelChangeMean']=mean;report['mergedPpt']=str(merged)
        show.View.GotoSlide(3);time.sleep(.4);capture_show(capture_handle,[merged.stem]).save(output/'merged-static-step.png')
        assert show.View.Slide.SlideIndex==3;restore_topmost();show.View.Exit();show=None;presentation.Close();presentation=None
        check('Native InsertFromFile merges into an owned teacher deck copy; embedded animation still plays and static steps remain usable')
        check('Relocated files render without original HTML; original teacher deck and original export retain exact bytes (no system-network change)')
    report['success']=True
except Exception as e:
    import traceback
    report['error']=traceback.format_exc()
    if slideshow_handle:
        try:ImageGrab.grab(window=slideshow_handle).save(output/'failure.png')
        except Exception:pass
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
    if app and initial==0:
        try:app.Quit()
        except Exception:pass
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    pythoncom.CoUninitialize()
print(json.dumps({'success':report['success'],'checks':len(report['checks']),'output':str(output)},ensure_ascii=False),flush=True)
sys.exit(0 if report['success'] else 1)
