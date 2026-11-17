using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace Xiaozhi.PermissionRuntime
{
    internal sealed partial class Runner
    {
        private sealed class InputChunk
        {
            internal int Sequence;
            internal byte[] Bytes;
        }

        private readonly BlockingCollection<InputChunk> inputQueue = new BlockingCollection<InputChunk>(4);
        private IntPtr sessionInputWrite;
        private Thread sessionInputThread;
        private int inputSequence, inputBytes;
        private bool sessionInputClosed;
        private JobLimits jobLimits;

        private void CreateSessionInput(ref Native.SecurityAttributes security)
        {
            Native.Check(Native.CreatePipe(out input, out sessionInputWrite, ref security, 65536));
            Native.Check(Native.SetHandleInformation(sessionInputWrite, 1, 0));
        }

        private void StartSessionInput()
        {
            IntPtr handle = sessionInputWrite;
            sessionInputWrite = IntPtr.Zero;
            sessionInputThread = new Thread(delegate ()
            {
                try
                {
                    using (FileStream stream = new FileStream(new SafeFileHandle(handle, true), FileAccess.Write, 16384, false))
                    {
                        foreach (InputChunk chunk in inputQueue.GetConsumingEnumerable())
                        {
                            stream.Write(chunk.Bytes, 0, chunk.Bytes.Length);
                            stream.Flush();
                            Dictionary<string, object> ack = Frame("input_ack");
                            ack.Add("sequence", chunk.Sequence);
                            sink.Send(ack);
                        }
                    }
                }
                catch
                {
                    if (!stopped.WaitOne(0))
                        Stop("failed", "input_closed");
                }
            });
            sessionInputThread.IsBackground = true;
            sessionInputThread.Name = "sandbox-session-input";
            sessionInputThread.Start();
        }

        private bool HandleSessionControl(Dictionary<string, object> frame)
        {
            string type = Request.Text(frame, "type", 20);
            if (type != "input" && type != "input_close")
                return false;
            if (type == "input")
                Request.Keys(frame, "schemaVersion", "type", "executionId", "sequence", "data");
            else
                Request.Keys(frame, "schemaVersion", "type", "executionId");
            Request.Number(frame, "schemaVersion", 1, 1);
            if (Request.Text(frame, "executionId", 80) != executionId || stopped.WaitOne(0))
                throw new SandboxException("invalid_protocol");
            if (type == "input_close")
            {
                sessionInputClosed = true;
                inputQueue.CompleteAdding();
                return true;
            }
            if (sessionInputClosed)
                throw new SandboxException("invalid_protocol");
            int sequence = Request.Number(frame, "sequence", 1, int.MaxValue);
            string encoded = Request.Text(frame, "data", 21848);
            byte[] bytes = Convert.FromBase64String(encoded);
            if (bytes.Length == 0 || bytes.Length > 16384 || Convert.ToBase64String(bytes) != encoded
                || sequence != inputSequence + 1 || bytes.Length > request.Session.MaxInputBytes - inputBytes)
                throw new SandboxException("invalid_protocol");
            inputSequence = sequence;
            inputBytes += bytes.Length;
            if (!inputQueue.TryAdd(new InputChunk { Sequence = sequence, Bytes = bytes }))
                throw new SandboxException("input_limit");
            return true;
        }

        private void CloseSessionInput()
        {
            sessionInputClosed = true;
            inputQueue.CompleteAdding();
            Native.Close(ref sessionInputWrite);
            // Job termination closes the reader end and interrupts a blocked writer.
            if (sessionInputThread != null)
                sessionInputThread.Join(3000);
        }
    }
}
