using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace Xiaozhi.PermissionRuntime
{
    internal sealed class ConPtySession : IDisposable
    {
        private readonly object gate = new object();
        private readonly object inputGate = new object();
        private readonly Action<byte[]> onBytes;
        private readonly Action<Exception> onFailure;
        private IntPtr console, writerThread;
        private FileStream input, output;
        private Thread reader, closer;
        private bool inputClosed, closing, closed;
        private Exception failure;

        private ConPtySession(Action<byte[]> bytes, Action<Exception> failed)
        {
            if (bytes == null || failed == null) throw new ArgumentNullException("callbacks");
            onBytes = bytes;
            onFailure = failed;
        }

        internal static ConPtySession Create(int cols, int rows, Action<byte[]> onBytes, Action<Exception> onFailure)
        {
            ConPtyNative.Coord size = ConPtyNative.Size(cols, rows);
            ConPtySession session = new ConPtySession(onBytes, onFailure);
            IntPtr inputRead = IntPtr.Zero, inputWrite = IntPtr.Zero;
            IntPtr outputRead = IntPtr.Zero, outputWrite = IntPtr.Zero;
            try
            {
                ConPtyNative.SecurityAttributes security = new ConPtyNative.SecurityAttributes();
                security.Length = Marshal.SizeOf(security);
                ConPtyNative.Check(ConPtyNative.CreatePipe(out inputRead, out inputWrite, ref security, 65536));
                ConPtyNative.Check(ConPtyNative.CreatePipe(out outputRead, out outputWrite, ref security, 65536));
                session.input = TakeStream(ref inputWrite, FileAccess.Write);
                session.output = TakeStream(ref outputRead, FileAccess.Read);
                ConPtyNative.CheckResult(ConPtyNative.CreatePseudoConsole(size, inputRead, outputWrite, 0, out session.console));
                return session;
            }
            catch
            {
                ConPtyNative.Close(ref inputRead);
                ConPtyNative.Close(ref outputWrite);
                session.Close();
                throw;
            }
            finally
            {
                ConPtyNative.Close(ref inputRead);
                ConPtyNative.Close(ref inputWrite);
                ConPtyNative.Close(ref outputRead);
                ConPtyNative.Close(ref outputWrite);
            }
        }

        private static FileStream TakeStream(ref IntPtr handle, FileAccess access)
        {
            SafeFileHandle owned = new SafeFileHandle(handle, true);
            handle = IntPtr.Zero;
            try { return new FileStream(owned, access, 16384, false); }
            catch { owned.Dispose(); throw; }
        }

        internal IntPtr Handle
        {
            get
            {
                lock (gate)
                {
                    if (closing || console == IntPtr.Zero) throw new ObjectDisposedException("ConPtySession");
                    return console;
                }
            }
        }

        internal void StartReading()
        {
            lock (gate)
            {
                if (reader != null || output == null) return;
                reader = new Thread(ReadOutput);
                reader.IsBackground = true;
                reader.Name = "sandbox-pty-output";
                reader.Start();
            }
        }

        private void ReadOutput()
        {
            try
            {
                byte[] buffer = new byte[16384];
                int count;
                while ((count = output.Read(buffer, 0, buffer.Length)) != 0)
                {
                    byte[] chunk = new byte[count];
                    Buffer.BlockCopy(buffer, 0, chunk, 0, count);
                    onBytes(chunk);
                }
            }
            catch (IOException error)
            {
                int code = error.HResult & 65535;
                if (code != 109 && code != 232) ReportFailure(error);
            }
            catch (Exception error) { ReportFailure(error); }
        }

        private void ReportFailure(Exception error)
        {
            lock (gate)
            {
                if (failure != null) return;
                failure = error;
            }
            try { onFailure(error); }
            catch { /* The original runner retains the failure and owns termination. */ }
        }

        internal void WriteInput(byte[] bytes)
        {
            if (bytes == null || bytes.Length == 0 || bytes.Length > 16384)
                throw new ArgumentOutOfRangeException("bytes");
            lock (inputGate)
            {
                lock (gate)
                {
                    if (inputClosed || closing) throw new ObjectDisposedException("ConPtySession.input");
                    writerThread = ConPtyNative.OpenThread(1, false, ConPtyNative.GetCurrentThreadId());
                    ConPtyNative.Check(writerThread != IntPtr.Zero);
                }
                try
                {
                    input.Write(bytes, 0, bytes.Length);
                    input.Flush();
                }
                finally
                {
                    lock (gate) ConPtyNative.Close(ref writerThread);
                }
            }
        }

        internal void Resize(int cols, int rows)
        {
            ConPtyNative.Coord size = ConPtyNative.Size(cols, rows);
            lock (gate)
            {
                if (closing || console == IntPtr.Zero) throw new ObjectDisposedException("ConPtySession");
                ConPtyNative.CheckResult(ConPtyNative.ResizePseudoConsole(console, size));
            }
        }

        internal void CloseInput()
        {
            lock (gate)
            {
                inputClosed = true;
                // Normal EOF follows the core input queue drain. Cleanup can interrupt a blocked write.
                if (writerThread != IntPtr.Zero) ConPtyNative.CancelSynchronousIo(writerThread);
            }
            lock (inputGate)
            {
                if (input != null) { input.Dispose(); input = null; }
            }
        }

        internal void Close()
        {
            StartReading();
            lock (gate)
            {
                if (closed) return;
                if (!closing)
                {
                    closing = true;
                    IntPtr handle = console;
                    console = IntPtr.Zero;
                    closer = new Thread(delegate ()
                    {
                        try { if (handle != IntPtr.Zero) ConPtyNative.ClosePseudoConsole(handle); }
                        catch (Exception error) { ReportFailure(error); }
                    });
                    closer.IsBackground = true;
                    closer.Name = "sandbox-pty-close";
                    closer.Start();
                }
            }
            CloseInput();
            if (!closer.Join(5000) || reader != null && !reader.Join(3000))
                throw new InvalidOperationException("pty_cleanup_failed");
            lock (gate)
            {
                if (closed) return;
                if (output != null) { output.Dispose(); output = null; }
                closed = true;
                if (failure != null) throw new InvalidOperationException("pty_cleanup_failed", failure);
            }
        }

        public void Dispose() { Close(); }
    }
}
