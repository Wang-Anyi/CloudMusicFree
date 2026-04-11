// 错误日志上报（存储到localStorage）
export function logError(error, context) {
  const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
  logs.push({
    time: new Date().toISOString(),
    error: error.message || error,
    context: context,
    stack: error.stack
  });
  while (logs.length > 50) logs.shift();
  localStorage.setItem('errorLogs', JSON.stringify(logs));
}

// 离线缓存音乐（使用IndexedDB）
const dbPromise = idb.openDB('MusicCache', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('songs')) {
      db.createObjectStore('songs', { keyPath: 'id' });
    }
  }
});
export async function cacheSong(songId, blob) {
  const db = await dbPromise;
  await db.put('songs', { id: songId, blob, timestamp: Date.now() });
}
export async function getCachedSong(songId) {
  const db = await dbPromise;
  return await db.get('songs', songId);
}

// 动态渐变背景（根据封面颜色）
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

// 歌词逐字解析（网易云逐字歌词格式）
export function parseWordByWordLyrics(lrcContent) {
  const lines = lrcContent.split('\n');
  const words = [];
  for (let line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);
    if (match) {
      const time = parseInt(match[1])*60 + parseInt(match[2]) + parseInt(match[3])/100;
      const text = line.replace(/\[.*?\]/g, '').trim();
      const wordPattern = /([\u4e00-\u9fa5a-zA-Z0-9]+)\s*\(([\d.]+)\)/g;
      let matchWord;
      while ((matchWord = wordPattern.exec(text)) !== null) {
        words.push({
          time: time + parseFloat(matchWord[2]),
          word: matchWord[1]
        });
      }
    }
  }
  return words;
}

// 分享功能（生成截图并分享）
export async function shareSong(songName, artist, coverUrl) {
  const element = document.createElement('div');
  element.style.position = 'fixed';
  element.style.top = '-9999px';
  element.style.width = '400px';
  element.style.background = 'white';
  element.style.padding = '20px';
  element.style.textAlign = 'center';
  element.innerHTML = `
    <img src="${coverUrl}" width="200" height="200" style="border-radius:20px">
    <h2>${songName}</h2>
    <p>${artist}</p>
    <p>🎵 云音匣 · 正在播放</p>
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
