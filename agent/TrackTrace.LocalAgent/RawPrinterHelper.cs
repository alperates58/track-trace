using System;
using System.IO;
using System.Runtime.InteropServices;

namespace TrackTrace.LocalAgent
{
    public static class RawPrinterHelper
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
        }

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

        public static void SendStringToPrinter(string szPrinterName, string szString)
        {
            IntPtr pBytes = IntPtr.Zero;
            IntPtr hPrinter = IntPtr.Zero;
            try
            {
                int dwCount = szString.Length;
                pBytes = Marshal.StringToCoTaskMemAnsi(szString);

                DOCINFOA di = new DOCINFOA();
                di.pDocName = "TrackTrace ZPL Document";
                di.pDataType = "RAW";

                if (!OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
                {
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception($"OpenPrinter failed for printer '{szPrinterName}' with error {err}");
                }

                if (!StartDocPrinter(hPrinter, 1, di))
                {
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception($"StartDocPrinter failed with error {err}");
                }

                if (!StartPagePrinter(hPrinter))
                {
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception($"StartPagePrinter failed with error {err}");
                }

                int dwWritten = 0;
                if (!WritePrinter(hPrinter, pBytes, dwCount, out dwWritten))
                {
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception($"WritePrinter failed with error {err}");
                }

                if (!EndPagePrinter(hPrinter))
                {
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception($"EndPagePrinter failed with error {err}");
                }

                if (!EndDocPrinter(hPrinter))
                {
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception($"EndDocPrinter failed with error {err}");
                }
            }
            finally
            {
                if (hPrinter != IntPtr.Zero)
                {
                    ClosePrinter(hPrinter);
                }
                if (pBytes != IntPtr.Zero)
                {
                    Marshal.FreeCoTaskMem(pBytes);
                }
            }
        }
    }
}
