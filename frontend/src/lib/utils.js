/**
 * Formatea un string reemplazando guiones bajos por espacios y aplicando un formato.
 *
 * @param {string} text - Texto a formatear (ej. "columna_vertebral_espondilosis")
 * @param {string} format - 'sentence' (primera mayúscula, resto minúsculas), 'upper' (TODO MAYÚSCULAS), 'lower' (todo minúsculas), 'title' (Primera Letra De Cada Palabra Mayúscula)
 * @returns {string} Texto formateado
 */
export function formatLabel(text, format = 'sentence') {
    if (!text) return '';

    // Reemplazar guiones bajos por espacios y eliminar espacios extra
    let formatted = text.replace(/_/g, ' ').trim().replace(/\s+/g, ' ');

    switch (format) {
        case 'sentence':
            // Primera letra mayúscula, resto minúsculas
            return formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();

        case 'upper':
            return formatted.toUpperCase();

        case 'lower':
            return formatted.toLowerCase();

        case 'title':
            // Cada palabra con inicial mayúscula
            return formatted.replace(/\b\w/g, (c) => c.toUpperCase());

        default:
            return formatted;
    }
}