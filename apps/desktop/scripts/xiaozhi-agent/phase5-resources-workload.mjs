/** Synthetic Win32 resource probe, compiled only into the script's owned TEMP root. */
export const resourceWorkload = String.raw`
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;

internal static class ResourceProbe
{
    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits {
        internal long ProcessTime, JobTime;
        internal uint Flags;
        internal UIntPtr MinWorking, MaxWorking;
        internal uint ActiveProcesses;
        internal UIntPtr Affinity;
        internal uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters {
        internal ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits {
        internal BasicLimits Basic;
        internal IoCounters Io;
        internal UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)] private struct CpuLimit {internal uint Flags, Rate;}
    [StructLayout(LayoutKind.Sequential)] private struct Accounting {
        internal long User, Kernel, PeriodUser, PeriodKernel;
        internal uint Faults, Total, Active, Terminated;
    }
    [DllImport("kernel32.dll", SetLastError=true, EntryPoint="QueryInformationJobObject")]
    private static extern bool QueryExtended(IntPtr job,int kind,out ExtendedLimits value,int size,IntPtr returned);
    [DllImport("kernel32.dll", SetLastError=true, EntryPoint="QueryInformationJobObject")]
    private static extern bool QueryCpu(IntPtr job,int kind,out CpuLimit value,int size,IntPtr returned);
    [DllImport("kernel32.dll", SetLastError=true, EntryPoint="QueryInformationJobObject")]
    private static extern bool QueryAccounting(IntPtr job,int kind,out Accounting value,int size,IntPtr returned);
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
    [DllImport("kernel32.dll")] private static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern IntPtr VirtualAlloc(IntPtr address,UIntPtr size,uint allocation,uint protect);
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern bool VirtualFree(IntPtr address,UIntPtr size,uint freeType);

    private static readonly Stopwatch Wall = Stopwatch.StartNew();
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static readonly object OutputGate = new object();
    private static readonly List<IntPtr> Allocations = new List<IntPtr>();
    private static ulong committed;
    private static long accumulator;

    private static Dictionary<string,object> Snapshot(string kind) {
        Process process=Process.GetCurrentProcess();
        ExtendedLimits extended; CpuLimit cpu; Accounting accounting; bool inJob;
        bool jobOk=IsProcessInJob(GetCurrentProcess(),IntPtr.Zero,out inJob);
        int jobError=Marshal.GetLastWin32Error();
        bool extendedOk=QueryExtended(IntPtr.Zero,9,out extended,Marshal.SizeOf(typeof(ExtendedLimits)),IntPtr.Zero);
        int extendedError=Marshal.GetLastWin32Error();
        bool cpuOk=QueryCpu(IntPtr.Zero,15,out cpu,Marshal.SizeOf(typeof(CpuLimit)),IntPtr.Zero);
        int cpuError=Marshal.GetLastWin32Error();
        bool accountingOk=QueryAccounting(IntPtr.Zero,1,out accounting,Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero);
        int accountingError=Marshal.GetLastWin32Error();
        return new Dictionary<string,object> {
            {"kind",kind},{"pid",process.Id},{"logicalProcessors",Environment.ProcessorCount},
            {"wallMs",Wall.Elapsed.TotalMilliseconds},{"processUserMs",process.UserProcessorTime.TotalMilliseconds},
            {"processKernelMs",process.PrivilegedProcessorTime.TotalMilliseconds},{"processPrivateBytes",process.PrivateMemorySize64},
            {"committedTouchedBytes",committed},{"jobMembershipQueryOk",jobOk},{"inJob",inJob},{"jobMembershipError",jobOk?0:jobError},
            {"extendedQueryOk",extendedOk},{"extendedQueryError",extendedOk?0:extendedError},
            {"limitFlags",extended.Basic.Flags},{"jobMemoryLimit",extended.JobMemory.ToUInt64()},
            {"peakJobMemory",extended.PeakJobMemory.ToUInt64()},{"peakProcessMemory",extended.PeakProcessMemory.ToUInt64()},
            {"maxProcesses",extended.Basic.ActiveProcesses},{"jobUserTimeLimit100ns",extended.Basic.JobTime},
            {"cpuQueryOk",cpuOk},{"cpuQueryError",cpuOk?0:cpuError},{"cpuFlags",cpu.Flags},{"cpuRate",cpu.Rate},
            {"accountingQueryOk",accountingOk},{"accountingQueryError",accountingOk?0:accountingError},
            {"jobUserMs",accounting.User/10000.0},{"jobKernelMs",accounting.Kernel/10000.0},
            {"jobActiveProcesses",accounting.Active},{"jobTotalProcesses",accounting.Total}
        };
    }
    private static void Emit(Dictionary<string,object> value) {lock(OutputGate){Console.WriteLine(Json.Serialize(value));Console.Out.Flush();}}
    private static void Allocate(int mebibytes) {
        for(int i=0;i<mebibytes;i+=16) {
            uint bytes=(uint)Math.Min(16,mebibytes-i)*1048576;
            IntPtr allocation=VirtualAlloc(IntPtr.Zero,new UIntPtr(bytes),0x3000,4);
            int error=Marshal.GetLastWin32Error();
            if(allocation==IntPtr.Zero) {
                Dictionary<string,object> failed=Snapshot("allocation_failure_caught");failed.Add("win32Error",error);failed.Add("requestedBytes",bytes);Emit(failed);
                Thread.Sleep(5000);return;
            }
            Allocations.Add(allocation);
            for(int offset=0;offset<bytes;offset+=4096)Marshal.WriteByte(allocation,offset,123);
            committed+=bytes;Emit(Snapshot("allocation_touched"));
        }
    }
    private static Process Child(string mode,string value) {
        ProcessStartInfo start=new ProcessStartInfo(Assembly.GetExecutingAssembly().Location,mode+" "+value);
        start.UseShellExecute=false;start.CreateNoWindow=true;
        start.RedirectStandardOutput=true;start.RedirectStandardError=true;
        Process child=new Process();child.StartInfo=start;
        child.OutputDataReceived+=delegate(object sender,DataReceivedEventArgs data){if(data.Data!=null)lock(OutputGate){Console.WriteLine(data.Data);Console.Out.Flush();}};
        child.ErrorDataReceived+=delegate(object sender,DataReceivedEventArgs data){if(data.Data!=null)lock(OutputGate){Console.Error.WriteLine(data.Data);Console.Error.Flush();}};
        child.Start();child.BeginOutputReadLine();child.BeginErrorReadLine();return child;
    }
    private static void Busy(int milliseconds) {
        Stopwatch interval=Stopwatch.StartNew();
        while(interval.ElapsedMilliseconds<milliseconds) {
            for(int i=0;i<500000;i++)accumulator=unchecked((accumulator*1664525+1013904223)^i);
        }
        GC.KeepAlive(accumulator);
    }
    public static int Main(string[] args) {
        try {
            string mode=args.Length==0?"query":args[0];
            Emit(Snapshot("started"));
            if(mode=="inspect-host")return 0;
            if(mode=="query") {Allocate(16);Emit(Snapshot("normal_complete"));return 0;}
            if(mode=="memory-parent") {Allocate(384);Thread.Sleep(5000);return 0;}
            if(mode=="memory-child") {Allocate(Int32.Parse(args[1],CultureInfo.InvariantCulture));Thread.Sleep(10000);return 0;}
            if(mode=="memory-tree") {
                Allocate(48);using(Process first=Child("memory-child","64")) {
                    Thread.Sleep(750);using(Process second=Child("memory-child","128")) {Emit(Snapshot("tree_spawned"));Thread.Sleep(15000);}
                }return 0;
            }
            if(mode=="cpu-rate") {Emit(Snapshot("cpu_interval_start"));Busy(Int32.Parse(args[1],CultureInfo.InvariantCulture));Emit(Snapshot("cpu_interval_end"));return 0;}
            if(mode=="cpu-total") {Emit(Snapshot("cpu_interval_start"));Busy(25000);Emit(Snapshot("unexpected_cpu_complete"));return 0;}
            if(mode=="cpu-tree") {
                using(Process first=Child("cpu-total","0"))using(Process second=Child("cpu-total","0")) {
                    Emit(Snapshot("tree_spawned"));Busy(25000);
                }return 0;
            }
            return 2;
        }catch(Exception error) {
            Dictionary<string,object> failed=Snapshot("fixture_exception");failed.Add("exceptionType",error.GetType().Name);failed.Add("hresult",error.HResult);Emit(failed);return 3;
        }finally {
            foreach(IntPtr allocation in Allocations)VirtualFree(allocation,UIntPtr.Zero,0x8000);
        }
    }
}
`;
