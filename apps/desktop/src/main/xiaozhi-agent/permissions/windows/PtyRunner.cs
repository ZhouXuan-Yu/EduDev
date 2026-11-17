using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace Xiaozhi.PermissionRuntime
{
    internal sealed partial class Runner
    {
        private ConPtySession ptySession;
        private bool ptyCleanupComplete = true;

        private bool UsesPty
        {
            get { return request != null && request.Session != null && request.Session.Mode == "pty"; }
        }

        private void CreatePty()
        {
            ptyCleanupComplete = false;
            ptySession = ConPtySession.Create(request.Session.Cols, request.Session.Rows,
                delegate(byte[] bytes) { EmitSessionOutput(bytes, bytes.Length, "pty"); },
                delegate(Exception failure) { Stop("failed", "pty_io_failed"); });
        }

        private void ConfigurePtyAttributes()
        {
            Native.Check(Native.UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x20016),
                ptySession.Handle, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero));
        }

        private bool HandlePtyControl(Dictionary<string, object> frame)
        {
            if (Request.Text(frame, "type", 20) != "resize") return false;
            if (!UsesPty || ptySession == null || stopped.WaitOne(0))
                throw new SandboxException("invalid_protocol");
            Request.Keys(frame, "schemaVersion", "type", "executionId", "controlId", "cols", "rows");
            Request.Number(frame, "schemaVersion", 1, 1);
            if (Request.Text(frame, "executionId", 80) != executionId)
                throw new SandboxException("invalid_protocol");
            string controlId = Request.Text(frame, "controlId", 160);
            if (!Regex.IsMatch(controlId, "^[A-Za-z0-9_-]{1,160}$"))
                throw new SandboxException("invalid_protocol");
            int cols = Request.Number(frame, "cols", 1, 1000);
            int rows = Request.Number(frame, "rows", 1, 1000);
            ptySession.Resize(cols, rows);
            Dictionary<string, object> ack = Frame("resize_ack");
            ack.Add("controlId", controlId);
            ack.Add("cols", cols);
            ack.Add("rows", rows);
            sink.Send(ack);
            return true;
        }

        private void ClosePty()
        {
            if (ptySession == null) return;
            try { ptySession.Close(); ptyCleanupComplete = true; }
            catch { state = "failed"; error = "cleanup_failed"; }
        }

        private void EmitSessionOutput(byte[] buffer, int count, string streamName)
        {
            lock (gate)
            {
                int allowed = Math.Min(count, request.MaxOutputBytes - emittedBytes);
                if (allowed > 0)
                {
                    byte[] chunk = new byte[allowed];
                    Buffer.BlockCopy(buffer, 0, chunk, 0, allowed);
                    Dictionary<string, object> output = Frame("output");
                    output.Add("stream", streamName);
                    output.Add("data", Convert.ToBase64String(chunk));
                    sink.Send(output);
                    emittedBytes += allowed;
                }
                if (allowed != count)
                {
                    truncated = true;
                    Stop("failed", "output_limit");
                }
            }
        }
    }
}
