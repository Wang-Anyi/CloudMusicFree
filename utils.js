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
            // 取左上角第一个像素颜色（可优化为取平均色）
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

// 歌词逐字解析（网易云逐字歌词格式）
export function parseWordByWordLyrics(lrcContent) {
    const lines = lrcContent.split('\n');
    const words = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (let line of lines) {
        const match = line.match(timeRegex);
        if (match) {
            const baseTime = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
            const text = line.replace(timeRegex, '').trim();
            // 匹配格式：字 (持续时间) 如：我 (0.3) 的 (0.5) 爱 (0.4) 你 (0.2)
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
// 实际使用时请替换为自己的API密钥
export async function translateLyrics(text, targetLang = 'zh') {
    // 这里仅为占位，实际需要调用翻译API
    // 示例：调用有道翻译 https://fanyi.youdao.com/openapi.do
    console.log('翻译功能需自行配置API密钥');
    return text;
}

// 离线缓存音乐（使用IndexedDB）
const DB_NAME = 'MusicCacheDB';
const STORE_NAME = 'songs';
let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
    return dbPromise;
}

export async function cacheSong(songId, blob) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await store.put({ id: songId, blob, timestamp: Date.now() });
    return tx.complete;
}

export async function getCachedSong(songId) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await store.get(songId);
    return result ? result.blob : null;
}

// 错误日志上报（存储到localStorage）
export function logError(error, context) {
    const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
    logs.push({
        time: new Date().toISOString(),
        error: error.message || error,
        context: context,
        stack: error.stack
    });
    // 保留最近50条
    while (logs.length > 50) logs.shift();
    localStorage.setItem('errorLogs', JSON.stringify(logs));
}

// 分享功能（生成截图并下载）
export async function shareSong(songName, artist, coverUrl) {
    const element = document.createElement('div');
    element.style.position = 'fixed';
    element.style.top = '-9999px';
    element.style.width = '400px';
    element.style.background = 'white';
    element.style.padding = '20px';
    element.style.textAlign = 'center';
    element.style.borderRadius = '20px';
    element.innerHTML = `
        <img src="${coverUrl}" width="200" height="200" style="border-radius:20px">
        <h2 style="margin:10px 0">${songName}</h2>
        <p>${artist}</p>
        <p style="margin-top:10px">🎵 云音匣 · 正在播放</p>
    `;
    document.body.appendChild(element);
    try {
        const canvas = await html2canvas(element);
        const dataUrl = canvas.toDataURL();
        const link = document.createElement('a');
        link.download = `${songName}-分享.png`;
        link.href = dataUrl;
        link.click();
    } catch (e) {
        console.error('分享截图失败', e);
    }
    document.body.removeChild(element);
}
