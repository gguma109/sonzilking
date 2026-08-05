const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf16le'); 
if(!css.includes('.calc-preview')) {
    // If not utf16le, try utf8 or whatever
    css = fs.readFileSync('css/style.css', 'utf8');
}
// Replace any '???' or corrupted emojis
css = css.replace(/content:\s*'[^']*';/g, (match) => {
    if(match.includes('???') || match.includes('')) {
        return "content: '🧮';";
    }
    return match;
});
fs.writeFileSync('css/style.css', css, 'utf8');
