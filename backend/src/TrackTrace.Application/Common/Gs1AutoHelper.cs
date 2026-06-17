using System;
using System.Linq;
using System.Text;

namespace TrackTrace.Application.Common
{
    public enum ParsedCodeType
    {
        NormalDataMatrix,
        Gs1Unknown,
        Gs1Long_01_21_91_92,
        Gs1Short_01_21_93
    }

    public sealed class ParseResult
    {
        public bool Success { get; set; }
        public bool IsGs1 { get; set; }
        public ParsedCodeType CodeType { get; set; }
        public string Original { get; set; } = string.Empty;
        public string Normalized { get; set; } = string.Empty;
        public string? ErrorMessage { get; set; }
        public string? Gtin { get; set; }
        public string? SerialNo { get; set; }
        public string? CryptoTail { get; set; }
    }

    public static class Gs1AutoHelper
    {
        public const char GS = (char)0x1D;

        public static ParseResult NormalizeForEncodingOrBypassValidation(string rawLine)
        {
            var strictResult = NormalizeForEncoding(rawLine);
            if (strictResult.Success)
                return strictResult;

            string s = PrepareRawForParsing(rawLine);
            if (string.IsNullOrWhiteSpace(s))
                return strictResult;

            bool startsWithGs = s.Length > 0 && s[0] == GS;
            if (startsWithGs)
                s = s.Substring(1);

            if (LooksLikeParenthesizedAi(s))
                s = ConvertParenthesizedAiToRaw(s);

            bool looksLikeGs1 = s.StartsWith("01") && s.Length >= 16;
            if (!looksLikeGs1)
                return strictResult;

            string gtin = SafeSubstring(s, 2, 14);
            if (!IsAllDigits(gtin) || gtin.Length != 14)
                return strictResult;

            return new ParseResult
            {
                Success = true,
                IsGs1 = true,
                CodeType = ParsedCodeType.Gs1Unknown,
                Original = rawLine,
                Normalized = GS + s,
                Gtin = gtin,
                CryptoTail = s.Length > 16 ? s.Substring(16) : string.Empty
            };
        }

        public static ParseResult NormalizeForEncoding(string rawLine)
        {
            if (rawLine == null)
                return Fail("Satır null geldi.");

            string s = PrepareRawForParsing(rawLine);

            if (string.IsNullOrWhiteSpace(s))
                return Fail("Satır boş.");

            bool startsWithGs = s.Length > 0 && s[0] == GS;
            if (startsWithGs)
                s = s.Substring(1);

            if (LooksLikeParenthesizedAi(s))
                s = ConvertParenthesizedAiToRaw(s);

            bool has01 = s.StartsWith("01");
            if (!has01)
            {
                return new ParseResult
                {
                    Success = true,
                    IsGs1 = false,
                    CodeType = ParsedCodeType.NormalDataMatrix,
                    Original = rawLine,
                    Normalized = s,
                    CryptoTail = s
                };
            }

            if (s.Length < 16)
                return Fail("GS1 gibi görünüyor ama 01 alanı tamamlanmamış.");

            string ai01 = SafeSubstring(s, 0, 2);
            string gtin = SafeSubstring(s, 2, 14);

            if (ai01 != "01")
                return Fail("GS1 veri 01 ile başlamalı.");

            if (!IsAllDigits(gtin) || gtin.Length != 14)
                return Fail("01 alanından sonra 14 haneli GTIN gelmeli.");

            string rest = s.Substring(16);

            if (string.IsNullOrEmpty(rest))
                return Fail("01 alanı var ama devamında en az 21 alanı bekleniyor.");

            if (!rest.StartsWith("21"))
                return Fail("01 alanından sonra 21 alanı bekleniyor.");

            string serial;
            string after21;
            ExtractVariableAiBody(rest, "21", new[] { "91", "92", "93" }, out serial, out after21);

            if (string.IsNullOrWhiteSpace(serial))
                return Fail("21 seri alanı boş.");

            if (after21.StartsWith("91"))
            {
                string v91;
                string after91;
                ExtractVariableAiBody(after21, "91", new[] { "92", "93" }, out v91, out after91);

                if (string.IsNullOrWhiteSpace(v91))
                    return Fail("91 alanı boş.");

                // SADECE uzun yapı geçerli: 91 + 92
                if (after91.StartsWith("92"))
                {
                    string v92;
                    string after92;
                    ExtractVariableAiBody(after91, "92", Array.Empty<string>(), out v92, out after92);

                    if (string.IsNullOrWhiteSpace(v92))
                        return Fail("92 alanı boş.");

                    if (!string.IsNullOrEmpty(after92))
                        return Fail("92 alanından sonra beklenmeyen veri var.");

                    string normalized = "01" + gtin + "21" + serial + GS + "91" + v91 + GS + "92" + v92;

                    return new ParseResult
                    {
                        Success = true,
                        IsGs1 = true,
                        CodeType = ParsedCodeType.Gs1Long_01_21_91_92,
                        Original = rawLine,
                        Normalized = GS + normalized,
                        Gtin = gtin,
                        SerialNo = serial,
                        CryptoTail = "91" + v91 + GS + "92" + v92
                    };
                }

                return Fail("Geçersiz GS1 yapı: 21'den sonra 91 geldi ancak 92 yok. Kısa yapıda 93 kullanılmalı, uzun yapıda ise 91'den sonra 92 gelmelidir.");
            }

            if (after21.StartsWith("93"))
            {
                string v93;
                string after93;
                ExtractVariableAiBody(after21, "93", Array.Empty<string>(), out v93, out after93);

                if (string.IsNullOrWhiteSpace(v93))
                    return Fail("93 alanı boş.");

                if (!string.IsNullOrEmpty(after93))
                    return Fail("93 alanından sonra beklenmeyen veri var.");

                string normalized = "01" + gtin + "21" + serial + GS + "93" + v93;

                return new ParseResult
                {
                    Success = true,
                    IsGs1 = true,
                    CodeType = ParsedCodeType.Gs1Short_01_21_93,
                    Original = rawLine,
                    Normalized = GS + normalized,
                    Gtin = gtin,
                    SerialNo = serial,
                    CryptoTail = "93" + v93
                };
            }

            return Fail("Geçersiz GS1 yapı: 21 alanından sonra 93 (kısa) veya 91+92 (uzun) bekleniyor.");
        }

        private static void ExtractVariableAiBody(string source, string ai, string[] nextPossibleAis, out string body, out string remainder)
        {
            body = "";
            remainder = "";

            if (!source.StartsWith(ai))
                return;

            string s = source.Substring(ai.Length);

            int gsPos = s.IndexOf(GS);
            if (gsPos >= 0)
            {
                body = s.Substring(0, gsPos);
                remainder = s.Substring(gsPos + 1);
                return;
            }

            int minPos = -1;
            foreach (var nextAi in nextPossibleAis)
            {
                int p = s.IndexOf(nextAi, StringComparison.Ordinal);
                if (p > 0)
                {
                    if (minPos == -1 || p < minPos)
                        minPos = p;
                }
            }

            if (minPos >= 0)
            {
                body = s.Substring(0, minPos);
                remainder = s.Substring(minPos);
                return;
            }

            body = s;
            remainder = "";
        }

        private static bool LooksLikeParenthesizedAi(string s)
        {
            return s.Contains("(01)") || s.Contains("(21)") || s.Contains("(91)") || s.Contains("(92)") || s.Contains("(93)");
        }

        private static string ConvertParenthesizedAiToRaw(string s)
        {
            return s.Replace("(01)", "01")
                    .Replace("(21)", "21")
                    .Replace("(91)", "91")
                    .Replace("(92)", "92")
                    .Replace("(93)", "93")
                    .Trim();
        }

        private static string RemoveLeadingBomAndInvisible(string s)
        {
            if (string.IsNullOrEmpty(s))
                return s;

            while (s.Length > 0 &&
                  (s[0] == '\uFEFF' || s[0] == '\u200B' || s[0] == '\u0000' || char.IsWhiteSpace(s[0])))
            {
                s = s.Substring(1);
            }

            return s;
        }

        private static string InterpretEscapeSequences(string text)
        {
            if (string.IsNullOrEmpty(text))
                return text;

            var sb = new StringBuilder(text.Length);

            for (int i = 0; i < text.Length; i++)
            {
                char ch = text[i];
                if (ch == '\\' && i + 1 < text.Length)
                {
                    char n = text[i + 1];
                    if (n == 'F')
                    {
                        sb.Append(GS);
                        i++;
                        continue;
                    }
                    if (n == 'n')
                    {
                        sb.Append('\n');
                        i++;
                        continue;
                    }
                    if (n == 't')
                    {
                        sb.Append('\t');
                        i++;
                        continue;
                    }
                    if (n == '\\')
                    {
                        sb.Append('\\');
                        i++;
                        continue;
                    }
                }

                sb.Append(ch);
            }

            return sb.ToString();
        }

        private static string SafeSubstring(string s, int start, int len)
        {
            if (string.IsNullOrEmpty(s) || start >= s.Length)
                return "";

            if (start + len > s.Length)
                return s.Substring(start);

            return s.Substring(start, len);
        }

        private static bool IsAllDigits(string s)
        {
            return !string.IsNullOrEmpty(s) && s.All(char.IsDigit);
        }

        private static ParseResult Fail(string msg)
        {
            return new ParseResult
            {
                Success = false,
                ErrorMessage = msg
            };
        }

        private static string PrepareRawForParsing(string rawLine)
        {
            if (rawLine == null)
                return string.Empty;

            string s = rawLine;
            s = RemoveLeadingBomAndInvisible(s);
            s = s.TrimEnd('\r', '\n');
            s = InterpretEscapeSequences(s);
            return s;
        }
    }
}
