using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace Xiaozhi.PermissionRuntime
{
    internal sealed class SandboxException : Exception
    {
        public readonly string Code;
        public SandboxException(string code) : base(code)
        {
            Code = code;
        }
    }

    internal static class Json
    {
        internal static object Parse(string text)
        {
            return new Parser(text).Read();
        }

        internal static string Encode(object value)
        {
            if (value == null)
                return "null";
            string str = value as string;
            if (str != null)
            {
                StringBuilder builder = new StringBuilder("\"");
                foreach (char ch in str)
                {
                    if (ch == '"')
                        builder.Append("\\\"");
                    else if (ch == '\\')
                        builder.Append("\\\\");
                    else if (ch < 32)
                        builder.Append("\\u" + ((int)ch).ToString("x4", CultureInfo.InvariantCulture));
                    else
                        builder.Append(ch);
                }

                return builder.Append('"').ToString();
            }

            if (value is bool)
                return (bool)value ? "true" : "false";
            IDictionary<string, object> map = value as IDictionary<string, object>;
            if (map != null)
            {
                List<string> parts = new List<string>();
                foreach (KeyValuePair<string, object> pair in map)
                    parts.Add(Encode(pair.Key) + ":" + Encode(pair.Value));
                return "{" + string.Join(",", parts.ToArray()) + "}";
            }

            if (value is int || value is long || value is uint)
                return Convert.ToString(value, CultureInfo.InvariantCulture);
            throw new InvalidOperationException("Unsupported protocol value");
        }

        private sealed class Parser
        {
            private readonly string text;
            private int cursor;
            internal Parser(string value)
            {
                text = value;
            }

            internal object Read()
            {
                object value = Value(0);
                Space();
                if (cursor != text.Length)
                    Invalid();
                return value;
            }

            private void Space()
            {
                while (cursor < text.Length
                    && (text[cursor] == ' '
                        || text[cursor] == '\t'
                        || text[cursor] == '\r'
                        || text[cursor] == '\n'))
                    cursor++;
            }

            private static void Invalid()
            {
                throw new SandboxException("invalid_protocol");
            }

            private object Value(int depth)
            {
                if (depth > 12)
                    Invalid();
                Space();
                if (cursor >= text.Length)
                    Invalid();
                char ch = text[cursor];
                if (ch == '{')
                {
                    cursor++;
                    Dictionary<string, object> map = new Dictionary<string, object>(StringComparer.Ordinal);
                    Space();
                    if (cursor < text.Length && text[cursor] == '}')
                    {
                        cursor++;
                        return map;
                    }

                    while (true)
                    {
                        Space();
                        string key = String();
                        Space();
                        if (cursor >= text.Length || text[cursor++] != ':' || map.ContainsKey(key))
                            Invalid();
                        map.Add(key, Value(depth + 1));
                        Space();
                        if (cursor >= text.Length)
                            Invalid();
                        char delimiter = text[cursor++];
                        if (delimiter == '}')
                            return map;
                        if (delimiter != ',')
                            Invalid();
                    }
                }

                if (ch == '"')
                    return String();
                if (ch == '-' || (ch >= '0' && ch <= '9'))
                {
                    int start = cursor++;
                    if (ch == '-')
                    {
                        if (cursor >= text.Length || text[cursor] < '0' || text[cursor] > '9')
                            Invalid();
                        cursor++;
                    }

                    if (text[cursor - 1] == '0' && cursor < text.Length && char.IsDigit(text[cursor]))
                        Invalid();
                    while (cursor < text.Length && text[cursor] >= '0' && text[cursor] <= '9')
                        cursor++;
                    long number;
                    if (!long.TryParse(
                        text.Substring(start, cursor - start),
                        NumberStyles.AllowLeadingSign,
                        CultureInfo.InvariantCulture,
                        out number
                    ))
                        Invalid();
                    return number;
                }

                foreach (string word in new string[]
                {


                    "true",

                    "false",

                    "null"

                }

                )
                {
                    if (cursor + word.Length <= text.Length && text.Substring(cursor, word.Length) == word)
                    {
                        cursor += word.Length;
                        if (word == "null")
                            return null;
                        return word == "true";
                    }
                }

                Invalid();
                return null;
            }

            private string String()
            {
                if (cursor >= text.Length || text[cursor++] != '"')
                    Invalid();
                StringBuilder builder = new StringBuilder();
                while (cursor < text.Length)
                {
                    char ch = text[cursor++];
                    if (ch == '"')
                        return builder.ToString();
                    if (ch < 32)
                        Invalid();
                    if (ch == '\\')
                    {
                        if (cursor >= text.Length)
                            Invalid();
                        char escaped = text[cursor++];
                        switch (escaped)
                        {
                            case '"':
                                ch = '"';
                                break;
                            case '\\':
                                ch = '\\';
                                break;
                            case '/':
                                ch = '/';
                                break;
                            case 'b':
                                ch = '\b';
                                break;
                            case 'f':
                                ch = '\f';
                                break;
                            case 'n':
                                ch = '\n';
                                break;
                            case 'r':
                                ch = '\r';
                                break;
                            case 't':
                                ch = '\t';
                                break;
                            case 'u':
                                int code;
                                if (cursor + 4 > text.Length
                                    || !int.TryParse(
                                    text.Substring(cursor, 4),
                                    NumberStyles.AllowHexSpecifier,
                                    CultureInfo.InvariantCulture,
                                    out code
                                ))
                                    Invalid();
                                ch = (char)int.Parse(text.Substring(cursor, 4), NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture);
                                cursor += 4;
                                break;
                            default:
                                Invalid();
                                break;
                        }
                    }

                    builder.Append(ch);
                }

                Invalid();
                return null;
            }
        }
    }

    internal sealed class Request
    {
        internal string ExecutionId, GrantHash, Executable, ExecutableHash, ProjectionRoot, Cwd, Command;
        internal Dictionary<string, object> Owner;
        internal Dictionary<string, object> Environment;
        internal int TimeoutMs, MaxOutputBytes, MaxProcesses;
        internal static readonly UTF8Encoding StrictUtf8 = new UTF8Encoding(false, true);
        internal static Dictionary<string, object> Object(object value)
        {
            Dictionary<string, object> map = value as Dictionary<string, object>;
            if (map == null)
                throw new SandboxException("invalid_protocol");
            return map;
        }

        internal static void Keys(Dictionary<string, object> map, params string[] names)
        {
            if (map.Count != names.Length)
                throw new SandboxException("invalid_protocol");
            foreach (string name in names)
                if (!map.ContainsKey(name))
                    throw new SandboxException("invalid_protocol");
        }

        internal static string Text(Dictionary<string, object> map, string key, int maximum)
        {
            object value;
            string text;
            if (!map.TryGetValue(key, out value)
                || (text = value as string) == null
                || text.Length > maximum
                || text.IndexOf('\0') >= 0)
                throw new SandboxException("invalid_protocol");
            return text;
        }

        internal static int Number(Dictionary<string, object> map, string key, int minimum, int maximum)
        {
            object value;
            if (!map.TryGetValue(key, out value)
                || !(value is long)
                || (long)value < minimum
                || (long)value > maximum)
                throw new SandboxException("invalid_protocol");
            return (int)(long)value;
        }

        internal static bool Id(string text, string prefix)
        {
            Guid guid;
            return text != null
                && text.StartsWith(prefix, StringComparison.Ordinal)
                && text.Length == prefix.Length + 36
                && Guid.TryParseExact(text.Substring(prefix.Length), "D", out guid);
        }

        internal static Request Parse(Dictionary<string, object> map)
        {
            Keys(
                map,
                "schemaVersion",
                "type",
                "executionId",
                "owner",
                "grantHash",
                "executable",
                "executableHash",
                "projectionRoot",
                "cwd",
                "command",
                "env",
                "timeoutMs",
                "maxOutputBytes",
                "maxProcesses"
            );
            if (Number(map, "schemaVersion", 1, 1) != 1 || Text(map, "type", 20) != "start")
                throw new SandboxException("invalid_protocol");
            Request request = new Request();
            request.ExecutionId = Text(map, "executionId", 80);
            if (!Id(request.ExecutionId, "xiexec_"))
                throw new SandboxException("invalid_protocol");
            request.Owner = Object(map["owner"]);
            ValidateOwner(request.Owner);
            request.GrantHash = Text(map, "grantHash", 64);
            request.ExecutableHash = Text(map, "executableHash", 64);
            if (!Regex.IsMatch(request.GrantHash, "^[0-9a-f]{64}$")
                || !Regex.IsMatch(request.ExecutableHash, "^[0-9a-f]{64}$"))
                throw new SandboxException("invalid_protocol");
            request.Executable = Text(map, "executable", 1024);
            request.ProjectionRoot = Text(map, "projectionRoot", 1024);
            request.Cwd = Text(map, "cwd", 1024);
            request.Command = Text(map, "command", 65536);
            StrictUtf8.GetByteCount(request.Command);
            int commandCharacters = 0;
            for (int index = 0; index < request.Command.Length; index++)
            {
                if (char.IsHighSurrogate(request.Command[index]))
                    index++;
                if (++commandCharacters > 32768)
                    throw new SandboxException("invalid_protocol");
            }
            request.TimeoutMs = Number(map, "timeoutMs", 1000, 120000);
            request.MaxOutputBytes = Number(map, "maxOutputBytes", 1024, 4194304);
            request.MaxProcesses = Number(map, "maxProcesses", 1, 64);
            request.Environment = Object(map["env"]);
            foreach (string key in request.Environment.Keys)
            {
                if (key != "XIAOZHI_WORKSPACE" && key != "XIAOZHI_BROKER_ROOT")
                    throw new SandboxException("invalid_protocol");
                Text(request.Environment, key, 1024);
            }

            return request;
        }

        internal static void ValidateOwner(Dictionary<string, object> owner)
        {
            Keys(owner, "sessionId", "taskId", "runId", "generation");
            if (!Id(Text(owner, "sessionId", 80), "aisession_")
                || Text(owner, "taskId", 256).Length == 0
                || Text(owner, "runId", 256).Length == 0)
                throw new SandboxException("invalid_protocol");
            Number(owner, "generation", 1, int.MaxValue);
        }
    }

    internal static class Native
    {
        internal const uint ReadAttributes = 0x80, MaximumAllowed = 0x02000000;
        [StructLayout(LayoutKind.Sequential)]
        internal struct SecurityAttributes
        {
            internal int Length;
            internal IntPtr Descriptor;
            internal int Inherit;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        internal struct StartupInfo
        {
            internal int cb;
            internal string Reserved, Desktop, Title;
            internal int X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
            internal short Show, ReservedSize;
            internal IntPtr ReservedBytes, Input, Output, Error;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct StartupInfoEx
        {
            internal StartupInfo Info;
            internal IntPtr Attributes;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct ProcessInformation
        {
            internal IntPtr Process, Thread;
            internal int Pid, Tid;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct SecurityCapabilities
        {
            internal IntPtr Sid, Capabilities;
            internal int Count, Reserved;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct BasicLimits
        {
            internal long ProcessTime, JobTime;
            internal uint Flags;
            internal UIntPtr MinWorkingSet, MaxWorkingSet;
            internal uint ActiveProcesses;
            internal UIntPtr Affinity;
            internal uint Priority, Scheduling;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct IoCounters
        {
            internal ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct ExtendedLimits
        {
            internal BasicLimits Basic;
            internal IoCounters Io;
            internal UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct JobAccounting
        {
            internal long User, Kernel, PeriodUser, PeriodKernel;
            internal uint PageFaults, Total, Active, Terminated;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct FileInformation
        {
            internal uint Attributes;
            internal System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
            internal uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct ProcessBasicInformation
        {
            internal IntPtr Reserved1, Peb, Reserved2, Reserved3, Pid, ParentPid;
        }

        [DllImport("userenv.dll", CharSet = CharSet.Unicode)]
        internal static extern int CreateAppContainerProfile(
            string name,
            string display,
            string description,
            IntPtr capabilities,
            uint count,
            out IntPtr sid
        );
        [DllImport("userenv.dll", CharSet = CharSet.Unicode)]
        internal static extern int DeleteAppContainerProfile(string name);
        [DllImport("userenv.dll", CharSet = CharSet.Unicode)]
        internal static extern int DeriveAppContainerSidFromAppContainerName(string name, out IntPtr sid);
        [DllImport("userenv.dll", CharSet = CharSet.Unicode)]
        internal static extern int GetAppContainerFolderPath(string sid, out IntPtr path);
        [DllImport("advapi32.dll")]
        internal static extern IntPtr FreeSid(IntPtr sid);
        [DllImport("kernel32.dll")]
        internal static extern IntPtr LocalFree(IntPtr pointer);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CloseHandle(IntPtr handle);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern SafeFileHandle CreateFile(
            string path,
            uint access,
            uint share,
            IntPtr security,
            uint creation,
            uint flags,
            IntPtr template
        );
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInformation information);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern uint GetFinalPathNameByHandle(SafeFileHandle handle, StringBuilder path, uint length, uint flags);
        [DllImport("advapi32.dll", SetLastError = true)]
        internal static extern uint GetSecurityInfo(
            SafeFileHandle handle,
            int type,
            uint information,
            out IntPtr owner,
            out IntPtr group,
            out IntPtr dacl,
            out IntPtr sacl,
            out IntPtr descriptor
        );
        [DllImport("advapi32.dll")]
        internal static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
        [DllImport("advapi32.dll", SetLastError = true)]
        internal static extern uint SetSecurityInfo(
            SafeFileHandle handle,
            int type,
            uint information,
            IntPtr owner,
            IntPtr group,
            IntPtr dacl,
            IntPtr sacl
        );
        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string sddl, uint revision, out IntPtr descriptor, out uint size);
        [DllImport("advapi32.dll", SetLastError = true)]
        internal static extern bool GetSecurityDescriptorSacl(IntPtr descriptor, out bool present, out IntPtr sacl, out bool defaulted);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool InitializeProcThreadAttributeList(IntPtr attributes, int count, int flags, ref IntPtr size);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool UpdateProcThreadAttribute(
            IntPtr attributes,
            uint flags,
            IntPtr key,
            IntPtr value,
            IntPtr size,
            IntPtr previous,
            IntPtr returned
        );
        [DllImport("kernel32.dll")]
        internal static extern void DeleteProcThreadAttributeList(IntPtr attributes);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref SecurityAttributes attributes, uint size);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern IntPtr CreateFile(
            string name,
            uint access,
            uint share,
            ref SecurityAttributes attributes,
            uint creation,
            uint flags,
            IntPtr template
        );
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern bool CreateProcess(
            string application,
            StringBuilder command,
            IntPtr processSecurity,
            IntPtr threadSecurity,
            bool inherit,
            uint flags,
            IntPtr environment,
            string cwd,
            ref StartupInfoEx startup,
            out ProcessInformation process
        );
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr CreateJobObject(IntPtr attributes, string name);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits limits, int size);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool QueryInformationJobObject(IntPtr job, int kind, out JobAccounting information, int size, IntPtr required);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool assigned);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool TerminateJobObject(IntPtr job, uint exit);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool TerminateProcess(IntPtr process, uint exit);
        [DllImport("kernel32.dll")]
        internal static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern uint ResumeThread(IntPtr thread);
        [DllImport("kernel32.dll")]
        internal static extern bool GetExitCodeProcess(IntPtr process, out uint exit);
        [DllImport("advapi32.dll", SetLastError = true)]
        internal static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
        [DllImport("advapi32.dll", SetLastError = true)]
        internal static extern bool GetTokenInformation(IntPtr token, int kind, IntPtr buffer, int size, out int required);
        [DllImport("kernel32.dll")]
        internal static extern IntPtr GetCurrentProcess();
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr GetStdHandle(int kind);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool WriteFile(IntPtr handle, byte[] bytes, uint length, out uint written, IntPtr overlapped);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
        [DllImport("ntdll.dll")]
        internal static extern int NtQueryInformationProcess(
            IntPtr process,
            int kind,
            ref ProcessBasicInformation information,
            int size,
            out int required
        );
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        internal static extern uint GetWindowsDirectory(StringBuilder path, uint size);
        internal static void Check(bool value)
        {
            if (!value)
                throw new Win32Exception(Marshal.GetLastWin32Error());
        }

        internal static void Close(ref IntPtr handle)
        {
            if (handle != IntPtr.Zero && handle != new IntPtr(-1))
                CloseHandle(handle);
            handle = IntPtr.Zero;
        }
    }

    internal sealed class Projection : IDisposable
    {
        internal readonly string Root;
        private readonly List<SafeFileHandle> pins = new List<SafeFileHandle>();
        private readonly Dictionary<string, SafeFileHandle> servicePins = new Dictionary<string, SafeFileHandle>(StringComparer.OrdinalIgnoreCase);
        private SecurityIdentifier sid;
        private bool grantsApplied;
        private const int EntryLimit = 10000;
        internal Projection(Request request, Action<string> diagnostic, bool recovery = false)
        {
            diagnostic("projection_path_validation");
            Root = Canonical(request.ProjectionRoot);
            diagnostic("projection_root_canonical");
            string temp = Canonical(Path.GetTempPath().TrimEnd('\\'));
            diagnostic("projection_temp_canonical");
            string leaf = Path.GetFileName(Root);
            Guid identifier;
            if (!string.Equals(Path.GetDirectoryName(Root), temp, StringComparison.OrdinalIgnoreCase)
                || !leaf.StartsWith("xiaozhi-permission-exec-", StringComparison.Ordinal)
                || !Guid.TryParseExact(leaf.Substring("xiaozhi-permission-exec-".Length), "D", out identifier))
                throw new SandboxException("invalid_projection");
            diagnostic("projection_root_name_validated");
            PinAncestors(Root);
            diagnostic("projection_owner_validation");
            using (SafeFileHandle rootHandle = Access(Root, true, true))
            {
                IntPtr owner, group, dacl, sacl, descriptor;
                uint error = Native.GetSecurityInfo(rootHandle, 1, 1, out owner, out group, out dacl, out sacl, out descriptor);
                if (error != 0)
                    throw new SandboxException("invalid_projection");
                try
                {
                    if (!new SecurityIdentifier(owner).Equals(WindowsIdentity.GetCurrent().User))
                        throw new SandboxException("invalid_projection");
                }
                finally
                {
                    Native.LocalFree(descriptor);
                }
            }

            if (!Inside(Root, Canonical(request.Cwd)) || !Directory.Exists(request.Cwd))
                throw new SandboxException("invalid_projection");
            diagnostic("projection_tree_validation");
            List<string> entries = Walk(Root);
            string marker = Path.Combine(Root, ".xiaozhi-projection.json");
            using (SafeFileHandle handle = OpenChecked(marker, false, false))
            {
                diagnostic("projection_marker_validation");
                using (FileStream stream = new FileStream(handle, FileAccess.Read))
                {
                    if (stream.Length > 8192)
                        throw new SandboxException("invalid_projection");
                    byte[] bytes = new byte[stream.Length];
                    int offset = 0;
                    while (offset < bytes.Length)
                    {
                        int count = stream.Read(bytes, offset, bytes.Length - offset);
                        if (count == 0)
                            throw new SandboxException("invalid_projection");
                        offset += count;
                    }

                    Dictionary<string, object> map = Request.Object(Json.Parse(Request.StrictUtf8.GetString(bytes)));
                    Request.Keys(map, "schemaVersion", "executionId", "grantHash", "owner");
                    Dictionary<string, object> markerOwner = Request.Object(map["owner"]);
                    Request.ValidateOwner(markerOwner);
                    bool ownerMatches = true;
                    foreach (string key in request.Owner.Keys)
                        if (!object.Equals(request.Owner[key], markerOwner[key]))
                            ownerMatches = false;
                    if (Request.Number(map, "schemaVersion", 1, 1) != 1
                        || Request.Text(map, "executionId", 80) != request.ExecutionId
                        || Request.Text(map, "grantHash", 64) != request.GrantHash
                        || !ownerMatches)
                        throw new SandboxException("invalid_projection");
                }
            }

            foreach (KeyValuePair<string, object> pair in request.Environment)
                if (!Inside(Root, Canonical((string)pair.Value)))
                    throw new SandboxException("invalid_projection");
            if (!recovery && Directory.Exists(PrivateState))
                throw new SandboxException("invalid_projection");
            string broker = Path.Combine(Root, ".runtime", "broker");
            if (Directory.Exists(broker))
            {
                // Main's bounded broker accesses these paths while the script is
                // running. Deny directory renames until the owned Job has ended.
                string runtime = Path.Combine(Root, ".runtime");
                servicePins.Add(runtime, OpenChecked(runtime, true, false, false, true));
                servicePins.Add(broker, OpenChecked(broker, true, false, false, true));
            }
            diagnostic("projection_validated");
        }

        private string PrivateState
        {
            get
            {
                return Path.Combine(Root, ".runtime", ".helper-state");
            }
        }

        private static Dictionary<string, object> Identity(Request request, string profileName)
        {
            return new Dictionary<string, object>
            {


                {
                    "schemaVersion",
                    1
                },

                {
                    "executionId",
                    request.ExecutionId
                },

                {
                    "grantHash",
                    request.GrantHash
                },

                {
                    "owner",
                    request.Owner
                },

                {
                    "projectionRoot",
                    request.ProjectionRoot
                },

                {
                    "executable",
                    request.Executable
                },

                {
                    "executableHash",
                    request.ExecutableHash
                },

                {
                    "profileName",
                    profileName
                }

            };
        }

        internal void WriteIdentity(Request request, string profileName)
        {
            Directory.CreateDirectory(Path.Combine(Root, ".runtime"));
            Directory.CreateDirectory(PrivateState);
            DirectorySecurity security = new DirectorySecurity();
            security.SetOwner(WindowsIdentity.GetCurrent().User);
            security.SetAccessRuleProtection(true, false);
            security.AddAccessRule(new FileSystemAccessRule(
                WindowsIdentity.GetCurrent().User,
                FileSystemRights.FullControl,
                InheritanceFlags.ObjectInherit | InheritanceFlags.ContainerInherit,
                PropagationFlags.None,
                AccessControlType.Allow
            ));
            security.AddAccessRule(new FileSystemAccessRule(
                new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null),
                FileSystemRights.FullControl,
                InheritanceFlags.ObjectInherit | InheritanceFlags.ContainerInherit,
                PropagationFlags.None,
                AccessControlType.Allow
            ));
            Directory.SetAccessControl(PrivateState, security);
            string path = Path.Combine(PrivateState, "identity.json");
            using (FileStream stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                byte[] bytes = Request.StrictUtf8.GetBytes(Json.Encode(Identity(request, profileName)));
                stream.Write(bytes, 0, bytes.Length);
                stream.Flush(true);
            }

            using (SafeFileHandle handle = OpenChecked(PrivateState, true, true))
                SetLabel(handle, true, "ME");
            using (SafeFileHandle handle = OpenChecked(path, false, true))
                SetLabel(handle, false, "ME");
        }

        internal void ValidateIdentity(Request request, string profileName)
        {
            try
            {
                ValidateIdentityCore(request, profileName);
            }
            catch (SandboxException)
            {
                throw;
            }
            catch
            {
                throw new SandboxException("invalid_projection");
            }
        }

        private void ValidateIdentityCore(Request request, string profileName)
        {
            string path = Path.Combine(PrivateState, "identity.json");
            DirectorySecurity security = Directory.GetAccessControl(PrivateState);
            if (!security.AreAccessRulesProtected
                || !security.GetOwner(typeof(SecurityIdentifier)).Equals(WindowsIdentity.GetCurrent().User))
                throw new SandboxException("invalid_projection");
            foreach (FileSystemAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier)))
            {
                SecurityIdentifier principal = (SecurityIdentifier)rule.IdentityReference;
                if (!principal.Equals(WindowsIdentity.GetCurrent().User)
                    && !principal.IsWellKnown(WellKnownSidType.LocalSystemSid))
                    throw new SandboxException("invalid_projection");
            }

            using (SafeFileHandle handle = OpenChecked(PrivateState, true, false))
                RequireMediumLabel(handle);
            using (SafeFileHandle handle = OpenChecked(path, false, false))
            {
                RequireMediumLabel(handle);
                using (FileStream stream = new FileStream(handle, FileAccess.Read))
                {
                    if (stream.Length > 8192)
                        throw new SandboxException("invalid_projection");
                    byte[] bytes = new byte[stream.Length];
                    int offset = 0;
                    while (offset < bytes.Length)
                    {
                        int count = stream.Read(bytes, offset, bytes.Length - offset);
                        if (count == 0)
                            throw new SandboxException("invalid_projection");
                        offset += count;
                    }

                    Dictionary<string, object> actual = Request.Object(Json.Parse(Request.StrictUtf8.GetString(bytes)));
                    Dictionary<string, object> expected = Identity(request, profileName);
                    Request.Keys(
                        actual,
                        "schemaVersion",
                        "executionId",
                        "grantHash",
                        "owner",
                        "projectionRoot",
                        "executable",
                        "executableHash",
                        "profileName"
                    );
                    Request.ValidateOwner(Request.Object(actual["owner"]));
                    foreach (string key in expected.Keys)
                    {
                        if (key == "owner")
                        {
                            Dictionary<string, object> owner = Request.Object(actual[key]);
                            foreach (string field in request.Owner.Keys)
                                if (!object.Equals(owner[field], request.Owner[field]))
                                    throw new SandboxException("invalid_projection");
                        }
                        else if (key == "schemaVersion")
                        {
                            Request.Number(actual, key, 1, 1);
                        }
                        else if (!object.Equals(actual[key], expected[key]))
                            throw new SandboxException("invalid_projection");
                    }
                }
            }
        }

        private static void RequireMediumLabel(SafeFileHandle handle)
        {
            IntPtr owner, group, dacl, sacl, descriptor;
            if (Native.GetSecurityInfo(handle, 1, 16, out owner, out group, out dacl, out sacl, out descriptor) != 0)
                throw new SandboxException("invalid_projection");
            try
            {
                bool found = false;
                if (sacl == IntPtr.Zero)
                    throw new SandboxException("invalid_projection");
                int count = (ushort)Marshal.ReadInt16(sacl, 4), offset = 8;
                for (int index = 0; index < count; index++)
                {
                    IntPtr ace = IntPtr.Add(sacl, offset);
                    if (Marshal.ReadByte(ace) == 0x11)
                    {
                        found = new SecurityIdentifier(IntPtr.Add(ace, 8)).Value == "S-1-16-8192";
                    }

                    offset += (ushort)Marshal.ReadInt16(ace, 2);
                }

                if (!found)
                    throw new SandboxException("invalid_projection");
            }
            finally
            {
                Native.LocalFree(descriptor);
            }
        }

        internal static string Canonical(string value)
        {
            try
            {
                if (string.IsNullOrEmpty(value)
                    || value.Length > 1024
                    || !Regex.IsMatch(value, "^[A-Za-z]:\\\\")
                    || value.IndexOf('/') >= 0
                    || value.IndexOf(':', 2) >= 0
                    || value.IndexOf('\0') >= 0
                    || value.EndsWith("\\", StringComparison.Ordinal))
                    throw new SandboxException("invalid_projection");
                string full = Path.GetFullPath(value);
                if (!string.Equals(full, value, StringComparison.OrdinalIgnoreCase))
                    throw new SandboxException("invalid_projection");
                foreach (string segment in full.Substring(3).Split('\\'))
                {
                    if (segment.Length == 0
                        || segment.EndsWith(".", StringComparison.Ordinal)
                        || segment.EndsWith(" ", StringComparison.Ordinal)
                        || Regex.IsMatch(segment, "^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\\.|$)", RegexOptions.IgnoreCase))
                        throw new SandboxException("invalid_projection");
                }

                return full;
            }
            catch (SandboxException)
            {
                throw;
            }
            catch
            {
                throw new SandboxException("invalid_projection");
            }
        }

        internal static bool Inside(string root, string value)
        {
            return string.Equals(root, value, StringComparison.OrdinalIgnoreCase)
                || value.StartsWith(root + "\\", StringComparison.OrdinalIgnoreCase);
        }

        private void PinAncestors(string path)
        {
            string current = Path.GetPathRoot(path);
            foreach (string segment in path.Substring(current.Length).Split('\\'))
            {
                current = Path.Combine(current, segment);
                pins.Add(OpenChecked(current, true, current == Root, current != Root));
            }
        }

        private SafeFileHandle Access(string path, bool directory, bool writable)
        {
            if (string.Equals(path, Root, StringComparison.OrdinalIgnoreCase))
                return new SafeFileHandle(pins[pins.Count - 1].DangerousGetHandle(), false);
            SafeFileHandle service;
            if (servicePins.TryGetValue(path, out service))
                return new SafeFileHandle(service.DangerousGetHandle(), false);
            return OpenChecked(path, directory, writable);
        }

        internal static SafeFileHandle OpenChecked(string path, bool directory, bool writable, bool ancestor = false, bool service = false)
        {
            SafeFileHandle handle = Native.CreateFile(
                path,
                service ? 0x000E0081 : ancestor ? Native.ReadAttributes : writable ? Native.MaximumAllowed : 0x80000000,
                ancestor ? 7u : 3u,
                IntPtr.Zero,
                3,
                0x00200000 | (directory ? 0x02000000u : 0u),
                IntPtr.Zero
            );
            if (handle.IsInvalid)
            {
                handle.Dispose();
                throw new SandboxException("invalid_projection");
            }

            Native.FileInformation info;
            if (!Native.GetFileInformationByHandle(handle, out info)
                || (info.Attributes & 0x400) != 0
                || (!directory
                    && info.Links != 1)
                || ((info.Attributes & 0x10) != 0) != directory)
            {
                handle.Dispose();
                throw new SandboxException("invalid_projection");
            }

            StringBuilder resolved = new StringBuilder(2048);
            uint length = Native.GetFinalPathNameByHandle(handle, resolved, (uint)resolved.Capacity, 0);
            if (length == 0
                || length >= resolved.Capacity
                || !string.Equals(resolved.ToString(), "\\\\?\\" + path, StringComparison.OrdinalIgnoreCase))
            {
                handle.Dispose();
                throw new SandboxException("invalid_projection");
            }

            return handle;
        }

        private static List<string> Walk(string root)
        {
            List<string> paths = new List<string>();
            Queue<string> pending = new Queue<string>();
            pending.Enqueue(root);
            while (pending.Count > 0)
            {
                string directory = pending.Dequeue();
                paths.Add(directory);
                if (paths.Count > EntryLimit)
                    throw new SandboxException("invalid_projection");
                foreach (string entry in Directory.GetFileSystemEntries(directory))
                {
                    FileAttributes attributes = File.GetAttributes(entry);
                    if ((attributes & FileAttributes.ReparsePoint) != 0)
                        throw new SandboxException("invalid_projection");
                    bool isDirectory = (attributes & FileAttributes.Directory) != 0;
                    using (SafeFileHandle handle = OpenChecked(entry, isDirectory, false))
                    {
                    }

                    if (isDirectory)
                        pending.Enqueue(entry);
                    else
                        paths.Add(entry);
                    if (paths.Count + pending.Count > EntryLimit)
                        throw new SandboxException("invalid_projection");
                }
            }

            return paths;
        }

        internal void Grant(string sidText)
        {
            sid = new SecurityIdentifier(sidText);
            grantsApplied = true;
            string runtime = Path.Combine(Root, ".runtime");
            if (File.Exists(runtime))
                throw new SandboxException("invalid_projection");
            Directory.CreateDirectory(runtime);
            foreach (string name in new string[]
            {
                "temp",
                "home",
                "roaming"
            }

            )
                Directory.CreateDirectory(Path.Combine(runtime, name));
            foreach (string path in Walk(Root))
            {
                if (Inside(PrivateState, path))
                    continue;
                bool directory = Directory.Exists(path);
                using (SafeFileHandle handle = Access(path, directory, true))
                {
                    ChangeAcl(handle, directory, true);
                    SetLabel(handle, directory, "LW");
                }
            }
        }

        private void ChangeAcl(SafeFileHandle handle, bool directory, bool add)
        {
            IntPtr owner, group, dacl, sacl, descriptor;
            if (Native.GetSecurityInfo(handle, 1, 4, out owner, out group, out dacl, out sacl, out descriptor) != 0)
                throw new SandboxException("cleanup_failed");
            try
            {
                byte[] bytes = new byte[Native.GetSecurityDescriptorLength(descriptor)];
                Marshal.Copy(descriptor, bytes, 0, bytes.Length);
                RawSecurityDescriptor security = new RawSecurityDescriptor(bytes, 0);
                RawAcl acl = security.DiscretionaryAcl;
                if (acl == null)
                    throw new SandboxException("invalid_projection");
                for (int i = acl.Count - 1; i >= 0; i--)
                {
                    KnownAce ace = acl[i] as KnownAce;
                    if (ace != null && ace.SecurityIdentifier.Equals(sid))
                        acl.RemoveAce(i);
                }

                if (add)
                {
                    int index = 0;
                    while (index < acl.Count)
                    {
                        QualifiedAce existing = acl[index] as QualifiedAce;
                        if (existing == null
                            || existing.AceQualifier != AceQualifier.AccessDenied
                            || (existing.AceFlags & AceFlags.Inherited) != 0)
                            break;
                        index++;
                    }

                    acl.InsertAce(index, new CommonAce(
                        directory ? AceFlags.ObjectInherit | AceFlags.ContainerInherit : AceFlags.None,
                        AceQualifier.AccessAllowed,
                        (int)(FileSystemRights.Modify | FileSystemRights.Synchronize),
                        sid,
                        false,
                        null
                    ));
                }

                byte[] rawAcl = new byte[acl.BinaryLength];
                acl.GetBinaryForm(rawAcl, 0);
                IntPtr buffer = Marshal.AllocHGlobal(rawAcl.Length);
                try
                {
                    Marshal.Copy(rawAcl, 0, buffer, rawAcl.Length);
                    if (Native.SetSecurityInfo(handle, 1, 4, IntPtr.Zero, IntPtr.Zero, buffer, IntPtr.Zero) != 0)
                        throw new SandboxException("cleanup_failed");
                }
                finally
                {
                    Marshal.FreeHGlobal(buffer);
                }
            }
            finally
            {
                Native.LocalFree(descriptor);
            }
        }

        private static void SetLabel(SafeFileHandle handle, bool directory, string level)
        {
            IntPtr descriptor;
            uint size;
            Native.Check(Native.ConvertStringSecurityDescriptorToSecurityDescriptor(
                "S:(ML;" + (directory ? "OICI" : "") + ";NW;;;" + level + ")",
                1,
                out descriptor,
                out size
            ));
            try
            {
                bool present, defaulted;
                IntPtr sacl;
                Native.Check(Native.GetSecurityDescriptorSacl(descriptor, out present, out sacl, out defaulted));
                if (Native.SetSecurityInfo(handle, 1, 16, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, sacl) != 0)
                    throw new SandboxException("invalid_projection");
            }
            finally
            {
                Native.LocalFree(descriptor);
            }
        }

        internal int Cleanup()
        {
            if (!grantsApplied)
                return 0;
            int remaining = 0;
            List<string> paths;
            try
            {
                paths = Walk(Root);
            }
            catch
            {
                return -1;
            }

            foreach (string path in paths)
            {
                try
                {
                    using (SafeFileHandle handle = Access(path, Directory.Exists(path), true))
                    {
                        ChangeAcl(handle, Directory.Exists(path), false);
                        remaining += CountSidAces(handle);
                    }
                }
                catch
                {
                    remaining++;
                }
            }

            return remaining;
        }

        internal int RecoverOwnedSid(string sidText)
        {
            sid = new SecurityIdentifier(sidText);
            grantsApplied = true;
            return Cleanup();
        }

        private int CountSidAces(SafeFileHandle handle)
        {
            IntPtr owner, group, dacl, sacl, descriptor;
            if (Native.GetSecurityInfo(handle, 1, 4, out owner, out group, out dacl, out sacl, out descriptor) != 0)
                throw new SandboxException("cleanup_failed");
            try
            {
                byte[] bytes = new byte[Native.GetSecurityDescriptorLength(descriptor)];
                Marshal.Copy(descriptor, bytes, 0, bytes.Length);
                RawAcl acl = new RawSecurityDescriptor(bytes, 0).DiscretionaryAcl;
                if (acl == null)
                    throw new SandboxException("cleanup_failed");
                int count = 0;
                foreach (GenericAce generic in acl)
                {
                    KnownAce ace = generic as KnownAce;
                    if (ace != null && ace.SecurityIdentifier.Equals(sid))
                        count++;
                }

                return count;
            }
            finally
            {
                Native.LocalFree(descriptor);
            }
        }

        public void Dispose()
        {
            foreach (SafeFileHandle handle in servicePins.Values)
                handle.Dispose();
            servicePins.Clear();
            foreach (SafeFileHandle handle in pins)
                handle.Dispose();
            pins.Clear();
        }
    }

    internal sealed class ProtocolSink
    {
        private readonly BlockingCollection<string> queue = new BlockingCollection<string>(128);
        private readonly Thread writer;
        private readonly Action broken;
        private int diagnosticBytes;
        internal ProtocolSink(Action onBroken)
        {
            broken = onBroken;
            writer = new Thread(WriteLoop);
            writer.IsBackground = true;
            writer.Name = "sandbox-protocol-output";
            writer.Start();
        }

        internal bool Send(Dictionary<string, object> frame)
        {
            try
            {
                if (queue.TryAdd(Json.Encode(frame), 100))
                    return true;
            }
            catch (InvalidOperationException)
            {
            }

            broken();
            return false;
        }

        private void WriteLoop()
        {
            try
            {
                IntPtr handle = Native.GetStdHandle(-11);
                if (handle == IntPtr.Zero || handle == new IntPtr(-1))
                    throw new IOException();
                foreach (string frame in queue.GetConsumingEnumerable())
                {
                    byte[] bytes = Request.StrictUtf8.GetBytes(frame + "\n");
                    uint written;
                    if (!Native.WriteFile(handle, bytes, (uint)bytes.Length, out written, IntPtr.Zero)
                        || written != bytes.Length)
                        throw new IOException();
                }
            }
            catch
            {
                broken();
            }
        }

        internal void Diagnostic(string code)
        {
            lock (this)
            {
                string line = "xiaozhi-sandbox " + code + "\n";
                int bytes = Encoding.UTF8.GetByteCount(line);
                if (diagnosticBytes + bytes > 8192)
                    return;
                diagnosticBytes += bytes;
                try
                {
                    Console.Error.Write(line);
                }
                catch
                {
                }
            }
        }

        internal void Complete()
        {
            queue.CompleteAdding();
            writer.Join(2000);
        }
    }

    internal sealed class Runner
    {
        private readonly object gate = new object ();
        private readonly Stopwatch duration = Stopwatch.StartNew();
        private readonly ManualResetEvent stopped = new ManualResetEvent(false);
        private readonly ProtocolSink sink;
        private string executionId = "xiexec_00000000-0000-0000-0000-000000000000";
        private string state, error;
        private Request request;
        private Projection projection;
        private FileStream executablePin, payloadPin;
        private IntPtr appSid, job, parent;
        private Native.ProcessInformation process;
        private string profileName;
        private bool profileCreated, truncated, resumed;
        private int emittedBytes;
        private Thread stdoutReader, stderrReader;
        private readonly List<IntPtr> allocations = new List<IntPtr>();
        private IntPtr attributes, stdoutRead, stdoutWrite, stderrRead, stderrWrite, input;
        internal Runner()
        {
            sink = new ProtocolSink(delegate
            {
                Stop("cancelled", null);
            });
        }

        private Dictionary<string, object> Frame(string type)
        {
            return new Dictionary<string, object>
            {


                {
                    "schemaVersion",
                    1
                },

                {
                    "type",
                    type
                },

                {
                    "executionId",
                    executionId
                }

            };
        }

        private void Stop(string nextState, string nextError)
        {
            lock (gate)
            {
                if (state == null || (state == "completed" && nextState == "failed"))
                {
                    state = nextState;
                    error = nextError;
                }

                stopped.Set();
            }
        }

        internal int ExitStatus
        {
            get
            {
                return state == "failed" ? 1 : 0;
            }
        }

        internal void Run(string[] args)
        {
            object exitCode = null;
            int remainingAces = 0;
            uint activeProcesses = 0;
            bool profileRemoved = true;
            try
            {
                if (args.Length != 1 || (args[0] != "--protocol-stdio" && args[0] != "--cleanup-owned"))
                    throw new SandboxException("invalid_protocol");
                bool recovery = args[0] == "--cleanup-owned";
                Stream stdin = Console.OpenStandardInput();
                string first = ReadLine(stdin, 1048576);
                if (first == null)
                    throw new SandboxException("invalid_protocol");
                Dictionary<string, object> start = Request.Object(Json.Parse(first));
                object supplied;
                if (start.TryGetValue("executionId", out supplied) && Request.Id(supplied as string, "xiexec_"))
                    executionId = (string)supplied;
                request = Request.Parse(start);
                executionId = request.ExecutionId;
                ValidateHostToken();
                profileName = "XiaozhiSandbox." + Guid.ParseExact(executionId.Substring("xiexec_".Length), "D").ToString("N");
                try
                {
                    projection = new Projection(request, sink.Diagnostic, recovery);
                }
                catch (SandboxException)
                {
                    throw;
                }
                catch
                {
                    throw new SandboxException("invalid_projection");
                }

                if (recovery)
                {
                    projection.ValidateIdentity(request, profileName);
                    if (Native.DeriveAppContainerSidFromAppContainerName(profileName, out appSid) != 0)
                        throw new SandboxException("cleanup_failed");
                    profileCreated = true;
                    remainingAces = projection.RecoverOwnedSid(new SecurityIdentifier(appSid).Value);
                    if (remainingAces != 0)
                        throw new SandboxException("cleanup_failed");
                    state = "completed";
                    return;
                }

                MonitorParent();
                Thread inputThread = new Thread(delegate ()
                {
                    ReadControls(stdin);
                });
                inputThread.IsBackground = true;
                inputThread.Name = "sandbox-protocol-input";
                inputThread.Start();
                ValidateExecutable();
                if (stopped.WaitOne(0))
                    return;
                projection.WriteIdentity(request, profileName);
                CreateProfile();
                projection.Grant(new SecurityIdentifier(appSid).Value);
                string payload = WritePayload();
                if (duration.ElapsedMilliseconds >= request.TimeoutMs)
                    Stop("timed_out", null);
                if (!stopped.WaitOne(0))
                    Launch(payload);
                if (process.Process != IntPtr.Zero && resumed)
                {
                    while (Native.WaitForSingleObject(process.Process, 25) == 258)
                    {
                        if (duration.ElapsedMilliseconds >= request.TimeoutMs)
                            Stop("timed_out", null);
                        if (stopped.WaitOne(0))
                            break;
                    }

                    if (duration.ElapsedMilliseconds >= request.TimeoutMs
                        && Native.WaitForSingleObject(process.Process, 0) == 258)
                        Stop("timed_out", null);
                    if (stopped.WaitOne(0))
                        Native.TerminateJobObject(job, state == "timed_out" ? 124u : 125u);
                    Native.WaitForSingleObject(process.Process, 5000);
                    uint exit;
                    if (Native.GetExitCodeProcess(process.Process, out exit))
                        exitCode = unchecked((int)exit);
                    lock (gate)
                    {
                        if (state == null)
                            state = "completed";
                    }
                }
            }
            catch (SandboxException failure)
            {
                Stop("failed", failure.Code);
            }
            catch (DecoderFallbackException)
            {
                Stop("failed", "invalid_protocol");
            }
            catch (EncoderFallbackException)
            {
                Stop("failed", "invalid_protocol");
            }
            catch (Exception)
            {
                sink.Diagnostic("native_operation_failed");
                Stop("failed", "launch_failed");
            }
            finally
            {
                if (job != IntPtr.Zero)
                {
                    Native.TerminateJobObject(job, 125);
                    if (process.Process != IntPtr.Zero && !resumed)
                        Native.TerminateProcess(process.Process, 125);
                    if (process.Process != IntPtr.Zero)
                        Native.WaitForSingleObject(process.Process, 5000);
                    Native.JobAccounting accounting = new Native.JobAccounting();
                    for (int i = 0; i < 100; i++)
                    {
                        if (!Native.QueryInformationJobObject(
                            job,
                            1,
                            out accounting,
                            Marshal.SizeOf(typeof(Native.JobAccounting)),
                            IntPtr.Zero
                        ))
                        {
                            accounting.Active = uint.MaxValue;
                            break;
                        }

                        if (accounting.Active == 0)
                            break;
                        Thread.Sleep(25);
                    }

                    activeProcesses = accounting.Active;
                }
                else if (process.Process != IntPtr.Zero)
                {
                    Native.TerminateProcess(process.Process, 125);
                    Native.WaitForSingleObject(process.Process, 5000);
                }

                Native.Close(ref stdoutWrite);
                Native.Close(ref stderrWrite);
                Native.Close(ref input);
                if (stdoutReader != null)
                    stdoutReader.Join(3000);
                if (stderrReader != null)
                    stderrReader.Join(3000);
                if (payloadPin != null)
                    payloadPin.Dispose();
                if (executablePin != null)
                    executablePin.Dispose();
                if (projection != null)
                {
                    remainingAces = projection.Cleanup();
                    projection.Dispose();
                }

                if (profileCreated)
                {
                    profileRemoved = Native.DeleteAppContainerProfile(profileName) == 0;
                }

                if (appSid != IntPtr.Zero)
                    Native.FreeSid(appSid);
                Native.Close(ref process.Thread);
                Native.Close(ref process.Process);
                Native.Close(ref job);
                Native.Close(ref parent);
                Native.Close(ref stdoutRead);
                Native.Close(ref stderrRead);
                if (attributes != IntPtr.Zero)
                {
                    Native.DeleteProcThreadAttributeList(attributes);
                    Marshal.FreeHGlobal(attributes);
                }

                foreach (IntPtr pointer in allocations)
                    Marshal.FreeHGlobal(pointer);
                if (activeProcesses != 0 || remainingAces != 0 || !profileRemoved)
                {
                    state = "failed";
                    error = "cleanup_failed";
                }

                if (state == null)
                    state = "cancelled";
                Dictionary<string, object> result = Frame("result");
                result.Add("state", state);
                result.Add("exitCode", exitCode);
                result.Add("truncated", truncated);
                result.Add("durationMs", duration.ElapsedMilliseconds);
                result.Add("cleanup", new Dictionary<string, object> {

                    { "jobActiveProcesses", (long)activeProcesses },
                    { "profileRemoved", profileRemoved },
                    { "remainingOwnedAces", remainingAces }
                });
                if (error != null)
                    result.Add("error", error);
                sink.Send(result);
                sink.Complete();
            }
        }

        private static void ValidateHostToken()
        {
            IntPtr token;
            Native.Check(Native.OpenProcessToken(Native.GetCurrentProcess(), 8, out token));
            IntPtr buffer = Marshal.AllocHGlobal(4096);
            try
            {
                int needed;
                Native.Check(Native.GetTokenInformation(token, 29, buffer, 4096, out needed));
                if (Marshal.ReadInt32(buffer) != 0)
                    throw new SandboxException("invalid_protocol");
                Native.Check(Native.GetTokenInformation(token, 25, buffer, 4096, out needed));
                string integrity = new SecurityIdentifier(Marshal.ReadIntPtr(buffer)).Value;
                if (integrity != "S-1-16-8192" && integrity != "S-1-16-12288" && integrity != "S-1-16-16384")
                    throw new SandboxException("invalid_protocol");
            }
            finally
            {
                Native.CloseHandle(token);
                Marshal.FreeHGlobal(buffer);
            }
        }

        private static string ReadLine(Stream stream, int limit)
        {
            using (MemoryStream bytes = new MemoryStream())
            {
                while (true)
                {
                    int next = stream.ReadByte();
                    if (next == -1)
                    {
                        if (bytes.Length == 0)
                            return null;
                        throw new SandboxException("invalid_protocol");
                    }

                    if (next == 10)
                        break;
                    if (bytes.Length >= limit)
                        throw new SandboxException("invalid_protocol");
                    bytes.WriteByte((byte)next);
                }

                byte[] data = bytes.ToArray();
                int count = data.Length;
                if (count > 0 && data[count - 1] == 13)
                    count--;
                return Request.StrictUtf8.GetString(data, 0, count);
            }
        }

        private void ReadControls(Stream stdin)
        {
            try
            {
                while (true)
                {
                    string line = ReadLine(stdin, 4096);
                    if (line == null)
                    {
                        Stop("cancelled", null);
                        return;
                    }

                    Dictionary<string, object> cancel = Request.Object(Json.Parse(line));
                    Request.Keys(cancel, "schemaVersion", "type", "executionId", "reason");
                    Request.Number(cancel, "schemaVersion", 1, 1);
                    if (Request.Text(cancel, "type", 20) != "cancel")
                        throw new SandboxException("invalid_protocol");
                    string target = Request.Text(cancel, "executionId", 80);
                    if (!Request.Id(target, "xiexec_"))
                        throw new SandboxException("invalid_protocol");
                    string reason = Request.Text(cancel, "reason", 20);
                    if (reason != "cancelled" && reason != "revoked" && reason != "timeout")
                        throw new SandboxException("invalid_protocol");
                    if (target == executionId)
                        Stop(reason == "timeout" ? "timed_out" : "cancelled", null);
                }
            }
            catch
            {
                Stop("failed", "invalid_protocol");
            }
        }

        private void MonitorParent()
        {
            Native.ProcessBasicInformation information = new Native.ProcessBasicInformation();
            int required;
            if (Native.NtQueryInformationProcess(
                Native.GetCurrentProcess(),
                0,
                ref information,
                Marshal.SizeOf(information),
                out required
            ) != 0)
                throw new SandboxException("launch_failed");
            parent = Native.OpenProcess(0x100000, false, information.ParentPid.ToInt32());
            if (parent == IntPtr.Zero)
            {
                Stop("cancelled", null);
                return;
            }

            Thread monitor = new Thread(delegate ()
            {
                while (!stopped.WaitOne(50))
                    if (Native.WaitForSingleObject(parent, 0) == 0)
                    {
                        Stop("cancelled", null);
                        break;
                    }
            });
            monitor.IsBackground = true;
            monitor.Name = "sandbox-parent-monitor";
            monitor.Start();
        }

        private void ValidateExecutable()
        {
            try
            {
                ValidateExecutableCore();
            }
            catch (SandboxException)
            {
                throw;
            }
            catch
            {
                throw new SandboxException("executable_changed");
            }
        }

        private void ValidateExecutableCore()
        {
            string canonical;
            try
            {
                canonical = Projection.Canonical(request.Executable);
            }
            catch
            {
                throw new SandboxException("executable_changed");
            }

            string expected = null;
            foreach (TrustedRuntime runtime in TrustedRuntimes.Items)
                if (string.Equals(runtime.Path, canonical, StringComparison.OrdinalIgnoreCase))
                    expected = runtime.Hash;
            if (expected == null || request.ExecutableHash != expected)
                throw new SandboxException("executable_changed");
            string ancestor = Path.GetDirectoryName(canonical);
            while (!string.IsNullOrEmpty(ancestor) && ancestor.Length > 3)
            {
                if ((File.GetAttributes(ancestor) & FileAttributes.ReparsePoint) != 0)
                    throw new SandboxException("executable_changed");
                ancestor = Path.GetDirectoryName(ancestor);
            }

            if ((File.GetAttributes(canonical) & FileAttributes.ReparsePoint) != 0)
                throw new SandboxException("executable_changed");
            executablePin = new FileStream(canonical, FileMode.Open, FileAccess.Read, FileShare.Read);
            StringBuilder final = new StringBuilder(2048);
            if (Native.GetFinalPathNameByHandle(executablePin.SafeFileHandle, final, (uint)final.Capacity, 0) == 0
                || !string.Equals(final.ToString(), "\\\\?\\" + canonical, StringComparison.OrdinalIgnoreCase))
                throw new SandboxException("executable_changed");
            using (SHA256 hash = SHA256.Create())
            {
                string actual = BitConverter.ToString(hash.ComputeHash(executablePin)).Replace("-", "").ToLowerInvariant();
                if (actual != expected)
                    throw new SandboxException("executable_changed");
            }
        }

        private void CreateProfile()
        {
            if (Native.CreateAppContainerProfile(
                profileName,
                profileName,
                "Xiaozhi owned permission execution",
                IntPtr.Zero,
                0,
                out appSid
            ) != 0)
                throw new SandboxException("launch_failed");
            profileCreated = true;
        }

        private string WritePayload()
        {
            string path = Path.Combine(request.ProjectionRoot, ".runtime", "payload-" + Guid.NewGuid().ToString("N") + ".ps1");
            string prefix = "[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)\r\n[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)\r\n$OutputEncoding = [Console]::OutputEncoding\r\n";
            using (FileStream writer = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                byte[] bom = Encoding.UTF8.GetPreamble();
                writer.Write(bom, 0, bom.Length);
                byte[] bytes = Request.StrictUtf8.GetBytes(prefix + request.Command + "\r\nif (-not $?) { exit 1 }\r\n");
                writer.Write(bytes, 0, bytes.Length);
            }

            // Files created by the medium helper after the first grant also need a Low label and exact package ACE.
            projection.Grant(new SecurityIdentifier(appSid).Value);
            payloadPin = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            return path;
        }

        private IntPtr Allocate(int bytes)
        {
            IntPtr pointer = Marshal.AllocHGlobal(bytes);
            allocations.Add(pointer);
            return pointer;
        }

        private string EnvironmentBlock()
        {
            StringBuilder windowsPath = new StringBuilder(1024);
            if (Native.GetWindowsDirectory(windowsPath, (uint)windowsPath.Capacity) == 0)
                throw new SandboxException("launch_failed");
            string windows = windowsPath.ToString(), runtime = Path.Combine(request.ProjectionRoot, ".runtime");
            SortedDictionary<string, string> env = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            env.Add("APPDATA", Path.Combine(runtime, "roaming"));
            env.Add("COMSPEC", Path.Combine(windows, "System32", "cmd.exe"));
            env.Add("LOCALAPPDATA", Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
            env.Add("PATH", Path.Combine(windows, "System32") + ";" + Path.GetDirectoryName(request.Executable));
            env.Add("PSModulePath", Path.Combine(Path.GetDirectoryName(request.Executable), "Modules") + ";" + Path.Combine(windows, "System32", "WindowsPowerShell", "v1.0", "Modules"));
            env.Add("SystemDrive", Path.GetPathRoot(windows).TrimEnd('\\'));
            env.Add("SystemRoot", windows);
            env.Add("TEMP", Path.Combine(runtime, "temp"));
            env.Add("TMP", Path.Combine(runtime, "temp"));
            env.Add("USERPROFILE", Path.Combine(runtime, "home"));
            env.Add("windir", windows);
            foreach (KeyValuePair<string, object> pair in request.Environment)
                env.Add(pair.Key, (string)pair.Value);
            StringBuilder text = new StringBuilder();
            foreach (KeyValuePair<string, string> pair in env)
                text.Append(pair.Key).Append('=').Append(pair.Value).Append('\0');
            text.Append('\0');
            return text.ToString();
        }

        private void Launch(string payload)
        {
            Native.SecurityAttributes security = new Native.SecurityAttributes
            {
                Length = Marshal.SizeOf(typeof(Native.SecurityAttributes)),
                Inherit = 1
            };
            Native.Check(Native.CreatePipe(out stdoutRead, out stdoutWrite, ref security, 65536));
            Native.Check(Native.SetHandleInformation(stdoutRead, 1, 0));
            Native.Check(Native.CreatePipe(out stderrRead, out stderrWrite, ref security, 65536));
            Native.Check(Native.SetHandleInformation(stderrRead, 1, 0));
            input = Native.CreateFile("NUL", 0x80000000, 3, ref security, 3, 0x80, IntPtr.Zero);
            Native.Check(input != new IntPtr(-1));
            IntPtr size = IntPtr.Zero;
            Native.InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref size);
            attributes = Marshal.AllocHGlobal(size);
            Native.Check(Native.InitializeProcThreadAttributeList(attributes, 2, 0, ref size));
            Native.SecurityCapabilities capabilities = new Native.SecurityCapabilities
            {
                Sid = appSid
            };
            IntPtr cap = Allocate(Marshal.SizeOf(capabilities));
            Marshal.StructureToPtr(capabilities, cap, false);
            Native.Check(Native.UpdateProcThreadAttribute(
                attributes,
                0,
                new IntPtr(0x20009),
                cap,
                new IntPtr(Marshal.SizeOf(capabilities)),
                IntPtr.Zero,
                IntPtr.Zero
            ));
            IntPtr handles = Allocate(IntPtr.Size * 3);
            Marshal.WriteIntPtr(handles, stdoutWrite);
            Marshal.WriteIntPtr(handles, IntPtr.Size, stderrWrite);
            Marshal.WriteIntPtr(handles, IntPtr.Size * 2, input);
            Native.Check(Native.UpdateProcThreadAttribute(
                attributes,
                0,
                new IntPtr(0x20002),
                handles,
                new IntPtr(IntPtr.Size * 3),
                IntPtr.Zero,
                IntPtr.Zero
            ));
            job = Native.CreateJobObject(IntPtr.Zero, null);
            Native.Check(job != IntPtr.Zero);
            Native.ExtendedLimits limits = new Native.ExtendedLimits();
            limits.Basic.Flags = 0x2000 | 0x8;
            limits.Basic.ActiveProcesses = (uint)request.MaxProcesses;
            Native.Check(Native.SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(limits)));
            string environment = EnvironmentBlock();
            IntPtr env = Allocate(Encoding.Unicode.GetByteCount(environment));
            Marshal.Copy(Encoding.Unicode.GetBytes(environment), 0, env, Encoding.Unicode.GetByteCount(environment));
            Native.StartupInfoEx startup = new Native.StartupInfoEx();
            startup.Info.cb = Marshal.SizeOf(startup);
            startup.Info.Flags = 0x100;
            startup.Info.Input = input;
            startup.Info.Output = stdoutWrite;
            startup.Info.Error = stderrWrite;
            startup.Attributes = attributes;
            string arguments = "\"" + request.Executable + "\" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + payload + "\"";
            Native.Check(Native.CreateProcess(
                request.Executable,
                new StringBuilder(arguments),
                IntPtr.Zero,
                IntPtr.Zero,
                true,
                0x80000 | 0x400 | 0x4 | 0x08000000,
                env,
                request.Cwd,
                ref startup,
                out process
            ));
            Native.Check(Native.AssignProcessToJobObject(job, process.Process));
            bool assigned;
            Native.Check(Native.IsProcessInJob(process.Process, job, out assigned));
            if (!assigned || !CheckToken())
                throw new SandboxException("launch_failed");
            Dictionary<string, object> started = Frame("started");
            started.Add("pid", process.Pid);
            started.Add("tokenIsAppContainer", true);
            started.Add("jobAssigned", true);
            started.Add("profileName", profileName);
            started.Add("projectionRoot", request.ProjectionRoot);
            sink.Send(started);
            Native.Close(ref stdoutWrite);
            Native.Close(ref stderrWrite);
            Native.Close(ref input);
            stdoutReader = StartReader(ref stdoutRead, "stdout");
            stderrReader = StartReader(ref stderrRead, "stderr");
            if (stopped.WaitOne(0))
                return;
            if (Native.ResumeThread(process.Thread) == uint.MaxValue)
                throw new SandboxException("launch_failed");
            resumed = true;
        }

        private bool CheckToken()
        {
            IntPtr token;
            Native.Check(Native.OpenProcessToken(process.Process, 8, out token));
            IntPtr bytes = Marshal.AllocHGlobal(4096);
            try
            {
                int needed;
                Native.Check(Native.GetTokenInformation(token, 29, bytes, 4096, out needed));
                if (Marshal.ReadInt32(bytes) != 1)
                    return false;
                Native.Check(Native.GetTokenInformation(token, 31, bytes, 4096, out needed));
                if (!new SecurityIdentifier(Marshal.ReadIntPtr(bytes)).Equals(new SecurityIdentifier(appSid)))
                    return false;
                Native.Check(Native.GetTokenInformation(token, 30, bytes, 4096, out needed));
                if (Marshal.ReadInt32(bytes) != 0)
                    return false;
                Native.Check(Native.GetTokenInformation(token, 25, bytes, 4096, out needed));
                return new SecurityIdentifier(Marshal.ReadIntPtr(bytes)).Value == "S-1-16-4096";
            }
            finally
            {
                Native.CloseHandle(token);
                Marshal.FreeHGlobal(bytes);
            }
        }

        private Thread StartReader(ref IntPtr nativeHandle, string streamName)
        {
            IntPtr handle = nativeHandle;
            nativeHandle = IntPtr.Zero;
            Thread reader = new Thread(delegate ()
            {
                try
                {
                    using (FileStream stream = new FileStream(new SafeFileHandle(handle, true), FileAccess.Read, 16384, false))
                    {
                        byte[] buffer = new byte[16384];
                        int count;
                        while ((count = stream.Read(buffer, 0, buffer.Length)) > 0)
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
                catch
                {
                    Stop("failed", "launch_failed");
                }
            });
            reader.IsBackground = true;
            reader.Name = "sandbox-" + streamName;
            reader.Start();
            return reader;
        }
    }

    internal static class Program
    {
        internal static int Main(string[] args)
        {
            if (args.Length == 1 && args[0] == "--platform-info")
            {
                return PlatformInfo.Write();
            }

            Runner runner = new Runner();
            runner.Run(args);
            return runner.ExitStatus;
        }
    }
}
