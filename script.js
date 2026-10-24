const { createApp, ref, onMounted, nextTick, computed, watch } = Vue;

/* ============================================================
   动态渐变背景（保留原有）
   ============================================================ */
const extractColorFromImage = (url) => {
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
};
const setDynamicGradient = async (coverUrl) => {
    if (!coverUrl || !coverUrl.startsWith('http')) return;
    const color = await extractColorFromImage(coverUrl);
    if (color) {
        document.body.style.background = `radial-gradient(circle at 10% 20%, ${color}, rgba(0,0,0,0.8))`;
    }
};

/* ============================================================
   多 API 配置（区分 meting / netease 风格）
   ============================================================ */
const API_PROVIDERS = [
    { base: 'https://csm.sayqz.com/api/',               style: 'meting' },
    { base: 'https://api.i-meto.com/meting/api',        style: 'meting' },
    { base: 'https://api.injahow.cn/meting/',           style: 'meting' },
    { base: 'https://meting-api-pi-one.vercel.app/api', style: 'meting' },
    { base: 'https://api.liyefeng.top',                 style: 'netease' },
    { base: 'https://ncm.zhenxin.me',                   style: 'netease' },
    { base: 'https://zm.i9mr.com',                      style: 'netease' },
    { base: 'https://music.mcseekeri.com',              style: 'netease' },
    { base: 'https://zm.wwoyun.cn',                     style: 'netease' },
    { base: 'https://api.injahow.cn',                   style: 'netease' }
];
let currentApiIndex = 0;

/* ============================================================
   统一请求函数：自动故障转移 + 两种风格适配 + url 特殊处理
   ============================================================ */
const requestWithFallback = async (type, params = {}, options = {}) => {
    const errors = [];
    const timeout = options.timeout || 10000;
    const total = API_PROVIDERS.length;

    for (let i = 0; i < total; i++) {
        const provider = API_PROVIDERS[(currentApiIndex + i) % total];
        try {
            let url;
            if (provider.style === 'meting') {
                const qs = new URLSearchParams({ server: 'netease', type, ...params });
                url = `${provider.base}?${qs.toString()}`;
            } else {
                const pathMap = {
                    search: '/search',
                    url: '/song/url',
                    lyric: '/lyric',
                    detail: '/song/detail',
                    simi: '/simi/song',
                    mv: '/mv/url',
                    comment: '/comment/music',
                    playlistDetail: '/playlist/detail',
                    playlistTracks: '/playlist/track/all'
                };
                const paramMap = {
                    search: { keywords: params.s || params.keywords || '', limit: params.limit || 30 },
                    url: { id: params.id },
                    lyric: { id: params.id },
                    detail: { ids: params.ids || params.id },
                    simi: { id: params.id },
                    mv: { id: params.id },
                    comment: { id: params.id, limit: params.limit || 20 },
                    playlistDetail: { id: params.id },
                    playlistTracks: { id: params.id, limit: params.limit || 1000 }
                };
                const qs = new URLSearchParams(paramMap[type] || {});
                url = `${provider.base}${pathMap[type]}?${qs.toString()}`;
            }

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);

            if (!res.ok) {
                errors.push(`${provider.base} → HTTP ${res.status}`);
                continue;
            }

            // 播放地址特殊处理
            if (type === 'url') {
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('json')) {
                    const data = await res.json();
                    const u = data.url || data.data?.[0]?.url;
                    if (u) {
                        currentApiIndex = (currentApiIndex + i) % total;
                        return { data: { url: u.startsWith('//') ? 'https:' + u : u }, provider };
                    }
                } else {
                    // 直接是音频流或重定向
                    const finalUrl = res.url;
                    try { res.body?.cancel(); } catch (e) {}
                    if (finalUrl) {
                        currentApiIndex = (currentApiIndex + i) % total;
                        return { data: { url: finalUrl }, provider };
                    }
                }
                errors.push(`${provider.base} → 无有效地址`);
            } else {
                const data = await res.json();
                currentApiIndex = (currentApiIndex + i) % total;
                console.log(`[API] ✅ 成功: ${provider.base} (${type})`);
                return { data, provider };
            }
        } catch (e) {
            errors.push(`${provider.base} → ${e.message}`);
        }
    }
    console.error('所有接口失败:', errors);
    throw new Error('所有接口均不可用');
};

/* ============================================================
   Vue 应用
   ============================================================ */
createApp({
    setup() {
        // ========== 响应式数据（与之前完全一致） ==========
        const searchKeyword = ref('');
        const songIdInput = ref('');
        const playlistUrlInput = ref('');
        const searchResults = ref([]);
        const loadingSearch = ref(false);
        const searchPerformed = ref(false);
        
        const currentSongName = ref('');
        const currentArtist = ref('');
        const currentCover = ref('');
        const loadingPlay = ref(false);
        const playErrorMsg = ref('');
        const audioPlayer = ref(null);
        let currentAudioSrc = '';
        
        const isPlaying = ref(false);
        const currentTime = ref(0);
        const duration = ref(0);
        const progressValue = ref(0);
        const volumeValue = ref(0.7);
        
        const lyricsLines = ref([]);
        const currentLyricIndex = ref(-1);
        const lyricsContainer = ref(null);
        const wordByWordLyrics = ref([]);
        let currentWordIndex = ref(-1);
        
        const playHistory = ref([]);
        const recommendPlaylists = ref([]);
        
        const currentIsVip = ref(false);
        let currentSongId = '';
        let currentSongArtist = '';
        
        const queue = ref([]);
        let currentQueueIndex = -1;
        const loopMode = ref('none');
        
        const miniPlayerVisible = ref(false);
        const similarSongs = ref([]);
        const comments = ref([]);
        let sleepTimerId = null;
        
        const fullscreenPlayerVisible = ref(false);
        const fullscreenCover = ref('');
        const fullscreenSongName = ref('');
        const fullscreenArtist = ref('');
        const fullscreenLyrics = ref([]);
        const fullscreenLyricIndex = ref(-1);
        const fullscreenCurrentTime = ref(0);
        const fullscreenDuration = ref(0);
        const fullscreenProgressValue = ref(0);
        const fullscreenIsPlaying = ref(false);
        let fullscreenInterval = null;
        
        const currentTheme = ref('theme-default');
        const bgImageUrl = ref('');
        const blurEnabled = ref(false);
        const bgBlur = ref(0);
        const cardOpacity = ref(100);
        const maskOpacity = ref(30);
        const glassIntensity = ref(12);
        
        // ========== 辅助函数 ==========
        const formatDuration = (ms) => {
            if (!ms) return '00:00';
            const sec = Math.floor(ms / 1000);
            const mins = Math.floor(sec / 60);
            const secs = sec % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        const formatTime = (seconds) => {
            if (isNaN(seconds)) return '00:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        const toHttps = (url) => {
            if (!url) return url;
            return url.replace(/^http:\/\//i, 'https://');
        };
        
        const extractCover = (item) => {
            return item.al?.picUrl || item.album?.picUrl || item.cover || item.picUrl || '';
        };
        
        const extractSongId = (input) => {
            if (!input) return null;
            if (/^\d+$/.test(input.trim())) return input.trim();
            const match = input.match(/[?&]id=(\d+)/);
            if (match && match[1]) return match[1];
            const match2 = input.match(/\/song\/(\d+)/);
            return match2 ? match2[1] : null;
        };
        
        const extractPlaylistId = (input) => {
            if (!input) return null;
            if (/^\d+$/.test(input.trim())) return input.trim();
            const match = input.match(/[?&]id=(\d+)/);
            if (match && match[1]) return match[1];
            const match2 = input.match(/\/playlist\/(\d+)/);
            if (match2 && match2[1]) return match2[1];
            const match3 = input.match(/\/my\/m\/music\/playlist\?id=(\d+)/);
            if (match3 && match3[1]) return match3[1];
            return null;
        };
        
        const addToHistory = (id, name, artist, cover) => {
            const existing = playHistory.value.find(item => item.id === id);
            if (!existing) {
                playHistory.value.unshift({ id, name, artist, cover: toHttps(cover) });
                if (playHistory.value.length > 8) playHistory.value.pop();
            }
        };
        
        const logError = (error, context) => {
            const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
            logs.push({ time: new Date().toISOString(), error: error.message || error, context });
            while (logs.length > 50) logs.shift();
            localStorage.setItem('errorLogs', JSON.stringify(logs));
            console.error(`[${context}]`, error);
        };
        
        // ========== 主题 ==========
        const openThemeModal = () => { document.getElementById('themeModal').style.display = 'flex'; };
        const closeThemeModal = () => { document.getElementById('themeModal').style.display = 'none'; };
        const setTheme = (themeName) => {
            currentTheme.value = themeName;
            localStorage.setItem('appTheme', themeName);
            document.body.className = currentTheme.value;
            if (blurEnabled.value) document.body.classList.add('blur-enabled');
            closeThemeModal();
        };
        const loadTheme = () => {
            const saved = localStorage.getItem('appTheme');
            currentTheme.value = (saved && saved.includes('theme')) ? saved : 'theme-default';
            document.body.className = currentTheme.value;
        };
        
        // ========== 歌词滚动 ==========
        const scrollLyricsToActive = () => {
            if (!lyricsContainer.value) return;
            const container = lyricsContainer.value;
            const activeLine = container.querySelector('.lyric-line.active');
            if (activeLine) {
                const offset = activeLine.offsetTop - container.clientHeight / 2 + activeLine.clientHeight / 2;
                container.scrollTop = offset;
            }
        };
        const scrollFullscreenLyricsToActive = () => {
            const container = document.querySelector('.fullscreen-lyrics-scroll');
            if (!container) return;
            const activeLine = container.querySelector('.fullscreen-lyric-line.active');
            if (activeLine) {
                const offset = activeLine.offsetTop - container.clientHeight / 2 + activeLine.clientHeight / 2;
                container.scrollTop = offset;
            }
        };
        const splitLyricsIntoWords = () => {
            const containers = document.querySelectorAll('.lyrics-container .lyric-line');
            containers.forEach(container => {
                const text = container.innerText;
                if (text && !container.querySelector('.word-span')) {
                    container.innerHTML = '';
                    for (let char of text) {
                        const span = document.createElement('span');
                        span.className = 'word-span';
                        span.textContent = char;
                        container.appendChild(span);
                    }
                }
            });
        };
        
        // ========== 歌词解析 ==========
        const parseLrc = (lrc) => {
            if (!lrc) return [];
            const result = [];
            const lines = lrc.split(/\r?\n/);
            const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
            for (const line of lines) {
                const times = [];
                let m;
                timeRegex.lastIndex = 0;
                while ((m = timeRegex.exec(line)) !== null) {
                    const min = parseInt(m[1], 10);
                    const sec = parseInt(m[2], 10);
                    const msStr = m[3] || '0';
                    const ms = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10);
                    times.push(min * 60 + sec + ms / 1000);
                }
                if (times.length === 0) continue;
                const text = line.replace(/\[[^\]]*\]/g, '').trim();
                if (!text) continue;
                for (const t of times) result.push({ time: t, text });
            }
            result.sort((a, b) => a.time - b.time);
            return result;
        };
        
        const fetchLyrics = async (songId) => {
            try {
                const { data } = await requestWithFallback('lyric', { id: songId }, { timeout: 8000 });
                const lrcStr =
                    data.lrc?.lyric ||
                    (typeof data.lrc === 'string' ? data.lrc : '') ||
                    data.lyric ||
                    '';
                const parsed = parseLrc(lrcStr);
                lyricsLines.value = parsed;
                fullscreenLyrics.value = parsed;
                
                // 逐字歌词（尝试解析括号时间）
                const wordLines = lrcStr.split('\n');
                const words = [];
                const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
                for (let line of wordLines) {
                    const tm = line.match(timeRegex);
                    if (tm) {
                        const baseTime = parseInt(tm[1]) * 60 + parseInt(tm[2]) + parseInt(tm[3] || '0') / 100;
                        const content = line.replace(timeRegex, '').trim();
                        const regex = /([\u4e00-\u9fa5a-zA-Z0-9]+)\s*\(([\d.]+)\)/g;
                        let match;
                        while ((match = regex.exec(content)) !== null) {
                            words.push({ time: baseTime + parseFloat(match[2]), word: match[1] });
                        }
                    }
                }
                wordByWordLyrics.value = words;
                nextTick(() => splitLyricsIntoWords());
            } catch (e) {
                lyricsLines.value = [];
                fullscreenLyrics.value = [];
                wordByWordLyrics.value = [];
            }
        };
        
        const updateLyrics = (currentSec) => {
            if (lyricsLines.value.length) {
                let idx = -1;
                for (let i = 0; i < lyricsLines.value.length; i++) {
                    const line = lyricsLines.value[i];
                    if (line.time >= 0 && currentSec >= line.time) idx = i;
                    else if (line.time > currentSec) break;
                }
                if (idx !== currentLyricIndex.value) {
                    currentLyricIndex.value = idx;
                    fullscreenLyricIndex.value = idx;
                    nextTick(() => {
                        scrollLyricsToActive();
                        if (fullscreenPlayerVisible.value) scrollFullscreenLyricsToActive();
                    });
                }
            }
            if (wordByWordLyrics.value.length) {
                let activeIdx = -1;
                for (let i = 0; i < wordByWordLyrics.value.length; i++) {
                    if (currentSec >= wordByWordLyrics.value[i].time) activeIdx = i;
                    else break;
                }
                if (activeIdx !== currentWordIndex.value) {
                    currentWordIndex.value = activeIdx;
                    document.querySelectorAll('.word-span').forEach(s => s.classList.remove('active'));
                    if (activeIdx >= 0) {
                        let si = 0;
                        for (let line of document.querySelectorAll('.lyrics-container .lyric-line')) {
                            for (let s of line.querySelectorAll('.word-span')) {
                                if (si === activeIdx) { s.classList.add('active'); break; }
                                si++;
                            }
                            if (si > activeIdx) break;
                        }
                    }
                }
            }
        };
        
        // ========== 搜索（核心解析已重构） ==========
        const searchSongs = async () => {
            const keyword = searchKeyword.value.trim();
            if (!keyword) return alert('请输入歌名或歌手');
            searchResults.value = [];
            searchPerformed.value = true;
            loadingSearch.value = true;
            
            try {
                const { data } = await requestWithFallback('search', { s: keyword, limit: 30 }, { timeout: 12000 });
                const rawSongs =
                    data.result?.songs ||
                    data.songs ||
                    data.data ||
                    (Array.isArray(data) ? data : []);
                
                if (!rawSongs.length) {
                    searchResults.value = [];
                    loadingSearch.value = false;
                    return;
                }
                
                const defaultCover = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                searchResults.value = rawSongs.map(item => {
                    const id = item.id || item.song_id;
                    const name = item.name || item.title || '未知';
                    const artist = (item.artists || item.ar || []).map(a => a.name || a).join(' / ') || item.artist || '未知';
                    const duration = item.duration || item.dt || 0;
                    const fee = item.fee ?? 0;
                    const isVip = fee === 1 || fee === 4;
                    let picUrl = extractCover(item);
                    if (picUrl && picUrl.startsWith('http')) picUrl = toHttps(picUrl);
                    else picUrl = defaultCover;
                    return { id: String(id), name, artist, duration, picUrl, isVip, loadingCover: false };
                });
                
                // 补全缺失封面
                fillMissingCovers();
            } catch (e) {
                console.error('搜索失败', e);
                searchResults.value = [];
                playErrorMsg.value = '所有搜索接口均不可用';
            } finally {
                loadingSearch.value = false;
            }
        };
        
        const fillMissingCovers = async () => {
            const missing = searchResults.value.filter(s => !s.picUrl || s.picUrl.includes('flaticon'));
            for (const song of missing.slice(0, 10)) {
                try {
                    const { data } = await requestWithFallback('detail', { ids: song.id }, { timeout: 5000 });
                    const detail = data.songs?.[0] || data.data?.[0] || (Array.isArray(data) ? data[0] : null);
                    if (detail) {
                        const cover = extractCover(detail);
                        if (cover) {
                            const idx = searchResults.value.findIndex(s => s.id === song.id);
                            if (idx >= 0) searchResults.value[idx].picUrl = toHttps(cover);
                        }
                    }
                } catch (e) {}
            }
        };
        
        // ========== 播放地址 ==========
        const getSongUrl = async (songId) => {
            const { data } = await requestWithFallback('url', { id: songId }, { timeout: 15000 });
            const url = data.url;
            if (!url) throw new Error('未获取到播放地址');
            return toHttps(url);
        };
        
        // ========== 歌曲详情 ==========
        const getSongDetail = async (songId) => {
            const { data } = await requestWithFallback('detail', { ids: songId }, { timeout: 8000 });
            const detail = data.songs?.[0] || data.data?.[0] || (Array.isArray(data) ? data[0] : null);
            if (!detail) throw new Error('无法获取歌曲详情');
            return detail;
        };
        
        // ========== 播放核心 ==========
        const playSongById = async (songId, songName, artistName, coverUrl, addToQueue = true, queueIndex = -1) => {
            if (!songId) return;
            loadingPlay.value = true;
            playErrorMsg.value = '';
            try {
                const musicUrl = await getSongUrl(songId);
                currentSongName.value = songName || '未知歌曲';
                currentArtist.value = artistName || '网易云音乐';
                currentCover.value = coverUrl && coverUrl.startsWith('http') ? toHttps(coverUrl) : 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                currentIsVip.value = false;
                currentSongId = songId;
                currentSongArtist = currentArtist.value;
                addToHistory(songId, songName, currentArtist.value, currentCover.value);
                
                if (addToQueue) {
                    const existing = queue.value.find(s => s.id === songId);
                    if (!existing) {
                        queue.value.push({ id: songId, name: songName, artist: artistName, picUrl: currentCover.value });
                        currentQueueIndex = queue.value.length - 1;
                    } else {
                        currentQueueIndex = queue.value.findIndex(s => s.id === songId);
                    }
                    saveQueueToLocal();
                } else if (queueIndex >= 0) {
                    currentQueueIndex = queueIndex;
                }
                
                fullscreenSongName.value = currentSongName.value;
                fullscreenArtist.value = currentArtist.value;
                fullscreenCover.value = currentCover.value;
                setDynamicGradient(currentCover.value);
                
                const audio = audioPlayer.value;
                if (audio) {
                    audio.pause();
                    audio.removeAttribute('src');
                    audio.load();
                    await new Promise(r => setTimeout(r, 10));
                    audio.src = musicUrl;
                    await new Promise(resolve => {
                        const canPlayHandler = () => {
                            audio.removeEventListener('canplay', canPlayHandler);
                            resolve();
                        };
                        audio.addEventListener('canplay', canPlayHandler, { once: true });
                        setTimeout(resolve, 3000);
                    });
                    await audio.play();
                    isPlaying.value = true;
                    fullscreenIsPlaying.value = true;
                    const savedTime = localStorage.getItem(`playProgress_${songId}`);
                    if (savedTime) audio.currentTime = parseFloat(savedTime);
                }
                fetchLyrics(songId);
            } catch (err) {
                console.error('播放错误:', err);
                playErrorMsg.value = err.message || '网络错误，请重试';
                logError(err, 'playSongById');
            } finally {
                loadingPlay.value = false;
            }
        };
        
        // ========== 队列 ==========
        const saveQueueToLocal = () => {
            localStorage.setItem('playQueue', JSON.stringify(queue.value));
            localStorage.setItem('currentQueueIndex', currentQueueIndex);
        };
        const loadQueueFromLocal = () => {
            const saved = localStorage.getItem('playQueue');
            if (saved) {
                try {
                    queue.value = JSON.parse(saved);
                    const si = localStorage.getItem('currentQueueIndex');
                    if (si !== null) currentQueueIndex = parseInt(si);
                } catch (e) {}
            }
        };
        const playFromQueue = (idx) => {
            if (idx < 0 || idx >= queue.value.length) return;
            const song = queue.value[idx];
            playSongById(song.id, song.name, song.artist, song.picUrl, false, idx);
        };
        const removeFromQueue = (idx) => {
            queue.value.splice(idx, 1);
            if (currentQueueIndex >= idx) currentQueueIndex--;
            saveQueueToLocal();
        };
        const clearQueue = () => { queue.value = []; currentQueueIndex = -1; saveQueueToLocal(); };
        const toggleLoopMode = () => {
            if (loopMode.value === 'none') loopMode.value = 'one';
            else if (loopMode.value === 'one') loopMode.value = 'all';
            else loopMode.value = 'none';
            playErrorMsg.value = `循环模式: ${loopMode.value === 'none' ? '无' : (loopMode.value === 'one' ? '单曲循环' : '列表循环')}`;
            setTimeout(() => { if (playErrorMsg.value.includes('循环模式')) playErrorMsg.value = ''; }, 2000);
        };
        const playPrev = () => {
            if (!queue.value.length) return;
            let i = currentQueueIndex - 1;
            if (i < 0) i = queue.value.length - 1;
            playFromQueue(i);
        };
        const playNext = () => {
            if (!queue.value.length) return;
            let i = currentQueueIndex + 1;
            if (i >= queue.value.length) {
                if (loopMode.value === 'all') i = 0;
                else return;
            }
            playFromQueue(i);
        };
        
        let sortableInstanceQueue = null;
        const openPlayQueueModal = () => {
            document.getElementById('playQueueModal').style.display = 'flex';
            nextTick(() => {
                const queueList = document.getElementById('playQueueList');
                if (queueList && !sortableInstanceQueue) {
                    sortableInstanceQueue = new Sortable(queueList, {
                        animation: 200,
                        onEnd: (evt) => {
                            const newQueue = [...queue.value];
                            const [moved] = newQueue.splice(evt.oldIndex, 1);
                            newQueue.splice(evt.newIndex, 0, moved);
                            queue.value = newQueue;
                            saveQueueToLocal();
                            if (currentQueueIndex === evt.oldIndex) currentQueueIndex = evt.newIndex;
                            else if (currentQueueIndex > evt.oldIndex && currentQueueIndex <= evt.newIndex) currentQueueIndex--;
                            else if (currentQueueIndex < evt.oldIndex && currentQueueIndex >= evt.newIndex) currentQueueIndex++;
                            saveQueueToLocal();
                        }
                    });
                }
            });
        };
        const closePlayQueueModal = () => { document.getElementById('playQueueModal').style.display = 'none'; };
        
        // ========== 迷你播放器 ==========
        const toggleMiniPlayer = () => {
            miniPlayerVisible.value = !miniPlayerVisible.value;
            localStorage.setItem('miniPlayerVisible', miniPlayerVisible.value);
        };
        const restoreFromMini = () => { miniPlayerVisible.value = false; localStorage.setItem('miniPlayerVisible', false); };
        const closeMiniPlayer = () => { miniPlayerVisible.value = false; localStorage.setItem('miniPlayerVisible', false); };
        
        // ========== 相似/MV/评论/睡眠/分享（使用新请求函数） ==========
        const showSimilarSongs = async () => {
            if (!currentSongId) { playErrorMsg.value = '请先播放一首歌曲'; return; }
            try {
                const { data } = await requestWithFallback('simi', { id: currentSongId }, { timeout: 8000 });
                const list = data.songs || data.data || [];
                similarSongs.value = list.map(s => ({
                    id: s.id,
                    name: s.name,
                    artist: (s.artists || s.ar || []).map(a => a.name || a).join('/'),
                    picUrl: s.album?.picUrl || s.al?.picUrl || ''
                }));
                document.getElementById('similarSongsModal').style.display = 'flex';
            } catch (e) { playErrorMsg.value = '获取相似歌曲失败'; }
        };
        const playSimilarSong = (song) => { closeSimilarModal(); playSongById(song.id, song.name, song.artist, song.picUrl); };
        const closeSimilarModal = () => { document.getElementById('similarSongsModal').style.display = 'none'; };
        
        const showMV = async () => {
            if (!currentSongId) { playErrorMsg.value = '请先播放一首歌曲'; return; }
            try {
                const { data } = await requestWithFallback('mv', { id: currentSongId }, { timeout: 8000 });
                let mvUrl = data.data?.url || data.url;
                if (mvUrl) {
                    document.getElementById('mvIframe').src = mvUrl;
                    document.getElementById('mvPlayerModal').style.display = 'flex';
                } else playErrorMsg.value = '该歌曲暂无MV';
            } catch (e) { playErrorMsg.value = '获取MV失败'; }
        };
        const closeMvModal = () => { document.getElementById('mvIframe').src = ''; document.getElementById('mvPlayerModal').style.display = 'none'; };
        
        const showComments = async () => {
            if (!currentSongId) { playErrorMsg.value = '请先播放一首歌曲'; return; }
            try {
                const { data } = await requestWithFallback('comment', { id: currentSongId, limit: 20 }, { timeout: 8000 });
                comments.value = data.comments || data.hotComments || [];
                document.getElementById('commentsModal').style.display = 'flex';
            } catch (e) { playErrorMsg.value = '获取评论失败'; }
        };
        const closeCommentsModal = () => { document.getElementById('commentsModal').style.display = 'none'; };
        
        const openSleepTimerModal = () => { document.getElementById('sleepTimerModal').style.display = 'flex'; };
        const closeSleepModal = () => { document.getElementById('sleepTimerModal').style.display = 'none'; };
        const setSleepTimer = (minutes) => {
            if (sleepTimerId) clearTimeout(sleepTimerId);
            sleepTimerId = setTimeout(() => {
                const audio = audioPlayer.value;
                if (audio) { audio.pause(); isPlaying.value = false; fullscreenIsPlaying.value = false; playErrorMsg.value = `⏰ 定时 ${minutes} 分钟已到，已暂停`; setTimeout(() => { if (playErrorMsg.value.includes('定时')) playErrorMsg.value = ''; }, 3000); }
                sleepTimerId = null;
            }, minutes * 60 * 1000);
            playErrorMsg.value = `✅ 已设置 ${minutes} 分钟后暂停`;
            setTimeout(() => { if (playErrorMsg.value.includes('已设置')) playErrorMsg.value = ''; }, 2000);
            closeSleepModal();
        };
        const cancelSleepTimer = () => {
            if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; playErrorMsg.value = '✅ 已取消睡眠定时'; setTimeout(() => { if (playErrorMsg.value === '✅ 已取消睡眠定时') playErrorMsg.value = ''; }, 2000); }
        };
        
        const shareCurrentSong = async () => {
            if (!currentSongName.value) { playErrorMsg.value = '没有正在播放的歌曲'; return; }
            const div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.top = '-9999px';
            div.style.width = '400px';
            div.style.background = 'linear-gradient(135deg, #f9f3e6, #e8e0d5)';
            div.style.padding = '20px';
            div.style.textAlign = 'center';
            div.style.borderRadius = '20px';
            div.innerHTML = `<img src="${currentCover.value}" width="200" height="200" style="border-radius:20px"><h2 style="margin:10px 0">${currentSongName.value}</h2><p>${currentArtist.value}</p><p style="margin-top:10px">🎵 云音匣 · 正在播放</p>`;
            document.body.appendChild(div);
            try {
                const canvas = await html2canvas(div);
                const link = document.createElement('a');
                link.download = `${currentSongName.value}-分享.png`;
                link.href = canvas.toDataURL();
                link.click();
                playErrorMsg.value = '✅ 分享截图已保存';
                setTimeout(() => { if (playErrorMsg.value === '✅ 分享截图已保存') playErrorMsg.value = ''; }, 2000);
            } catch (e) { playErrorMsg.value = '分享失败'; }
            document.body.removeChild(div);
        };
        
        // ========== 下载 ==========
        const downloadCurrentSong = async () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src) { playErrorMsg.value = '没有正在播放的歌曲'; return; }
            if (currentIsVip.value) { playErrorMsg.value = 'VIP歌曲暂不支持下载'; return; }
            try {
                playErrorMsg.value = '⏳ 正在准备下载...';
                const musicUrl = audio.src;
                const resp = await fetch(musicUrl);
                const buffer = await resp.arrayBuffer();
                let coverBuffer = null;
                const coverUrl = currentCover.value;
                if (coverUrl && !coverUrl.includes('flaticon')) {
                    try { const ir = await fetch(coverUrl); if (ir.ok) coverBuffer = await ir.arrayBuffer(); } catch (e) {}
                }
                const writer = new window.ID3Writer(buffer);
                writer.setFrame('TIT2', currentSongName.value).setFrame('TPE1', [currentArtist.value]).setFrame('TALB', '云音匣下载').setFrame('TYER', new Date().getFullYear().toString()).setFrame('TCON', ['流行']);
                if (coverBuffer) writer.setFrame('APIC', { type: 3, data: coverBuffer, description: 'Cover', mime: coverUrl.endsWith('.png') ? 'image/png' : 'image/jpeg' });
                writer.addTag();
                const blob = new Blob([writer.arrayBuffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `${currentArtist.value} - ${currentSongName.value}.mp3`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
                playErrorMsg.value = '✅ 下载完成';
                setTimeout(() => { if (playErrorMsg.value === '✅ 下载完成') playErrorMsg.value = ''; }, 2000);
            } catch (e) { playErrorMsg.value = '下载失败'; }
        };
        
        // ========== 播放控制 ==========
        const togglePlayPause = () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src) return;
            if (audio.paused) { audio.play(); isPlaying.value = true; fullscreenIsPlaying.value = true; }
            else { audio.pause(); isPlaying.value = false; fullscreenIsPlaying.value = false; }
        };
        const stopAudio = () => {
            const audio = audioPlayer.value;
            if (audio) { audio.pause(); audio.currentTime = 0; isPlaying.value = false; fullscreenIsPlaying.value = false; }
        };
        const updateProgress = () => {
            const audio = audioPlayer.value;
            if (audio && audio.duration) {
                currentTime.value = audio.currentTime;
                const percent = (audio.currentTime / audio.duration) * 100;
                progressValue.value = percent;
                const bar = document.querySelector('.progress-bar');
                if (bar) bar.style.setProperty('--progress-percent', `${percent}%`);
                fullscreenCurrentTime.value = audio.currentTime;
                fullscreenDuration.value = audio.duration;
                fullscreenProgressValue.value = percent;
                updateLyrics(audio.currentTime);
            }
        };
        const onLoadedMetadata = () => {
            const audio = audioPlayer.value;
            if (audio) { duration.value = audio.duration; fullscreenDuration.value = audio.duration; audio.volume = volumeValue.value; }
        };
        const seekAudio = () => {
            const audio = audioPlayer.value;
            if (audio && duration.value) audio.currentTime = (progressValue.value / 100) * duration.value;
        };
        const changeVolume = () => {
            const audio = audioPlayer.value;
            if (audio) audio.volume = volumeValue.value;
        };
        const onAudioEnded = () => {
            isPlaying.value = false; fullscreenIsPlaying.value = false;
            if (loopMode.value === 'one') { const a = audioPlayer.value; if (a) { a.currentTime = 0; a.play(); isPlaying.value = true; } }
            else if (loopMode.value === 'all' && queue.value.length > 1) playNext();
        };
        const onAudioError = (e) => { console.error('Audio error:', e); playErrorMsg.value = '播放失败，可能是音频链接无效'; isPlaying.value = false; fullscreenIsPlaying.value = false; };
        
        // ========== 全屏 ==========
        const openFullscreenPlayer = () => {
            if (!currentSongName.value) { playErrorMsg.value = '请先播放一首歌曲'; setTimeout(() => { if (playErrorMsg.value === '请先播放一首歌曲') playErrorMsg.value = ''; }, 2000); return; }
            fullscreenPlayerVisible.value = true;
            document.getElementById('fullscreenPlayer').style.display = 'flex';
            document.body.style.overflow = 'hidden';
            fullscreenCover.value = currentCover.value;
            fullscreenSongName.value = currentSongName.value;
            fullscreenArtist.value = currentArtist.value;
            fullscreenLyrics.value = lyricsLines.value;
            fullscreenLyricIndex.value = currentLyricIndex.value;
            const audio = audioPlayer.value;
            if (audio) {
                fullscreenCurrentTime.value = audio.currentTime;
                fullscreenDuration.value = audio.duration;
                fullscreenProgressValue.value = (audio.currentTime / audio.duration) * 100;
                fullscreenIsPlaying.value = !audio.paused;
            }
            if (fullscreenInterval) clearInterval(fullscreenInterval);
            fullscreenInterval = setInterval(() => {
                if (audioPlayer.value && fullscreenPlayerVisible.value) {
                    const a = audioPlayer.value;
                    fullscreenCurrentTime.value = a.currentTime;
                    fullscreenDuration.value = a.duration;
                    fullscreenProgressValue.value = (a.currentTime / a.duration) * 100;
                    fullscreenIsPlaying.value = !a.paused;
                    if (currentLyricIndex.value !== fullscreenLyricIndex.value) fullscreenLyricIndex.value = currentLyricIndex.value;
                }
            }, 200);
        };
        const closeFullscreenPlayer = () => {
            fullscreenPlayerVisible.value = false;
            document.getElementById('fullscreenPlayer').style.display = 'none';
            document.body.style.overflow = '';
            if (fullscreenInterval) clearInterval(fullscreenInterval);
        };
        const fullscreenSeek = () => {
            const a = audioPlayer.value;
            if (a && fullscreenDuration.value) a.currentTime = (fullscreenProgressValue.value / 100) * fullscreenDuration.value;
        };
        const fullscreenTogglePlayPause = togglePlayPause;
        
        // ========== 背景设置（原样保留） ==========
        const bodyBackgroundStyle = computed(() => {
            if (bgImageUrl.value && bgImageUrl.value.trim()) {
                return { backgroundImage: `url(${bgImageUrl.value})`, backgroundSize: 'cover', backgroundPosition: 'center center', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' };
            }
            return {};
        });
        const loadBgSettings = () => {
            const sb = localStorage.getItem('customBgImage');
            if (sb) { bgImageUrl.value = sb; document.body.classList.add('custom-bg'); document.body.style.backgroundImage = `url(${sb})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center center'; document.body.style.backgroundAttachment = 'fixed'; }
            const sbl = localStorage.getItem('blurEnabled');
            if (sbl !== null) { blurEnabled.value = sbl === 'true'; if (blurEnabled.value) document.body.classList.add('blur-enabled'); else document.body.classList.remove('blur-enabled'); }
            const sbb = localStorage.getItem('bgBlur');
            if (sbb !== null) { bgBlur.value = parseInt(sbb); document.body.style.setProperty('--bg-blur-amount', `${bgBlur.value / 10}px`); }
            const sco = localStorage.getItem('cardOpacity');
            if (sco !== null) { cardOpacity.value = parseInt(sco); document.body.style.setProperty('--card-opacity', cardOpacity.value / 100); }
            const smo = localStorage.getItem('maskOpacity');
            if (smo !== null) { maskOpacity.value = parseInt(smo); document.body.style.setProperty('--mask-opacity', maskOpacity.value / 100); }
            const sg = localStorage.getItem('glassIntensity');
            if (sg !== null) { glassIntensity.value = parseInt(sg); document.querySelector('.app-container').style.backdropFilter = `blur(${glassIntensity.value}px)`; }
            const sm = localStorage.getItem('miniPlayerVisible');
            if (sm === 'true') miniPlayerVisible.value = true;
        };
        const saveBgImage = () => {
            if (!bgImageUrl.value.trim()) { playErrorMsg.value = '请输入图片URL'; return; }
            localStorage.setItem('customBgImage', bgImageUrl.value);
            document.body.classList.add('custom-bg');
            document.body.style.backgroundImage = `url(${bgImageUrl.value})`;
            document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center center'; document.body.style.backgroundAttachment = 'fixed';
            playErrorMsg.value = '✅ 背景已更新'; setTimeout(() => { if (playErrorMsg.value === '✅ 背景已更新') playErrorMsg.value = ''; }, 2000);
        };
        const resetBgImage = () => { bgImageUrl.value = ''; localStorage.removeItem('customBgImage'); document.body.classList.remove('custom-bg'); document.body.style.backgroundImage = ''; playErrorMsg.value = '✅ 已恢复默认背景'; };
        const saveBlurEnabled = () => { localStorage.setItem('blurEnabled', blurEnabled.value); if (blurEnabled.value) document.body.classList.add('blur-enabled'); else document.body.classList.remove('blur-enabled'); };
        const saveBgBlur = () => { localStorage.setItem('bgBlur', bgBlur.value); document.body.style.setProperty('--bg-blur-amount', `${bgBlur.value / 10}px`); };
        const saveCardOpacity = () => { localStorage.setItem('cardOpacity', cardOpacity.value); document.body.style.setProperty('--card-opacity', cardOpacity.value / 100); };
        const saveMaskOpacity = () => { localStorage.setItem('maskOpacity', maskOpacity.value); document.body.style.setProperty('--mask-opacity', maskOpacity.value / 100); };
        const saveGlassIntensity = () => { localStorage.setItem('glassIntensity', glassIntensity.value); document.querySelector('.app-container').style.backdropFilter = `blur(${glassIntensity.value}px)`; };
        
        const exportSettings = () => {
            const s = { theme: currentTheme.value, bgImageUrl: bgImageUrl.value, bgBlur: bgBlur.value, cardOpacity: cardOpacity.value, maskOpacity: maskOpacity.value, glassIntensity: glassIntensity.value, blurEnabled: blurEnabled.value };
            const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cloudmusic-settings.json'; a.click(); URL.revokeObjectURL(a.href);
            playErrorMsg.value = '✅ 设置已导出'; setTimeout(() => { if (playErrorMsg.value === '✅ 设置已导出') playErrorMsg.value = ''; }, 2000);
        };
        const importSettings = (event) => {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const s = JSON.parse(e.target.result);
                    if (s.theme) setTheme(s.theme);
                    if (s.bgImageUrl) { bgImageUrl.value = s.bgImageUrl; saveBgImage(); }
                    if (s.bgBlur !== undefined) { bgBlur.value = s.bgBlur; saveBgBlur(); }
                    if (s.cardOpacity !== undefined) { cardOpacity.value = s.cardOpacity; saveCardOpacity(); }
                    if (s.maskOpacity !== undefined) { maskOpacity.value = s.maskOpacity; saveMaskOpacity(); }
                    if (s.glassIntensity !== undefined) { glassIntensity.value = s.glassIntensity; saveGlassIntensity(); }
                    if (s.blurEnabled !== undefined) { blurEnabled.value = s.blurEnabled; saveBlurEnabled(); }
                    playErrorMsg.value = '✅ 设置导入成功';
                } catch (err) { playErrorMsg.value = '❌ 导入失败'; }
                setTimeout(() => { if (playErrorMsg.value.includes('设置')) playErrorMsg.value = ''; }, 2000);
            };
            reader.readAsText(file);
        };
        const applyCustomFont = (event) => {
            const file = event.target.files[0]; if (!file) return;
            const fontUrl = URL.createObjectURL(file);
            const style = document.createElement('style');
            style.textContent = `@font-face { font-family: 'CustomFont'; src: url('${fontUrl}') format('truetype'); } * { font-family: 'CustomFont', system-ui, sans-serif !important; }`;
            document.head.appendChild(style);
            playErrorMsg.value = '✅ 字体已应用'; setTimeout(() => { if (playErrorMsg.value === '✅ 字体已应用') playErrorMsg.value = ''; }, 2000);
        };
        
        const handleKeydown = (event) => {
            const t = event.target;
            if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
            switch (event.code) {
                case 'Space': event.preventDefault(); togglePlayPause(); break;
                case 'ArrowLeft': event.preventDefault(); seekAudio(); break;
                case 'ArrowRight': event.preventDefault(); break;
                case 'ArrowUp': event.preventDefault(); volumeValue.value = Math.min(1, volumeValue.value + 0.05); changeVolume(); break;
                case 'ArrowDown': event.preventDefault(); volumeValue.value = Math.max(0, volumeValue.value - 0.05); changeVolume(); break;
            }
        };
        
        // ========== 歌单（使用新请求函数） ==========
        const loadPlaylists = async () => {
            const ids = ['3778678', '19723756', '3136952023', '6727748870', '2253631882'];
            const randomIds = ids.sort(() => 0.5 - Math.random()).slice(0, 4);
            const plist = [];
            for (const pid of randomIds) {
                try {
                    const { data } = await requestWithFallback('playlistDetail', { id: pid }, { timeout: 8000 });
                    const pl = data.playlist || data;
                    if (pl) plist.push({ id: pl.id, name: pl.name, coverImgUrl: toHttps(pl.coverImgUrl || ''), trackCount: pl.trackCount || 0 });
                } catch (e) { console.warn(e); }
            }
            recommendPlaylists.value = plist.length ? plist : [
                { id: '3778678', name: '热歌榜', coverImgUrl: 'https://picsum.photos/80/80?random=1', trackCount: 100 },
                { id: '19723756', name: '欧美流行', coverImgUrl: 'https://picsum.photos/80/80?random=2', trackCount: 50 }
            ];
        };
        
        const fetchPlaylistTracks = async (playlistId, plName, isCustom = false) => {
            searchResults.value = [];
            searchPerformed.value = true;
            loadingSearch.value = true;
            try {
                const { data } = await requestWithFallback('playlistTracks', { id: playlistId, limit: 1000 }, { timeout: 15000 });
                const tracks = data.songs || data.data || [];
                const defaultCover = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                const songList = tracks.map(track => {
                    const fee = track.fee ?? 0;
                    const isVip = fee === 1 || fee === 4;
                    let picUrl = track.al?.picUrl || track.album?.picUrl || '';
                    if (picUrl && picUrl.startsWith('http')) picUrl = toHttps(picUrl); else picUrl = defaultCover;
                    return { id: String(track.id), name: track.name, artist: (track.ar || []).map(a => a.name).join('/'), duration: track.dt, picUrl, isVip, loadingCover: false };
                });
                searchResults.value = songList;
                playErrorMsg.value = `✅ 已加载歌单: ${plName} (共 ${songList.length} 首)`;
                if (isCustom) {
                    queue.value = songList.map(s => ({ id: s.id, name: s.name, artist: s.artist, picUrl: s.picUrl }));
                    currentQueueIndex = -1;
                    saveQueueToLocal();
                    playErrorMsg.value += ' 已加入播放队列';
                }
            } catch (e) {
                searchResults.value = [];
                playErrorMsg.value = '歌单加载失败';
            } finally {
                loadingSearch.value = false;
            }
        };
        
        const loadCustomPlaylist = async () => {
            const input = playlistUrlInput.value.trim();
            if (!input) return alert('请输入歌单链接或ID');
            const id = extractPlaylistId(input);
            if (!id) return alert('无法识别歌单ID');
            await fetchPlaylistTracks(id, `自定义歌单 ${id}`, true);
        };
        
        // ========== VIP 弹窗 ==========
        let pendingVipSong = null;
        const showVipModal = (song) => { pendingVipSong = song; document.getElementById('vipModal').style.display = 'flex'; };
        const hideVipModal = () => { document.getElementById('vipModal').style.display = 'none'; pendingVipSong = null; };
        const goToNetEase = () => { if (pendingVipSong && pendingVipSong.id) window.open(`https://music.163.com/song?id=${pendingVipSong.id}`, '_blank'); hideVipModal(); };
        
        const handlePlayClick = (song) => {
            if (song.isVip) showVipModal(song);
            else playSongById(song.id, song.name, song.artist, song.picUrl);
        };
        
        const parseById = async () => {
            const id = extractSongId(songIdInput.value);
            if (!id) return alert('请输入正确的歌曲ID或链接');
            try {
                const detail = await getSongDetail(id);
                const fee = detail.fee ?? 0;
                const isVip = fee === 1 || fee === 4;
                let picUrl = extractCover(detail);
                if (picUrl) picUrl = toHttps(picUrl); else picUrl = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                const song = { id: String(detail.id), name: detail.name, artist: (detail.ar || []).map(a => a.name).join('/'), picUrl, isVip };
                if (isVip) showVipModal(song);
                else playSongById(song.id, song.name, song.artist, song.picUrl);
            } catch (err) { playErrorMsg.value = '获取歌曲信息失败，请检查ID'; console.error(err); }
        };
        
        const openSettingsModal = () => { document.getElementById('settingsModal').style.display = 'flex'; };
        const closeSettingsModal = () => { document.getElementById('settingsModal').style.display = 'none'; };
        const openFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'flex'; };
        const closeFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'none'; };
        
        const initModalEvents = () => {
            const modals = ['themeModal', 'settingsModal', 'feedbackModal', 'vipModal', 'playQueueModal', 'similarSongsModal', 'mvPlayerModal', 'commentsModal', 'sleepTimerModal'];
            modals.forEach(id => {
                const m = document.getElementById(id);
                if (m) {
                    const c = m.querySelector('.modal-close');
                    if (c) c.onclick = () => m.style.display = 'none';
                    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
                }
            });
            const vip = document.getElementById('vipModal');
            if (vip) {
                const cancel = document.getElementById('modalCancelBtn');
                const confirm = document.getElementById('modalConfirmBtn');
                if (cancel) cancel.onclick = hideVipModal;
                if (confirm) confirm.onclick = goToNetEase;
            }
            const imp = document.getElementById('importSettingsInput');
            if (imp) imp.onchange = importSettings;
        };
        
        onMounted(() => {
            loadTheme();
            loadPlaylists();
            loadBgSettings();
            loadQueueFromLocal();
            initModalEvents();
            window.addEventListener('keydown', handleKeydown);
            if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW注册失败', e));
            const ann = document.getElementById('announcementModal');
            if (ann) {
                ann.style.display = 'flex';
                const c = document.getElementById('closeAnnouncementBtn');
                const ok = document.getElementById('confirmAnnouncementBtn');
                const hide = () => ann.style.display = 'none';
                if (c) c.onclick = hide;
                if (ok) ok.onclick = hide;
                ann.onclick = (e) => { if (e.target === ann) hide(); };
            }
            watch(queue, () => saveQueueToLocal(), { deep: true });
        });
        
        return {
            searchKeyword, songIdInput, playlistUrlInput, searchResults, loadingSearch, searchPerformed,
            currentSongName, currentArtist, currentCover, loadingPlay, playErrorMsg, audioPlayer,
            isPlaying, currentTime, duration, progressValue, volumeValue,
            lyricsLines, currentLyricIndex, lyricsContainer, playHistory, recommendPlaylists,
            formatDuration, formatTime, searchSongs, parseById,
            togglePlayPause, stopAudio, updateProgress, onLoadedMetadata, seekAudio, changeVolume,
            onAudioEnded, onAudioError, loadPlaylists, fetchPlaylistTracks, loadCustomPlaylist,
            handlePlayClick, downloadCurrentSong, onImageLoad: (e) => { const img = e.target; const w = img.closest('.cover-wrapper'); if (w) { const l = w.querySelector('.cover-loading'); if (l) l.style.display = 'none'; } if (img.classList && img.classList.contains('cover-large')) setDynamicGradient(img.src); }, onImageError: (e) => { const img = e.target; if (!img.src.includes('flaticon')) img.src = 'https://cdn-icons-png.flaticon.com/512/727/727245.png'; const w = img.closest('.cover-wrapper'); if (w) { const l = w.querySelector('.cover-loading'); if (l) l.style.display = 'none'; } },
            openFullscreenPlayer, closeFullscreenPlayer,
            fullscreenCover, fullscreenSongName, fullscreenArtist,
            fullscreenLyrics, fullscreenLyricIndex, fullscreenCurrentTime,
            fullscreenDuration, fullscreenProgressValue, fullscreenIsPlaying,
            fullscreenSeek, fullscreenTogglePlayPause,
            playPrev, playNext,
            currentTheme, openThemeModal, closeThemeModal, setTheme,
            bgImageUrl, blurEnabled, bgBlur, cardOpacity, maskOpacity, glassIntensity, bodyBackgroundStyle,
            saveBgImage, resetBgImage, saveBlurEnabled, saveBgBlur, saveCardOpacity, saveMaskOpacity, saveGlassIntensity,
            openSettingsModal, closeSettingsModal, openFeedbackModal, closeFeedbackModal,
            queue, playFromQueue, removeFromQueue, clearQueue, toggleLoopMode, loopMode,
            openPlayQueueModal, closePlayQueueModal,
            miniPlayerVisible, toggleMiniPlayer, restoreFromMini, closeMiniPlayer,
            similarSongs, showSimilarSongs, playSimilarSong, closeSimilarModal,
            showMV, closeMvModal,
            comments, showComments, closeCommentsModal,
            openSleepTimerModal, closeSleepModal, setSleepTimer, cancelSleepTimer,
            shareCurrentSong, applyCustomFont, exportSettings,
            showVipModal, hideVipModal, goToNetEase, playSongById
        };
    }
}).mount('#app');
