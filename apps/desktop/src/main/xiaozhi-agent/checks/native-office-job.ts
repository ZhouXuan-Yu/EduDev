// Shared owned Office process lifetime: closing the helper kills only its assigned server.
export const OFFICE_JOB_SOURCE=String.raw`using System;using System.Runtime.InteropServices;using System.ComponentModel;
public sealed class XiaozhiRenderJob:IDisposable {
 [StructLayout(LayoutKind.Sequential)]struct Basic {public long PerProcess,PerJob;public uint Flags;public UIntPtr Min,Max;public uint Active;public UIntPtr Affinity;public uint Priority,Scheduling;}
 [StructLayout(LayoutKind.Sequential)]struct Io {public ulong R,W,O,RB,WB,OB;}
 [StructLayout(LayoutKind.Sequential)]struct Extended {public Basic Basic;public Io Io;public UIntPtr Process,Job,PeakProcess,PeakJob;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr value,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint process);
 IntPtr handle;
 public XiaozhiRenderJob(IntPtr process){handle=CreateJobObject(IntPtr.Zero,null);if(handle==IntPtr.Zero)throw new Win32Exception();var value=new Extended();value.Basic.Flags=0x2000;var size=Marshal.SizeOf(value);var ptr=Marshal.AllocHGlobal(size);try{Marshal.StructureToPtr(value,ptr,false);if(!SetInformationJobObject(handle,9,ptr,(uint)size)||!AssignProcessToJobObject(handle,process)){Dispose();throw new Win32Exception();}}finally{Marshal.FreeHGlobal(ptr);}}
 public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
}`;
