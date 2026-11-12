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
    internal static class PlatformInfo
    {
        internal static int Write()
        {
            try
            {
                StringBuilder buffer = new StringBuilder(32768);
                uint length = Native.GetWindowsDirectory(buffer, (uint)buffer.Capacity);
                if (length == 0 || length >= buffer.Capacity)
                {
                    return 1;
                }

                string windows = Projection.Canonical(buffer.ToString().TrimEnd('\\'));
                Environment.SetEnvironmentVariable("SystemRoot", windows, EnvironmentVariableTarget.Process);
                Environment.SetEnvironmentVariable("windir", windows, EnvironmentVariableTarget.Process);
                string powershell = Path.Combine(windows, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
                string compiler = Path.Combine(windows, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
                Dictionary<string, object> frame = new Dictionary<string, object>
                {
                    { "schemaVersion", 1 },
                    { "type", "platform_info" },
                    { "platform", "win32" },
                    { "architecture", "x64" },
                    { "windowsDirectory", windows }
                };
                string prefix = Json.Encode(frame);
                string text = prefix.Substring(0, prefix.Length - 1)
                    + ",\"runtimes\":["
                    + Json.Encode(Inspect("powershell5", powershell))
                    + ","
                    + Json.Encode(Inspect("framework_csc", compiler))
                    + "]}\n";
                byte[] bytes = Request.StrictUtf8.GetBytes(text);
                uint written;
                if (!Native.WriteFile(Native.GetStdHandle(-11), bytes, (uint)bytes.Length, out written, IntPtr.Zero)
                    || written != bytes.Length)
                {
                    return 1;
                }

                return 0;
            }
            catch
            {
                return 1;
            }
        }

        internal static Dictionary<string, object> Inspect(string kind, string path)
        {
            Dictionary<string, object> result = new Dictionary<string, object>
            {
                { "kind", kind },
                { "path", path },
                { "sha256", null },
                { "fileVersion", null },
                { "trust", "unavailable" },
                { "trustSource", "none" },
                { "publisher", null },
                { "reason", "file_unavailable" }
            };
            try
            {
                string canonical = Projection.Canonical(path);
                string ancestor = canonical;
                while (!string.IsNullOrEmpty(ancestor) && ancestor.Length > 3)
                {
                    if ((File.GetAttributes(ancestor) & FileAttributes.ReparsePoint) != 0)
                    {
                        result["trust"] = "untrusted";
                        result["reason"] = "unsafe_path";
                        return result;
                    }

                    ancestor = Path.GetDirectoryName(ancestor);
                }

                using (FileStream stream = new FileStream(canonical, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    StringBuilder final = new StringBuilder(32768);
                    uint length = Native.GetFinalPathNameByHandle(stream.SafeFileHandle, final, (uint)final.Capacity, 0);
                    if (length == 0
                        || length >= final.Capacity
                        || !string.Equals(final.ToString(), "\\\\?\\" + canonical, StringComparison.OrdinalIgnoreCase))
                    {
                        result["trust"] = "untrusted";
                        result["reason"] = "unsafe_path";
                        return result;
                    }

                    using (SHA256 hash = SHA256.Create())
                    {
                        result["sha256"] = BitConverter.ToString(hash.ComputeHash(stream))
                            .Replace("-", "")
                            .ToLowerInvariant();
                    }

                    result["fileVersion"] = FileVersionInfo.GetVersionInfo(canonical).FileVersion;
                    stream.Position = 0;
                    OfflineWindowsTrust.Verify(canonical, stream.SafeFileHandle, result);
                }
            }
            catch
            {
                result["trust"] = "unavailable";
                result["reason"] = "file_or_trust_api_unavailable";
            }

            return result;
        }
    }

    internal static class OfflineWindowsTrust
    {
        private static readonly Guid VerifyAction = new Guid("00AAC56B-CD44-11d0-8CC2-00C04FC295EE");
        private static readonly Guid CatalogSubsystem = new Guid("F750E6C3-38EE-11D1-85E5-00C04FC295EE");
        private const uint CacheOnlyNoRevocation = 0x1000 | 0x10;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct FileInfo
        {
            internal uint Size;
            [MarshalAs(UnmanagedType.LPWStr)] internal string Path;
            internal IntPtr Handle;
            internal IntPtr Subject;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct CatalogInfo
        {
            internal uint Size;
            internal uint Version;
            [MarshalAs(UnmanagedType.LPWStr)] internal string CatalogPath;
            [MarshalAs(UnmanagedType.LPWStr)] internal string MemberTag;
            [MarshalAs(UnmanagedType.LPWStr)] internal string MemberPath;
            internal IntPtr MemberHandle;
            internal IntPtr Hash;
            internal uint HashLength;
            internal IntPtr CatalogContext;
            internal IntPtr Admin;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct TrustData
        {
            internal uint Size;
            internal IntPtr Policy;
            internal IntPtr Client;
            internal uint Ui;
            internal uint Revocation;
            internal uint Choice;
            internal IntPtr Info;
            internal uint StateAction;
            internal IntPtr State;
            internal IntPtr Url;
            internal uint Flags;
            internal uint UiContext;
            internal IntPtr SignatureSettings;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct ProviderSigner
        {
            internal uint Size;
            internal System.Runtime.InteropServices.ComTypes.FILETIME VerifyTime;
            internal uint CertificateCount;
            internal IntPtr Certificates;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct ProviderCertificate
        {
            internal uint Size;
            internal IntPtr Certificate;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct CatalogPathInfo
        {
            internal uint Size;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] internal string Path;
        }

        [DllImport("wintrust.dll", ExactSpelling = true)]
        private static extern int WinVerifyTrust(IntPtr window, ref Guid action, ref TrustData data);

        [DllImport("wintrust.dll", ExactSpelling = true)]
        private static extern IntPtr WTHelperProvDataFromStateData(IntPtr state);

        [DllImport("wintrust.dll", ExactSpelling = true)]
        private static extern IntPtr WTHelperGetProvSignerFromChain(IntPtr provider, uint signer, bool counter, uint counterSigner);

        [DllImport("wintrust.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool CryptCATAdminAcquireContext2(
            out IntPtr admin,
            ref Guid subsystem,
            string algorithm,
            IntPtr strongPolicy,
            uint flags);

        [DllImport("wintrust.dll", SetLastError = true)]
        private static extern bool CryptCATAdminCalcHashFromFileHandle2(
            IntPtr admin,
            SafeFileHandle file,
            ref uint size,
            byte[] hash,
            uint flags);

        [DllImport("wintrust.dll", SetLastError = true)]
        private static extern IntPtr CryptCATAdminEnumCatalogFromHash(
            IntPtr admin,
            byte[] hash,
            uint size,
            uint flags,
            ref IntPtr previous);

        [DllImport("wintrust.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool CryptCATCatalogInfoFromContext(IntPtr catalog, ref CatalogPathInfo info, uint flags);

        [DllImport("wintrust.dll", SetLastError = true)]
        private static extern bool CryptCATAdminReleaseCatalogContext(IntPtr admin, IntPtr catalog, uint flags);

        [DllImport("wintrust.dll", SetLastError = true)]
        private static extern bool CryptCATAdminReleaseContext(IntPtr admin, uint flags);

        internal static void Verify(string path, SafeFileHandle handle, Dictionary<string, object> result)
        {
            FileInfo file = new FileInfo
            {
                Size = (uint)Marshal.SizeOf(typeof(FileInfo)),
                Path = path,
                Handle = handle.DangerousGetHandle()
            };
            IntPtr info = Marshal.AllocHGlobal(Marshal.SizeOf(file));
            int embeddedStatus;
            try
            {
                Marshal.StructureToPtr(file, info, false);
                embeddedStatus = VerifyInfo(1, info, "embedded", result);
            }
            finally
            {
                Marshal.DestroyStructure(info, typeof(FileInfo));
                Marshal.FreeHGlobal(info);
            }

            if (embeddedStatus == 0)
            {
                return;
            }

            foreach (string algorithm in new string[] { "SHA256", "SHA1" })
            {
                if (VerifyCatalog(path, handle, algorithm, result))
                {
                    return;
                }
            }

            result["trust"] = embeddedStatus == unchecked((int)0x800B0100) ? "unavailable" : "untrusted";
            result["trustSource"] = "none";
            result["reason"] = "no_verified_signature_" + unchecked((uint)embeddedStatus).ToString("x8");
        }

        private static int VerifyInfo(uint choice, IntPtr info, string source, Dictionary<string, object> result)
        {
            TrustData data = new TrustData
            {
                Size = (uint)Marshal.SizeOf(typeof(TrustData)),
                Ui = 2,
                Choice = choice,
                Info = info,
                StateAction = 1,
                Flags = CacheOnlyNoRevocation
            };
            Guid action = VerifyAction;
            int status = WinVerifyTrust(new IntPtr(-1), ref action, ref data);
            try
            {
                if (status != 0)
                {
                    return status;
                }

                IntPtr provider = WTHelperProvDataFromStateData(data.State);
                if (provider == IntPtr.Zero)
                {
                    result["reason"] = "verified_chain_signer_unavailable";
                    return unchecked((int)0x800B0100);
                }

                IntPtr signerPointer = WTHelperGetProvSignerFromChain(provider, 0, false, 0);
                if (signerPointer == IntPtr.Zero)
                {
                    result["reason"] = "verified_chain_signer_unavailable";
                    return unchecked((int)0x800B0100);
                }

                ProviderSigner signer = (ProviderSigner)Marshal.PtrToStructure(signerPointer, typeof(ProviderSigner));
                if (signer.CertificateCount == 0 || signer.Certificates == IntPtr.Zero)
                {
                    result["reason"] = "verified_chain_signer_unavailable";
                    return unchecked((int)0x800B0100);
                }

                ProviderCertificate certificate = (ProviderCertificate)Marshal.PtrToStructure(
                    signer.Certificates,
                    typeof(ProviderCertificate));
                using (X509Certificate2 signerCertificate = new X509Certificate2(certificate.Certificate))
                {
                    string publisher = signerCertificate.GetNameInfo(X509NameType.SimpleName, false);
                    bool microsoft = Regex.IsMatch(
                        signerCertificate.Subject,
                        "(?:^|,\\s*)O=Microsoft Corporation(?:,|$)",
                        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)
                        && (publisher == "Microsoft Windows"
                            || publisher == "Microsoft Corporation"
                            || publisher == "Microsoft Windows Publisher");
                    result["publisher"] = publisher;
                    result["trustSource"] = source;
                    result["trust"] = microsoft ? "verified" : "untrusted";
                    result["reason"] = microsoft ? null : "publisher_not_microsoft";
                }

                return 0;
            }
            finally
            {
                data.StateAction = 2;
                WinVerifyTrust(new IntPtr(-1), ref action, ref data);
            }
        }

        private static bool VerifyCatalog(
            string path,
            SafeFileHandle handle,
            string algorithm,
            Dictionary<string, object> result)
        {
            IntPtr admin;
            Guid subsystem = CatalogSubsystem;
            if (!CryptCATAdminAcquireContext2(out admin, ref subsystem, algorithm, IntPtr.Zero, 0))
            {
                return false;
            }

            IntPtr catalog = IntPtr.Zero;
            try
            {
                uint size = 0;
                CryptCATAdminCalcHashFromFileHandle2(admin, handle, ref size, null, 0);
                if (size == 0 || size > 64)
                {
                    return false;
                }

                byte[] hash = new byte[size];
                if (!CryptCATAdminCalcHashFromFileHandle2(admin, handle, ref size, hash, 0))
                {
                    return false;
                }

                for (int attempt = 0; attempt < 16; attempt++)
                {
                    IntPtr previous = catalog;
                    catalog = CryptCATAdminEnumCatalogFromHash(admin, hash, size, 0, ref previous);
                    if (catalog == IntPtr.Zero)
                    {
                        return false;
                    }

                    CatalogPathInfo catalogPath = new CatalogPathInfo
                    {
                        Size = (uint)Marshal.SizeOf(typeof(CatalogPathInfo))
                    };
                    if (!CryptCATCatalogInfoFromContext(catalog, ref catalogPath, 0))
                    {
                        continue;
                    }

                    IntPtr hashBuffer = Marshal.AllocHGlobal(hash.Length);
                    CatalogInfo member = new CatalogInfo
                    {
                        Size = (uint)Marshal.SizeOf(typeof(CatalogInfo)),
                        CatalogPath = catalogPath.Path,
                        MemberTag = BitConverter.ToString(hash).Replace("-", ""),
                        MemberPath = path,
                        MemberHandle = handle.DangerousGetHandle(),
                        Hash = hashBuffer,
                        HashLength = size,
                        Admin = admin
                    };
                    IntPtr info = Marshal.AllocHGlobal(Marshal.SizeOf(member));
                    try
                    {
                        Marshal.Copy(hash, 0, hashBuffer, hash.Length);
                        Marshal.StructureToPtr(member, info, false);
                        if (VerifyInfo(2, info, "catalog", result) == 0)
                        {
                            return true;
                        }
                    }
                    finally
                    {
                        Marshal.DestroyStructure(info, typeof(CatalogInfo));
                        Marshal.FreeHGlobal(info);
                        Marshal.FreeHGlobal(hashBuffer);
                    }
                }

                return false;
            }
            finally
            {
                if (catalog != IntPtr.Zero)
                {
                    CryptCATAdminReleaseCatalogContext(admin, catalog, 0);
                }

                CryptCATAdminReleaseContext(admin, 0);
            }
        }
    }

}
