namespace Xiaozhi.PermissionRuntime {
internal sealed class TrustedRuntime { internal string Path, Hash; internal TrustedRuntime(string path, string hash) { Path=path; Hash=hash; } }
internal static class TrustedRuntimes { internal static readonly TrustedRuntime[] Items = new TrustedRuntime[] {
new TrustedRuntime(@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe", "60c9b29843624dd8af6b6a7b26147753be6aeef65098b9a503cc50850afe410f"),
new TrustedRuntime(@"C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1110-778-0_26.1110.778.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe", "2a6769a3330dc1084d0154bfde7d164ab750ca7f700f313f9d417c1be78b2233"),
}; } }
