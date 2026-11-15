using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

namespace MarmitexSocialPrototipo
{
    internal static class Program
    {
        private const string VercelPrototipoUrl = "https://client-one-theta-55.vercel.app/prototipo.html";
        private const string VercelAppUrl = "https://client-one-theta-55.vercel.app/";
        private const string EmbeddedResourceName = "prototipo.html";

        [DllImport("kernel32.dll")]
        private static extern bool AttachConsole(int dwProcessId);

        [STAThread]
        private static int Main(string[] args)
        {
            ServicePointManager.SecurityProtocol =
                (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;

            bool forceOffline = HasArg(args, "--offline") || HasArg(args, "--local");
            bool openFullApp = HasArg(args, "--app");
            bool checkOnly = HasArg(args, "--check");

            if (checkOnly)
            {
                AttachConsole(-1);
                string html = ReadEmbeddedHtml();
                bool vercelReachable = IsUrlReachable(VercelPrototipoUrl, 3500);
                string browser = FindAppBrowser();
                Console.WriteLine(string.Format(
                    "embeddedBytes={0};vercelReachable={1};browser={2}",
                    html != null ? html.Length : 0,
                    vercelReachable,
                    browser ?? "default"
                ));
                return (html != null && html.Length > 1000) ? 0 : 1;
            }

            string targetUrl;
            if (openFullApp)
            {
                targetUrl = VercelAppUrl;
            }
            else if (!forceOffline && IsUrlReachable(VercelPrototipoUrl, 3000))
            {
                targetUrl = VercelPrototipoUrl;
            }
            else
            {
                string localPath = ExtractEmbeddedHtml();
                if (string.IsNullOrEmpty(localPath))
                {
                    targetUrl = VercelPrototipoUrl;
                }
                else
                {
                    targetUrl = new Uri(localPath).AbsoluteUri;
                }
            }

            LaunchUrl(targetUrl);
            return 0;
        }

        private static bool HasArg(string[] args, string flag)
        {
            if (args == null) return false;
            foreach (string arg in args)
            {
                if (string.Equals(arg, flag, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private static bool IsUrlReachable(string url, int timeoutMs)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "HEAD";
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                req.AllowAutoRedirect = true;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    int code = (int)res.StatusCode;
                    return code >= 200 && code < 400;
                }
            }
            catch
            {
                return false;
            }
        }

        private static string ReadEmbeddedHtml()
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream stream = asm.GetManifestResourceStream(EmbeddedResourceName))
            {
                if (stream == null) return null;
                using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                {
                    return reader.ReadToEnd();
                }
            }
        }

        private static string ExtractEmbeddedHtml()
        {
            try
            {
                string html = ReadEmbeddedHtml();
                if (string.IsNullOrEmpty(html)) return null;
                string appDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "MarmitexSocial"
                );
                Directory.CreateDirectory(appDir);
                string outFile = Path.Combine(appDir, "prototipo.html");
                File.WriteAllText(outFile, html, Encoding.UTF8);
                return outFile;
            }
            catch
            {
                return null;
            }
        }

        private static void LaunchUrl(string targetUrl)
        {
            string browser = FindAppBrowser();
            if (!string.IsNullOrEmpty(browser))
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = browser;
                psi.Arguments = string.Format("--app=\"{0}\" --window-size=1280,860", targetUrl);
                psi.UseShellExecute = false;
                Process.Start(psi);
                return;
            }

            ProcessStartInfo fallback = new ProcessStartInfo(targetUrl);
            fallback.UseShellExecute = true;
            Process.Start(fallback);
        }

        private static string FindAppBrowser()
        {
            string[] regKeys = new[]
            {
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
            };

            foreach (string subKey in regKeys)
            {
                foreach (RegistryHive hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
                {
                    try
                    {
                        using (RegistryKey baseKey = RegistryKey.OpenBaseKey(hive, RegistryView.Default))
                        using (RegistryKey key = baseKey.OpenSubKey(subKey))
                        {
                            if (key != null)
                            {
                                object val = key.GetValue(null);
                                if (val != null)
                                {
                                    string path = val.ToString().Trim().Trim('"');
                                    if (File.Exists(path)) return path;
                                }
                            }
                        }
                    }
                    catch
                    {
                        // Ignore inaccessible registry hive
                    }
                }
            }

            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[] candidates = new[]
            {
                Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(localApp, @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string candidate in candidates)
            {
                if (!string.IsNullOrEmpty(candidate) && File.Exists(candidate))
                {
                    return candidate;
                }
            }

            return null;
        }
    }
}
