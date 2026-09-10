using System.Diagnostics;
using System.Text;
using System.Text.Json;

const string HostName = "com.bonsai.ext_install";

try
{
    var request = await ReceiveAsync(Console.OpenStandardInput());
    var response = await InstallAsync(request);
    await SendAsync(Console.OpenStandardOutput(), response);
}
catch (Exception ex)
{
    await SendAsync(Console.OpenStandardOutput(), new { ok = false, error = ex.Message });
}

static async Task<JsonElement> ReceiveAsync(Stream input)
{
    var header = new byte[4];
    await ReadExactlyAsync(input, header);
    var length = BitConverter.ToInt32(header, 0);
    if (length < 0 || length > 64 * 1024 * 1024) throw new InvalidDataException("Invalid native message size.");
    var data = new byte[length];
    await ReadExactlyAsync(input, data);
    using var doc = JsonDocument.Parse(data);
    return doc.RootElement.Clone();
}

static async Task SendAsync(Stream output, object value)
{
    var data = JsonSerializer.SerializeToUtf8Bytes(value);
    if (data.Length > 1024 * 1024) throw new InvalidDataException("Response too large.");
    await output.WriteAsync(BitConverter.GetBytes(data.Length));
    await output.WriteAsync(data);
    await output.FlushAsync();
}

static async Task ReadExactlyAsync(Stream stream, byte[] buffer)
{
    var offset = 0;
    while (offset < buffer.Length)
    {
        var read = await stream.ReadAsync(buffer.AsMemory(offset));
        if (read == 0) throw new EndOfStreamException("Native messaging input closed.");
        offset += read;
    }
}

static async Task<object> InstallAsync(JsonElement request)
{
    var action = request.TryGetProperty("action", out var a) ? a.GetString() : null;
    var repository = request.TryGetProperty("repository", out var r) ? r.GetString() : null;
    var browser = request.TryGetProperty("browser", out var b) ? b.GetString() : "auto";

    if (action != "install") return new { ok = false, error = "unsupported_action" };
    if (string.IsNullOrWhiteSpace(repository) || !System.Text.RegularExpressions.Regex.IsMatch(repository, "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"))
        return new { ok = false, error = "invalid_repository" };
    if (browser is not ("edge" or "chrome" or "auto")) return new { ok = false, error = "invalid_browser" };

    var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    var candidates = new List<string>();
    var configured = Environment.GetEnvironmentVariable("EXT_INSTALL_SKILL");
    if (!string.IsNullOrWhiteSpace(configured)) candidates.Add(configured);
    candidates.Add(Path.Combine(home, "ext-install-skill", "ext-install.ps1"));
    candidates.Add(Path.Combine(home, ".local", "share", "ext-install-skill", "ext-install.ps1"));

    var script = candidates.FirstOrDefault(File.Exists);
    if (script is null) return new { ok = false, error = "ext-install.ps1 not found" };

    var psi = new ProcessStartInfo
    {
        FileName = "powershell.exe",
        UseShellExecute = false,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        CreateNoWindow = true
    };
    psi.ArgumentList.Add("-NoProfile");
    psi.ArgumentList.Add("-ExecutionPolicy");
    psi.ArgumentList.Add("Bypass");
    psi.ArgumentList.Add("-File");
    psi.ArgumentList.Add(script);
    psi.ArgumentList.Add("-Repository");
    psi.ArgumentList.Add(repository);
    psi.ArgumentList.Add("-Browser");
    psi.ArgumentList.Add(browser!);

    using var process = Process.Start(psi) ?? throw new InvalidOperationException("Could not start PowerShell.");
    var stdout = await process.StandardOutput.ReadToEndAsync();
    var stderr = await process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    var output = (stdout + stderr).Trim();
    if (output.Length > 12000) output = output[^12000..];

    return process.ExitCode == 0
        ? new { ok = true, message = $"Installed / updated {repository}.", repository, browser, output }
        : new { ok = false, error = "install_failed", exitCode = process.ExitCode, output };
}
