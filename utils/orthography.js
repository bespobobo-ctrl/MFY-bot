/**
 * CLEAN SCRIPT ENGINE v2.0
 */
class Orthography {
    constructor() {
        this.ghostMap = {
            'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'x': 'х', 'c': 'с', 'y': 'у',
            'A': 'А', 'E': 'Е', 'O': 'О', 'P': 'Р', 'X': 'Х', 'C': 'С', 'Y': 'У'
        };

        this.translitMap = {
            "O'": "Ў", "o'": "ў", "G'": "Ғ", "g'": "ғ", "Sh": "Ш", "sh": "ш", "Ch": "Ч", "ch": "ч",
            "Yo": "Ё", "yo": "ё", "Yu": "Ю", "yu": "ю", "Ya": "Я", "ya": "я", "Ye": "Е", "ye": "е",
            'A': 'А', 'B': 'Б', 'V': 'В', 'G': 'Г', 'D': 'Д', 'E': 'Е', 'J': 'Ж', 'Z': 'З', 'I': 'И', 'Y': 'Й',
            'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О', 'P': 'П', 'R': 'Р', 'S': 'С', 'T': 'Т', 'U': 'У',
            'F': 'Ф', 'X': 'Х', 'H': 'Ҳ', 'Q': 'Қ', 'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е',
            'j': 'ж', 'z': 'з', 'i': 'и', 'y': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п',
            'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'f': 'ф', 'x': 'х', 'h': 'ҳ', 'q': 'қ', "'": 'ъ'
        };

        this.professionalDict = {
            "ердам": "ёрдам",
            "Ердам": "Ёрдам",
            "кумак": "кўмак",
            "Кумак": "Кўмак",
            "тўландирилди": "тўлдирилdi", // Note: intentional fix logic
            "якин": "яқин"
        };
    }

    latinToCyrillic(text) {
        if (!text || typeof text !== 'string') return text;
        let res = text;
        const keys = Object.keys(this.translitMap).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            const regex = new RegExp(key.replace("'", "\\'"), 'g');
            res = res.replace(regex, this.translitMap[key]);
        }
        return res;
    }

    cleanCyrillic(text) {
        if (!text) return "";
        let res = text;

        // 1. Ghost Latin Purge
        for (const [lat, cyr] of Object.entries(this.ghostMap)) {
            res = res.replace(new RegExp(lat, 'g'), cyr);
        }

        // 2. Pro Dictionary Polish
        for (const [wrong, right] of Object.entries(this.professionalDict)) {
            res = res.replace(new RegExp(wrong, 'g'), right);
        }

        return res;
    }

    /**
     * Matnni oxirgi to'liq gapda kesish (limit bo'yicha)
     */
    trimToLimit(text, maxLen) {
        if (!maxLen || !text || text.length <= maxLen) return text;
        // Oxirgi to'liq gapda kesish
        const trimmed = text.substring(0, maxLen);
        const lastDot = Math.max(trimmed.lastIndexOf('.'), trimmed.lastIndexOf('!'), trimmed.lastIndexOf('?'));
        if (lastDot > maxLen * 0.5) {
            return trimmed.substring(0, lastDot + 1);
        }
        return trimmed.trim();
    }

    sanitize(text, lang, maxLen = 0) {
        let result = text;
        if (lang === 'cyrillic') {
            result = this.cleanCyrillic(this.latinToCyrillic(result));
        }
        if (maxLen > 0) {
            result = this.trimToLimit(result, maxLen);
        }
        return result;
    }
}

module.exports = new Orthography();
