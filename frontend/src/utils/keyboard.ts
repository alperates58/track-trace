export function fixBarcodeKeyboardLayout(code: string): string {
  // Harita: TR klavye düzeninde basılan tuşun US klavyedeki karşılığı
  // Barkod tabancaları US düzeninde gönderir, ancak PC TR düzenindeyse 
  // tuş vuruşları yanlış yorumlanır. Bu fonksiyon bunu geri çevirir.
  const charMap: Record<string, string> = {
    // 2. Satır (Row 2)
    'ğ': '[',
    'Ğ': '{',
    'ü': ']',
    'Ü': '}',

    // 3. Satır (Row 3)
    'ş': ';',
    'Ş': ':',
    'i': '\'',
    'İ': '"',

    // 4. Satır (Row 4)
    'ö': ',',
    'Ö': '<',
    'ç': '.',
    'Ç': '>',
    '.': '/',  
    ':': '?',  

    // Sayı Satırı (Number Row Shifted)
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
    '_': '+',   

    // Harfler
    'ı': 'i',
    'I': 'I'
  };

  let fixed = '';
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    fixed += charMap[char] || char;
  }
  return fixed;
}
