using System;
using System.Runtime.InteropServices;

internal static class PermissionSecurityRead
{
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
    private static extern uint GetNamedSecurityInfo(string path, int type, uint flags,
        out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
    private static extern bool ConvertSecurityDescriptorToStringSecurityDescriptor(IntPtr descriptor,
        uint revision, uint flags, out IntPtr text, out uint length);

    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr pointer);

    private static int Main(string[] arguments)
    {
        if (arguments.Length != 1) return 2;
        IntPtr owner, group, dacl, sacl, descriptor;
        const uint readSections = 1 | 2 | 4 | 16;
        const uint serializedSections = 1 | 2 | 4 | 8;
        if (GetNamedSecurityInfo(arguments[0], 1, readSections, out owner, out group, out dacl, out sacl, out descriptor) != 0) return 3;
        try
        {
            IntPtr text;
            uint length;
            if (!ConvertSecurityDescriptorToStringSecurityDescriptor(descriptor, 1, serializedSections, out text, out length)) return 4;
            try {Console.WriteLine(Marshal.PtrToStringUni(text));}
            finally {LocalFree(text);}
        }
        finally {LocalFree(descriptor);}
        return 0;
    }
}
