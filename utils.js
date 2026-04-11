// 动态渐变背景（根据封面主色调）
export async function extractColorFromImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const pixelData = ctx.getImageData(0, 0, 1, 1).data;
            resolve(`rgb(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]})`);
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

export async function setDynamicGradient(coverUrl) {
    const color = await extractColorFromImage(coverUrl);
    if (color) {
        document.body.style.background = `radial-gradient(circle at 10% 20%, ${color}, rgba(0,0,0,0.8))`;
    }
}

// 歌词逐字解析（增强版）
export function parseWordByWordLyrics(lrcContent) {
    const lines = lrcContent.split('\n');
    const words = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (let line of lines) {
        const match = line.match(timeRegex);
        if (match) {
            const baseTime = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
            const text = line.replace(timeRegex, '').trim();
            const regex = /([\u4e00-\u9fa5a-zA-Z0-9]+)\s*\(([\d.]+)\)/g;
            let m;
            while ((m = regex.exec(text)) !== null) {
                words.push({
                    time: baseTime + parseFloat(m[2]),
                    word: m[1]
                });
            }
        }
    }
    return words;
}

// 歌词翻译（示例：使用有道翻译API，需要自行申请密钥）
export async function translateLyrics(text, targetLang = 'zh') {
    // 这里仅为占位，实际需要调用翻译API
    console.log('翻译功能需自行配置API密钥');
    return text;
}
