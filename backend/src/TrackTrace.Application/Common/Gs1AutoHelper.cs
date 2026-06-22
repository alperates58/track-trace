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

    public enum ValidationProfile
    {
        Auto,
        Gs1,
        ZnakCosmetics,
        ZnakShort,
        ZnakLightIndustry,
        None
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
        public string? ErrorType { get; set; }
        public string? SuggestedFix { get; set; }
        public string? WarningMessage { get; set; }
    }

    public static class Gs1AutoHelper
    {
        public const char GS = (char)0x1D;

        public static ParseResult NormalizeForEncoding(string rawLine, string profileStr = "Auto")
        {
            if (rawLine == null)
                return Fail("Satır null geldi.", "Boş Satır", "Yüklenen satır içeriği boş olmamalıdır.");

            string s = rawLine;
            s = RemoveLeadingBomAndInvisible(s);
            s = s.TrimEnd('\r', '\n');
            s = s.Trim(); // Trim whitespace at beginning/end only

            if (string.IsNullOrEmpty(s))
                return Fail("Satır boş.", "Boş Kod", "Kod boş veya satır boş olmamalıdır.");

            // Parse profileStr
            ValidationProfile profile = ValidationProfile.Auto;
            if (!string.IsNullOrEmpty(profileStr) && Enum.TryParse<ValidationProfile>(profileStr, true, out var parsedProfile))
            {
                profile = parsedProfile;
            }

            string interpreted = InterpretEscapeSequences(s);

            if (profile == ValidationProfile.None)
            {
                return new ParseResult
                {
                    Success = true,
                    IsGs1 = false,
                    CodeType = ParsedCodeType.NormalDataMatrix,
                    Original = rawLine,
                    Normalized = interpreted,
                    CryptoTail = interpreted
                };
            }

            // Check if there are literal text representations of GS separator
            if (interpreted.Contains("<GS>") || interpreted.Contains("\\GS") || 
                (interpreted.Contains("GS") && (interpreted.Contains(" 91") || interpreted.Contains(" 92") || interpreted.Contains(" 93") || 
                                                interpreted.Contains("<GS>91") || interpreted.Contains("<GS>92") || interpreted.Contains("<GS>93") || 
                                                interpreted.Contains("\\GS91") || interpreted.Contains("\\GS92") || interpreted.Contains("\\GS93"))))
            {
                return Fail("GS grup ayırıcı eksik veya yanlış yerde. Kodda literal olarak 'GS', '<GS>', '\\GS' veya boşluk kullanılmış olabilir.", 
                            "GS Ayırıcı Eksik", 
                            "Kodda seri numarası ile doğrulama alanları arasında gerçek GS karakteri kullanılmalıdır.");
            }

            // Let's check for spaces around AIs
            if (interpreted.Contains(" 91") || interpreted.Contains(" 92") || interpreted.Contains(" 93") || interpreted.Contains(" 21"))
            {
                return Fail("GS grup ayırıcı eksik veya yanlış yerde. Kodda boşluk kullanılmış olabilir.",
                            "GS Ayırıcı Eksik",
                            "Kodda boşluk yerine gerçek GS karakteri kullanılmalıdır.");
            }

            bool startsWithGs = interpreted.Length > 0 && interpreted[0] == GS;
            string stripped = startsWithGs ? interpreted.Substring(1) : interpreted;

            if (LooksLikeParenthesizedAi(stripped))
                stripped = ConvertParenthesizedAiToRaw(stripped);

            bool isGs1Candidate = stripped.StartsWith("01");

            if (profile == ValidationProfile.Auto && !isGs1Candidate)
            {
                return new ParseResult
                {
                    Success = true,
                    IsGs1 = false,
                    CodeType = ParsedCodeType.NormalDataMatrix,
                    Original = rawLine,
                    Normalized = interpreted,
                    CryptoTail = interpreted
                };
            }

            if (!isGs1Candidate)
            {
                return Fail("01 AI bulunamadı.", "01 AI Eksik", "Kodun başlangıcında 01 uygulama tanımlayıcısı (GTIN) bulunmalıdır.");
            }

            // At this point, it is treated as GS1. It must start with 01.
            if (stripped.Length < 16)
            {
                return Fail("GTIN 14 hane değil.", "GTIN Hatalı", "01 alanından sonra 14 haneli ürün kodu (GTIN) girilmelidir.");
            }

            string ai01 = stripped.Substring(0, 2);
            string gtin = stripped.Substring(2, 14);

            if (ai01 != "01")
            {
                return Fail("01 AI bulunamadı.", "01 AI Eksik", "Kodun başlangıcında 01 uygulama tanımlayıcısı (GTIN) bulunmalıdır.");
            }

            if (gtin.Length != 14)
            {
                return Fail("GTIN 14 hane değil.", "GTIN Hatalı", "GTIN alanı tam olarak 14 karakterden oluşmalıdır.");
            }

            if (!IsAllDigits(gtin))
            {
                return Fail("GTIN sadece rakamlardan oluşmalı.", "GTIN Sayısal Değil", "GTIN alanında harf veya özel karakter bulunmamalı, sadece rakamlar kullanılmalıdır.");
            }

            if (stripped.Length < 18 || stripped.Substring(16, 2) != "21")
            {
                return Fail("21 AI bulunamadı.", "21 AI Eksik", "GTIN alanından sonra 21 seri numarası uygulama tanımlayıcısı gelmelidir.");
            }

            string rest = stripped.Substring(18);
            if (string.IsNullOrEmpty(rest))
            {
                return Fail("Seri numarası boş.", "Seri Numarası Eksik", "21 alanından sonra boş olmayan bir seri numarası eklenmelidir.");
            }

            // Check if there are both 92 and 93
            if (rest.Contains("92") && rest.Contains("93"))
            {
                return Fail("Hem 92 hem 93 alanı var; şablon belirsiz.", "Şablon Belirsiz", "Kripto alanlarından sadece birini kullanın (ya 91+92 ya da sadece 93).");
            }

            // Split rest by GS separator (ASCII 29)
            int gsPos = rest.IndexOf(GS);
            string serial;
            string remainder;
            string? warningMessage = null;

            if (gsPos < 0)
            {
                // No GS separator
                // Under Gs1 profile or Auto profile (if no crypto fields are present), it's standard GS1
                bool hasCryptoIndicator = rest.Contains("91") || rest.Contains("92") || rest.Contains("93");
                if (profile == ValidationProfile.Gs1 || (profile == ValidationProfile.Auto && !hasCryptoIndicator))
                {
                    if (rest.Length > 20)
                    {
                        return Fail("Seri numarası 20 karakterden uzun olamaz.", "Seri Numarası Çok Uzun", "Seri numarasını kısaltın veya doğru yerde GS ayırıcı kullandığınızdan emin olun.");
                    }

                    string? warning = null;
                    if (profile == ValidationProfile.Auto)
                    {
                        warning = "Doğrulama/kripto alanları eksik olabilir.";
                    }

                    return new ParseResult
                    {
                        Success = true,
                        IsGs1 = true,
                        CodeType = ParsedCodeType.NormalDataMatrix,
                        Original = rawLine,
                        Normalized = GS + "01" + gtin + "21" + rest,
                        Gtin = gtin,
                        SerialNo = rest,
                        WarningMessage = warning
                    };
                }

                // If Znak profile or Auto profile with crypto indicator, GS separator is missing!
                // Try to split automatically if crypto indicator is present
                int splitPos = FindMissingGsSplitPosition(rest, profile);

                if (splitPos > 0)
                {
                    serial = rest.Substring(0, splitPos);
                    remainder = rest.Substring(splitPos);
                    warningMessage = "GS grup ayırıcı eksik. Kod otomatik düzeltildi (GS ayırıcı eklendi).";
                }
                else
                {
                    return Fail("21 seri numarasından sonra 91/92/93 alanlarına geçişte GS grup ayırıcı bulunamadı.",
                                "GS Ayırıcı Eksik",
                                "Kodda seri numarası ile doğrulama alanları arasında gerçek GS karakteri kullanılmalıdır.");
                }
            }
            else
            {
                serial = rest.Substring(0, gsPos);
                remainder = rest.Substring(gsPos + 1);
            }

            if (string.IsNullOrEmpty(serial))
            {
                return Fail("Seri numarası boş.", "Seri Numarası Eksik", "21 alanından sonra boş olmayan bir seri numarası eklenmelidir.");
            }

            // Validate serial length
            if (profile == ValidationProfile.ZnakCosmetics || profile == ValidationProfile.ZnakShort)
            {
                if (serial.Length != 6)
                {
                    return Fail("Seri numarası beklenen uzunlukta değil (Kozmetik için 6 karakter olmalıdır).",
                                "Seri Numarası Uzunluğu Hatalı",
                                "Seri numarasını 6 karakter olacak şekilde düzenleyin.");
                }
            }
            else if (profile == ValidationProfile.ZnakLightIndustry)
            {
                if (serial.Length != 13)
                {
                    return Fail("Seri numarası beklenen uzunlukta değil (Hafif Sanayi için 13 karakter olmalıdır).",
                                "Seri Numarası Uzunluğu Hatalı",
                                "Seri numarasını 13 karakter olacak şekilde düzenleyin.");
                }
            }
            else if (profile == ValidationProfile.Auto)
            {
                if (remainder.StartsWith("93"))
                {
                    if (serial.Length != 6)
                    {
                        return Fail("Seri numarası beklenen uzunlukta değil (Kozmetik Kısa şablonu için 6 karakter olmalıdır).",
                                    "Seri Numarası Uzunluğu Hatalı",
                                    "Seri numarasını 6 karakter olacak şekilde düzenleyin.");
                    }
                }
                else if (remainder.StartsWith("91"))
                {
                    if (serial.Length != 6 && serial.Length != 13)
                    {
                        return Fail("Seri numarası beklenen uzunlukta değil (Kozmetik için 6, Hafif Sanayi için 13 karakter olmalıdır).",
                                    "Seri Numarası Uzunluğu Hatalı",
                                    "Seri numarasını 6 veya 13 karakter olacak şekilde düzenleyin.");
                    }
                }
            }

            // Validate fields after serial
            if (remainder.StartsWith("93"))
            {
                if (profile == ValidationProfile.ZnakCosmetics || profile == ValidationProfile.ZnakLightIndustry)
                {
                    return Fail("Kod yapısı seçilen şablonla eşleşmiyor (Kısa şablon 93 alanı tespit edildi).",
                                "Şablon Eşleşmedi",
                                "Doğrulama profilini 'Kısa Şablon' veya 'Otomatik Algıla' olarak değiştirin.");
                }

                string crypto = remainder.Substring(2);
                if (crypto.Contains(GS.ToString()))
                {
                    return Fail("93 alanından sonra beklenmeyen veri veya GS ayırıcı var.",
                                "Kripto Kod Geçersiz",
                                "93 kripto alanından sonra herhangi bir veri bulunmamalıdır.");
                }

                if (string.IsNullOrEmpty(crypto))
                {
                    return Fail("93 alanı var ancak kripto kod boş.",
                                "Kripto Kod Eksik",
                                "93 alanından sonra 4 karakterli kripto kodu ekleyin.");
                }

                if (crypto.Length != 4)
                {
                    return Fail("Kripto kod beklenen uzunlukta değil (Kısa şablon için 4 karakter olmalıdır).",
                                "Kripto Kod Uzunluğu Hatalı",
                                "Kripto kod uzunluğunu kontrol edin, tam olarak 4 karakter olmalıdır.");
                }

                return new ParseResult
                {
                    Success = true,
                    IsGs1 = true,
                    CodeType = ParsedCodeType.Gs1Short_01_21_93,
                    Original = rawLine,
                    Normalized = GS + "01" + gtin + "21" + serial + GS + "93" + crypto,
                    Gtin = gtin,
                    SerialNo = serial,
                    CryptoTail = "93" + crypto,
                    WarningMessage = warningMessage
                };
            }
            else if (remainder.StartsWith("91"))
            {
                if (profile == ValidationProfile.ZnakShort)
                {
                    return Fail("Kod yapısı seçilen şablonla eşleşmiyor (Standart 91 alanı tespit edildi).",
                                "Şablon Eşleşmedi",
                                "Doğrulama profilini 'Kozmetik / Ev Kimyasalları' veya 'Otomatik Algıla' olarak değiştirin.");
                }

                string restAfter91 = remainder.Substring(2);
                int gs2Pos = restAfter91.IndexOf(GS);
                if (gs2Pos < 0)
                {
                    if (restAfter91.Contains("92"))
                    {
                        return Fail("91 doğrulama anahtarından sonra 92 alanına geçişte GS grup ayırıcı olmadığından format hatalı.",
                                    "GS Ayırıcı Eksik",
                                    "91 doğrulama anahtarı ile 92 kripto alanı arasına gerçek GS karakteri yerleştirilmelidir.");
                    }
                    else
                    {
                        return Fail("91 alanı var ama 92 alanı yok.",
                                    "92 AI Eksik",
                                    "Kodun sonuna 92 uygulama tanımlayıcısı ve kripto kod eklenmelidir.");
                    }
                }

                string v91 = restAfter91.Substring(0, gs2Pos);
                string after91 = restAfter91.Substring(gs2Pos + 1);

                if (string.IsNullOrEmpty(v91))
                {
                    return Fail("91 alanı var ancak doğrulama anahtarı boş.",
                                "Doğrulama Anahtarı Eksik",
                                "91 alanından sonra 4 karakterli doğrulama anahtarını ekleyin.");
                }

                if (v91.Length != 4)
                {
                    return Fail("91 doğrulama anahtarı beklenen uzunlukta değil (4 karakter olmalıdır).",
                                "Doğrulama Anahtarı Uzunluğu Hatalı",
                                "Doğrulama anahtarı uzunluğunu kontrol edin, tam olarak 4 karakter olmalıdır.");
                }

                if (!after91.StartsWith("92"))
                {
                    return Fail("91 alanından sonra 92 alanı bekleniyor.",
                                "92 AI Eksik",
                                "Doğrulama anahtarından sonra 92 uygulama tanımlayıcısı ile devam edin.");
                }

                string crypto = after91.Substring(2);
                if (string.IsNullOrEmpty(crypto))
                {
                    return Fail("92 alanı var ancak kripto kod boş.",
                                "Kripto Kod Eksik",
                                "92 alanından sonra 44 karakterli kripto kodu ekleyin.");
                }

                if (crypto.Length != 44)
                {
                    return Fail("Kripto kod beklenen uzunlukta değil (Standart şablon için 44 karakter olmalıdır).",
                                "Kripto Kod Uzunluğu Hatalı",
                                "Kripto kod uzunluğunu kontrol edin, tam olarak 44 karakter olmalıdır.");
                }

                return new ParseResult
                {
                    Success = true,
                    IsGs1 = true,
                    CodeType = ParsedCodeType.Gs1Long_01_21_91_92,
                    Original = rawLine,
                    Normalized = GS + "01" + gtin + "21" + serial + GS + "91" + v91 + GS + "92" + crypto,
                    Gtin = gtin,
                    SerialNo = serial,
                    CryptoTail = "91" + v91 + GS + "92" + crypto,
                    WarningMessage = warningMessage
                };
            }
            else if (remainder.StartsWith("92"))
            {
                return Fail("92 alanı bulundu ancak 91 doğrulama anahtarı eksik.",
                            "91 AI Eksik",
                            "Standart şablonda 91 ve 92 alanları birlikte bulunmalıdır.");
            }

            return Fail("Kod yapısı PDF’teki desteklenen şablonlarla eşleşmiyor.",
                        "Şablon Uyuşmazlığı",
                        "Kripto alanları için 91+92 veya 93 uygulama tanımlayıcılarını kullanın.");
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

        private static int FindMissingGsSplitPosition(string rest, ValidationProfile profile)
        {
            if (string.IsNullOrEmpty(rest))
                return -1;

            if ((profile == ValidationProfile.Auto || profile == ValidationProfile.ZnakShort) &&
                rest.Length == 12 &&
                rest.Substring(6, 2) == "93")
            {
                return 6;
            }

            if ((profile == ValidationProfile.Auto || profile == ValidationProfile.ZnakCosmetics) &&
                rest.Length > 12 &&
                rest.Substring(6).StartsWith("91"))
            {
                return 6;
            }

            if ((profile == ValidationProfile.Auto || profile == ValidationProfile.ZnakLightIndustry) &&
                rest.Length > 19 &&
                rest.Substring(13).StartsWith("91"))
            {
                return 13;
            }

            string[] possibleAis = { "91", "92", "93" };
            int splitPos = -1;
            foreach (var ai in possibleAis)
            {
                int idx = rest.IndexOf(ai, StringComparison.Ordinal);
                if (idx > 0 && (splitPos == -1 || idx < splitPos))
                    splitPos = idx;
            }

            return splitPos;
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

        public static string ExtractSscc(string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return query;
            
            query = query.Trim();

            int idx = query.IndexOf("[00]");
            if (idx >= 0 && query.Length >= idx + 4 + 18)
            {
                return query.Substring(idx + 4, 18);
            }

            idx = query.IndexOf("(00)");
            if (idx >= 0 && query.Length >= idx + 4 + 18)
            {
                return query.Substring(idx + 4, 18);
            }

            if (query.Contains("|"))
            {
                var parts = query.Split('|');
                foreach (var part in parts)
                {
                    if (part.StartsWith("[00]") && part.Length >= 22)
                        return part.Substring(4, 18);
                    if (part.StartsWith("(00)") && part.Length >= 22)
                        return part.Substring(4, 18);
                }
            }

            var match20 = System.Text.RegularExpressions.Regex.Match(query, @"\b00(\d{18})\b");
            if (match20.Success)
            {
                return match20.Groups[1].Value;
            }

            var match = System.Text.RegularExpressions.Regex.Match(query, @"\b\d{18}\b");
            if (match.Success)
            {
                return match.Value;
            }

            return query;
        }

        private static ParseResult Fail(string msg, string errorType = "Geçersiz Barkod", string suggestedFix = "")
        {
            return new ParseResult
            {
                Success = false,
                ErrorMessage = msg,
                ErrorType = errorType,
                SuggestedFix = suggestedFix
            };
        }
    }
}
