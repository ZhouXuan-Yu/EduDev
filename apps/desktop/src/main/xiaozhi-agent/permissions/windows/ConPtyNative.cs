using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace Xiaozhi.PermissionRuntime
{
    internal static class ConPtyNative
    {
        [StructLayout(LayoutKind.Sequential)]
        internal struct Coord
        {
            internal short X, Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct SecurityAttributes
        {
            internal int Length;
            internal IntPtr Descriptor;
            internal int Inherit;
        }

        [DllImport("kernel32.dll", ExactSpelling = true)]
        internal static extern int CreatePseudoConsole(Coord size, IntPtr input, IntPtr output, uint flags, out IntPtr console);
        [DllImport("kernel32.dll", ExactSpelling = true)]
        internal static extern int ResizePseudoConsole(IntPtr console, Coord size);
        [DllImport("kernel32.dll", ExactSpelling = true)]
        internal static extern void ClosePseudoConsole(IntPtr console);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref SecurityAttributes security, uint size);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CloseHandle(IntPtr handle);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr OpenThread(uint access, bool inherit, uint threadId);
        [DllImport("kernel32.dll")]
        internal static extern uint GetCurrentThreadId();
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CancelSynchronousIo(IntPtr thread);

        internal static Coord Size(int cols, int rows)
        {
            if (cols < 1 || cols > 1000 || rows < 1 || rows > 1000)
                throw new ArgumentOutOfRangeException("cols/rows");
            return new Coord { X = (short)cols, Y = (short)rows };
        }

        internal static void Check(bool success)
        {
            if (!success) throw new Win32Exception(Marshal.GetLastWin32Error());
        }

        internal static void CheckResult(int result)
        {
            if (result < 0) Marshal.ThrowExceptionForHR(result);
        }

        internal static void Close(ref IntPtr handle)
        {
            IntPtr closing = handle;
            handle = IntPtr.Zero;
            if (closing != IntPtr.Zero) CloseHandle(closing);
        }
    }
}
