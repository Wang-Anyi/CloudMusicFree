const { createApp, ref, onMounted, nextTick, computed, watch } = Vue;

/* ========== 动态渐变背景 ========== */
const extractColorFromImage = (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
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
    if (window.__hasCustomBg && window.__hasCustomBg()) return;
    if (!coverUrl || !coverUrl.startsWith('http')) return;
    const color = await extractColorFromImage(coverUrl);
    if (color) {
        document.body.style.background = `radial-gradient(circle at 10% 20%, ${color}, rgba(0,0,0,0.8))`;
    }
};

createApp({
    setup() {
        // ========== 响应式数据 ==========
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
        const hasMV = ref(false);
        const currentMVUrl = ref('');
        const currentAlbum = ref('');
        const currentLrcRaw = ref('');

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
        const containerOpacity = ref(75);
        const maskOpacity = ref(30);
        const glassIntensity = ref(12);
        const fontScale = ref(parseInt(localStorage.getItem('fontScale') || '100'));

        const orientationMode = ref(localStorage.getItem('orientationMode') || 'auto');
        const isFullscreen = ref(false);
        const autoFullscreenOnEnter = ref(localStorage.getItem('autoFullscreenOnEnter') === 'true');

        const userCookie = ref('');

        const QUALITY_LEVELS = ['lossless', 'exhigh', 'higher', 'standard'];
        const qualityLevel = ref(localStorage.getItem('qualityLevel') || 'exhigh');

        const myPlaylists = ref([]);
        const loadingMyPlaylists = ref(false);

        const createdPlaylists = computed(() => myPlaylists.value.filter(p => !p.subscribed));
        const subscribedPlaylists = computed(() => myPlaylists.value.filter(p => p.subscribed));

        window.__hasCustomBg = () => !!(bgImageUrl.value && bgImageUrl.value.trim());

        // ========== PWA 安装 ==========
        const deferredInstallPrompt = ref(null);
        const showInstallBtn = ref(false);
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const isStandalone = ref(
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true
        );
        const canInstall = computed(() => !isStandalone.value && (showInstallBtn.value || isIOS));

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt.value = e;
            showInstallBtn.value = true;
        });
        window.addEventListener('appinstalled', () => {
            showInstallBtn.value = false;
            deferredInstallPrompt.value = null;
            playErrorMsg.value = '✅ 应用已安装到桌面';
            setTimeout(() => { if (playErrorMsg.value.includes('已安装')) playErrorMsg.value = ''; }, 3000);
        });

        const installApp = async () => {
            if (deferredInstallPrompt.value) {
                deferredInstallPrompt.value.prompt();
                try {
                    const { outcome } = await deferredInstallPrompt.value.userChoice;
                    playErrorMsg.value = outcome === 'accepted' ? '✅ 已开始安装' : '已取消安装';
                    setTimeout(() => { if (playErrorMsg.value.includes('安装')) playErrorMsg.value = ''; }, 2500);
                } catch (e) {}
                deferredInstallPrompt.value = null;
                showInstallBtn.value = false;
            } else if (isIOS) {
                document.getElementById('iosInstallModal').style.display = 'flex';
            } else {
                playErrorMsg.value = '请使用 Chrome/Edge 菜单中的「安装应用」';
                setTimeout(() => { if (playErrorMsg.value.includes('安装应用')) playErrorMsg.value = ''; }, 3000);
            }
        };

        // ========== 全屏 / 方向 ==========
        const toggleFullscreen = async () => {
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                } else {
                    await document.documentElement.requestFullscreen();
                }
            } catch (e) {
                playErrorMsg.value = '全屏失败：' + (e.message || e);
                setTimeout(() => { if (playErrorMsg.value.includes('全屏')) playErrorMsg.value = ''; }, 3000);
            }
        };

        const setOrientation = async (mode) => {
            orientationMode.value = mode;
            localStorage.setItem('orientationMode', mode);
            if (mode === 'auto') {
                try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
                playErrorMsg.value = '✅ 方向已恢复自动';
                setTimeout(() => { if (playErrorMsg.value.includes('方向')) playErrorMsg.value = ''; }, 2000);
                return;
            }
            try {
                if (!document.fullscreenElement) {
                    try {
                        await document.documentElement.requestFullscreen();
                    } catch (e) {
                        playErrorMsg.value = '锁定方向需要先进入全屏，请点击「进入全屏」';
                        setTimeout(() => { if (playErrorMsg.value.includes('全屏')) playErrorMsg.value = ''; }, 3000);
                        return;
                    }
                }
                if (screen.orientation && screen.orientation.lock) {
                    await screen.orientation.lock(mode);
                    playErrorMsg.value = `✅ 已锁定${mode === 'portrait' ? '竖屏' : '横屏'}`;
                } else {
                    playErrorMsg.value = '当前浏览器不支持方向锁定';
                }
            } catch (e) {
                playErrorMsg.value = '方向锁定失败：' + (e.message || e);
            }
            setTimeout(() => { if (playErrorMsg.value.includes('锁定') || playErrorMsg.value.includes('方向')) playErrorMsg.value = ''; }, 3000);
        };

        const saveAutoFullscreen = () => {
            localStorage.setItem('autoFullscreenOnEnter', autoFullscreenOnEnter.value);
            if (autoFullscreenOnEnter.value) {
                setupAutoFullscreen();
                playErrorMsg.value = '✅ 已开启自动全屏，请点击页面任意位置触发';
            } else {
                playErrorMsg.value = '✅ 已关闭自动全屏';
            }
            setTimeout(() => { if (playErrorMsg.value.includes('全屏')) playErrorMsg.value = ''; }, 2500);
        };

        let autoFsListeners = [];
        const setupAutoFullscreen = () => {
            if (!autoFullscreenOnEnter.value) return;
            if (document.fullscreenElement) return;
            const trigger = async () => {
                try {
                    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
                    if (orientationMode.value !== 'auto' && screen.orientation && screen.orientation.lock) {
                        try { await screen.orientation.lock(orientationMode.value); } catch (e) {}
                    }
                } catch (e) {}
                removeAutoFsListeners();
            };
            autoFsListeners.forEach(([evt, fn]) => document.removeEventListener(evt, fn));
            autoFsListeners = [
                ['click', trigger],
                ['touchstart', trigger],
                ['keydown', trigger]
            ];
            autoFsListeners.forEach(([evt, fn]) => document.addEventListener(evt, fn, { once: true, passive: true }));
        };
        const removeAutoFsListeners = () => {
            autoFsListeners.forEach(([evt, fn]) => document.removeEventListener(evt, fn));
            autoFsListeners = [];
        };

        const onFullscreenChange = () => {
            isFullscreen.value = !!document.fullscreenElement;
            if (document.fullscreenElement) document.body.classList.add('is-fullscreen');
            else document.body.classList.remove('is-fullscreen');
        };

        // ========== API 列表 ==========
        const API_LIST = [
            'https://meting-api-pi-one.vercel.app',
            'https://api-enhanced-delta-six.vercel.app',
            'https://api.liyefeng.top',
            'https://ncm.zhenxin.me',
            'https://zm.i9mr.com',
            'https://music.mcseekeri.com',
            'https://zm.wwoyun.cn',
            'https://api.injahow.cn',
            'https://netease-api.cyan9527.com',
            'https://music.ghser.com'
        ];
        let currentApiIndex = 0;

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
        const toHttps = (url) => url ? url.replace(/^http:\/\//i, 'https://') : url;
        const extractCover = (item) => item.al?.picUrl || item.album?.picUrl || item.cover || item.picUrl || '';
        const checkIsVip = (item) => {
            const fee = item?.fee ?? 0;
            return fee === 1 || fee === 4;
        };
        const extractSongId = (input) => {
            if (!input) return null;
            if (/^\d+$/.test(input.trim())) return input.trim();
            const m1 = input.match(/[?&]id=(\d+)/); if (m1) return m1[1];
            const m2 = input.match(/\/song\/(\d+)/); return m2 ? m2[1] : null;
        };
        const extractPlaylistId = (input) => {
            if (!input) return null;
            if (/^\d+$/.test(input.trim())) return input.trim();
            const m1 = input.match(/[?&]id=(\d+)/); if (m1) return m1[1];
            const m2 = input.match(/\/playlist\/(\d+)/); if (m2) return m2[1];
            const m3 = input.match(/\/my\/m\/music\/playlist\?id=(\d+)/); if (m3) return m3[1];
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

        // ========== 背景应用 ==========
        const applyBgImage = () => {
            if (bgImageUrl.value && bgImageUrl.value.trim()) {
                document.body.style.background = `url(${bgImageUrl.value}) center center / cover no-repeat fixed`;
            } else {
                document.body.style.background = '';
            }
        };

        // ========== 一次性加载所有设置并生效 ==========
        const loadAllSettings = () => {
            const st = localStorage.getItem('appTheme');
            currentTheme.value = (st && st.includes('theme')) ? st : 'theme-default';
            document.body.className = currentTheme.value;

            const sb = localStorage.getItem('customBgImage');
            if (sb) {
                bgImageUrl.value = sb;
                applyBgImage();
                document.body.classList.add('custom-bg');
            }

            const sbl = localStorage.getItem('blurEnabled');
            if (sbl !== null) {
                blurEnabled.value = sbl === 'true';
                if (blurEnabled.value) document.body.classList.add('blur-enabled');
            }

            const sbb = localStorage.getItem('bgBlur');
            if (sbb !== null) {
                bgBlur.value = parseInt(sbb);
                document.body.style.setProperty('--bg-blur-amount', `${bgBlur.value / 10}px`);
            }

            const sco = localStorage.getItem('cardOpacity');
            if (sco !== null) {
                cardOpacity.value = parseInt(sco);
                document.body.style.setProperty('--card-opacity', cardOpacity.value / 100);
            }

            const sct = localStorage.getItem('containerOpacity');
            if (sct !== null) {
                containerOpacity.value = parseInt(sct);
                document.body.style.setProperty('--container-opacity', containerOpacity.value / 100);
            }

            const smo = localStorage.getItem('maskOpacity');
            if (smo !== null) {
                maskOpacity.value = parseInt(smo);
                document.body.style.setProperty('--mask-opacity', maskOpacity.value / 100);
            }

            const sg = localStorage.getItem('glassIntensity');
            if (sg !== null) {
                glassIntensity.value = parseInt(sg);
                const app = document.querySelector('.app-container');
                if (app) app.style.backdropFilter = `blur(${glassIntensity.value}px)`;
            }

            const sfs = localStorage.getItem('fontScale');
            if (sfs !== null) {
                fontScale.value = parseInt(sfs);
                document.documentElement.style.setProperty('--font-scale', fontScale.value / 100);
            }

            const sql = localStorage.getItem('qualityLevel');
            if (sql) qualityLevel.value = sql;

            const som = localStorage.getItem('orientationMode');
            if (som) orientationMode.value = som;

            const saf = localStorage.getItem('autoFullscreenOnEnter');
            if (saf !== null) autoFullscreenOnEnter.value = saf === 'true';

            const smp = localStorage.getItem('miniPlayerVisible');
            if (smp === 'true') miniPlayerVisible.value = true;

            const sc = localStorage.getItem('neteaseCookie');
            if (sc) userCookie.value = sc;
        };

        // ========== 主题 ==========
        const openThemeModal = () => { document.getElementById('themeModal').style.display = 'flex'; };
        const closeThemeModal = () => { document.getElementById('themeModal').style.display = 'none'; };
        const setTheme = (themeName) => {
            currentTheme.value = themeName;
            localStorage.setItem('appTheme', themeName);
            document.body.className = currentTheme.value;
            if (bgImageUrl.value && bgImageUrl.value.trim()) {
                document.body.classList.add('custom-bg');
                applyBgImage();
            }
            if (blurEnabled.value) document.body.classList.add('blur-enabled');
            closeThemeModal();
        };

        // ========== 歌词 ==========
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
                    const ms = parseInt((m[3] || '0').padEnd(3, '0').slice(0, 3), 10);
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
                const res = await requestWithFallback(`/lyric?id=${songId}`, { timeout: 8000 });
                const data = res.data;
                const lrcStr = data.lrc?.lyric || (typeof data.lrc === 'string' ? data.lrc : '') || data.lyric || '';
                currentLrcRaw.value = lrcStr;
                const parsed = parseLrc(lrcStr);
                lyricsLines.value = parsed;
                fullscreenLyrics.value = parsed;
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
                currentLrcRaw.value = '';
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

        // ========== 通用请求 ==========
        const requestWithFallback = async (urlPath, options = {}) => {
            const maxRetries = API_LIST.length;
            let lastError = null;
            for (let i = 0; i < maxRetries; i++) {
                const apiIndex = (currentApiIndex + i) % maxRetries;
                const apiBase = API_LIST[apiIndex];
                let fullUrl = `${apiBase}${urlPath}`;
                if (userCookie.value.trim()) {
                    const sep = fullUrl.includes('?') ? '&' : '?';
                    fullUrl += `${sep}cookie=${encodeURIComponent(userCookie.value)}`;
                }
                try {
                    const response = await axios.get(fullUrl, { timeout: options.timeout || 15000, ...options });
                    currentApiIndex = apiIndex;
                    console.log(`[API] ✅ 成功: ${apiBase}`);
                    return response;
                } catch (err) {
                    console.warn(`[API] ❌ ${apiBase} 失败:`, err.message);
                    lastError = err;
                }
            }
            throw lastError || new Error('所有 API 均不可用');
        };

        // ========== 图片加载 ==========
        const onImageLoad = (event) => {
            const img = event.target;
            const wrapper = img.closest('.cover-wrapper');
            if (wrapper) {
                const loadingDiv = wrapper.querySelector('.cover-loading');
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
            if (img.classList && img.classList.contains('cover-large')) setDynamicGradient(img.src);
        };
        const onImageError = (event) => {
            const img = event.target;
            if (!img.src.includes('cdn-icons-png.flaticon.com')) img.src = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
            const wrapper = img.closest('.cover-wrapper');
            if (wrapper) {
                const loadingDiv = wrapper.querySelector('.cover-loading');
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
        };

        // ========== 搜索 ==========
        const searchSongs = async () => {
            const keyword = searchKeyword.value.trim();
            if (!keyword) return alert('请输入歌名或歌手');
            searchResults.value = [];
            searchPerformed.value = true;
            loadingSearch.value = true;
            let songsData = null;
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[i];
                try {
                    let url = `${apiBase}/search?keywords=${encodeURIComponent(keyword)}&limit=30`;
                    if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                    const res = await axios.get(url, { timeout: 10000 });
                    let songs = res.data?.result?.songs || res.data?.data || (Array.isArray(res.data) ? res.data : null);
                    if (songs && songs.length) { songsData = songs; break; }
                } catch (e) { console.warn(e); }
            }
            if (!songsData) {
                searchResults.value = [];
                playErrorMsg.value = '所有搜索接口均不可用';
                loadingSearch.value = false;
                return;
            }
            const defaultCover = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
            const tempResults = songsData.map(item => {
                const id = item.id || item.song_id;
                const name = item.name || item.title || '未知';
                const artist = (item.artists || item.ar || []).map(a => a.name || a).join(' / ') || item.artist || '未知';
                const dur = item.duration || item.dt || 0;
                const isVip = checkIsVip(item);
                let picUrl = extractCover(item);
                if (picUrl && picUrl.startsWith('http')) picUrl = toHttps(picUrl); else picUrl = defaultCover;
                return { id: String(id), name, artist, duration: dur, picUrl, isVip, loadingCover: false };
            });
            searchResults.value = tempResults;
            loadingSearch.value = false;
            fillMissingCovers();
        };
        const fillMissingCovers = async () => {
            const missing = searchResults.value.filter(s => !s.picUrl || s.picUrl.includes('flaticon'));
            for (const song of missing.slice(0, 10)) {
                try {
                    let url = `${API_LIST[0]}/song/detail?ids=${song.id}`;
                    if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                    const res = await axios.get(url, { timeout: 5000 });
                    const detail = res.data?.songs?.[0] || res.data?.data?.[0];
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

        // ========== 解析优先级 ==========
        const outerUrlCache = new Map();
        const probeOuterUrl = (songId, allowShort = false) => {
            const key = `${songId}_${allowShort}`;
            if (outerUrlCache.has(key)) return outerUrlCache.get(key);
            const outerUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
            const p = new Promise((resolve) => {
                const a = new Audio();
                let settled = false;
                const done = (ok) => {
                    if (settled) return;
                    settled = true;
                    a.oncanplay = a.onloadedmetadata = a.onerror = null;
                    try { a.pause(); } catch (e) {}
                    a.removeAttribute('src');
                    try { a.load(); } catch (e) {}
                    resolve(ok ? outerUrl : null);
                };
                a.preload = 'auto';
                a.onloadedmetadata = () => { if (!allowShort && a.duration && a.duration < 40) done(false); };
                a.oncanplay = () => done(true);
                a.onerror = () => done(false);
                a.src = outerUrl;
                setTimeout(() => done(false), 5000);
            });
            outerUrlCache.set(key, p);
            return p;
        };
        const getSongUrlV1 = async (songId) => {
            const levels = [...QUALITY_LEVELS];
            const start = levels.indexOf(qualityLevel.value);
            if (start > 0) levels.splice(0, start);
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                for (const lv of levels) {
                    try {
                        let url = `${apiBase}/song/url/v1?id=${songId}&level=${lv}`;
                        if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                        const res = await axios.get(url, { timeout: 15000 });
                        const musicUrl = (res.data?.data || [])[0]?.url;
                        if (musicUrl) {
                            currentApiIndex = (currentApiIndex + i) % API_LIST.length;
                            console.log(`[v1] ✅ ${songId} level=${lv}`);
                            return toHttps(musicUrl);
                        }
                    } catch (e) {}
                }
            }
            return null;
        };
        const getSongUrlLegacy = async (songId) => {
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    let url = `${apiBase}/song/url?id=${songId}`;
                    if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                    const res = await axios.get(url, { timeout: 20000 });
                    let musicUrl = res.data?.data?.[0]?.url || res.data?.url || (typeof res.data === 'string' ? res.data : null);
                    if (musicUrl) {
                        currentApiIndex = (currentApiIndex + i) % API_LIST.length;
                        return toHttps(musicUrl);
                    }
                } catch (err) {}
            }
            return null;
        };
        const getSongUrl = async (songId) => {
            let url;
            url = await probeOuterUrl(songId);
            if (url) { console.log(`[0外链] ✅ ${songId}`); return url; }
            url = await getSongUrlV1(songId);
            if (url) return url;
            url = await getSongUrlLegacy(songId);
            if (url) return url;
            url = await probeOuterUrl(songId, true);
            if (url) { console.log(`[3兜底] ⚠️ ${songId} 试听外链`); return url; }
            throw new Error('无法获取播放地址');
        };

        const getSongDetail = async (songId) => {
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    let url = `${apiBase}/song/detail?ids=${songId}`;
                    if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                    const res = await axios.get(url, { timeout: 8000 });
                    let detail = res.data?.songs?.[0] || res.data?.data?.[0];
                    if (detail) return detail;
                } catch (err) {}
            }
            throw new Error('无法获取歌曲详情');
        };

        // ========== 播放核心 ==========
        const playSongById = async (songId, songName, artistName, coverUrl, addToQueue = true, queueIndex = -1) => {
            if (!songId) return;
            const mvModal = document.getElementById('mvPlayerModal');
            if (mvModal && mvModal.style.display !== 'none') {
                document.getElementById('mvIframe').src = '';
                mvModal.style.display = 'none';
            }
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
                hasMV.value = false;
                currentMVUrl.value = '';
                currentAlbum.value = '';
                currentLrcRaw.value = '';
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
                        const canPlayHandler = () => { audio.removeEventListener('canplay', canPlayHandler); resolve(); };
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
                checkMV(songId);
                fetchAlbumInfo(songId);
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

        // ========== 相似歌曲 ==========
        const showSimilarSongs = async () => {
            if (!currentSongId) { playErrorMsg.value = '请先播放一首歌曲'; return; }
            similarSongs.value = [];
            playErrorMsg.value = '⏳ 正在获取相似歌曲...';
            let list = null;
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    let url = `${apiBase}/simi/song?id=${currentSongId}`;
                    if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                    const res = await axios.get(url, { timeout: 8000 });
                    const data = res.data;
                    const songs = data?.songs || data?.data || data?.result?.songs || data?.result || (Array.isArray(data) ? data : null);
                    if (songs && songs.length) { list = songs; break; }
                } catch (e) {}
            }
            if (list && list.length) {
                similarSongs.value = list.map(s => {
                    const artistArr = s.artists || s.ar || [];
                    return {
                        id: s.id,
                        name: s.name || '未知',
                        artist: artistArr.map(a => a.name || a).join('/') || '未知',
                        picUrl: s.album?.picUrl || s.al?.picUrl || s.picUrl || '',
                        isVip: checkIsVip(s)
                    };
                });
                playErrorMsg.value = '';
                document.getElementById('similarSongsModal').style.display = 'flex';
            } else {
                playErrorMsg.value = '暂无相似歌曲或接口不可用';
                setTimeout(() => { if (playErrorMsg.value.includes('相似')) playErrorMsg.value = ''; }, 3000);
            }
        };
        const playSimilarSong = (song) => {
            if (song.isVip && !userCookie.value.trim()) { showVipModal(song); return; }
            closeSimilarModal();
            playSongById(song.id, song.name, song.artist, song.picUrl);
        };
        const closeSimilarModal = () => { document.getElementById('similarSongsModal').style.display = 'none'; };

        // ========== MV ==========
        const checkMV = async (songId) => {
            if (!songId) return;
            try {
                let mvid = 0;
                try {
                    const detail = await getSongDetail(songId);
                    mvid = Number(detail?.mvid || detail?.mv || 0);
                } catch (e) {}

                if (mvid > 0) {
                    for (let i = 0; i < API_LIST.length; i++) {
                        const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                        try {
                            let url = `${apiBase}/mv/url?id=${mvid}`;
                            if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                            const res = await axios.get(url, { timeout: 6000 });
                            const mvUrl = res.data?.data?.url || res.data?.url;
                            if (mvUrl) {
                                if (currentSongId === songId) {
                                    currentMVUrl.value = mvUrl;
                                    hasMV.value = true;
                                }
                                return;
                            }
                        } catch (e) {}
                    }
                    if (currentSongId === songId) hasMV.value = true;
                    return;
                }

                for (let i = 0; i < API_LIST.length; i++) {
                    const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                    try {
                        let url = `${apiBase}/mv/url?id=${songId}`;
                        if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                        const res = await axios.get(url, { timeout: 6000 });
                        const mvUrl = res.data?.data?.url || res.data?.url;
                        if (mvUrl) {
                            if (currentSongId === songId) {
                                currentMVUrl.value = mvUrl;
                                hasMV.value = true;
                            }
                            return;
                        }
                    } catch (e) {}
                }
                if (currentSongId === songId) hasMV.value = false;
            } catch (e) {
                if (currentSongId === songId) hasMV.value = false;
            }
        };

        const fetchAlbumInfo = async (songId) => {
            if (!songId) return;
            try {
                const detail = await getSongDetail(songId);
                if (currentSongId === songId) {
                    currentAlbum.value = detail?.al?.name || detail?.album?.name || '';
                }
            } catch (e) {}
        };

        const showMV = async () => {
            if (!currentSongId) { playErrorMsg.value = '请先播放一首歌曲'; return; }
            if (currentMVUrl.value) {
                document.getElementById('mvIframe').src = currentMVUrl.value;
                document.getElementById('mvPlayerModal').style.display = 'flex';
                return;
            }
            try {
                let mvid = 0;
                try {
                    const detail = await getSongDetail(currentSongId);
                    mvid = Number(detail?.mvid || detail?.mv || 0);
                } catch (e) {}
                const targetId = mvid > 0 ? mvid : currentSongId;

                for (let i = 0; i < API_LIST.length; i++) {
                    const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                    try {
                        let url = `${apiBase}/mv/url?id=${targetId}`;
                        if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                        const res = await axios.get(url, { timeout: 8000 });
                        const mvUrl = res.data?.data?.url || res.data?.url;
                        if (mvUrl) {
                            currentMVUrl.value = mvUrl;
                            hasMV.value = true;
                            document.getElementById('mvIframe').src = mvUrl;
                            document.getElementById('mvPlayerModal').style.display = 'flex';
                            return;
                        }
                    } catch (e) {}
                }
                playErrorMsg.value = '该歌曲暂无 MV 或接口暂不可用';
                setTimeout(() => { if (playErrorMsg.value.includes('MV')) playErrorMsg.value = ''; }, 3000);
            } catch (e) {
                playErrorMsg.value = '获取 MV 失败';
            }
        };
        const closeMvModal = () => { document.getElementById('mvIframe').src = ''; document.getElementById('mvPlayerModal').style.display = 'none'; };

        // ========== 评论 ==========
        const showComments = async () => {
            if (!currentSongId) { playErrorMsg.value = '请先播放一首歌曲'; return; }
            comments.value = [];
            playErrorMsg.value = '⏳ 正在获取评论...';
            let list = null;
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    let url = `${apiBase}/comment/music?id=${currentSongId}&limit=30`;
                    if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                    const res = await axios.get(url, { timeout: 8000 });
                    const data = res.data;
                    const arr = data?.hotComments || data?.comments
                        || data?.data?.hotComments || data?.data?.comments
                        || data?.result?.hotComments || data?.result?.comments
                        || (Array.isArray(data) ? data : null);
                    if (arr && arr.length) { list = arr; break; }
                } catch (e) {}
            }
            if (list && list.length) {
                comments.value = list
                    .filter(c => c && c.user && c.content)
                    .map(c => ({
                        commentId: c.commentId || c.id,
                        user: {
                            nickname: c.user.nickname || '匿名用户',
                            avatarUrl: c.user.avatarUrl || c.user.avatar || 'https://cdn-icons-png.flaticon.com/512/727/727245.png'
                        },
                        content: c.content
                    }));
                playErrorMsg.value = '';
                document.getElementById('commentsModal').style.display = 'flex';
            } else {
                playErrorMsg.value = '暂无评论或接口不可用';
                setTimeout(() => { if (playErrorMsg.value.includes('评论')) playErrorMsg.value = ''; }, 3000);
            }
        };
        const closeCommentsModal = () => { document.getElementById('commentsModal').style.display = 'none'; };

        // ========== 睡眠 ==========
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

        // ========== 下载（增强版：完整元数据 + 歌词 + 封面） ==========
        const downloadCurrentSong = async () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src) { playErrorMsg.value = '没有正在播放的歌曲'; return; }
            if (currentIsVip.value) { playErrorMsg.value = 'VIP歌曲暂不支持下载'; return; }
            if (window.__downloading) { playErrorMsg.value = '⏳ 正在下载中，请稍候...'; return; }

            window.__downloading = true;
            playErrorMsg.value = '⏳ 正在准备下载...';

            try {
                let songDetail = null;
                try {
                    songDetail = await getSongDetail(currentSongId);
                } catch (e) {
                    console.warn('[下载] 详情获取失败，使用基础信息');
                }

                const title = songDetail?.name || currentSongName.value || '未知歌曲';
                const artistArr = (songDetail?.ar || []).map(a => a.name).filter(Boolean);
                const artist = artistArr.length ? artistArr.join('/') : (currentArtist.value || '未知歌手');
                const album = songDetail?.al?.name || currentAlbum.value || '云音匣下载';
                const year = songDetail?.publishTime
                    ? String(new Date(songDetail.publishTime).getFullYear())
                    : String(new Date().getFullYear());
                const trackNo = songDetail?.no ? String(songDetail.no) : '';

                let lyricText = currentLrcRaw.value || '';
                if (!lyricText) {
                    try {
                        const lrcRes = await requestWithFallback(`/lyric?id=${currentSongId}`, { timeout: 8000 });
                        const data = lrcRes.data;
                        lyricText = data?.lrc?.lyric || (typeof data?.lrc === 'string' ? data.lrc : '') || data?.lyric || '';
                    } catch (e) {
                        console.warn('[下载] 歌词获取失败');
                    }
                }

                playErrorMsg.value = '⏳ 正在获取封面...';
                let coverBuffer = null;
                let coverMime = 'image/jpeg';
                const coverUrl = toHttps(songDetail?.al?.picUrl || currentCover.value || '');
                if (coverUrl && !coverUrl.includes('flaticon')) {
                    try {
                        const ir = await fetch(coverUrl, { mode: 'cors' });
                        if (ir.ok) {
                            coverBuffer = await ir.arrayBuffer();
                            if (/\.png(\?|$)/i.test(coverUrl)) coverMime = 'image/png';
                        }
                    } catch (e) {
                        console.warn('[下载] 封面获取失败（可能是 CORS 限制）');
                    }
                }

                playErrorMsg.value = '⏳ 正在下载音频数据...';
                const resp = await fetch(audio.src);
                if (!resp.ok) throw new Error('音频下载失败');
                const buffer = await resp.arrayBuffer();

                playErrorMsg.value = '⏳ 正在写入歌曲信息...';
                const writer = new window.ID3Writer(buffer);

                writer
                    .setFrame('TIT2', title)
                    .setFrame('TPE1', artistArr.length ? artistArr : [artist])
                    .setFrame('TPE2', artistArr.length ? artistArr : [artist])
                    .setFrame('TALB', album)
                    .setFrame('TYER', year)
                    .setFrame('TCON', ['流行'])
                    .setFrame('TXXX', { description: '歌曲ID', value: String(currentSongId) })
                    .setFrame('TXXX', { description: '来源', value: '云音匣 · 网易云免费播放器' })
                    .setFrame('TXXX', { description: '在线播放', value: `https://music.163.com/song?id=${currentSongId}` })
                    .setFrame('TXXX', { description: '下载时间', value: new Date().toLocaleString('zh-CN') })
                    .setFrame('WOAS', `https://music.163.com/song?id=${currentSongId}`)
                    .setFrame('COMM', {
                        language: 'chi',
                        description: '',
                        text: [
                            `歌曲名称：${title}`,
                            `歌手：${artist}`,
                            `专辑：${album}`,
                            `歌曲ID：${currentSongId}`,
                            `在线播放：https://music.163.com/song?id=${currentSongId}`,
                            `下载来源：云音匣 · 网易云免费播放器`,
                            `下载时间：${new Date().toLocaleString('zh-CN')}`,
                            ``,
                            `本文件仅供个人学习交流使用，请支持正版音乐。`
                        ].join('\n')
                    });

                if (trackNo) writer.setFrame('TRCK', trackNo);

                if (coverBuffer) {
                    writer.setFrame('APIC', {
                        type: 3,
                        data: coverBuffer,
                        description: 'Cover',
                        mime: coverMime
                    });
                }

                if (lyricText) {
                    writer.setFrame('USLT', {
                        language: 'chi',
                        descriptor: '',
                        lyrics: lyricText
                    });
                }

                writer.addTag();

                const blob = new Blob([writer.arrayBuffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const safeName = (s) => String(s).replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 100);
                link.download = `${safeName(artist)} - ${safeName(title)}.mp3`;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);

                const features = [];
                if (coverBuffer) features.push('封面');
                if (lyricText) features.push('歌词');
                features.push('完整信息');
                playErrorMsg.value = `✅ 下载完成（含${features.join(' / ')}）`;
                setTimeout(() => { if (playErrorMsg.value.includes('下载完成')) playErrorMsg.value = ''; }, 3000);
            } catch (e) {
                console.error('[下载] 失败:', e);
                playErrorMsg.value = '❌ 下载失败：' + (e.message || '未知错误');
                setTimeout(() => { if (playErrorMsg.value.includes('下载失败')) playErrorMsg.value = ''; }, 4000);
            } finally {
                window.__downloading = false;
            }
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
                // ✅ 同时更新主播放器 + 全屏播放器的进度条
                document.querySelectorAll('.progress-bar').forEach(bar => {
                    bar.style.setProperty('--progress-percent', `${percent}%`);
                });
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
            if (audio && duration.value) {
                audio.currentTime = (progressValue.value / 100) * duration.value;
                document.querySelectorAll('.progress-bar').forEach(bar => {
                    bar.style.setProperty('--progress-percent', `${progressValue.value}%`);
                });
            }
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

        // ========== 全屏播放器 ==========
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
                const percent = (audio.currentTime / audio.duration) * 100;
                fullscreenCurrentTime.value = audio.currentTime;
                fullscreenDuration.value = audio.duration;
                fullscreenProgressValue.value = percent;
                fullscreenIsPlaying.value = !audio.paused;
                // ✅ 打开全屏瞬间就同步一次进度条填充色
                document.querySelectorAll('.progress-bar').forEach(bar => {
                    bar.style.setProperty('--progress-percent', `${percent}%`);
                });
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
            if (a && fullscreenDuration.value) {
                a.currentTime = (fullscreenProgressValue.value / 100) * fullscreenDuration.value;
                // ✅ 拖动后立即刷新所有进度条
                document.querySelectorAll('.progress-bar').forEach(bar => {
                    bar.style.setProperty('--progress-percent', `${fullscreenProgressValue.value}%`);
                });
            }
        };
        const fullscreenTogglePlayPause = togglePlayPause;

        // ========== 背景设置 ==========
        const saveBgImage = () => {
            if (!bgImageUrl.value.trim()) { playErrorMsg.value = '请输入图片URL'; return; }
            localStorage.setItem('customBgImage', bgImageUrl.value);
            applyBgImage();
            document.body.classList.add('custom-bg');
            playErrorMsg.value = '✅ 背景已更新';
            setTimeout(() => { if (playErrorMsg.value === '✅ 背景已更新') playErrorMsg.value = ''; }, 2000);
        };
        const resetBgImage = () => {
            bgImageUrl.value = '';
            localStorage.removeItem('customBgImage');
            applyBgImage();
            document.body.classList.remove('custom-bg');
            if (currentCover.value) setDynamicGradient(currentCover.value);
            playErrorMsg.value = '✅ 已恢复默认背景';
            setTimeout(() => { if (playErrorMsg.value.includes('默认背景')) playErrorMsg.value = ''; }, 2000);
        };
        const saveBlurEnabled = () => { localStorage.setItem('blurEnabled', blurEnabled.value); if (blurEnabled.value) document.body.classList.add('blur-enabled'); else document.body.classList.remove('blur-enabled'); };
        const saveBgBlur = () => { localStorage.setItem('bgBlur', bgBlur.value); document.body.style.setProperty('--bg-blur-amount', `${bgBlur.value / 10}px`); };
        const saveCardOpacity = () => { localStorage.setItem('cardOpacity', cardOpacity.value); document.body.style.setProperty('--card-opacity', cardOpacity.value / 100); };
        const saveContainerOpacity = () => { localStorage.setItem('containerOpacity', containerOpacity.value); document.body.style.setProperty('--container-opacity', containerOpacity.value / 100); };
        const saveMaskOpacity = () => { localStorage.setItem('maskOpacity', maskOpacity.value); document.body.style.setProperty('--mask-opacity', maskOpacity.value / 100); };
        const saveGlassIntensity = () => { localStorage.setItem('glassIntensity', glassIntensity.value); document.querySelector('.app-container').style.backdropFilter = `blur(${glassIntensity.value}px)`; };
        const saveFontScale = () => {
            localStorage.setItem('fontScale', fontScale.value);
            document.documentElement.style.setProperty('--font-scale', fontScale.value / 100);
        };

        const saveQualityLevel = () => {
            localStorage.setItem('qualityLevel', qualityLevel.value);
            playErrorMsg.value = `✅ 音质偏好已设为 ${qualityLevel.value}`;
            setTimeout(() => { if (playErrorMsg.value.includes('音质偏好')) playErrorMsg.value = ''; }, 2000);
        };

        const saveCookie = () => {
            localStorage.setItem('neteaseCookie', userCookie.value);
            playErrorMsg.value = '✅ Cookie 已保存';
            setTimeout(() => { if (playErrorMsg.value === '✅ Cookie 已保存') playErrorMsg.value = ''; }, 2000);
        };

        // ========== 自定义字体持久化（IndexedDB） ==========
        const FONT_DB_NAME = 'cloudmusic-db';
        const FONT_STORE = 'fonts';
        const FONT_KEY = 'custom-font';

        const openFontDB = () => {
            if (!window.idb || !window.idb.openDB) return Promise.reject(new Error('idb 库未加载'));
            return window.idb.openDB(FONT_DB_NAME, 1, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains(FONT_STORE)) {
                        db.createObjectStore(FONT_STORE);
                    }
                }
            });
        };

        const applyFontFromData = (arrayBuffer, fileName, mime) => {
            const oldStyle = document.getElementById('custom-font-style');
            if (oldStyle) oldStyle.remove();
            if (window.__customFontUrl) {
                try { URL.revokeObjectURL(window.__customFontUrl); } catch (e) {}
                window.__customFontUrl = null;
            }
            const blob = new Blob([arrayBuffer], { type: mime });
            const fontUrl = URL.createObjectURL(blob);
            window.__customFontUrl = fontUrl;
            const format = mime.includes('woff2') ? 'woff2'
                : mime.includes('woff') ? 'woff'
                : mime.includes('otf') ? 'opentype'
                : 'truetype';
            const style = document.createElement('style');
            style.id = 'custom-font-style';
            style.textContent = `
                @font-face {
                    font-family: 'CustomFont';
                    src: url('${fontUrl}') format('${format}');
                    font-display: swap;
                }
                * {
                    font-family: 'CustomFont', system-ui, 'Segoe UI', 'PingFang SC', Roboto, sans-serif !important;
                }
            `;
            document.head.appendChild(style);
        };

        const applyCustomFont = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                const arrayBuffer = await file.arrayBuffer();
                const ext = file.name.split('.').pop().toLowerCase();
                const mimeMap = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
                const mime = mimeMap[ext] || 'font/ttf';

                applyFontFromData(arrayBuffer, file.name, mime);

                const db = await openFontDB();
                await db.put(FONT_STORE, { data: arrayBuffer, name: file.name, mime, ts: Date.now() }, FONT_KEY);
                db.close();

                playErrorMsg.value = '✅ 字体已应用并保存，刷新后仍生效';
                setTimeout(() => { if (playErrorMsg.value.includes('字体')) playErrorMsg.value = ''; }, 2500);
                event.target.value = '';
            } catch (e) {
                console.error('字体保存失败', e);
                playErrorMsg.value = '❌ 字体保存失败：' + (e.message || '未知错误');
            }
        };

        const loadCustomFontFromDB = async () => {
            try {
                const db = await openFontDB();
                const fontData = await db.get(FONT_STORE, FONT_KEY);
                db.close();
                if (fontData && fontData.data) {
                    applyFontFromData(fontData.data, fontData.name, fontData.mime);
                    console.log('[字体] 已从 IndexedDB 恢复自定义字体');
                }
            } catch (e) {
                console.warn('[字体] 读取自定义字体失败', e);
            }
        };

        const restoreDefaultFont = async () => {
            try {
                const style = document.getElementById('custom-font-style');
                if (style) style.remove();
                if (window.__customFontUrl) {
                    try { URL.revokeObjectURL(window.__customFontUrl); } catch (e) {}
                    window.__customFontUrl = null;
                }
                const db = await openFontDB();
                await db.delete(FONT_STORE, FONT_KEY);
                db.close();
                playErrorMsg.value = '✅ 已恢复默认字体';
                setTimeout(() => { if (playErrorMsg.value.includes('字体')) playErrorMsg.value = ''; }, 2500);
            } catch (e) {
                playErrorMsg.value = '❌ 恢复默认字体失败';
            }
        };

        // ========== 导出/导入设置 ==========
        const exportSettings = () => {
            const s = {
                theme: currentTheme.value,
                bgImageUrl: bgImageUrl.value,
                bgBlur: bgBlur.value,
                cardOpacity: cardOpacity.value,
                containerOpacity: containerOpacity.value,
                maskOpacity: maskOpacity.value,
                glassIntensity: glassIntensity.value,
                fontScale: fontScale.value,
                blurEnabled: blurEnabled.value,
                qualityLevel: qualityLevel.value,
                orientationMode: orientationMode.value,
                autoFullscreenOnEnter: autoFullscreenOnEnter.value
            };
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
                    if (s.containerOpacity !== undefined) { containerOpacity.value = s.containerOpacity; saveContainerOpacity(); }
                    if (s.maskOpacity !== undefined) { maskOpacity.value = s.maskOpacity; saveMaskOpacity(); }
                    if (s.glassIntensity !== undefined) { glassIntensity.value = s.glassIntensity; saveGlassIntensity(); }
                    if (s.fontScale !== undefined) { fontScale.value = s.fontScale; saveFontScale(); }
                    if (s.blurEnabled !== undefined) { blurEnabled.value = s.blurEnabled; saveBlurEnabled(); }
                    if (s.qualityLevel) { qualityLevel.value = s.qualityLevel; saveQualityLevel(); }
                    if (s.orientationMode) { orientationMode.value = s.orientationMode; localStorage.setItem('orientationMode', s.orientationMode); }
                    if (s.autoFullscreenOnEnter !== undefined) {
                        autoFullscreenOnEnter.value = s.autoFullscreenOnEnter;
                        localStorage.setItem('autoFullscreenOnEnter', s.autoFullscreenOnEnter);
                        if (s.autoFullscreenOnEnter) setupAutoFullscreen();
                    }
                    playErrorMsg.value = '✅ 设置导入成功';
                } catch (err) { playErrorMsg.value = '❌ 导入失败'; }
                setTimeout(() => { if (playErrorMsg.value.includes('设置')) playErrorMsg.value = ''; }, 2000);
            };
            reader.readAsText(file);
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

        // ========== 热门歌单 ==========
        const loadPlaylists = async () => {
            const ids = ['3778678', '19723756', '3136952023', '6727748870', '2253631882'];
            const randomIds = ids.sort(() => 0.5 - Math.random()).slice(0, 4);
            const plist = [];
            for (const pid of randomIds) {
                try {
                    const res = await requestWithFallback(`/playlist/detail?id=${pid}`, { timeout: 8000 });
                    if (res.data && res.data.playlist) {
                        plist.push({ id: res.data.playlist.id, name: res.data.playlist.name, coverImgUrl: toHttps(res.data.playlist.coverImgUrl || ''), trackCount: res.data.playlist.trackCount });
                    }
                } catch (e) { console.warn(e); }
            }
            recommendPlaylists.value = plist.length ? plist : [
                { id: '3778678', name: '热歌榜', coverImgUrl: 'https://picsum.photos/80/80?random=1', trackCount: 100 },
                { id: '19723756', name: '欧美流行', coverImgUrl: 'https://picsum.photos/80/80?random=2', trackCount: 50 }
            ];
        };

        // ========== 歌单加载 ==========
        const fetchPlaylistTracks = async (playlistId, plName, isCustom = false) => {
            searchResults.value = [];
            searchPerformed.value = true;
            loadingSearch.value = true;

            const defaultCover = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
            const cookieParam = userCookie.value.trim() ? `&cookie=${encodeURIComponent(userCookie.value)}` : '';

            const tryRequest = async (path) => {
                for (let i = 0; i < API_LIST.length; i++) {
                    const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                    try {
                        const res = await axios.get(`${apiBase}${path}${cookieParam}`, { timeout: 20000 });
                        if (res && res.data) {
                            currentApiIndex = (currentApiIndex + i) % API_LIST.length;
                            return res.data;
                        }
                    } catch (e) {}
                }
                return null;
            };

            try {
                playErrorMsg.value = `⏳ 正在加载歌单 ${plName}...`;

                let trackIds = [];
                let trackCount = 0;
                const detailData = await tryRequest(`/playlist/detail?id=${playlistId}`);
                if (detailData && detailData.playlist) {
                    trackIds = (detailData.playlist.trackIds || []).map(t => t.id);
                    trackCount = trackIds.length || detailData.playlist.trackCount || 0;
                }

                let rawSongs = [];
                if (trackCount > 0) {
                    const allData = await tryRequest(`/playlist/track/all?id=${playlistId}&limit=${trackCount}&offset=0`);
                    if (allData && allData.songs && allData.songs.length) {
                        rawSongs = allData.songs;
                    }
                } else {
                    const allData = await tryRequest(`/playlist/track/all?id=${playlistId}`);
                    if (allData && allData.songs && allData.songs.length) {
                        rawSongs = allData.songs;
                        trackCount = rawSongs.length;
                    }
                }

                if (trackCount > 0 && rawSongs.length < trackCount) {
                    const batchSize = 1000;
                    let offset = rawSongs.length;
                    while (offset < trackCount) {
                        const limit = Math.min(batchSize, trackCount - offset);
                        const pageData = await tryRequest(`/playlist/track/all?id=${playlistId}&limit=${limit}&offset=${offset}`);
                        if (pageData && pageData.songs && pageData.songs.length) {
                            rawSongs.push(...pageData.songs);
                            offset += pageData.songs.length;
                            playErrorMsg.value = `⏳ 已加载 ${rawSongs.length}/${trackCount} 首...`;
                        } else {
                            break;
                        }
                    }
                }

                if ((!rawSongs || !rawSongs.length) && trackIds.length) {
                    const collected = [];
                    const batchSize = 200;
                    for (let i = 0; i < trackIds.length; i += batchSize) {
                        const batch = trackIds.slice(i, i + batchSize);
                        const idsParam = '[' + batch.join(',') + ']';
                        for (let j = 0; j < API_LIST.length; j++) {
                            const apiBase = API_LIST[(currentApiIndex + j) % API_LIST.length];
                            try {
                                const res = await axios.get(`${apiBase}/song/detail?ids=${encodeURIComponent(idsParam)}${cookieParam}`, { timeout: 20000 });
                                if (res.data && res.data.songs && res.data.songs.length) {
                                    collected.push(...res.data.songs);
                                    currentApiIndex = (currentApiIndex + j) % API_LIST.length;
                                    break;
                                }
                            } catch (e) {}
                        }
                        playErrorMsg.value = `⏳ 已加载 ${collected.length}/${trackIds.length} 首...`;
                    }
                    if (collected.length) rawSongs = collected;
                }

                if (rawSongs && rawSongs.length) {
                    const songList = rawSongs.map(track => {
                        let picUrl = extractCover(track);
                        if (picUrl && picUrl.startsWith('http')) picUrl = toHttps(picUrl); else picUrl = defaultCover;
                        return {
                            id: String(track.id),
                            name: track.name || '未知',
                            artist: (track.ar || track.artists || []).map(a => a.name || a).join('/') || '未知',
                            duration: track.dt || track.duration || 0,
                            picUrl,
                            isVip: checkIsVip(track),
                            loadingCover: false
                        };
                    });
                    searchResults.value = songList;
                    playErrorMsg.value = `✅ 已加载歌单: ${plName} (共 ${songList.length} 首)`;
                    if (isCustom) {
                        queue.value = songList.map(s => ({ id: s.id, name: s.name, artist: s.artist, picUrl: s.picUrl }));
                        currentQueueIndex = -1;
                        saveQueueToLocal();
                        playErrorMsg.value += ' · 已加入播放队列';
                    }
                    setTimeout(() => { if (playErrorMsg.value.includes('已加载歌单')) playErrorMsg.value = ''; }, 3000);
                } else {
                    searchResults.value = [];
                    playErrorMsg.value = '❌ 歌单加载失败：所有接口均无法返回数据，请检查 Cookie 或稍后再试';
                }
            } catch (e) {
                console.error('fetchPlaylistTracks 异常:', e);
                searchResults.value = [];
                playErrorMsg.value = '❌ 歌单接口异常：' + (e.message || '未知错误');
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

        // ========== 我的歌单 ==========
        let cachedUid = null;
        const getMyUid = async () => {
            if (cachedUid) return cachedUid;
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    let url = `${apiBase}/user/account/get`;
                    if (userCookie.value.trim()) url += `?cookie=${encodeURIComponent(userCookie.value)}`;
                    const res = await axios.get(url, { timeout: 10000 });
                    const uid = res.data?.account?.id || res.data?.profile?.userId;
                    if (uid) { cachedUid = uid; return uid; }
                } catch (e) {}
            }
            return null;
        };

        const loadMyPlaylists = async (autoOpenModal = true) => {
            if (!userCookie.value.trim()) {
                if (autoOpenModal) {
                    playErrorMsg.value = '请先在设置中填写 Cookie';
                    setTimeout(() => { if (playErrorMsg.value === '请先在设置中填写 Cookie') playErrorMsg.value = ''; }, 2500);
                }
                return false;
            }
            loadingMyPlaylists.value = true;
            if (autoOpenModal) document.getElementById('myPlaylistsModal').style.display = 'flex';
            try {
                const uid = await getMyUid();
                if (!uid) throw new Error('Cookie 可能已失效，无法获取用户信息');
                let list = null;
                for (let i = 0; i < API_LIST.length; i++) {
                    const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                    try {
                        let url = `${apiBase}/user/playlist?uid=${uid}&limit=1000&offset=0`;
                        if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                        const res = await axios.get(url, { timeout: 15000 });
                        const arr = res.data?.playlist || [];
                        if (arr.length) { list = arr; break; }
                    } catch (e) {}
                }
                if (!list) throw new Error('所有 API 均无法获取歌单');
                myPlaylists.value = list.map(pl => ({
                    id: String(pl.id), name: pl.name,
                    coverImgUrl: toHttps(pl.coverImgUrl || ''),
                    trackCount: pl.trackCount, specialType: pl.specialType, subscribed: pl.subscribed
                }));
                if (autoOpenModal) {
                    playErrorMsg.value = `✅ 已加载 ${myPlaylists.value.length} 个歌单`;
                    setTimeout(() => { if (playErrorMsg.value.includes('已加载')) playErrorMsg.value = ''; }, 2000);
                }
                return true;
            } catch (e) {
                if (autoOpenModal) playErrorMsg.value = e.message || '加载我的歌单失败';
                return false;
            } finally {
                loadingMyPlaylists.value = false;
            }
        };

        const openMyPlaylistsModal = () => { loadMyPlaylists(true); };
        const openMyPlaylist = (pl) => {
            closeMyPlaylistsModal();
            fetchPlaylistTracks(pl.id, pl.name);
        };
        const closeMyPlaylistsModal = () => { document.getElementById('myPlaylistsModal').style.display = 'none'; };

        // ========== VIP 弹窗 ==========
        let pendingVipSong = null;
        const showVipModal = (song) => {
            pendingVipSong = song;
            document.getElementById('vipModal').style.display = 'flex';
        };
        const hideVipModal = () => {
            document.getElementById('vipModal').style.display = 'none';
            pendingVipSong = null;
        };
        const goToNetEase = () => {
            if (pendingVipSong && pendingVipSong.id) window.open(`https://music.163.com/song?id=${pendingVipSong.id}`, '_blank');
            hideVipModal();
        };

        const handlePlayClick = (song) => {
            if (song.isVip && !userCookie.value.trim()) showVipModal(song);
            else playSongById(song.id, song.name, song.artist, song.picUrl);
        };
        const parseById = async () => {
            const id = extractSongId(songIdInput.value);
            if (!id) return alert('请输入正确的歌曲ID或链接');
            try {
                const detail = await getSongDetail(id);
                const isVip = checkIsVip(detail);
                let picUrl = extractCover(detail);
                if (picUrl) picUrl = toHttps(picUrl); else picUrl = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                const song = { id: String(detail.id), name: detail.name, artist: (detail.ar || []).map(a => a.name).join('/'), picUrl, isVip };
                if (isVip && !userCookie.value.trim()) showVipModal(song);
                else playSongById(song.id, song.name, song.artist, song.picUrl);
            } catch (err) { playErrorMsg.value = '获取歌曲信息失败，请检查ID'; console.error(err); }
        };

        const openSettingsModal = () => { document.getElementById('settingsModal').style.display = 'flex'; };
        const closeSettingsModal = () => { document.getElementById('settingsModal').style.display = 'none'; };
        const openFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'flex'; };
        const closeFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'none'; };

        const initModalEvents = () => {
            const modals = ['themeModal', 'settingsModal', 'feedbackModal', 'vipModal', 'playQueueModal', 'similarSongsModal', 'mvPlayerModal', 'commentsModal', 'sleepTimerModal', 'myPlaylistsModal', 'iosInstallModal'];
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
            const iosConfirm = document.getElementById('confirmIosInstallBtn');
            if (iosConfirm) iosConfirm.onclick = () => { document.getElementById('iosInstallModal').style.display = 'none'; };
        };

        // ========== 挂载 ==========
        onMounted(() => {
            loadAllSettings();
            loadCustomFontFromDB();
            loadPlaylists();
            loadQueueFromLocal();
            initModalEvents();
            window.addEventListener('keydown', handleKeydown);
            document.addEventListener('fullscreenchange', onFullscreenChange);
            if (autoFullscreenOnEnter.value) setupAutoFullscreen();
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW注册失败', e));
            }
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
            handlePlayClick, downloadCurrentSong, onImageLoad, onImageError,
            hasMV, currentMVUrl,
            openFullscreenPlayer, closeFullscreenPlayer,
            fullscreenCover, fullscreenSongName, fullscreenArtist,
            fullscreenLyrics, fullscreenLyricIndex, fullscreenCurrentTime,
            fullscreenDuration, fullscreenProgressValue, fullscreenIsPlaying,
            fullscreenSeek, fullscreenTogglePlayPause,
            playPrev, playNext,
            currentTheme, openThemeModal, closeThemeModal, setTheme,
            bgImageUrl, blurEnabled, bgBlur, cardOpacity, containerOpacity, maskOpacity, glassIntensity,
            saveBgImage, resetBgImage, saveBlurEnabled, saveBgBlur, saveCardOpacity, saveContainerOpacity, saveMaskOpacity, saveGlassIntensity,
            fontScale, saveFontScale,
            openSettingsModal, closeSettingsModal, openFeedbackModal, closeFeedbackModal,
            queue, playFromQueue, removeFromQueue, clearQueue, toggleLoopMode, loopMode,
            openPlayQueueModal, closePlayQueueModal,
            miniPlayerVisible, toggleMiniPlayer, restoreFromMini, closeMiniPlayer,
            similarSongs, showSimilarSongs, playSimilarSong, closeSimilarModal,
            showMV, closeMvModal,
            comments, showComments, closeCommentsModal,
            openSleepTimerModal, closeSleepModal, setSleepTimer, cancelSleepTimer,
            applyCustomFont, restoreDefaultFont, exportSettings,
            showVipModal, hideVipModal, goToNetEase, playSongById,
            userCookie, saveCookie,
            qualityLevel, saveQualityLevel,
            myPlaylists, loadingMyPlaylists, loadMyPlaylists,
            createdPlaylists, subscribedPlaylists, openMyPlaylist, openMyPlaylistsModal, closeMyPlaylistsModal,
            canInstall, installApp,
            orientationMode, setOrientation,
            isFullscreen, toggleFullscreen,
            autoFullscreenOnEnter, saveAutoFullscreen
        };
    }
}).mount('#app');
