"""Small ABI adapter to Windows GDI+, the renderer used by System.Drawing.

No drawing records are interpreted here. Input and raster size are validated by
metafiles.py before this adapter calls the original operating-system renderer.
"""
import ctypes


class StartupInput(ctypes.Structure):
    _fields_ = [("version", ctypes.c_uint), ("callback", ctypes.c_void_p),
                ("suppress_thread", ctypes.c_int), ("suppress_codecs", ctypes.c_int)]


def render(data, size):
    from PIL import Image
    gdip = ctypes.WinDLL("gdiplus.dll", winmode=0x800)
    shell = ctypes.WinDLL("shlwapi.dll", winmode=0x800)
    pointer = ctypes.c_void_p

    def bind(name, arguments):
        function = getattr(gdip, name)
        function.argtypes = arguments
        function.restype = ctypes.c_int
        return function

    startup = bind("GdiplusStartup", [ctypes.POINTER(ctypes.c_size_t), ctypes.POINTER(StartupInput), pointer])
    shutdown = gdip.GdiplusShutdown
    shutdown.argtypes = [ctypes.c_size_t]
    shutdown.restype = None
    load = bind("GdipLoadImageFromStream", [pointer, ctypes.POINTER(pointer)])
    bitmap = bind("GdipCreateBitmapFromScan0", [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, pointer, ctypes.POINTER(pointer)])
    graphics = bind("GdipGetImageGraphicsContext", [pointer, ctypes.POINTER(pointer)])
    clear = bind("GdipGraphicsClear", [pointer, ctypes.c_uint])
    draw = bind("GdipDrawImageRectI", [pointer, pointer, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int])
    flush = bind("GdipFlush", [pointer, ctypes.c_int])
    dispose_graphics = bind("GdipDeleteGraphics", [pointer])
    dispose_image = bind("GdipDisposeImage", [pointer])
    shell.SHCreateMemStream.argtypes = [pointer, ctypes.c_uint]
    shell.SHCreateMemStream.restype = pointer

    def check(status):
        if status:
            raise ValueError("parse_failed")

    width, height = size
    token, source, target, context = ctypes.c_size_t(), pointer(), pointer(), pointer()
    original = ctypes.create_string_buffer(data)
    pixels = ctypes.create_string_buffer(width * height * 4)
    stream = None
    check(startup(ctypes.byref(token), ctypes.byref(StartupInput(1, None, 0, 1)), None))
    try:
        stream = shell.SHCreateMemStream(original, len(data))
        if not stream:
            raise ValueError("parse_failed")
        check(load(stream, ctypes.byref(source)))
        # PixelFormat32bppARGB is stored as BGRA on little-endian Windows.
        check(bitmap(width, height, width * 4, 0x26200A, pixels, ctypes.byref(target)))
        check(graphics(target, ctypes.byref(context)))
        check(clear(context, 0xFFFFFFFF))
        check(draw(context, source, 0, 0, width, height))
        check(flush(context, 1))
        with Image.frombytes("RGBA", size, pixels.raw, "raw", "BGRA") as image:
            return image.convert("RGB")
    finally:
        if context:
            dispose_graphics(context)
        if target:
            dispose_image(target)
        if source:
            dispose_image(source)
        if stream:
            vtable = ctypes.cast(stream, ctypes.POINTER(ctypes.POINTER(pointer))).contents
            release = ctypes.WINFUNCTYPE(ctypes.c_ulong, pointer)(vtable[2])
            release(stream)
        shutdown(token)
