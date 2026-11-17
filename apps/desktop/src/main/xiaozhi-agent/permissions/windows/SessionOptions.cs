using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Xiaozhi.PermissionRuntime
{
    internal sealed class SessionOptions
    {
        internal string Arguments;
        internal int MaxInputBytes, MemoryBytes, CpuRate, UserTimeMs;
        internal Dictionary<string, object> Environment;

        internal static SessionOptions Extract(ref Dictionary<string, object> map)
        {
            object value;
            if (!map.TryGetValue("session", out value))
                return null;
            Dictionary<string, object> options = Request.Object(value);
            Request.Keys(options, "schemaVersion", "mode", "arguments", "maxInputBytes", "memoryBytes", "cpuRate", "userTimeMs", "environment");
            Request.Number(options, "schemaVersion", 1, 1);
            if (Request.Text(options, "mode", 16) != "stdio")
                throw new SandboxException("unsupported_constraint");
            SessionOptions result = new SessionOptions();
            result.Arguments = Request.Text(options, "arguments", 16384);
            result.MaxInputBytes = Request.Number(options, "maxInputBytes", 1024, 67108864);
            result.MemoryBytes = Request.Number(options, "memoryBytes", 16777216, int.MaxValue);
            result.CpuRate = Request.Number(options, "cpuRate", 1, 10000);
            result.UserTimeMs = Request.Number(options, "userTimeMs", 0, 86400000);
            result.Environment = Request.Object(options["environment"]);
            if (result.Environment.Count > 16)
                throw new SandboxException("invalid_protocol");
            foreach (string key in result.Environment.Keys)
            {
                if (!Regex.IsMatch(key, "^MCP_[A-Z0-9_]{1,64}$"))
                    throw new SandboxException("invalid_protocol");
                Request.Text(result.Environment, key, 8192);
            }
            map = new Dictionary<string, object>(map, StringComparer.Ordinal);
            map.Remove("session");
            return result;
        }
    }

    internal sealed partial class Request
    {
        internal SessionOptions Session;
    }
}
