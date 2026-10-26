const { createApp, ref, onMounted, onUnmounted, nextTick, computed, watch } = Vue;

const DEFAULT_COVER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"></svg>'
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
        let activePlayToken = 0;

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

        const isMobileView = ref(false);

        const userCookie = ref('');

        const QUALITY_LEVELS = ['lossless', 'exhigh', 'higher', 'standard'];
        const qualityLevel = ref(localStorage.getItem('qualityLevel') || 'exhigh');

        const myPlaylists = ref([]);
        const loadingMyPlaylists = ref(false);

        const createdPlaylists = computed(() => myPlaylists.value.filter(p => !p.subscribed));
        const subscribedPlaylists = computed(() => myPlaylists.value.filter(p => p.subscribed));

        const bugDescription = ref('');
        const logContent = ref('');
        const logHint = ref('');

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

        const checkMobileView = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            let mobile;
            if (orientationMode.value === 'portrait') {
                mobile = true;
            } else if (orientationMode.value === 'landscape') {
                mobile = false;
            } else {
                mobile = w <= 768 || (h > w && w <= 1024);
            }
            isMobileView.value = mobile;
            document.body.classList.toggle('mobile-view', mobile);
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
                checkMobileView();
                playErrorMsg.value = '✅ 已恢复自动布局';
                setTimeout(() => { if (playErrorMsg.value.includes('布局') || playErrorMsg.value.includes('方向')) playErrorMsg.value = ''; }, 2000);
                return;
            }
            try {
                if (!document.fullscreenElement) {
                    try { await document.documentElement.requestFullscreen(); }
                    catch (e) {
                        checkMobileView();
                        playErrorMsg.value = '布局已切换（锁定方向需全屏）';
                        setTimeout(() => { if (playErrorMsg.value.includes('布局')) playErrorMsg.value = ''; }, 2500);
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
            checkMobileView();
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
            checkMobileView();
            if (fullscreenPlayerVisible.value) {
                updateFullscreenScrollH();
                scrollFullscreenLyricsToActive();
            }
        };

        /* ============================================================
           朋友的 Meting API（主力）
           ============================================================ */
        const METING_BASE = 'https://musicapi.bixygames.com/api';
        const metingUrl = (type, id, extra = '') =>
            `${METING_BASE}?server=netease&type=${type}&id=${encodeURIComponent(id)}${extra}`;

        /* ============================================================
           补充 API（从原 13 个里挑出最稳定的 4 个）
           用于：歌曲详情、歌单详情、歌单全部歌曲、用户歌单、VIP 播放地址
           ============================================================ */
        const SUPPLEMENT_API_LIST = [
            'https://netease-cloud-music-api-five-roan-88.vercel.app',
            'https://music-api.heheda.top',
            'https://ncm.zhenxin.me',
            'https://ncme.zhenxin.me'
        ];

        let currentApiIndex = 0;

        const API_COOLDOWN_MS = 5 * 60 * 1000;
        const apiCooldown = new Map();

        const isApiAvailable = (apiBase) => {
            const until = apiCooldown.get(apiBase);
            if (!until) return true;
            if (Date.now() > until) {
                apiCooldown.delete(apiBase);
                return true;
            }
            return false;
        };

        const markApiFailed = (apiBase) => {
            apiCooldown.set(apiBase, Date.now() + API_COOLDOWN_MS);
        };

        const markApiOk = (apiBase) => {
            if (apiCooldown.has(apiBase)) apiCooldown.delete(apiBase);
        };

        const toHttps = (url) => (url && typeof url === 'string') ? url.replace(/^http:\/\//i, 'https://') : url;

        const extractIdFromMetingUrl = (url) => {
            if (!url) return '';
            const m = String(url).match(/[?&]id=(\d+)/);
            return m ? m[1] : '';
        };

        const metingItemToSong = (item) => {
            if (!item) return null;
            const id = extractIdFromMetingUrl(item.url) || '';
            return {
                id: id || String(Math.random()),
                name: item.title || '未知',
                artist: item.author || '未知',
                duration: 0,
                picUrl: toHttps(item.pic || '') || DEFAULT_COVER,
                playUrl: toHttps(item.url || ''),
                lrcUrl: toHttps(item.lrc || ''),
                isVip: false,
                albumId: null,
                loadingCover: false,
                needFetchCover: false
            };
        };

        const checkIsVip = (item) => {
            const fee = item?.fee ?? 0;
            return fee === 1 || fee === 4;
        };

        const fixImageUrl = (url) => {
            if (!url || typeof url !== 'string') return '';
            url = url.trim();
            if (!url) return '';
            if (url.startsWith('//')) url = 'https:' + url;
            if (!/^https?:\/\//i.test(url)) return '';
            return url.replace(/^http:\/\//i, 'https://');
        };

        const proxyCover = (url, size = 200) => {
            if (!url || typeof url !== 'string' || !url.startsWith('http')) return '';
            if (url.includes('images.weserv.nl')) return url;
            const clean = url.replace(/^https?:\/\//i, '');
            return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=${size}&h=${size}&fit=cover&output=jpg`;
        };

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
        const addToHistory = (id, name, artist, cover, isVip = false) => {
            const existing = playHistory.value.find(item => item.id === id);
            if (!existing) {
                playHistory.value.unshift({ id, name, artist, cover: toHttps(cover), isVip });
                if (playHistory.value.length > 8) playHistory.value.pop();
            }
        };
        const logError = (error, context) => {
            try {
                const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
                logs.push({
                    time: new Date().toISOString(),
                    error: (error && (error.message || error.toString())) || String(error),
                    context: context || 'unknown'
                });
                while (logs.length > 100) logs.shift();
                localStorage.setItem('errorLogs', JSON.stringify(logs));
            } catch (e) {}
            console.error(`[${context}]`, error);
        };

        const collectEnvInfo = () => {
            const info = {
                '生成时间': new Date().toLocaleString('zh-CN'),
                '页面 URL': location.href,
                'User Agent': navigator.userAgent,
                '平台': navigator.platform,
                '语言': navigator.language,
                '屏幕': `${screen.width}x${screen.height}`,
                '窗口': `${window.innerWidth}x${window.innerHeight}`,
                '设备像素比': window.devicePixelRatio,
                '布局模式': isMobileView.value ? '移动端' : '桌面端',
                '方向设置': orientationMode.value,
                '当前主题': currentTheme.value,
                '是否填写 Cookie': userCookie.value.trim() ? '是' : '否',
                'Cookie 长度': String(userCookie.value.trim().length),
                'API 主力': '朋友的 Meting API',
                '补充 API 索引': String(currentApiIndex),
                '正在播放': currentSongName.value || '(无)',
                '当前歌曲 ID': currentSongId || '(无)',
                '当前是否 VIP': currentIsVip.value ? '是' : '否',
                '播放状态': isPlaying.value ? '播放中' : '暂停',
                '队列长度': String(queue.value.length),
                '搜索结果数': String(searchResults.value.length),
                'PWA 模式': isStandalone.value ? '是' : '否',
                '在线状态': navigator.onLine ? '在线' : '离线'
            };
            return Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('\n');
        };

        const buildLogText = () => {
            let logs = [];
            try { logs = JSON.parse(localStorage.getItem('errorLogs') || '[]'); } catch (e) {}
            const envInfo = collectEnvInfo();
            const desc = (bugDescription.value || '').trim();
            const parts = [];
            parts.push('========== 云音匣调试日志 ==========');
            parts.push('');
            parts.push('【问题描述】');
            parts.push(desc || '（用户未填写）');
            parts.push('');
            parts.push('【环境信息】');
            parts.push(envInfo);
            parts.push('');
            parts.push('【错误日志】');
            if (!logs.length) {
                parts.push('（暂无错误记录）');
            } else {
                logs.forEach((log, i) => {
                    parts.push(`[${i + 1}] ${log.time}`);
                    parts.push(`  context: ${log.context || '未知'}`);
                    parts.push(`  error: ${log.error || '未知'}`);
                    parts.push('');
                });
            }
            parts.push('========== 日志结束 ==========');
            return parts.join('\n');
        };

        const refreshLogContent = () => {
            logContent.value = buildLogText();
            logHint.value = '✅ 日志已刷新';
            setTimeout(() => { if (logHint.value.includes('刷新')) logHint.value = ''; }, 2000);
        };

        const openLogExportModal = () => {
            bugDescription.value = '';
            logContent.value = buildLogText();
            logHint.value = '';
            document.getElementById('logExportModal').style.display = 'flex';
        };

        const closeLogExportModal = () => {
            document.getElementById('logExportModal').style.display = 'none';
        };

        const copyLogToClipboard = async () => {
            logHint.value = '';
            const text = logContent.value || buildLogText();
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                logHint.value = '✅ 已复制到剪贴板，可直接粘贴发送';
            } catch (e) {
                logHint.value = '❌ 复制失败：' + (e.message || '未知错误') + '，请手动长按全选复制';
            }
            setTimeout(() => { if (logHint.value.includes('复制')) logHint.value = ''; }, 3000);
        };

        const downloadLogFile = () => {
            const text = logContent.value || buildLogText();
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.href = url;
            a.download = `云音匣日志_${ts}.txt`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            logHint.value = '✅ 文件已下载';
            setTimeout(() => { if (logHint.value.includes('下载')) logHint.value = ''; }, 2000);
        };

        const clearLogs = () => {
            if (!confirm('确定要清空所有错误日志吗？')) return;
            localStorage.removeItem('errorLogs');
            playErrorMsg.value = '✅ 日志已清空';
            setTimeout(() => { if (playErrorMsg.value.includes('日志')) playErrorMsg.value = ''; }, 2000);
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
            if (isMobileView.value) document.body.classList.add('mobile-view');
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

        /* ============================================================
           歌词：朋友的 Meting API type=lrc
           ============================================================ */
        const fetchLyrics = async (songId) => {
            try {
                const lrcUrl = metingUrl('lrc', songId);
                const r = await axios.get(lrcUrl, { timeout: 10000 });
                let text = '';
                if (typeof r.data === 'string') text = r.data;
                else if (r.data?.lyric) text = r.data.lyric;
                currentLrcRaw.value = text;
                currentTLrcRaw.value = '';
                const merged = mergeLyrics(text, '');
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

        watch(orientationMode, () => { checkMobileView(); });

        const buildApiUrl = (apiBase, path) => {
            if (!userCookie.value.trim()) return `${apiBase}${path}`;
            const sep = path.includes('?') ? '&' : '?';
            return `${apiBase}${path}${sep}cookie=${encodeURIComponent(userCookie.value)}`;
        };

        const requestWithFallback = async (urlPath, options = {}) => {
            const maxRetries = SUPPLEMENT_API_LIST.length;
            let lastError = null;
            for (let i = 0; i < maxRetries; i++) {
                const apiIndex = (currentApiIndex + i) % maxRetries;
                const apiBase = SUPPLEMENT_API_LIST[apiIndex];
                if (!isApiAvailable(apiBase)) continue;
                const fullUrl = buildApiUrl(apiBase, urlPath);
                try {
                    const response = await axios.get(fullUrl, { timeout: options.timeout || 8000, ...options });
                    currentApiIndex = apiIndex;
                    markApiOk(apiBase);
                    return response;
                } catch (err) {
                    markApiFailed(apiBase);
                    lastError = err;
                }
            }
            throw lastError || new Error('所有补充 API 均不可用');
        };

        const onImageLoad = (event) => {
            const img = event.target;
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
            if (current === DEFAULT_COVER || current.startsWith('data:image/svg+xml')) {
                const wrapper = img.closest('.cover-wrapper');
                if (wrapper) {
                    const loadingDiv = wrapper.querySelector('.cover-loading');
                    if (loadingDiv) loadingDiv.style.display = 'none';
                }
                return;
            }
            img.src = DEFAULT_COVER;
            const wrapper = img.closest('.cover-wrapper');
            if (wrapper) {
                const loadingDiv = wrapper.querySelector('.cover-loading');
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
        };

        /* ============================================================
           搜索：朋友的 Meting + 异步补充歌曲详情
           ============================================================ */
        const enrichSongsWithDetail = async (songs) => {
            const ids = songs.map(s => s.id).filter(id => /^\d+$/.test(id));
            if (!ids.length) return;
            const batchSize = 100;
            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                try {
                    const res = await requestWithFallback(`/song/detail?ids=${batch.join(',')}`, { timeout: 10000 });
                    const detailSongs = res.data?.songs || res.data?.data || [];
                    detailSongs.forEach(d => {
                        const target = songs.find(s => String(s.id) === String(d.id));
                        if (target) {
                            target.duration = d.dt || 0;
                            target.isVip = checkIsVip(d);
                            target.albumId = d.al?.id || null;
                            const cover = d.al?.picUrl;
                            if (cover && cover.startsWith('http')) {
                                target.picUrl = toHttps(cover);
                            }
                        }
                    });
                } catch (e) {
                    logError(e, 'enrichSongsWithDetail');
                }
            }
        };

        const searchSongs = async () => {
            const keyword = searchKeyword.value.trim();
            if (!keyword) return alert('请输入歌名或歌手');
            searchResults.value = [];
            searchPerformed.value = true;
            loadingSearch.value = true;

            try {
                const res = await axios.get(metingUrl('search', keyword), { timeout: 15000 });
                const items = Array.isArray(res.data) ? res.data : [];
                if (!items.length) {
                    playErrorMsg.value = '没有找到相关歌曲';
                    logError('搜索无结果: ' + keyword, 'searchSongs');
                    loadingSearch.value = false;
                    return;
                }
                searchResults.value = items.map(metingItemToSong).filter(Boolean);
                loadingSearch.value = false;
                enrichSongsWithDetail(searchResults.value);
            } catch (e) {
                searchResults.value = [];
                playErrorMsg.value = '搜索失败：' + (e.message || '接口异常');
                logError(e, 'searchSongs');
                loadingSearch.value = false;
            }
        };

        /* ============================================================
           播放地址：Meting（免费）+ 补充 API（VIP）
           ============================================================ */
        const getSongUrlV1ForVip = async (songId) => {
            for (const apiBase of SUPPLEMENT_API_LIST) {
                if (!isApiAvailable(apiBase)) continue;
                for (const lv of ['exhigh', 'higher', 'standard']) {
                    try {
                        const url = buildApiUrl(apiBase, `/song/url/v1?id=${songId}&level=${lv}`);
                        const res = await axios.get(url, { timeout: 12000 });
                        const item = (res.data?.data || [])[0];
                        if (item?.url) {
                            const trial = item.freeTrialInfo;
                            const isTrial = !!(trial && typeof trial === 'object');
                            if (isTrial) continue;
                            markApiOk(apiBase);
                            return toHttps(item.url);
                        }
                    } catch (e) {
                        markApiFailed(apiBase);
                    }
                }
            }
            return null;
        };

        const getSongUrl = async (songId, isVip, playUrl) => {
            if (isVip) {
                const url = await getSongUrlV1ForVip(songId);
                if (url) return url;
                if (playUrl) return playUrl;
                return metingUrl('url', songId);
            }
            if (playUrl) return playUrl;
            return metingUrl('url', songId);
        };

        const getSongDetail = async (songId) => {
            for (let i = 0; i < SUPPLEMENT_API_LIST.length; i++) {
                const apiBase = SUPPLEMENT_API_LIST[(currentApiIndex + i) % SUPPLEMENT_API_LIST.length];
                if (!isApiAvailable(apiBase)) continue;
                try {
                    const url = buildApiUrl(apiBase, `/song/detail?ids=${songId}`);
                    const res = await axios.get(url, { timeout: 8000 });
                    const detail = res.data?.songs?.[0] || res.data?.data?.[0];
                    if (detail) {
                        currentApiIndex = (currentApiIndex + i) % SUPPLEMENT_API_LIST.length;
                        markApiOk(apiBase);
                        return detail;
                    }
                } catch (err) {
                    markApiFailed(apiBase);
                }
            }
            throw new Error('无法获取歌曲详情');
        };

        const playSongById = async (songId, songName, artistName, coverUrl, addToQueue = true, queueIndex = -1, isVip = false, playUrl = '') => {
            if (!songId) return;
            const myToken = ++activePlayToken;
            loadingPlay.value = true;
            playErrorMsg.value = '';
            try {
                const musicUrl = await getSongUrl(songId, isVip, playUrl);
                if (myToken !== activePlayToken) { loadingPlay.value = false; return; }

                currentSongName.value = songName || '未知歌曲';
                currentArtist.value = artistName || '网易云音乐';

                let initialCover = DEFAULT_COVER;
                if (coverUrl && coverUrl.startsWith('http') && coverUrl !== DEFAULT_COVER) {
                    initialCover = coverUrl;
                }
                currentCover.value = initialCover;
                currentIsVip.value = !!isVip;
                currentSongId = songId;
                currentSongArtist = currentArtist.value;
                currentAlbum.value = '';
                currentLrcRaw.value = '';
                currentTLrcRaw.value = '';
                addToHistory(songId, songName, currentArtist.value, currentCover.value, !!isVip);

                if (addToQueue) {
                    const existing = queue.value.find(s => s.id === songId);
                    if (!existing) {
                        queue.value.push({ id: songId, name: songName, artist: artistName, picUrl: currentCover.value, isVip: !!isVip, playUrl });
                        currentQueueIndex = queue.value.length - 1;
                    } else {
                        existing.isVip = !!isVip;
                        existing.playUrl = playUrl || existing.playUrl;
                        currentQueueIndex = queue.value.findIndex(s => s.id === songId);
                    }
                } else if (queueIndex >= 0) {
                    currentQueueIndex = queueIndex;
                }
                fullscreenSongName.value = currentSongName.value;
                fullscreenArtist.value = currentArtist.value;
                fullscreenCover.value = currentCover.value;
                if (initialCover !== DEFAULT_COVER) setDynamicGradient(initialCover);

                const audio = audioPlayer.value;
                if (audio) {
                    audio.pause();
                    audio.removeAttribute('src');
                    audio.load();

                    await new Promise(r => setTimeout(r, 10));
                    if (myToken !== activePlayToken) { loadingPlay.value = false; return; }

                    audio.src = musicUrl;
                    await new Promise(resolve => {
                        const handler = () => { audio.removeEventListener('canplay', handler); resolve(); };
                        audio.addEventListener('canplay', handler, { once: true });
                        setTimeout(resolve, 3000);
                    });

                    if (myToken !== activePlayToken) { loadingPlay.value = false; return; }

                    try {
                        await audio.play();
                        if (myToken === activePlayToken) {
                            isPlaying.value = true;
                            fullscreenIsPlaying.value = true;
                        }
                    } catch (e) {
                        if (e.name !== 'AbortError' && !/interrupted|paused/i.test(e.message)) {
                            throw e;
                        }
                    }
                }

                if (myToken !== activePlayToken) { loadingPlay.value = false; return; }
                fetchLyrics(songId);
                fetchAlbumInfo(songId);
            } catch (err) {
                if (myToken === activePlayToken) {
                    console.error('播放错误:', err);
                    playErrorMsg.value = err.message || '网络错误，请重试';
                    logError(err, 'playSongById');
                }
            } finally {
                if (myToken === activePlayToken) loadingPlay.value = false;
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
            playSongById(song.id, song.name, song.artist, song.picUrl, false, i, !!song.isVip, song.playUrl || '');
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
                playSongById(song.id, song.name, song.artist, song.picUrl, false, pickIdx, !!song.isVip, song.playUrl || '');
                return;
            }

            let i = currentQueueIndex + 1;
            if (i >= total) i = 0;
            const song = queue.value[i];
            playSongById(song.id, song.name, song.artist, song.picUrl, false, i, !!song.isVip, song.playUrl || '');
        };

        const userNext = () => playNext(true);

        const fetchAlbumInfo = async (songId) => {
            if (!songId) return;
            try {
                const detail = await getSongDetail(songId);
                if (currentSongId === songId) {
                    currentAlbum.value = detail?.al?.name || detail?.album?.name || '';
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
                        const lrcUrl = metingUrl('lrc', currentSongId);
                        const lrcRes = await axios.get(lrcUrl, { timeout: 10000 });
                        const text = typeof lrcRes.data === 'string' ? lrcRes.data : (lrcRes.data?.lyric || '');
                        lyricText = text;
                    } catch (e) {}
                }

                playErrorMsg.value = '⏳ 正在获取封面...';
                let coverBuffer = null;
                let coverMime = 'image/jpeg';
                const coverUrl = toHttps(songDetail?.al?.picUrl || (currentCover.value && currentCover.value.startsWith('http') && !currentCover.value.includes('weserv') ? currentCover.value : ''));
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
                if (lyricText) features.push('歌词');
                features.push('完整信息');
                playErrorMsg.value = `✅ 下载完成（含${features.join(' / ')}）${currentIsVip.value ? '（VIP 可能仅含试听部分）' : ''}`;
                setTimeout(() => { if (playErrorMsg.value.includes('下载完成')) playErrorMsg.value = ''; }, 3000);
            } catch (e) {
                console.error('[下载] 失败:', e);
                logError(e, 'downloadCurrentSong');
                playErrorMsg.value = '❌ 下载失败：' + (e.message || '未知错误');
                setTimeout(() => { if (playErrorMsg.value.includes('下载失败')) playErrorMsg.value = ''; }, 4000);
            } finally {
                window.__downloading = false;
            }
        };

        const togglePlayPause = () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src) return;
            if (audio.paused) {
                audio.play().then(() => {
                    isPlaying.value = true;
                    fullscreenIsPlaying.value = true;
                }).catch(e => {
                    if (e.name !== 'AbortError' && !/interrupted|paused/i.test(e.message)) {
                        console.warn('播放失败:', e);
                        logError(e, 'togglePlayPause');
                    }
                });
            } else {
                audio.pause();
                isPlaying.value = false;
                fullscreenIsPlaying.value = false;
            }
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
                if (a) {
                    a.currentTime = 0;
                    a.play().then(() => {
                        isPlaying.value = true;
                        fullscreenIsPlaying.value = true;
                    }).catch(e => {
                        if (e.name !== 'AbortError' && !/interrupted|paused/i.test(e.message)) {
                            console.warn('循环播放失败:', e);
                            logError(e, 'onAudioEnded');
                        }
                    });
                }
                return;
            }
            playNext(false);
        };

        const onAudioError = (e) => {
            console.error('Audio error:', e);
            playErrorMsg.value = '播放失败，可能是音频链接无效';
            isPlaying.value = false; fullscreenIsPlaying.value = false;
            try {
                const audio = audioPlayer.value;
                const src = audio?.src || '';
                logError(`audio error code=${audio?.error?.code} message=${audio?.error?.message || '未知'} src=${src.slice(0, 100)}`, 'onAudioError');
            } catch (er) {}
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
            if (audio.paused) { audio.play().then(() => { isPlaying.value = true; fullscreenIsPlaying.value = true; }).catch(() => {}); }
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
        const FONT_DB_VERSION = 1;

        const openFontDB = () => {
            return new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    reject(new Error('当前浏览器不支持 IndexedDB'));
                    return;
                }
                const req = indexedDB.open(FONT_DB_NAME, FONT_DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(FONT_STORE)) {
                        db.createObjectStore(FONT_STORE);
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error || new Error('打开数据库失败'));
                req.onblocked = () => reject(new Error('数据库被其他标签页占用，请关闭其他页面后重试'));
            });
        };

        const idbPut = (db, store, value, key) => new Promise((resolve, reject) => {
            const tx = db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).put(value, key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('写入失败'));
        });

        const idbGet = (db, store, key) => new Promise((resolve, reject) => {
            const tx = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('读取失败'));
        });

        const idbDelete = (db, store, key) => new Promise((resolve, reject) => {
            const tx = db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).delete(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('删除失败'));
        });

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
                try {
                    await idbPut(db, FONT_STORE, { data: arrayBuffer, name: file.name, mime, ts: Date.now() }, FONT_KEY);
                } finally {
                    db.close();
                }

                playErrorMsg.value = '✅ 字体已应用并保存';
                setTimeout(() => { if (playErrorMsg.value.includes('字体')) playErrorMsg.value = ''; }, 2500);
                event.target.value = '';
            } catch (e) {
                playErrorMsg.value = '❌ 字体保存失败：' + (e.message || '未知错误');
                logError(e, 'applyCustomFont');
            }
        };
        const loadCustomFontFromDB = async () => {
            try {
                const db = await openFontDB();
                let fontData = null;
                try {
                    fontData = await idbGet(db, FONT_STORE, FONT_KEY);
                } finally {
                    db.close();
                }
                if (fontData && fontData.data) applyFontFromData(fontData.data, fontData.name, fontData.mime);
            } catch (e) {}
        };
        const restoreDefaultFont = async () => {
            try {
                const style = document.getElementById('custom-font-style');
                if (style) style.remove();
                if (window.__customFontUrl) { try { URL.revokeObjectURL(window.__customFontUrl); } catch (e) {} window.__customFontUrl = null; }
                const db = await openFontDB();
                try {
                    await idbDelete(db, FONT_STORE, FONT_KEY);
                } finally {
                    db.close();
                }
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
                    checkMobileView();
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

        /* ============================================================
           推荐歌单：补充 API
           ============================================================ */
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
                            coverImgUrl: proxyCover(toHttps(res.data.playlist.coverImgUrl || ''), 200),
                            trackCount: res.data.playlist.trackCount
                        });
                    }
                } catch (e) {}
            }
            recommendPlaylists.value = plist.length ? plist : [
                { id: '3778678', name: '热歌榜', coverImgUrl: DEFAULT_COVER, trackCount: 100 }
            ];
        };

        /* ============================================================
           歌单加载：补充 API（playlist/detail + playlist/track/all）
           ============================================================ */
        const fetchPlaylistTracks = async (playlistId, plName, isCustom = false) => {
            searchResults.value = [];
            searchPerformed.value = true;
            loadingSearch.value = true;

            const cookieParam = userCookie.value.trim() ? `&cookie=${encodeURIComponent(userCookie.value)}` : '';

            const tryRequest = async (path) => {
                for (let i = 0; i < SUPPLEMENT_API_LIST.length; i++) {
                    const apiBase = SUPPLEMENT_API_LIST[(currentApiIndex + i) % SUPPLEMENT_API_LIST.length];
                    if (!isApiAvailable(apiBase)) continue;
                    try {
                        const res = await axios.get(`${apiBase}${path}${cookieParam}`, { timeout: 20000 });
                        if (res && res.data) {
                            currentApiIndex = (currentApiIndex + i) % SUPPLEMENT_API_LIST.length;
                            markApiOk(apiBase);
                            return res.data;
                        }
                    } catch (e) {
                        markApiFailed(apiBase);
                    }
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
                        for (let j = 0; j < SUPPLEMENT_API_LIST.length; j++) {
                            const apiBase = SUPPLEMENT_API_LIST[(currentApiIndex + j) % SUPPLEMENT_API_LIST.length];
                            if (!isApiAvailable(apiBase)) continue;
                            try {
                                const res = await axios.get(`${apiBase}/song/detail?ids=${encodeURIComponent(idsParam)}${cookieParam}`, { timeout: 20000 });
                                if (res.data && res.data.songs && res.data.songs.length) {
                                    collected.push(...res.data.songs);
                                    currentApiIndex = (currentApiIndex + j) % SUPPLEMENT_API_LIST.length;
                                    markApiOk(apiBase);
                                    break;
                                }
                            } catch (e) {
                                markApiFailed(apiBase);
                            }
                        }
                        playErrorMsg.value = `⏳ 已加载 ${collected.length}/${trackIds.length} 首...`;
                    }
                    if (collected.length) rawSongs = collected;
                }

                if (rawSongs && rawSongs.length) {
                    const songList = rawSongs.map(track => {
                        return {
                            id: String(track.id),
                            name: track.name || '未知',
                            artist: (track.ar || track.artists || []).map(a => a.name || a).join('/') || '未知',
                            duration: track.dt || track.duration || 0,
                            picUrl: proxyCover(toHttps(track.al?.picUrl || ''), 200) || DEFAULT_COVER,
                            isVip: checkIsVip(track),
                            albumId: track.al?.id || track.album?.id || null,
                            loadingCover: false,
                            needFetchCover: false,
                            playUrl: metingUrl('url', track.id)
                        };
                    });
                    searchResults.value = songList;
                    playErrorMsg.value = `✅ 已加载歌单: ${plName} (共 ${songList.length} 首)`;
                    if (isCustom) {
                        queue.value = songList.map(s => ({ id: s.id, name: s.name, artist: s.artist, picUrl: s.picUrl, isVip: s.isVip, playUrl: s.playUrl }));
                        currentQueueIndex = -1;
                        playErrorMsg.value += ' · 已加入播放队列';
                    }
                    setTimeout(() => { if (playErrorMsg.value.includes('已加载歌单')) playErrorMsg.value = ''; }, 3000);
                } else {
                    searchResults.value = [];
                    playErrorMsg.value = '❌ 歌单加载失败';
                    logError(`加载歌单失败: ${plName} (${playlistId})`, 'fetchPlaylistTracks');
                }
            } catch (e) {
                searchResults.value = [];
                playErrorMsg.value = '❌ 歌单接口异常';
                logError(e, 'fetchPlaylistTracks');
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

        /* ============================================================
           我的歌单：补充 API
           ============================================================ */
        let cachedUid = null;
        const getMyUid = async () => {
            if (cachedUid) return cachedUid;
            for (let i = 0; i < SUPPLEMENT_API_LIST.length; i++) {
                const apiBase = SUPPLEMENT_API_LIST[(currentApiIndex + i) % SUPPLEMENT_API_LIST.length];
                if (!isApiAvailable(apiBase)) continue;
                try {
                    let url = `${apiBase}/user/account/get`;
                    if (userCookie.value.trim()) url += `?cookie=${encodeURIComponent(userCookie.value)}`;
                    const res = await axios.get(url, { timeout: 10000 });
                    const uid = res.data?.account?.id || res.data?.profile?.userId;
                    if (uid) {
                        cachedUid = uid;
                        markApiOk(apiBase);
                        return uid;
                    }
                } catch (e) {
                    markApiFailed(apiBase);
                }
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
                for (let i = 0; i < SUPPLEMENT_API_LIST.length; i++) {
                    const apiBase = SUPPLEMENT_API_LIST[(currentApiIndex + i) % SUPPLEMENT_API_LIST.length];
                    if (!isApiAvailable(apiBase)) continue;
                    try {
                        let url = `${apiBase}/user/playlist?uid=${uid}&limit=1000&offset=0`;
                        if (userCookie.value.trim()) url += `&cookie=${encodeURIComponent(userCookie.value)}`;
                        const res = await axios.get(url, { timeout: 15000 });
                        const arr = res.data?.playlist || [];
                        if (arr.length) {
                            list = arr;
                            markApiOk(apiBase);
                            break;
                        }
                    } catch (e) {
                        markApiFailed(apiBase);
                    }
                }
                if (!list) throw new Error('所有补充 API 均无法获取歌单');
                myPlaylists.value = list.map(pl => ({
                    id: String(pl.id), name: pl.name,
                    coverImgUrl: proxyCover(toHttps(pl.coverImgUrl || ''), 200),
                    trackCount: pl.trackCount, specialType: pl.specialType, subscribed: pl.subscribed
                }));
                if (autoOpenModal) {
                    playErrorMsg.value = `✅ 已加载 ${myPlaylists.value.length} 个歌单`;
                    setTimeout(() => { if (playErrorMsg.value.includes('已加载')) playErrorMsg.value = ''; }, 2000);
                }
                return true;
            } catch (e) {
                if (autoOpenModal) playErrorMsg.value = e.message || '加载我的歌单失败';
                logError(e, 'loadMyPlaylists');
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
            if (song.isVip && !userCookie.value.trim()) {
                showVipModal(song);
                return;
            }
            const sourceList = searchResults.value;
            if (sourceList && sourceList.length) {
                const newQueue = sourceList.map(s => ({
                    id: String(s.id),
                    name: s.name,
                    artist: s.artist,
                    picUrl: s.picUrl,
                    isVip: !!s.isVip,
                    playUrl: s.playUrl || ''
                }));
                queue.value = newQueue;
                const idx = newQueue.findIndex(s => String(s.id) === String(song.id));
                currentQueueIndex = idx >= 0 ? idx : -1;
            }
            playSongById(song.id, song.name, song.artist, song.picUrl, false, currentQueueIndex, !!song.isVip, song.playUrl || '');
        };

        const parseById = async () => {
            const id = extractSongId(songIdInput.value);
            if (!id) return alert('请输入正确的歌曲ID或链接');
            try {
                const detail = await getSongDetail(id);
                const isVip = checkIsVip(detail);
                const cover = detail?.al?.picUrl;
                const picUrl = cover ? proxyCover(toHttps(cover), 200) : DEFAULT_COVER;
                const song = { id: String(detail.id), name: detail.name, artist: (detail.ar || []).map(a => a.name).join('/'), picUrl, isVip };
                if (isVip && !userCookie.value.trim()) showVipModal(song);
                else playSongById(song.id, song.name, song.artist, song.picUrl, true, -1, isVip, metingUrl('url', song.id));
            } catch (err) { playErrorMsg.value = '获取歌曲信息失败，请检查ID'; logError(err, 'parseById'); }
        };

        const openSettingsModal = () => { document.getElementById('settingsModal').style.display = 'flex'; };
        const closeSettingsModal = () => { document.getElementById('settingsModal').style.display = 'none'; };
        const openFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'flex'; };
        const closeFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'none'; };

        const initModalEvents = () => {
            const modals = ['themeModal', 'settingsModal', 'feedbackModal', 'vipModal', 'sleepTimerModal', 'myPlaylistsModal', 'iosInstallModal', 'logExportModal'];
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

        const onGlobalError = (event) => {
            try {
                const msg = event?.error?.message || event?.message || '未知错误';
                const loc = event?.filename ? ` @ ${event.filename}:${event.lineno}:${event.colno}` : '';
                logError(msg + loc, 'window.onerror');
            } catch (e) {}
        };
        const onUnhandledRejection = (event) => {
            try {
                const reason = event?.reason;
                const msg = reason?.message || String(reason || '未知 Promise 错误');
                logError(msg, 'unhandledrejection');
            } catch (e) {}
        };

        onMounted(() => {
            loadAllSettings();
            loadCustomFontFromDB();
            loadPlaylists();
            initModalEvents();
            checkMobileView();
            window.addEventListener('keydown', handleKeydown);
            window.addEventListener('resize', checkMobileView);
            document.addEventListener('fullscreenchange', onFullscreenChange);
            window.addEventListener('resize', onWindowResize);
            window.addEventListener('error', onGlobalError);
            window.addEventListener('unhandledrejection', onUnhandledRejection);
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
        });

        onUnmounted(() => {
            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('resize', checkMobileView);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            window.removeEventListener('error', onGlobalError);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
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
            autoFullscreenOnEnter, saveAutoFullscreen,
            isMobileView,
            bugDescription, logContent, logHint,
            openLogExportModal, closeLogExportModal, refreshLogContent, copyLogToClipboard, downloadLogFile, clearLogs
        };
    }
}).mount('#app');
