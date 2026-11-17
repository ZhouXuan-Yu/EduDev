using System;
using System.Runtime.InteropServices;

namespace Xiaozhi.PermissionRuntime
{
    internal sealed class JobLimits : IDisposable
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct CpuLimit
        {
            internal uint Flags, Rate;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct CompletionPort
        {
            internal IntPtr Key, Port;
        }

        [DllImport("kernel32.dll", SetLastError = true, EntryPoint = "SetInformationJobObject")]
        private static extern bool SetCpu(IntPtr job, int kind, ref CpuLimit info, int size);
        [DllImport("kernel32.dll", SetLastError = true, EntryPoint = "QueryInformationJobObject")]
        private static extern bool QueryCpu(IntPtr job, int kind, out CpuLimit info, int size, IntPtr returned);
        [DllImport("kernel32.dll", SetLastError = true, EntryPoint = "QueryInformationJobObject")]
        private static extern bool QueryLimits(IntPtr job, int kind, out Native.ExtendedLimits info, int size, IntPtr returned);
        [DllImport("kernel32.dll", SetLastError = true, EntryPoint = "SetInformationJobObject")]
        private static extern bool SetPort(IntPtr job, int kind, ref CompletionPort info, int size);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr CreateIoCompletionPort(IntPtr file, IntPtr existing, IntPtr key, uint threads);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetQueuedCompletionStatus(IntPtr port, out uint message, out IntPtr key, out IntPtr data, uint timeout);

        private IntPtr port;

        internal JobLimits(IntPtr job, int maxProcesses, SessionOptions session)
        {
            Native.ExtendedLimits limits = new Native.ExtendedLimits();
            limits.Basic.Flags = 0x2000 | 0x8 | 0x200;
            limits.Basic.ActiveProcesses = (uint)maxProcesses;
            limits.JobMemory = new UIntPtr((uint)(session == null ? 536870912 : session.MemoryBytes));
            if (session != null && session.UserTimeMs > 0)
            {
                limits.Basic.Flags |= 0x4;
                limits.Basic.JobTime = (long)session.UserTimeMs * 10000;
            }
            CpuLimit cpu = new CpuLimit { Flags = 0x1 | 0x4, Rate = (uint)(session == null ? 5000 : session.CpuRate) };
            Native.ExtendedLimits actual;
            CpuLimit actualCpu;
            if (!Native.SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(limits))
                || !SetCpu(job, 15, ref cpu, Marshal.SizeOf(cpu))
                || !QueryLimits(job, 9, out actual, Marshal.SizeOf(limits), IntPtr.Zero)
                || !QueryCpu(job, 15, out actualCpu, Marshal.SizeOf(cpu), IntPtr.Zero)
                || actual.Basic.Flags != limits.Basic.Flags || actual.JobMemory != limits.JobMemory
                || actual.Basic.ActiveProcesses != limits.Basic.ActiveProcesses || actual.Basic.JobTime != limits.Basic.JobTime
                || actualCpu.Flags != cpu.Flags || actualCpu.Rate != cpu.Rate)
                throw new SandboxException("unsupported_constraint");
            port = CreateIoCompletionPort(new IntPtr(-1), IntPtr.Zero, IntPtr.Zero, 1);
            if (port == IntPtr.Zero)
                throw new SandboxException("unsupported_constraint");
            CompletionPort association = new CompletionPort { Key = new IntPtr(1), Port = port };
            if (!SetPort(job, 7, ref association, Marshal.SizeOf(association)))
            {
                Dispose();
                throw new SandboxException("unsupported_constraint");
            }
        }

        internal string Poll()
        {
            uint message;
            IntPtr key, data;
            while (GetQueuedCompletionStatus(port, out message, out key, out data, 0))
            {
                if (message == 1 || message == 2)
                    return "cpu_limit";
                if (message == 9 || message == 10)
                    return "memory_limit";
                if (message == 3)
                    return "process_limit";
            }
            return null;
        }

        public void Dispose()
        {
            Native.Close(ref port);
        }
    }
}
