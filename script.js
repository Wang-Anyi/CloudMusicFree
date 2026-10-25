document.title = '✅ 云音匣 v4 图片修复';

const { createApp, ref, onMounted, onUnmounted, nextTick, computed, watch } = Vue;

// 默认封面：红色背景 + 白色音符（用 <path> 画，不依赖字体）
const DEFAULT_COVER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" fill="#ff6b6b"/>' +
    '<path d="M80 140 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M120 140 L120 60 L140 50 L140 70 L120 80 Z" fill="#ffffff"/>' +
    '</svg>'
);

const gradientColorCache = new Map();

const extractColorFromImage = (url) => {
    if (!url || !url.startsWith('http')) return Promise.resolve(null);
    if (gradientColorCache.has(url)) return Promise.resolve(gradientColorCache.get(url));
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const pixelData = ctx.getImageData(0, 0, 1, 1).data;
                const color = `rgb(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]})`;
                gradientColorCache.set(url, color);
                resolve(color);
            } catch (e) { resolve(null); }
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

        const playHistory = ref([]);
        const recommendPlaylists = ref([]);

        const currentIsVip = ref(false);
        let currentSongId = '';
        let currentSongArtist = '';
        const currentAlbum = ref('');
        const currentLrcRaw = ref('');
        const currentTLrcRaw = ref('');

        const queue = ref([]);
        let currentQueueIndex = -1;
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
        const fullscreenLyricsContainer = ref(null);
        let fullscreenInterval = null;

        const currentTheme = ref('theme-default');
        const bgImageUrl = ref('');
        const blurEnabled = ref(false);
        const bgBlur = ref(0);
        const cardOpacity = ref(100);
        const containerOpacity = ref(78);
        const maskOpacity = ref(30);
        const glassIntensity = ref(12);
        const fontScale = ref(parseInt(localStorage.getItem('fontScale') || '100'));

        const karaokeEnabled = ref(localStorage.getItem('karaokeEnabled') === 'true');

        const customAccent = ref(localStorage.getItem('customAccent') || '#d44c2f');
        const customBgStart = ref(localStorage.getItem('customBgStart') || '#f9f3e6');
        const customBgEnd = ref(localStorage.getItem('customBgEnd') || '#e8e0d5');

        const loopMode = ref(localStorage.getItem('loopMode') || 'all');
        const shufflePlayed = new Set();
        const loopModeLabel = computed(() => {
            if (loopMode.value === 'one') return '单曲循环';
            if (loopMode.value === 'shuffle') return '随机播放';
            return '列表循环';
        });
        const loopModeIcon = computed(() => {
            if (loopMode.value === 'one') return '🔂';
            if (loopMode.value === 'shuffle') return '🔀';
            return '🔁';
        });

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

        const toggleFullscreen = async () => {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
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
                    try { await document.documentElement.requestFullscreen(); }
                    catch (e) {
                        playErrorMsg.value = '锁定方向需要先进入全屏';
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
            if (autoFullscreenOnEnter.value) setupAutoFullscreen();
            playErrorMsg.value = autoFullscreenOnEnter.value ? '✅ 已开启自动全屏' : '✅ 已关闭自动全屏';
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
            autoFsListeners = [['click', trigger], ['touchstart', trigger], ['keydown', trigger]];
            autoFsListeners.forEach(([evt, fn]) => document.addEventListener(evt, fn, { once: true, passive: true }));
        };
        const removeAutoFsListeners = () => {
            autoFsListeners.forEach(([evt, fn]) => document.removeEventListener(evt, fn));
            autoFsListeners = [];
        };

        const onFullscreenChange = () => {
            isFullscreen.value = !!document.fullscreenElement;
            if (fullscreenPlayerVisible.value) {
                updateFullscreenScrollH();
                setTimeout(() => scrollFullscreenLyricsToActive(), 200);
            }
        };

        const onWindowResize = () => {
            if (fullscreenPlayerVisible.value) {
                updateFullscreenScrollH();
                scrollFullscreenLyricsToActive();
            }
        };

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
        const toHttps = (url) => (url && typeof url === 'string') ? url.replace(/^http:\/\//i, 'https://') : url;

        const weservWrap = (url, size = 200) => {
            const clean = String(url).replace(/^https?:\/\//i, '');
            return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=${size}&h=${size}&fit=cover&output=jpg&default=1`;
        };

        const fixImageUrl = (url) => {
            if (!url || typeof url !== 'string') return '';
            url = url.trim();
            if (!url) return '';
            if (url.startsWith('//')) url = 'https:' + url;
            if (!/^https?:\/\//i.test(url)) return '';
            url = url.replace(/^http:\/\//i, 'https://');
            if (url.includes('images.weserv.nl')) return url;
            if (/music\.126\.net/i.test(url)) {
                if (!/[?&]param=/i.test(url)) {
                    url += (url.includes('?') ? '&' : '?') + 'param=200y200';
                }
                return weservWrap(url, 200);
            }
            return url;
        };

        const extractCover = (item) => {
            if (!item || typeof item !== 'object') return '';
            const candidates = [];
            if (item.al && typeof item.al === 'object') {
                candidates.push(item.al.picUrl, item.al.picUrl_str);
            }
            if (item.album && typeof item.album === 'object') {
                candidates.push(item.album.picUrl, item.album.picUrl_str);
            }
            candidates.push(item.pic, item.picUrl, item.cover, item.coverImgUrl, item.img1v1Url);
            if (Array.isArray(item.ar) && item.ar[0] && typeof item.ar[0] === 'object') {
                candidates.push(item.ar[0].picUrl);
            }
            if (Array.isArray(item.artists) && item.artists[0] && typeof item.artists[0] === 'object') {
                candidates.push(item.artists[0].picUrl, item.artists[0].img1v1Url);
            }
            for (const c of candidates) {
                const fixed = fixImageUrl(c);
                if (fixed && /^https:\/\//i.test(fixed)) return fixed;
            }
            return '';
        };

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

        const applyBgImage = () => {
            if (bgImageUrl.value && bgImageUrl.value.trim()) {
                document.body.style.background = `url(${bgImageUrl.value}) center center / cover no-repeat fixed`;
            } else {
                document.body.style.background = '';
            }
        };

        const applyCustomColors = () => {
            localStorage.setItem('customAccent', customAccent.value);
            localStorage.setItem('customBgStart', customBgStart.value);
            localStorage.setItem('customBgEnd', customBgEnd.value);
            if (currentTheme.value !== 'theme-custom') return;
            document.body.style.setProperty('--lyrics-active-color', customAccent.value);
            document.body.style.setProperty('--progress-played', customAccent.value);
            document.body.style.setProperty('--progress-thumb', customAccent.value);
            document.body.style.setProperty('--btn-bg', customAccent.value);
            document.body.style.setProperty('--bg-gradient-start', customBgStart.value);
            document.body.style.setProperty('--bg-gradient-end', customBgEnd.value);
        };

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
            if (sbb !== null) { bgBlur.value = parseInt(sbb); document.body.style.setProperty('--bg-blur-amount', `${bgBlur.value / 10}px`); }

            const sco = localStorage.getItem('cardOpacity');
            if (sco !== null) { cardOpacity.value = parseInt(sco); document.body.style.setProperty('--card-opacity', cardOpacity.value / 100); }

            const sct = localStorage.getItem('containerOpacity');
            if (sct !== null) { containerOpacity.value = parseInt(sct); document.body.style.setProperty('--container-opacity', containerOpacity.value / 100); }

            const smo = localStorage.getItem('maskOpacity');
            if (smo !== null) { maskOpacity.value = parseInt(smo); document.body.style.setProperty('--mask-opacity', maskOpacity.value / 100); }

            const sg = localStorage.getItem('glassIntensity');
            if (sg !== null) {
                glassIntensity.value = parseInt(sg);
                const app = document.querySelector('.app-container');
                if (app) app.style.backdropFilter = `blur(${glassIntensity.value}px)`;
            }

            const sfs = localStorage.getItem('fontScale');
            if (sfs !== null) { fontScale.value = parseInt(sfs); document.documentElement.style.setProperty('--font-scale', fontScale.value / 100); }

            const sql = localStorage.getItem('qualityLevel');
            if (sql) qualityLevel.value = sql;

            const som = localStorage.getItem('orientationMode');
            if (som) orientationMode.value = som;

            const saf = localStorage.getItem('autoFullscreenOnEnter');
            if (saf !== null) autoFullscreenOnEnter.value = saf === 'true';

            const sc = localStorage.getItem('neteaseCookie');
            if (sc) userCookie.value = sc;

            const ca = localStorage.getItem('customAccent');
            if (ca) customAccent.value = ca;
            const cbs = localStorage.getItem('customBgStart');
            if (cbs) customBgStart.value = cbs;
            const cbe = localStorage.getItem('customBgEnd');
            if (cbe) customBgEnd.value = cbe;

            const sk = localStorage.getItem('karaokeEnabled');
            if (sk !== null) karaokeEnabled.value = sk === 'true';

            if (currentTheme.value === 'theme-custom') applyCustomColors();
        };

        const openThemeModal = () => { document.getElementById('themeModal').style.display = 'flex'; };
        const closeThemeModal = () => { document.getElementById('themeModal').style.display = 'none'; };
        const setTheme = (themeName) => {
            ['--lyrics-active-color', '--progress-played', '--progress-thumb', '--btn-bg', '--bg-gradient-start', '--bg-gradient-end']
                .forEach(v => document.body.style.removeProperty(v));
            currentTheme.value = themeName;
            localStorage.setItem('appTheme', themeName);
            document.body.className = currentTheme.value;
            if (themeName === 'theme-custom') applyCustomColors();
            if (bgImageUrl.value && bgImageUrl.value.trim()) {
                document.body.classList.add('custom-bg');
                applyBgImage();
            }
            if (blurEnabled.value) document.body.classList.add('blur-enabled');
            closeThemeModal();
        };

        const scrollLyricsToActive = () => {
            if (!lyricsContainer.value) return;
            const container = lyricsContainer.value;
            const activeLine = container.querySelector('.lyric-line.active');
            if (activeLine) {
                const offset = activeLine.offsetTop - container.clientHeight / 2 + activeLine.clientHeight / 2;
                container.scrollTop = offset;
            }
        };

        const updateFullscreenScrollH = () => {
            const container = fullscreenLyricsContainer.value || document.querySelector('.fullscreen-lyrics-scroll');
            if (!container) return;
            container.style.setProperty('--scroll-h', container.clientHeight + 'px');
        };

        let fullscreenScrollRaf = null;
        let pendingFullscreenScroll = null;
        const performFullscreenScroll = () => {
            if (pendingFullscreenScroll === null) return;
            const container = document.querySelector('.fullscreen-lyrics-scroll');
            if (container) container.scrollTop = pendingFullscreenScroll;
            pendingFullscreenScroll = null;
            fullscreenScrollRaf = null;
        };
        const scrollFullscreenLyricsToActive = () => {
            const container = document.querySelector('.fullscreen-lyrics-scroll');
            if (!container) return;
            const activeLine = container.querySelector('.fullscreen-lyric-line.active');
            if (!activeLine) return;

            const containerRect = container.getBoundingClientRect();
            const lineRect = activeLine.getBoundingClientRect();
            if (containerRect.height === 0) return;

            const currentScrollTop = container.scrollTop;
            const lineCenterInContent = lineRect.top - containerRect.top + currentScrollTop + lineRect.height / 2;
            const targetRatio = 0.42;
            const target = lineCenterInContent - containerRect.height * targetRatio;

            pendingFullscreenScroll = Math.max(0, target);
            if (!fullscreenScrollRaf) {
                fullscreenScrollRaf = requestAnimationFrame(performFullscreenScroll);
            }
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

        const mergeLyrics = (lrcStr, tlyricStr) => {
            const original = parseLrc(lrcStr);
            const translated = parseLrc(tlyricStr);
            const transMap = {};
            translated.forEach(t => {
                const key = t.time.toFixed(2);
                if (!transMap[key]) transMap[key] = [];
                transMap[key].push(t.text);
            });
            return original.map(line => {
                const key = line.time.toFixed(2);
                return { time: line.time, text: line.text, trans: (transMap[key] || []).join(' / ') };
            });
        };

        const buildMergedLrc = (originalLrc, translatedLrc) => {
            if (!originalLrc) return '';
            if (!translatedLrc) return originalLrc;
            const original = parseLrc(originalLrc);
            const translated = parseLrc(translatedLrc);
            if (!translated.length) return originalLrc;
            const transMap = {};
            translated.forEach(t => {
                const key = t.time.toFixed(2);
                if (!transMap[key]) transMap[key] = [];
                transMap[key].push(t.text);
            });
            const fmt = (s) => {
                const min = Math.floor(s / 60);
                const sec = s - min * 60;
                return `[${String(min).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}]`;
            };
            const lines = [];
            original.forEach(line => {
                lines.push(fmt(line.time) + line.text);
                const key = line.time.toFixed(2);
                if (transMap[key]) transMap[key].forEach(transText => lines.push(fmt(line.time) + transText));
            });
            return lines.join('\n');
        };

        const fetchLyrics = async (songId) => {
            try {
                const res = await requestWithFallback(`/lyric?id=${songId}`, { timeout: 8000 });
                const data = res.data;
                const lrcStr = data.lrc?.lyric || (typeof data.lrc === 'string' ? data.lrc : '') || data.lyric || '';
                const tlyricStr = data.tlyric?.lyric || (typeof data.tlyric === 'string' ? data.tlyric : '') || '';
                currentLrcRaw.value = lrcStr;
                currentTLrcRaw.value = tlyricStr;
                const merged = mergeLyrics(lrcStr, tlyricStr);
                lyricsLines.value = merged;
                fullscreenLyrics.value = merged;
            } catch (e) {
                lyricsLines.value = [];
                fullscreenLyrics.value = [];
                currentLrcRaw.value = '';
                currentTLrcRaw.value = '';
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
                        if (fullscreenPlayerVisible.value) {
                            scrollFullscreenLyricsToActive();
                            updateFullscreenScrollH();
                        }
                    });
                }
            }
        };

        let karaokeRafId = null;

        const updateKaraokeFrame = () => {
            if (!fullscreenPlayerVisible.value) return;
            if (!karaokeEnabled.value) return;
            const idx = fullscreenLyricIndex.value;
            if (idx < 0) return;

            const audio = audioPlayer.value;
            if (!audio) return;

            const el = document.querySelector('.fullscreen-lyric-line.active');
            if (!el) return;
            if (el.dataset.idx !== String(idx)) return;

            const line = fullscreenLyrics.value[idx];
            if (!line) return;

            const next = fullscreenLyrics.value[idx + 1];
            const lineStart = line.time;
            const lineEnd = next ? next.time : line.time + 5;
            const lineDuration = Math.max(0.1, lineEnd - lineStart);

            let progress = (audio.currentTime - lineStart) / lineDuration;
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;

            el.style.setProperty('--karaoke-percent', `${progress * 100}%`);
        };

        const tickKaraoke = () => {
            updateKaraokeFrame();
            karaokeRafId = requestAnimationFrame(tickKaraoke);
        };

        const startKaraokeLoop = () => {
            stopKaraokeLoop();
            if (!fullscreenPlayerVisible.value || !karaokeEnabled.value) return;
            karaokeRafId = requestAnimationFrame(tickKaraoke);
        };

        const stopKaraokeLoop = () => {
            if (karaokeRafId) {
                cancelAnimationFrame(karaokeRafId);
                karaokeRafId = null;
            }
        };

        watch(karaokeEnabled, (enabled) => {
            if (enabled && fullscreenPlayerVisible.value) startKaraokeLoop();
            else stopKaraokeLoop();
        });

        const buildApiUrl = (apiBase, path) => {
            if (!userCookie.value.trim()) return `${apiBase}${path}`;
            const sep = path.includes('?') ? '&' : '?';
            return `${apiBase}${path}${sep}cookie=${encodeURIComponent(userCookie.value)}`;
        };

        const requestWithFallback = async (urlPath, options = {}) => {
            const maxRetries = API_LIST.length;
            let lastError = null;
            for (let i = 0; i < maxRetries; i++) {
                const apiIndex = (currentApiIndex + i) % maxRetries;
                const apiBase = API_LIST[apiIndex];
                const fullUrl = buildApiUrl(apiBase, urlPath);
                try {
                    const response = await axios.get(fullUrl, { timeout: options.timeout || 15000, ...options });
                    currentApiIndex = apiIndex;
                    return response;
                } catch (err) { lastError = err; }
            }
            throw lastError || new Error('所有 API 均不可用');
        };

        const imageQueue = [];
        let activeImageTasks = 0;
        const MAX_IMAGE_CONCURRENCY = 3;

        const enqueueImageLoad = (songId, albumId) => {
            imageQueue.push({ songId, albumId });
            processImageQueue();
        };

        const processImageQueue = () => {
            while (imageQueue.length > 0 && activeImageTasks < MAX_IMAGE_CONCURRENCY) {
                const task = imageQueue.shift();
                activeImageTasks++;
                loadSingleImage(task.songId, task.albumId).finally(() => {
                    activeImageTasks--;
                    if (imageQueue.length > 0) processImageQueue();
                });
            }
        };

        const applyCoverToSong = (songId, cover) => {
            const target = searchResults.value.find(s => String(s.id) === String(songId));
            if (target) {
                target.picUrl = cover;
                target.loadingCover = false;
            }
            if (currentSongId && String(currentSongId) === String(songId) &&
                (!currentCover.value || currentCover.value === DEFAULT_COVER || currentCover.value.includes('flaticon'))) {
                currentCover.value = cover;
                fullscreenCover.value = cover;
                setDynamicGradient(cover);
            }
        };

        const loadSingleImage = async (songId, albumId) => {
            for (let i = 0; i < Math.min(4, API_LIST.length); i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    const url = buildApiUrl(apiBase, `/song/detail?ids=${songId}`);
                    const res = await axios.get(url, { timeout: 5000 });
                    const detail =
                        res.data?.songs?.[0] ||
                        res.data?.data?.[0] ||
                        res.data?.result?.songs?.[0] ||
                        (Array.isArray(res.data) ? res.data[0] : null);
                    if (detail) {
                        const cover = extractCover(detail);
                        if (cover) {
                            applyCoverToSong(songId, cover);
                            return true;
                        }
                    }
                } catch (e) {}
            }

            if (albumId) {
                for (let i = 0; i < Math.min(4, API_LIST.length); i++) {
                    const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                    try {
                        const url = buildApiUrl(apiBase, `/album?id=${albumId}`);
                        const res = await axios.get(url, { timeout: 4000 });
                        const album =
                            res.data?.album ||
                            res.data?.data?.album ||
                            res.data?.data ||
                            res.data?.result;
                        const cover = extractCover(album);
                        if (cover) {
                            applyCoverToSong(songId, cover);
                            return true;
                        }
                    } catch (e) {}
                }
            }

            const idx = searchResults.value.findIndex(s => s.id === songId);
            if (idx >= 0) searchResults.value[idx].loadingCover = false;
            return false;
        };

        const enrichCoversBatch = async (songs) => {
            if (!songs || !songs.length) return;
            const needIds = songs
                .filter(s => !s.picUrl || s.picUrl === DEFAULT_COVER || s.picUrl.includes('flaticon'))
                .map(s => s.id);
            if (!needIds.length) return;

            const batchSize = 50;
            for (let i = 0; i < needIds.length; i += batchSize) {
                const ids = needIds.slice(i, i + batchSize);
                const idsParam = '[' + ids.join(',') + ']';
                let detailSongs = null;
                for (const apiBase of API_LIST) {
                    try {
                        const url = `${apiBase}/song/detail?ids=${encodeURIComponent(idsParam)}`;
                        const res = await axios.get(url, { timeout: 10000 });
                        const arr = res.data?.songs
                            || res.data?.data
                            || (Array.isArray(res.data) ? res.data : null)
                            || res.data?.result?.songs;
                        if (Array.isArray(arr) && arr.length) {
                            detailSongs = arr;
                            break;
                        }
                    } catch (e) {}
                }
                if (!detailSongs) continue;
                detailSongs.forEach(d => {
                    const cover = extractCover(d);
                    if (!cover) return;
                    const target = songs.find(x => String(x.id) === String(d.id));
                    if (target && (!target.picUrl || target.picUrl === DEFAULT_COVER || target.picUrl.includes('flaticon'))) {
                        target.picUrl = cover;
                        target.loadingCover = false;
                    }
                    if (currentSongId && String(currentSongId) === String(d.id) &&
                        (!currentCover.value || currentCover.value === DEFAULT_COVER || currentCover.value.includes('flaticon'))) {
                        currentCover.value = cover;
                        fullscreenCover.value = cover;
                        setDynamicGradient(cover);
                    }
                });
            }
        };

        const loadImagesForResults = (songs) => {
            songs.forEach(song => {
                if (!song.picUrl || song.picUrl === DEFAULT_COVER || song.picUrl.includes('flaticon')) {
                    enqueueImageLoad(song.id, song.albumId);
                }
            });
        };

        const onImageLoad = (event) => {
            const img = event.target;
            // 尺寸检测：weserv 或网易云返回的"错误小图"会被拦截
            if (img.naturalWidth && img.naturalWidth < 20) {
                if (img.src !== DEFAULT_COVER) {
                    img.src = DEFAULT_COVER;
                    return;
                }
            }
            const wrapper = img.closest('.cover-wrapper');
            if (wrapper) {
                const loadingDiv = wrapper.querySelector('.cover-loading');
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
            if (img.classList && img.classList.contains('cover-large') && img.src.startsWith('http')) {
                setDynamicGradient(img.src);
            }
        };

        const onImageError = (event) => {
            const img = event.target;
            const current = img.src || '';

            const hideLoading = () => {
                const wrapper = img.closest('.cover-wrapper');
                if (wrapper) {
                    const loadingDiv = wrapper.querySelector('.cover-loading');
                    if (loadingDiv) loadingDiv.style.display = 'none';
                }
            };

            if (current === DEFAULT_COVER || current.startsWith('data:image/svg+xml')) {
                hideLoading();
                return;
            }
            if (!current || current.startsWith('data:') || current === window.location.href) {
                img.src = DEFAULT_COVER;
                hideLoading();
                return;
            }

            // 原始网易云 URL 失败 → weserv 代理
            if (/music\.126\.net/i.test(current) && img.dataset.triedWeserv !== 'true') {
                img.dataset.triedWeserv = 'true';
                img.src = weservWrap(current, 200);
                return;
            }

            // 任何其他失败 → 默认图
            img.src = DEFAULT_COVER;
            hideLoading();
        };

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
                    const url = buildApiUrl(apiBase, `/search?keywords=${encodeURIComponent(keyword)}&limit=30`);
                    const res = await axios.get(url, { timeout: 8000 });
                    const songs = res.data?.result?.songs || res.data?.data || (Array.isArray(res.data) ? res.data : null);
                    if (songs && songs.length) {
                        songsData = songs;
                        currentApiIndex = i;
                        break;
                    }
                } catch (e) {}
            }

            if (!songsData) {
                searchResults.value = [];
                playErrorMsg.value = '所有搜索接口均不可用';
                loadingSearch.value = false;
                return;
            }

            searchResults.value = songsData.map(item => {
                const id = item.id || item.song_id;
                const name = item.name || item.title || '未知';
                const artist = (item.artists || item.ar || []).map(a => a.name || a).join(' / ') || item.artist || '未知';
                const dur = item.duration || item.dt || 0;
                const isVip = checkIsVip(item);
                const albumId = item.album?.id || item.al?.id || item.albumId || null;
                let picUrl = extractCover(item);
                const needsCover = !picUrl;
                if (needsCover) picUrl = DEFAULT_COVER;
                return { id: String(id), name, artist, duration: dur, picUrl, isVip, albumId, loadingCover: needsCover };
            });
            loadingSearch.value = false;

            enrichCoversBatch(searchResults.value);
            loadImagesForResults(searchResults.value);
        };

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
                        const url = buildApiUrl(apiBase, `/song/url/v1?id=${songId}&level=${lv}`);
                        const res = await axios.get(url, { timeout: 15000 });
                        const musicUrl = (res.data?.data || [])[0]?.url;
                        if (musicUrl) { currentApiIndex = (currentApiIndex + i) % API_LIST.length; return toHttps(musicUrl); }
                    } catch (e) {}
                }
            }
            return null;
        };
        const getSongUrlLegacy = async (songId) => {
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    const url = buildApiUrl(apiBase, `/song/url?id=${songId}`);
                    const res = await axios.get(url, { timeout: 20000 });
                    const musicUrl = res.data?.data?.[0]?.url || res.data?.url || (typeof res.data === 'string' ? res.data : null);
                    if (musicUrl) { currentApiIndex = (currentApiIndex + i) % API_LIST.length; return toHttps(musicUrl); }
                } catch (err) {}
            }
            return null;
        };
        const getSongUrl = async (songId) => {
            let url;
            url = await probeOuterUrl(songId); if (url) return url;
            url = await getSongUrlV1(songId); if (url) return url;
            url = await getSongUrlLegacy(songId); if (url) return url;
            url = await probeOuterUrl(songId, true); if (url) return url;
            throw new Error('无法获取播放地址');
        };

        const getSongDetail = async (songId) => {
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    const url = buildApiUrl(apiBase, `/song/detail?ids=${songId}`);
                    const res = await axios.get(url, { timeout: 8000 });
                    const detail =
                        res.data?.songs?.[0] ||
                        res.data?.data?.[0] ||
                        res.data?.result?.songs?.[0] ||
                        (Array.isArray(res.data) ? res.data[0] : null);
                    if (detail) return detail;
                } catch (err) {}
            }
            throw new Error('无法获取歌曲详情');
        };

        const playSongById = async (songId, songName, artistName, coverUrl, addToQueue = true, queueIndex = -1) => {
            if (!songId) return;
            loadingPlay.value = true;
            playErrorMsg.value = '';
            try {
                const musicUrl = await getSongUrl(songId);
                currentSongName.value = songName || '未知歌曲';
                currentArtist.value = artistName || '网易云音乐';

                let initialCover = DEFAULT_COVER;
                if (coverUrl && (coverUrl.startsWith('http') || coverUrl.startsWith('data:')) && !coverUrl.includes('flaticon')) {
                    initialCover = toHttps(coverUrl);
                }
                currentCover.value = initialCover;
                currentIsVip.value = false;
                currentSongId = songId;
                currentSongArtist = currentArtist.value;
                currentAlbum.value = '';
                currentLrcRaw.value = '';
                currentTLrcRaw.value = '';
                addToHistory(songId, songName, currentArtist.value, currentCover.value);
                if (addToQueue) {
                    const existing = queue.value.find(s => s.id === songId);
                    if (!existing) {
                        queue.value.push({ id: songId, name: songName, artist: artistName, picUrl: currentCover.value });
                        currentQueueIndex = queue.value.length - 1;
                    } else {
                        currentQueueIndex = queue.value.findIndex(s => s.id === songId);
                    }
                } else if (queueIndex >= 0) {
                    currentQueueIndex = queueIndex;
                }
                fullscreenSongName.value = currentSongName.value;
                fullscreenArtist.value = currentArtist.value;
                fullscreenCover.value = currentCover.value;
                if (initialCover !== DEFAULT_COVER) setDynamicGradient(initialCover);

                if (initialCover === DEFAULT_COVER) {
                    getSongDetail(songId).then(detail => {
                        const c = extractCover(detail);
                        if (c && currentSongId === songId) {
                            currentCover.value = c;
                            fullscreenCover.value = c;
                            setDynamicGradient(c);
                        }
                    }).catch(() => {});
                }

                const audio = audioPlayer.value;
                if (audio) {
                    audio.pause();
                    audio.removeAttribute('src');
                    audio.load();
                    await new Promise(r => setTimeout(r, 10));
                    audio.src = musicUrl;
                    await new Promise(resolve => {
                        const handler = () => { audio.removeEventListener('canplay', handler); resolve(); };
                        audio.addEventListener('canplay', handler, { once: true });
                        setTimeout(resolve, 3000);
                    });
                    await audio.play();
                    isPlaying.value = true;
                    fullscreenIsPlaying.value = true;
                }
                fetchLyrics(songId);
                fetchAlbumInfo(songId);
            } catch (err) {
                console.error('播放错误:', err);
                playErrorMsg.value = err.message || '网络错误，请重试';
                logError(err, 'playSongById');
            } finally {
                loadingPlay.value = false;
            }
        };

        const toggleLoopMode = () => {
            if (loopMode.value === 'all') loopMode.value = 'one';
            else if (loopMode.value === 'one') loopMode.value = 'shuffle';
            else loopMode.value = 'all';
            if (loopMode.value === 'shuffle') shufflePlayed.clear();
            localStorage.setItem('loopMode', loopMode.value);
            playErrorMsg.value = `🔁 ${loopModeLabel.value}`;
            setTimeout(() => { if (playErrorMsg.value.startsWith('🔁')) playErrorMsg.value = ''; }, 2000);
        };

        const userPrev = () => {
            if (!queue.value.length) return;
            if (loopMode.value === 'shuffle') { playNext(true); return; }
            const total = queue.value.length;
            let i = currentQueueIndex - 1;
            if (i < 0) i = total - 1;
            const song = queue.value[i];
            playSongById(song.id, song.name, song.artist, song.picUrl, false, i);
        };

        const playNext = (manual = false) => {
            if (!queue.value.length) return;
            const total = queue.value.length;

            if (loopMode.value === 'shuffle') {
                if (shufflePlayed.size >= total) {
                    shufflePlayed.clear();
                    playErrorMsg.value = '🎲 所有歌曲已随机播放完毕';
                    setTimeout(() => { if (playErrorMsg.value.includes('随机播放')) playErrorMsg.value = ''; }, 3000);
                    return;
                }
                const pool = [];
                for (let i = 0; i < total; i++) {
                    if (!shufflePlayed.has(i) && i !== currentQueueIndex) pool.push(i);
                }
                if (pool.length === 0) {
                    shufflePlayed.clear();
                    playErrorMsg.value = '🎲 所有歌曲已随机播放完毕';
                    setTimeout(() => { if (playErrorMsg.value.includes('随机播放')) playErrorMsg.value = ''; }, 3000);
                    return;
                }
                const pickIdx = pool[Math.floor(Math.random() * pool.length)];
                shufflePlayed.add(pickIdx);
                const song = queue.value[pickIdx];
                playSongById(song.id, song.name, song.artist, song.picUrl, false, pickIdx);
                return;
            }

            let i = currentQueueIndex + 1;
            if (i >= total) i = 0;
            const song = queue.value[i];
            playSongById(song.id, song.name, song.artist, song.picUrl, false, i);
        };

        const userNext = () => playNext(true);

        const fetchAlbumInfo = async (songId) => {
            if (!songId) return;
            try {
                const detail = await getSongDetail(songId);
                if (currentSongId === songId) {
                    currentAlbum.value = detail?.al?.name || detail?.album?.name || '';
                    const c = extractCover(detail);
                    if (c && (!currentCover.value || currentCover.value === DEFAULT_COVER || currentCover.value.includes('flaticon'))) {
                        currentCover.value = c;
                        fullscreenCover.value = c;
                        setDynamicGradient(c);
                    }
                }
            } catch (e) {}
        };

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

        const downloadCurrentSong = async () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src) { playErrorMsg.value = '没有正在播放的歌曲'; return; }
            if (currentIsVip.value) { playErrorMsg.value = 'VIP歌曲暂不支持下载'; return; }
            if (window.__downloading) { playErrorMsg.value = '⏳ 正在下载中，请稍候...'; return; }

            window.__downloading = true;
            playErrorMsg.value = '⏳ 正在准备下载...';

            try {
                let songDetail = null;
                try { songDetail = await getSongDetail(currentSongId); } catch (e) {}

                const title = songDetail?.name || currentSongName.value || '未知歌曲';
                const artistArr = (songDetail?.ar || []).map(a => a.name).filter(Boolean);
                const artist = artistArr.length ? artistArr.join('/') : (currentArtist.value || '未知歌手');
                const album = songDetail?.al?.name || currentAlbum.value || '云音匣下载';
                const year = songDetail?.publishTime ? String(new Date(songDetail.publishTime).getFullYear()) : String(new Date().getFullYear());
                const trackNo = songDetail?.no ? String(songDetail.no) : '';

                let lyricText = '';
                let hasTranslation = false;
                if (currentLrcRaw.value) {
                    lyricText = buildMergedLrc(currentLrcRaw.value, currentTLrcRaw.value);
                    hasTranslation = !!currentTLrcRaw.value;
                }
                if (!lyricText) {
                    try {
                        const lrcRes = await requestWithFallback(`/lyric?id=${currentSongId}`, { timeout: 8000 });
                        const data = lrcRes.data;
                        const orig = data?.lrc?.lyric || (typeof data?.lrc === 'string' ? data.lrc : '') || data?.lyric || '';
                        const trans = data?.tlyric?.lyric || (typeof data?.tlyric === 'string' ? data.tlyric : '') || '';
                        lyricText = buildMergedLrc(orig, trans);
                        hasTranslation = !!trans;
                    } catch (e) {}
                }

                playErrorMsg.value = '⏳ 正在获取封面...';
                let coverBuffer = null;
                let coverMime = 'image/jpeg';
                const coverUrl = toHttps(songDetail?.al?.picUrl || (currentCover.value && currentCover.value.startsWith('http') ? currentCover.value : ''));
                if (coverUrl && !coverUrl.includes('flaticon')) {
                    try {
                        const ir = await fetch(coverUrl, { mode: 'cors' });
                        if (ir.ok) {
                            coverBuffer = await ir.arrayBuffer();
                            if (/\.png(\?|$)/i.test(coverUrl)) coverMime = 'image/png';
                        }
                    } catch (e) {}
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
                if (coverBuffer) writer.setFrame('APIC', { type: 3, data: coverBuffer, description: 'Cover', mime: coverMime });
                if (lyricText) writer.setFrame('USLT', { description: '', lyrics: lyricText });
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
                if (lyricText) features.push(hasTranslation ? '歌词(含翻译)' : '歌词');
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

        const togglePlayPause = () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src) return;
            if (audio.paused) { audio.play(); isPlaying.value = true; fullscreenIsPlaying.value = true; }
            else { audio.pause(); isPlaying.value = false; fullscreenIsPlaying.value = false; }
        };

        const updateProgress = () => {
            const audio = audioPlayer.value;
            if (audio && audio.duration) {
                currentTime.value = audio.currentTime;
                const percent = (audio.currentTime / audio.duration) * 100;
                progressValue.value = percent;
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
            isPlaying.value = false;
            fullscreenIsPlaying.value = false;
            if (loopMode.value === 'one') {
                const a = audioPlayer.value;
                if (a) { a.currentTime = 0; a.play(); isPlaying.value = true; fullscreenIsPlaying.value = true; }
                return;
            }
            playNext(false);
        };

        const onAudioError = (e) => {
            console.error('Audio error:', e);
            playErrorMsg.value = '播放失败，可能是音频链接无效';
            isPlaying.value = false; fullscreenIsPlaying.value = false;
        };

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
                    if (fullscreenCover.value !== currentCover.value) fullscreenCover.value = currentCover.value;
                }
            }, 200);
            nextTick(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        updateFullscreenScrollH();
                        scrollFullscreenLyricsToActive();
                        startKaraokeLoop();
                    });
                });
            });
        };
        const closeFullscreenPlayer = () => {
            fullscreenPlayerVisible.value = false;
            document.getElementById('fullscreenPlayer').style.display = 'none';
            document.body.style.overflow = '';
            if (fullscreenInterval) clearInterval(fullscreenInterval);
            stopKaraokeLoop();
        };
        const fullscreenSeek = () => {
            const a = audioPlayer.value;
            if (a && fullscreenDuration.value) {
                a.currentTime = (fullscreenProgressValue.value / 100) * fullscreenDuration.value;
                document.querySelectorAll('.progress-bar').forEach(bar => {
                    bar.style.setProperty('--progress-percent', `${fullscreenProgressValue.value}%`);
                });
            }
        };
        const fullscreenTogglePlayPause = togglePlayPause;

        let pointerDownPos = null;
        let pointerDownTime = 0;
        const onLyricPointerDown = (e) => {
            pointerDownPos = { x: e.clientX, y: e.clientY };
            pointerDownTime = Date.now();
        };
        const seekToLyric = (time, event) => {
            if (pointerDownPos && event) {
                const dx = Math.abs(event.clientX - pointerDownPos.x);
                const dy = Math.abs(event.clientY - pointerDownPos.y);
                if (dx > 6 || dy > 6) return;
            }
            if (Date.now() - pointerDownTime > 400) return;
            const audio = audioPlayer.value;
            if (!audio) return;
            audio.currentTime = time;
            if (audio.paused) { audio.play(); isPlaying.value = true; fullscreenIsPlaying.value = true; }
        };

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
            if (currentCover.value && currentCover.value.startsWith('http')) setDynamicGradient(currentCover.value);
            playErrorMsg.value = '✅ 已恢复主题背景';
            setTimeout(() => { if (playErrorMsg.value.includes('主题背景')) playErrorMsg.value = ''; }, 2000);
        };
        const saveBlurEnabled = () => { localStorage.setItem('blurEnabled', blurEnabled.value); if (blurEnabled.value) document.body.classList.add('blur-enabled'); else document.body.classList.remove('blur-enabled'); };
        const saveBgBlur = () => { localStorage.setItem('bgBlur', bgBlur.value); document.body.style.setProperty('--bg-blur-amount', `${bgBlur.value / 10}px`); };
        const saveCardOpacity = () => { localStorage.setItem('cardOpacity', cardOpacity.value); document.body.style.setProperty('--card-opacity', cardOpacity.value / 100); };
        const saveContainerOpacity = () => { localStorage.setItem('containerOpacity', containerOpacity.value); document.body.style.setProperty('--container-opacity', containerOpacity.value / 100); };
        const saveMaskOpacity = () => { localStorage.setItem('maskOpacity', maskOpacity.value); document.body.style.setProperty('--mask-opacity', maskOpacity.value / 100); };
        const saveGlassIntensity = () => { localStorage.setItem('glassIntensity', glassIntensity.value); document.querySelector('.app-container').style.backdropFilter = `blur(${glassIntensity.value}px)`; };
        const saveFontScale = () => { localStorage.setItem('fontScale', fontScale.value); document.documentElement.style.setProperty('--font-scale', fontScale.value / 100); };
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
        const saveKaraokeEnabled = () => {
            localStorage.setItem('karaokeEnabled', karaokeEnabled.value);
        };

        const toggleKaraokeFromPlayer = () => {
            karaokeEnabled.value = !karaokeEnabled.value;
            saveKaraokeEnabled();
            if (karaokeEnabled.value && fullscreenPlayerVisible.value) {
                startKaraokeLoop();
                playErrorMsg.value = '🎤 卡拉OK 已开启';
            } else {
                stopKaraokeLoop();
                document.querySelectorAll('.fullscreen-lyric-line.active').forEach(el => {
                    el.style.removeProperty('--karaoke-percent');
                });
                playErrorMsg.value = '🎤 卡拉OK 已关闭';
            }
            setTimeout(() => { if (playErrorMsg.value.includes('卡拉OK')) playErrorMsg.value = ''; }, 2000);
        };

        const FONT_DB_NAME = 'cloudmusic-db';
        const FONT_STORE = 'fonts';
        const FONT_KEY = 'custom-font';
        const openFontDB = () => {
            if (!window.idb || !window.idb.openDB) return Promise.reject(new Error('idb 库未加载'));
            return window.idb.openDB(FONT_DB_NAME, 1, {
                upgrade(db) { if (!db.objectStoreNames.contains(FONT_STORE)) db.createObjectStore(FONT_STORE); }
            });
        };
        const applyFontFromData = (arrayBuffer, fileName, mime) => {
            const oldStyle = document.getElementById('custom-font-style');
            if (oldStyle) oldStyle.remove();
            if (window.__customFontUrl) { try { URL.revokeObjectURL(window.__customFontUrl); } catch (e) {} window.__customFontUrl = null; }
            const blob = new Blob([arrayBuffer], { type: mime });
            const fontUrl = URL.createObjectURL(blob);
            window.__customFontUrl = fontUrl;
            const format = mime.includes('woff2') ? 'woff2' : mime.includes('woff') ? 'woff' : mime.includes('otf') ? 'opentype' : 'truetype';
            const style = document.createElement('style');
            style.id = 'custom-font-style';
            style.textContent = `@font-face { font-family: 'CustomFont'; src: url('${fontUrl}') format('${format}'); font-display: swap; } * { font-family: 'CustomFont', system-ui, sans-serif !important; }`;
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
                playErrorMsg.value = '✅ 字体已应用并保存';
                setTimeout(() => { if (playErrorMsg.value.includes('字体')) playErrorMsg.value = ''; }, 2500);
                event.target.value = '';
            } catch (e) {
                playErrorMsg.value = '❌ 字体保存失败：' + (e.message || '未知错误');
            }
        };
        const loadCustomFontFromDB = async () => {
            try {
                const db = await openFontDB();
                const fontData = await db.get(FONT_STORE, FONT_KEY);
                db.close();
                if (fontData && fontData.data) applyFontFromData(fontData.data, fontData.name, fontData.mime);
            } catch (e) {}
        };
        const restoreDefaultFont = async () => {
            try {
                const style = document.getElementById('custom-font-style');
                if (style) style.remove();
                if (window.__customFontUrl) { try { URL.revokeObjectURL(window.__customFontUrl); } catch (e) {} window.__customFontUrl = null; }
                const db = await openFontDB();
                await db.delete(FONT_STORE, FONT_KEY);
                db.close();
                playErrorMsg.value = '✅ 已恢复默认字体';
                setTimeout(() => { if (playErrorMsg.value.includes('字体')) playErrorMsg.value = ''; }, 2500);
            } catch (e) { playErrorMsg.value = '❌ 恢复默认字体失败'; }
        };

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
                autoFullscreenOnEnter: autoFullscreenOnEnter.value,
                loopMode: loopMode.value,
                karaokeEnabled: karaokeEnabled.value,
                customAccent: customAccent.value,
                customBgStart: customBgStart.value,
                customBgEnd: customBgEnd.value
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
                    if (s.loopMode) { loopMode.value = s.loopMode; localStorage.setItem('loopMode', s.loopMode); }
                    if (s.karaokeEnabled !== undefined) { karaokeEnabled.value = s.karaokeEnabled; saveKaraokeEnabled(); }
                    if (s.customAccent) { customAccent.value = s.customAccent; applyCustomColors(); }
                    if (s.customBgStart) { customBgStart.value = s.customBgStart; applyCustomColors(); }
                    if (s.customBgEnd) { customBgEnd.value = s.customBgEnd; applyCustomColors(); }
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

        const loadPlaylists = async () => {
            const allIds = [
                '3778678',
                '19723756',
                '3136952023',
                '6727748870',
                '2253631882',
                '2884035',
                '3779629'
            ];
            const shuffled = allIds.sort(() => 0.5 - Math.random());
            const plist = [];
            for (const pid of shuffled) {
                if (plist.length >= 4) break;
                try {
                    const res = await requestWithFallback(`/playlist/detail?id=${pid}`, { timeout: 8000 });
                    if (res.data && res.data.playlist) {
                        const name = res.data.playlist.name || '';
                        if (/喜欢的音乐|lan0101806/i.test(name)) continue;
                        plist.push({
                            id: res.data.playlist.id,
                            name: res.data.playlist.name,
                            coverImgUrl: toHttps(res.data.playlist.coverImgUrl || ''),
                            trackCount: res.data.playlist.trackCount
                        });
                    }
                } catch (e) {}
            }
            recommendPlaylists.value = plist.length ? plist : [
                { id: '3778678', name: '热歌榜', coverImgUrl: DEFAULT_COVER, trackCount: 100 }
            ];
        };

        const fetchPlaylistTracks = async (playlistId, plName, isCustom = false) => {
            searchResults.value = [];
            searchPerformed.value = true;
            loadingSearch.value = true;

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
                        const cover = extractCover(track);
                        return {
                            id: String(track.id),
                            name: track.name || '未知',
                            artist: (track.ar || track.artists || []).map(a => a.name || a).join('/') || '未知',
                            duration: track.dt || track.duration || 0,
                            picUrl: cover || DEFAULT_COVER,
                            isVip: checkIsVip(track),
                            albumId: track.album?.id || track.al?.id || track.albumId || null,
                            loadingCover: !cover
                        };
                    });
                    searchResults.value = songList;
                    playErrorMsg.value = `✅ 已加载歌单: ${plName} (共 ${songList.length} 首)`;
                    if (isCustom) {
                        queue.value = songList.map(s => ({ id: s.id, name: s.name, artist: s.artist, picUrl: s.picUrl }));
                        currentQueueIndex = -1;
                        playErrorMsg.value += ' · 已加入播放队列';
                    }
                    enrichCoversBatch(songList);
                    setTimeout(() => { if (playErrorMsg.value.includes('已加载歌单')) playErrorMsg.value = ''; }, 3000);
                } else {
                    searchResults.value = [];
                    playErrorMsg.value = '❌ 歌单加载失败';
                }
            } catch (e) {
                searchResults.value = [];
                playErrorMsg.value = '❌ 歌单接口异常';
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
                    setTimeout(() => { if (playErrorMsg.value.includes('Cookie')) playErrorMsg.value = ''; }, 2500);
                }
                return false;
            }
            loadingMyPlaylists.value = true;
            if (autoOpenModal) document.getElementById('myPlaylistsModal').style.display = 'flex';
            try {
                const uid = await getMyUid();
                if (!uid) throw new Error('Cookie 可能已失效');
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
                const cover = extractCover(detail);
                const song = { id: String(detail.id), name: detail.name, artist: (detail.ar || []).map(a => a.name).join('/'), picUrl: cover || DEFAULT_COVER, isVip };
                if (isVip && !userCookie.value.trim()) showVipModal(song);
                else playSongById(song.id, song.name, song.artist, song.picUrl);
            } catch (err) { playErrorMsg.value = '获取歌曲信息失败，请检查ID'; }
        };

        const openSettingsModal = () => { document.getElementById('settingsModal').style.display = 'flex'; };
        const closeSettingsModal = () => { document.getElementById('settingsModal').style.display = 'none'; };
        const openFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'flex'; };
        const closeFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'none'; };

        const initModalEvents = () => {
            const modals = ['themeModal', 'settingsModal', 'feedbackModal', 'vipModal', 'sleepTimerModal', 'myPlaylistsModal', 'iosInstallModal'];
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

        onMounted(() => {
            loadAllSettings();
            loadCustomFontFromDB();
            loadPlaylists();
            initModalEvents();
            window.addEventListener('keydown', handleKeydown);
            document.addEventListener('fullscreenchange', onFullscreenChange);
            window.addEventListener('resize', onWindowResize);
            if (autoFullscreenOnEnter.value) setupAutoFullscreen();
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW注册失败', e));
            }

            // 兜底修复：把 referrerpolicy 从 no-referrer 改掉，避免网易云 CDN 拒绝
            const fixReferrer = () => {
                document.querySelectorAll('img[referrerpolicy="no-referrer"]').forEach(img => {
                    img.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                });
            };
            fixReferrer();
            const obs = new MutationObserver(muts => {
                muts.forEach(m => m.addedNodes.forEach(n => {
                    if (n.nodeType === 1) {
                        if (n.tagName === 'IMG' && n.getAttribute('referrerpolicy') === 'no-referrer') {
                            n.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                        }
                        n.querySelectorAll && n.querySelectorAll('img[referrerpolicy="no-referrer"]').forEach(img => {
                            img.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                        });
                    }
                }));
            });
            obs.observe(document.body, { childList: true, subtree: true });

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
        });

        onUnmounted(() => {
            window.removeEventListener('resize', onWindowResize);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            stopKaraokeLoop();
        });

        return {
            searchKeyword, songIdInput, playlistUrlInput, searchResults, loadingSearch, searchPerformed,
            currentSongName, currentArtist, currentCover, loadingPlay, playErrorMsg, audioPlayer,
            isPlaying, currentTime, duration, progressValue, volumeValue,
            lyricsLines, currentLyricIndex, lyricsContainer,
            playHistory, recommendPlaylists,
            formatDuration, formatTime, searchSongs, parseById,
            togglePlayPause, updateProgress, onLoadedMetadata, seekAudio, changeVolume,
            onAudioEnded, onAudioError,
            loadPlaylists, fetchPlaylistTracks, loadCustomPlaylist,
            handlePlayClick, downloadCurrentSong, onImageLoad, onImageError,
            loopMode, loopModeLabel, loopModeIcon, toggleLoopMode, userPrev, userNext,
            openFullscreenPlayer, closeFullscreenPlayer,
            fullscreenCover, fullscreenSongName, fullscreenArtist,
            fullscreenLyrics, fullscreenLyricIndex, fullscreenCurrentTime,
            fullscreenDuration, fullscreenProgressValue, fullscreenIsPlaying,
            fullscreenLyricsContainer,
            fullscreenSeek, fullscreenTogglePlayPause,
            seekToLyric, onLyricPointerDown,
            currentTheme, openThemeModal, closeThemeModal, setTheme,
            customAccent, customBgStart, customBgEnd, applyCustomColors,
            karaokeEnabled, saveKaraokeEnabled, toggleKaraokeFromPlayer,
            bgImageUrl, blurEnabled, bgBlur, cardOpacity, containerOpacity, maskOpacity, glassIntensity,
            saveBgImage, resetBgImage, saveBlurEnabled, saveBgBlur, saveCardOpacity, saveContainerOpacity, saveMaskOpacity, saveGlassIntensity,
            fontScale, saveFontScale,
            openSettingsModal, closeSettingsModal, openFeedbackModal, closeFeedbackModal,
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
