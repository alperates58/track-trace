export function fixBarcodeKeyboardLayout(code: string): string {
  // Harita: TR klavye düzeninde basılan tuşun US klavyedeki karşılığı
  // Barkod tabancaları US düzeninde gönderir, ancak PC TR düzenindeyse 
  // tuş vuruşları yanlış yorumlanır. Bu fonksiyon bunu geri çevirir.
  const charMap: Record<string, string> = {
    'ı': 'i',
    'I': 'I',
    'ş': ';',
    'Ş': ':',
    'ğ': '[',
    'Ğ': '{',
    'ü': ']',
    'Ü': '}',
    'i': '\'',
    'İ': '"',
    'ç': '/',
    'Ç': '?',
    '\'': '@',
    '^': '#',
    '+': '$',
    '&': '^',
    '/': '&',
    '(': '*',
    ')': '(',
    '=': ')',
    '*': '-',
    '?': '_',
    '-': '=',
    '_': '+'
  };

  let fixed = '';
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    fixed += charMap[char] || char;
  }
  return fixed;
}
