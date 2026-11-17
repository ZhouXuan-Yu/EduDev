using System.Collections.Generic;
using System.IO;
using Microsoft.Win32.SafeHandles;

namespace Xiaozhi.PermissionRuntime
{
    internal sealed partial class Runner
    {
        private bool packageExecutable;

        private void ReleasePackageExecutablePin()
        {
            packageExecutable = request.Session != null
                && Projection.Inside(Path.Combine(request.ProjectionRoot, ".runtime", "package"), request.Executable);
            if (packageExecutable && executablePin != null)
            {
                executablePin.Dispose();
                executablePin = null;
            }
        }

        private void RevalidatePackageExecutablePin()
        {
            if (packageExecutable)
                ValidateExecutable();
        }
    }

    internal sealed partial class Projection
    {
        private readonly List<SafeFileHandle> sessionPackagePins = new List<SafeFileHandle>();

        internal void ProtectSessionPackage()
        {
            string package = Path.Combine(Root, ".runtime", "package");
            if (!Directory.Exists(package))
                return;
            // Immutable executable resources remain readable and executable at Low.
            // Medium labels deny Low writes and DACL replacement. Pins deny deletion/renaming.
            foreach (string entry in Walk(package))
            {
                bool directory = Directory.Exists(entry);
                using (SafeFileHandle writable = OpenChecked(entry, directory, true))
                    SetLabel(writable, directory, "ME");
                SafeFileHandle handle = OpenChecked(entry, directory, false);
                sessionPackagePins.Add(handle);
            }
        }

        internal void DisposeSessionPackage()
        {
            foreach (SafeFileHandle handle in sessionPackagePins)
                handle.Dispose();
            sessionPackagePins.Clear();
        }
    }
}
