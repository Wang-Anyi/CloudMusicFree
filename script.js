const { createApp, ref, onMounted, nextTick, computed } = Vue;

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
        let currentAudioSrc = '';
        
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
        
        // 播放队列相关
        const queue = ref([]);
        let currentQueueIndex = -1;
        const loopMode = ref('none'); // 'none', 'one', 'all'
        
        // 迷你播放器
        const miniPlayerVisible = ref(false);
        
        // 相似歌曲、MV、评论
        const similarSongs = ref([]);
        const comments = ref([]);
        
        // 睡眠定时器
        let sleepTimerId = null;
        
        // 全屏播放器相关
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
        
        // 主题、背景设置
        const currentTheme = ref('theme-default');
        const bgImageUrl = ref('');
        const blurEnabled = ref(false);
        const bgBlur = ref(0);
        const cardOpacity = ref(100);
        const maskOpacity = ref(30);
        const glassIntensity = ref(12); // 毛玻璃强度
        
        // ---------- API 列表 ----------
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
        
        // ---------- 辅助函数 ----------
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
        
        // 错误日志
        const logError = (error, context) => {
            const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
            logs.push({ time: new Date().toISOString(), error: error.message || error, context });
            while (logs.length > 50) logs.shift();
            localStorage.setItem('errorLogs', JSON.stringify(logs));
            console.error(`[${context}]`, error);
        };
        
        // ---------- 主题切换 ----------
        const openThemeModal = () => {
            document.getElementById('themeModal').style.display = 'flex';
        };
        const closeThemeModal = () => {
            document.getElementById('themeModal').style.display = 'none';
        };
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
        
        // ---------- 歌词滚动 ----------
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
        
        // ---------- 歌词解析 ----------
        const fetchLyrics = async (songId) => {
            try {
                const res = await requestWithFallback(`/lyric?id=${songId}`, { timeout: 8000 });
                if (res.data && res.data.lrc && res.data.lrc.lyric) {
                    const rawLyric = res.data.lrc.lyric;
                    const lines = rawLyric.split('\n');
                    const parsed = [];
                    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
                    for (let line of lines) {
                        const match = line.match(timeRegex);
                        if (match) {
                            const minutes = parseInt(match[1]);
                            const seconds = parseInt(match[2]);
                            const millis = parseInt(match[3].padEnd(3, '0'));
                            const time = minutes * 60 + seconds + millis / 1000;
                            const text = line.replace(timeRegex, '').trim();
                            if (text) parsed.push({ time, text });
                        } else if (line.trim()) {
                            parsed.push({ time: -1, text: line.trim() });
                        }
                    }
                    parsed.sort((a,b) => a.time - b.time);
                    lyricsLines.value = parsed;
                    fullscreenLyrics.value = parsed;
                } else {
                    lyricsLines.value = [];
                    fullscreenLyrics.value = [];
                }
            } catch (e) {
                console.warn('歌词加载失败', e);
                lyricsLines.value = [];
                fullscreenLyrics.value = [];
            }
        };
        
        const updateLyrics = (currentSec) => {
            if (!lyricsLines.value.length) return;
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
        };
        
        // ---------- 通用请求（故障转移）----------
        const requestWithFallback = async (urlPath, options = {}) => {
            const maxRetries = API_LIST.length;
            let lastError = null;
            for (let i = 0; i < maxRetries; i++) {
                const apiIndex = (currentApiIndex + i) % maxRetries;
                const apiBase = API_LIST[apiIndex];
                const fullUrl = `${apiBase}${urlPath}`;
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
        
        // ---------- 获取真实封面 ----------
        const fetchRealCover = async (songId) => {
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    const res = await axios.get(`${apiBase}/song/detail?ids=${songId}`, { timeout: 5000 });
                    let detail = res.data?.songs?.[0] || res.data?.data?.[0];
                    if (detail) {
                        const coverUrl = extractCover(detail);
                        if (coverUrl && coverUrl.startsWith('http')) return toHttps(coverUrl);
                    }
                } catch(e) {}
            }
            return null;
        };
        
        // ---------- 图片加载 ----------
        const onImageLoad = (event) => {
            const wrapper = event.target.closest('.cover-wrapper');
            if (wrapper) {
                const loadingDiv = wrapper.querySelector('.cover-loading');
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
        };
        const onImageError = (event) => {
            const img = event.target;
            if (!img.src.includes('cdn-icons-png.flaticon.com')) {
                img.src = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
            }
            const wrapper = img.closest('.cover-wrapper');
            if (wrapper) {
                const loadingDiv = wrapper.querySelector('.cover-loading');
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
        };
        
        // ---------- 搜索 ----------
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
                    const res = await axios.get(`${apiBase}/search?keywords=${encodeURIComponent(keyword)}&limit=30`, { timeout: 10000 });
                    let songs = res.data?.result?.songs || res.data?.data || (Array.isArray(res.data) ? res.data : null);
                    if (songs && songs.length) {
                        songsData = songs;
                        break;
                    }
                } catch(e) { console.warn(e); }
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
                const name = item.name || item.title;
                const artist = item.artists?.[0]?.name || item.artist || item.singer || '未知';
                const duration = item.duration || item.dt || 0;
                const fee = item.fee || 0;
                const isVip = (fee === 1 || fee === 4);
                return { id: String(id), name, artist, duration, picUrl: defaultCover, isVip, loadingCover: true };
            });
            searchResults.value = tempResults;
            const coverPromises = tempResults.map(async (song, index) => {
                const realCover = await fetchRealCover(song.id);
                if (realCover) searchResults.value[index].picUrl = realCover;
                else searchResults.value[index].loadingCover = false;
            });
            await Promise.allSettled(coverPromises);
            loadingSearch.value = false;
        };
        
        // ---------- 播放地址获取 ----------
        const getSongUrl = async (songId) => {
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    const res = await axios.get(`${apiBase}/song/url?id=${songId}`, { timeout: 20000 });
                    let musicUrl = res.data?.data?.[0]?.url || res.data?.url || (typeof res.data === 'string' ? res.data : null);
                    if (musicUrl) {
                        currentApiIndex = (currentApiIndex + i) % API_LIST.length;
                        return toHttps(musicUrl);
                    }
                } catch (err) {}
            }
            throw new Error('无法获取播放地址');
        };
        
        // ---------- 歌曲详情 ----------
        const getSongDetail = async (songId) => {
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    const res = await axios.get(`${apiBase}/song/detail?ids=${songId}`, { timeout: 8000 });
                    let detail = res.data?.songs?.[0] || res.data?.data?.[0];
                    if (detail) return detail;
                } catch (err) {}
            }
            throw new Error('无法获取歌曲详情');
        };
        
        // ---------- 播放核心（集成队列）----------
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
                } else if (queueIndex >= 0) {
                    currentQueueIndex = queueIndex;
                }
                
                fullscreenSongName.value = currentSongName.value;
                fullscreenArtist.value = currentArtist.value;
                fullscreenCover.value = currentCover.value;
                
                const audio = audioPlayer.value;
                if (audio) {
                    audio.pause();
                    audio.src = '';
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
                    // 记忆播放进度
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
        
        // 队列操作
        const playFromQueue = (idx) => {
            if (idx < 0 || idx >= queue.value.length) return;
            const song = queue.value[idx];
            playSongById(song.id, song.name, song.artist, song.picUrl, false, idx);
        };
        const addToPlayQueue = (song) => {
            if (!queue.value.find(s => s.id === song.id)) {
                queue.value.push(song);
                playErrorMsg.value = `✅ 已添加到队列: ${song.name}`;
                setTimeout(() => { if (playErrorMsg.value === `✅ 已添加到队列: ${song.name}`) playErrorMsg.value = ''; }, 2000);
            } else {
                playErrorMsg.value = '歌曲已在队列中';
                setTimeout(() => { if (playErrorMsg.value === '歌曲已在队列中') playErrorMsg.value = ''; }, 1500);
            }
        };
        const removeFromQueue = (idx) => {
            queue.value.splice(idx, 1);
            if (currentQueueIndex >= idx) currentQueueIndex--;
        };
        const clearQueue = () => {
            queue.value = [];
            currentQueueIndex = -1;
        };
        const toggleLoopMode = () => {
            if (loopMode.value === 'none') loopMode.value = 'one';
            else if (loopMode.value === 'one') loopMode.value = 'all';
            else loopMode.value = 'none';
            playErrorMsg.value = `循环模式: ${loopMode.value === 'none' ? '无' : (loopMode.value === 'one' ? '单曲循环' : '列表循环')}`;
            setTimeout(() => { if (playErrorMsg.value.includes('循环模式')) playErrorMsg.value = ''; }, 2000);
        };
        
        // 上一曲/下一曲（基于队列）
        const playPrev = () => {
            if (queue.value.length === 0) {
                playErrorMsg.value = '队列为空';
                return;
            }
            let newIndex = currentQueueIndex - 1;
            if (newIndex < 0) newIndex = queue.value.length - 1;
            playFromQueue(newIndex);
        };
        const playNext = () => {
            if (queue.value.length === 0) return;
            let newIndex = currentQueueIndex + 1;
            if (newIndex >= queue.value.length) {
                if (loopMode.value === 'all') newIndex = 0;
                else return;
            }
            playFromQueue(newIndex);
        };
        
        // 下载
        const downloadCurrentSong = async () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src) {
                playErrorMsg.value = '没有正在播放的歌曲';
                setTimeout(() => { if (playErrorMsg.value === '没有正在播放的歌曲') playErrorMsg.value = ''; }, 2000);
                return;
            }
            if (currentIsVip.value) {
                playErrorMsg.value = 'VIP歌曲暂不支持下载';
                return;
            }
            try {
                playErrorMsg.value = '⏳ 正在准备下载...';
                const musicUrl = audio.src;
                const audioResponse = await fetch(musicUrl);
                const audioBuffer = await audioResponse.arrayBuffer();
                let coverBuffer = null;
                const coverUrl = currentCover.value;
                if (coverUrl && !coverUrl.includes('flaticon')) {
                    try {
                        const imgRes = await fetch(coverUrl);
                        if (imgRes.ok) coverBuffer = await imgRes.arrayBuffer();
                    } catch(e) {}
                }
                const writer = new window.ID3Writer(audioBuffer);
                writer.setFrame('TIT2', currentSongName.value)
                      .setFrame('TPE1', [currentArtist.value])
                      .setFrame('TALB', '云音匣下载')
                      .setFrame('TYER', new Date().getFullYear().toString())
                      .setFrame('TCON', ['流行']);
                if (coverBuffer) {
                    writer.setFrame('APIC', {
                        type: 3,
                        data: coverBuffer,
                        description: 'Cover',
                        mime: coverUrl.endsWith('.png') ? 'image/png' : 'image/jpeg'
                    });
                }
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
            } catch (err) {
                console.error(err);
                playErrorMsg.value = '下载失败';
            }
        };
        
        // 记忆播放进度
        const saveProgress = () => {
            const audio = audioPlayer.value;
            if (audio && audio.src && currentSongId) {
                localStorage.setItem(`playProgress_${currentSongId}`, audio.currentTime);
            }
        };
        window.addEventListener('beforeunload', saveProgress);
        
        // 睡眠定时器
        const setSleepTimer = (minutes) => {
            if (sleepTimerId) clearTimeout(sleepTimerId);
            sleepTimerId = setTimeout(() => {
                const audio = audioPlayer.value;
                if (audio) {
                    audio.pause();
                    isPlaying.value = false;
                    fullscreenIsPlaying.value = false;
                    playErrorMsg.value = `⏰ 定时 ${minutes} 分钟已到，已暂停播放`;
                    setTimeout(() => { if (playErrorMsg.value.includes('定时')) playErrorMsg.value = ''; }, 3000);
                }
                sleepTimerId = null;
            }, minutes * 60 * 1000);
            playErrorMsg.value = `✅ 已设置 ${minutes} 分钟后暂停`;
            setTimeout(() => { if (playErrorMsg.value.includes('已设置')) playErrorMsg.value = ''; }, 2000);
            closeSleepModal();
        };
        const cancelSleepTimer = () => {
            if (sleepTimerId) {
                clearTimeout(sleepTimerId);
                sleepTimerId = null;
                playErrorMsg.value = '✅ 已取消睡眠定时';
                setTimeout(() => { if (playErrorMsg.value === '✅ 已取消睡眠定时') playErrorMsg.value = ''; }, 2000);
            }
        };
        
        // 弹窗控制
        const openPlayQueueModal = () => { document.getElementById('playQueueModal').style.display = 'flex'; };
        const closePlayQueueModal = () => { document.getElementById('playQueueModal').style.display = 'none'; };
        
        const toggleMiniPlayer = () => {
            miniPlayerVisible.value = !miniPlayerVisible.value;
            localStorage.setItem('miniPlayerVisible', miniPlayerVisible.value);
        };
        const restoreFromMini = () => {
            miniPlayerVisible.value = false;
            localStorage.setItem('miniPlayerVisible', false);
        };
        const closeMiniPlayer = () => {
            miniPlayerVisible.value = false;
            localStorage.setItem('miniPlayerVisible', false);
        };
        
        // 相似歌曲推荐
        const showSimilarSongs = async () => {
            if (!currentSongId) {
                playErrorMsg.value = '请先播放一首歌曲';
                return;
            }
            try {
                const res = await requestWithFallback(`/simi/song?id=${currentSongId}`, { timeout: 8000 });
                if (res.data && res.data.songs) {
                    similarSongs.value = res.data.songs.map(s => ({
                        id: s.id,
                        name: s.name,
                        artist: s.artists.map(a => a.name).join('/'),
                        picUrl: s.album.picUrl
                    }));
                } else {
                    similarSongs.value = [];
                }
                document.getElementById('similarSongsModal').style.display = 'flex';
            } catch (err) {
                playErrorMsg.value = '获取相似歌曲失败';
            }
        };
        const playSimilarSong = (song) => {
            closeSimilarModal();
            playSongById(song.id, song.name, song.artist, song.picUrl);
        };
        const closeSimilarModal = () => { document.getElementById('similarSongsModal').style.display = 'none'; };
        
        // MV播放
        const showMV = async () => {
            if (!currentSongId) {
                playErrorMsg.value = '请先播放一首歌曲';
                return;
            }
            try {
                const res = await requestWithFallback(`/mv/url?id=${currentSongId}`, { timeout: 8000 });
                let mvUrl = res.data?.data?.url;
                if (mvUrl) {
                    const iframe = document.getElementById('mvIframe');
                    iframe.src = mvUrl;
                    document.getElementById('mvPlayerModal').style.display = 'flex';
                } else {
                    playErrorMsg.value = '该歌曲暂无MV';
                }
            } catch (err) {
                playErrorMsg.value = '获取MV失败';
            }
        };
        const closeMvModal = () => {
            document.getElementById('mvIframe').src = '';
            document.getElementById('mvPlayerModal').style.display = 'none';
        };
        
        // 评论展示
        const showComments = async () => {
            if (!currentSongId) {
                playErrorMsg.value = '请先播放一首歌曲';
                return;
            }
            try {
                const res = await requestWithFallback(`/comment/music?id=${currentSongId}&limit=20`, { timeout: 8000 });
                if (res.data && res.data.comments) {
                    comments.value = res.data.comments;
                } else {
                    comments.value = [];
                }
                document.getElementById('commentsModal').style.display = 'flex';
            } catch (err) {
                playErrorMsg.value = '获取评论失败';
            }
        };
        const closeCommentsModal = () => { document.getElementById('commentsModal').style.display = 'none'; };
        
        // 睡眠定时弹窗
        const openSleepTimerModal = () => { document.getElementById('sleepTimerModal').style.display = 'flex'; };
        const closeSleepModal = () => { document.getElementById('sleepTimerModal').style.display = 'none'; };
        
        // 分享功能
        const shareCurrentSong = async () => {
            if (!currentSongName.value) {
                playErrorMsg.value = '没有正在播放的歌曲';
                return;
            }
            const div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.top = '-9999px';
            div.style.width = '400px';
            div.style.background = 'linear-gradient(135deg, #f9f3e6, #e8e0d5)';
            div.style.padding = '20px';
            div.style.textAlign = 'center';
            div.style.borderRadius = '20px';
            div.innerHTML = `
                <img src="${currentCover.value}" width="200" height="200" style="border-radius:20px">
                <h2 style="margin:10px 0">${currentSongName.value}</h2>
                <p>${currentArtist.value}</p>
                <p style="margin-top:10px">🎵 云音匣 · 正在播放</p>
            `;
            document.body.appendChild(div);
            try {
                const canvas = await html2canvas(div);
                const link = document.createElement('a');
                link.download = `${currentSongName.value}-分享.png`;
                link.href = canvas.toDataURL();
                link.click();
                playErrorMsg.value = '✅ 分享截图已保存';
                setTimeout(() => { if (playErrorMsg.value === '✅ 分享截图已保存') playErrorMsg.value = ''; }, 2000);
            } catch (err) {
                playErrorMsg.value = '分享失败';
            }
            document.body.removeChild(div);
        };
        
        // ---------- 播放器控制 ----------
        const togglePlayPause = () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src) return;
            if (audio.paused) {
                audio.play();
                isPlaying.value = true;
                fullscreenIsPlaying.value = true;
            } else {
                audio.pause();
                isPlaying.value = false;
                fullscreenIsPlaying.value = false;
            }
        };
        
        const stopAudio = () => {
            const audio = audioPlayer.value;
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
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
                const progressBar = document.querySelector('.progress-bar');
                if (progressBar) progressBar.style.setProperty('--progress-percent', `${percent}%`);
                fullscreenCurrentTime.value = audio.currentTime;
                fullscreenDuration.value = audio.duration;
                fullscreenProgressValue.value = percent;
                updateLyrics(audio.currentTime);
            }
        };
        
        const onLoadedMetadata = () => {
            const audio = audioPlayer.value;
            if (audio) {
                duration.value = audio.duration;
                fullscreenDuration.value = audio.duration;
                audio.volume = volumeValue.value;
            }
        };
        const seekAudio = () => {
            const audio = audioPlayer.value;
            if (audio && duration.value) {
                audio.currentTime = (progressValue.value / 100) * duration.value;
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
                const audio = audioPlayer.value;
                if (audio) audio.currentTime = 0;
                audio.play();
                isPlaying.value = true;
                fullscreenIsPlaying.value = true;
            } else if (loopMode.value === 'all' && queue.value.length > 1) {
                playNext();
            }
        };
        const onAudioError = (e) => {
            console.error('Audio error:', e);
            playErrorMsg.value = '播放失败，可能是音频链接无效';
            isPlaying.value = false;
            fullscreenIsPlaying.value = false;
        };
        
        // ---------- 全屏播放器 ----------
        const openFullscreenPlayer = () => {
            if (!currentSongName.value) {
                playErrorMsg.value = '请先播放一首歌曲';
                setTimeout(() => { if (playErrorMsg.value === '请先播放一首歌曲') playErrorMsg.value = ''; }, 2000);
                return;
            }
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
                    const audio = audioPlayer.value;
                    fullscreenCurrentTime.value = audio.currentTime;
                    fullscreenDuration.value = audio.duration;
                    fullscreenProgressValue.value = (audio.currentTime / audio.duration) * 100;
                    fullscreenIsPlaying.value = !audio.paused;
                    if (currentLyricIndex.value !== fullscreenLyricIndex.value) {
                        fullscreenLyricIndex.value = currentLyricIndex.value;
                    }
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
            const audio = audioPlayer.value;
            if (audio && fullscreenDuration.value) {
                audio.currentTime = (fullscreenProgressValue.value / 100) * fullscreenDuration.value;
            }
        };
        const fullscreenTogglePlayPause = togglePlayPause;
        
        // ---------- 背景设置 ----------
        const bodyBackgroundStyle = computed(() => {
            if (bgImageUrl.value && bgImageUrl.value.trim()) {
                return {
                    backgroundImage: `url(${bgImageUrl.value})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center',
                    backgroundAttachment: 'fixed',
                    backgroundRepeat: 'no-repeat'
                };
            }
            return {};
        });
        
        const loadBgSettings = () => {
            const savedBg = localStorage.getItem('customBgImage');
            if (savedBg) {
                bgImageUrl.value = savedBg;
                document.body.classList.add('custom-bg');
                document.body.style.backgroundImage = `url(${savedBg})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center center';
                document.body.style.backgroundAttachment = 'fixed';
            }
            const savedBlur = localStorage.getItem('blurEnabled');
            if (savedBlur !== null) {
                blurEnabled.value = savedBlur === 'true';
                if (blurEnabled.value) document.body.classList.add('blur-enabled');
                else document.body.classList.remove('blur-enabled');
            }
            const savedBgBlur = localStorage.getItem('bgBlur');
            if (savedBgBlur !== null) {
                bgBlur.value = parseInt(savedBgBlur);
                document.body.style.setProperty('--bg-blur-amount', `${bgBlur.value / 10}px`);
            }
            const savedCardOpacity = localStorage.getItem('cardOpacity');
            if (savedCardOpacity !== null) {
                cardOpacity.value = parseInt(savedCardOpacity);
                document.body.style.setProperty('--card-opacity', cardOpacity.value / 100);
            }
            const savedMaskOpacity = localStorage.getItem('maskOpacity');
            if (savedMaskOpacity !== null) {
                maskOpacity.value = parseInt(savedMaskOpacity);
                document.body.style.setProperty('--mask-opacity', maskOpacity.value / 100);
            }
            const savedGlass = localStorage.getItem('glassIntensity');
            if (savedGlass !== null) {
                glassIntensity.value = parseInt(savedGlass);
                document.querySelector('.app-container').style.backdropFilter = `blur(${glassIntensity.value}px)`;
            }
            const savedMini = localStorage.getItem('miniPlayerVisible');
            if (savedMini === 'true') miniPlayerVisible.value = true;
        };
        
        const saveBgImage = () => {
            if (!bgImageUrl.value.trim()) {
                playErrorMsg.value = '请输入图片URL';
                return;
            }
            localStorage.setItem('customBgImage', bgImageUrl.value);
            document.body.classList.add('custom-bg');
            document.body.style.backgroundImage = `url(${bgImageUrl.value})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center center';
            document.body.style.backgroundAttachment = 'fixed';
            playErrorMsg.value = '✅ 背景已更新';
            setTimeout(() => { if (playErrorMsg.value === '✅ 背景已更新') playErrorMsg.value = ''; }, 2000);
        };
        const resetBgImage = () => {
            bgImageUrl.value = '';
            localStorage.removeItem('customBgImage');
            document.body.classList.remove('custom-bg');
            document.body.style.backgroundImage = '';
            playErrorMsg.value = '✅ 已恢复默认背景';
        };
        const saveBlurEnabled = () => {
            localStorage.setItem('blurEnabled', blurEnabled.value);
            if (blurEnabled.value) document.body.classList.add('blur-enabled');
            else document.body.classList.remove('blur-enabled');
        };
        const saveBgBlur = () => {
            localStorage.setItem('bgBlur', bgBlur.value);
            document.body.style.setProperty('--bg-blur-amount', `${bgBlur.value / 10}px`);
        };
        const saveCardOpacity = () => {
            localStorage.setItem('cardOpacity', cardOpacity.value);
            document.body.style.setProperty('--card-opacity', cardOpacity.value / 100);
        };
        const saveMaskOpacity = () => {
            localStorage.setItem('maskOpacity', maskOpacity.value);
            document.body.style.setProperty('--mask-opacity', maskOpacity.value / 100);
        };
        const saveGlassIntensity = () => {
            localStorage.setItem('glassIntensity', glassIntensity.value);
            document.querySelector('.app-container').style.backdropFilter = `blur(${glassIntensity.value}px)`;
        };
        
        // 导入/导出设置
        const exportSettings = () => {
            const settings = {
                theme: currentTheme.value,
                bgImageUrl: bgImageUrl.value,
                bgBlur: bgBlur.value,
                cardOpacity: cardOpacity.value,
                maskOpacity: maskOpacity.value,
                glassIntensity: glassIntensity.value,
                blurEnabled: blurEnabled.value
            };
            const dataStr = JSON.stringify(settings, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'cloudmusic-settings.json';
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            playErrorMsg.value = '✅ 设置已导出';
            setTimeout(() => { if (playErrorMsg.value === '✅ 设置已导出') playErrorMsg.value = ''; }, 2000);
        };
        const importSettings = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const settings = JSON.parse(e.target.result);
                    if (settings.theme) setTheme(settings.theme);
                    if (settings.bgImageUrl) {
                        bgImageUrl.value = settings.bgImageUrl;
                        saveBgImage();
                    }
                    if (settings.bgBlur !== undefined) { bgBlur.value = settings.bgBlur; saveBgBlur(); }
                    if (settings.cardOpacity !== undefined) { cardOpacity.value = settings.cardOpacity; saveCardOpacity(); }
                    if (settings.maskOpacity !== undefined) { maskOpacity.value = settings.maskOpacity; saveMaskOpacity(); }
                    if (settings.glassIntensity !== undefined) { glassIntensity.value = settings.glassIntensity; saveGlassIntensity(); }
                    if (settings.blurEnabled !== undefined) { blurEnabled.value = settings.blurEnabled; saveBlurEnabled(); }
                    playErrorMsg.value = '✅ 设置导入成功';
                } catch (err) {
                    playErrorMsg.value = '❌ 导入失败，文件格式错误';
                }
                setTimeout(() => { if (playErrorMsg.value === '✅ 设置导入成功' || playErrorMsg.value === '❌ 导入失败，文件格式错误') playErrorMsg.value = ''; }, 2000);
            };
            reader.readAsText(file);
        };
        
        // 自定义字体
        const applyCustomFont = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const fontUrl = URL.createObjectURL(file);
                const style = document.createElement('style');
                style.textContent = `@font-face { font-family: 'CustomFont'; src: url('${fontUrl}') format('truetype'); } * { font-family: 'CustomFont', system-ui, sans-serif !important; }`;
                document.head.appendChild(style);
                localStorage.setItem('customFontUrl', fontUrl);
                playErrorMsg.value = '✅ 字体已应用';
                setTimeout(() => { if (playErrorMsg.value === '✅ 字体已应用') playErrorMsg.value = ''; }, 2000);
            };
            reader.readAsDataURL(file);
        };
        
        // 快捷键增强
        const handleKeydown = (event) => {
            const target = event.target;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
            if (isInput) return;
            switch (event.code) {
                case 'Space': event.preventDefault(); togglePlayPause(); break;
                case 'ArrowLeft': event.preventDefault(); seekAudio(); break;
                case 'ArrowRight': event.preventDefault(); break;
                case 'ArrowUp': event.preventDefault(); volumeValue.value = Math.min(1, volumeValue.value + 0.05); changeVolume(); break;
                case 'ArrowDown': event.preventDefault(); volumeValue.value = Math.max(0, volumeValue.value - 0.05); changeVolume(); break;
            }
        };
        
        // ---------- 歌单加载 ----------
        const loadPlaylists = async () => {
            const playlistIds = ['3778678', '19723756', '3136952023', '6727748870', '2253631882'];
            const randomIds = playlistIds.sort(() => 0.5 - Math.random()).slice(0, 4);
            const plist = [];
            for (let pid of randomIds) {
                try {
                    const res = await requestWithFallback(`/playlist/detail?id=${pid}`, { timeout: 8000 });
                    if (res.data && res.data.playlist) {
                        plist.push({
                            id: res.data.playlist.id,
                            name: res.data.playlist.name,
                            coverImgUrl: toHttps(res.data.playlist.coverImgUrl || 'https://picsum.photos/80/80?random=1'),
                            trackCount: res.data.playlist.trackCount
                        });
                    }
                } catch(e) { console.warn(e); }
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
                const res = await requestWithFallback(`/playlist/track/all?id=${playlistId}&limit=1000`, { timeout: 15000 });
                if (res.data && res.data.songs) {
                    const tracks = res.data.songs;
                    const defaultCover = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                    const songList = tracks.map(track => {
                        const fee = track.fee || 0;
                        const isVip = (fee === 1 || fee === 4);
                        let picUrl = extractCover(track);
                        if (picUrl && picUrl.startsWith('http')) picUrl = toHttps(picUrl);
                        else picUrl = defaultCover;
                        return {
                            id: String(track.id),
                            name: track.name,
                            artist: track.ar.map(a => a.name).join('/'),
                            duration: track.dt,
                            picUrl: picUrl,
                            isVip: isVip,
                            loadingCover: false
                        };
                    });
                    searchResults.value = songList;
                    playErrorMsg.value = `✅ 已加载歌单: ${plName} (共 ${songList.length} 首)`;
                    if (isCustom) {
                        queue.value = songList.map(s => ({ id: s.id, name: s.name, artist: s.artist, picUrl: s.picUrl }));
                        currentQueueIndex = -1;
                        playErrorMsg.value += ` 已加入播放队列`;
                    }
                } else {
                    searchResults.value = [];
                    playErrorMsg.value = '歌单加载失败';
                }
            } catch (e) {
                searchResults.value = [];
                playErrorMsg.value = '歌单接口异常';
            } finally {
                loadingSearch.value = false;
            }
        };
        
        const loadCustomPlaylist = async () => {
            const input = playlistUrlInput.value.trim();
            if (!input) return alert('请输入歌单链接或ID');
            const playlistId = extractPlaylistId(input);
            if (!playlistId) {
                alert('无法识别歌单ID，请检查链接格式');
                return;
            }
            await fetchPlaylistTracks(playlistId, `自定义歌单 ${playlistId}`, true);
        };
        
        // VIP 弹窗相关
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
            if (pendingVipSong && pendingVipSong.id) {
                window.open(`https://music.163.com/song?id=${pendingVipSong.id}`, '_blank');
            }
            hideVipModal();
        };
        
        const handlePlayClick = (song) => {
            if (song.isVip) {
                showVipModal(song);
            } else {
                playSongById(song.id, song.name, song.artist, song.picUrl);
            }
        };
        
        const parseById = async () => {
            const id = extractSongId(songIdInput.value);
            if (!id) return alert('请输入正确的歌曲ID或链接');
            try {
                const songDetail = await getSongDetail(id);
                const fee = songDetail.fee || 0;
                const isVip = (fee === 1 || fee === 4);
                let picUrl = extractCover(songDetail);
                if (picUrl) picUrl = toHttps(picUrl);
                else picUrl = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                const song = {
                    id: String(songDetail.id),
                    name: songDetail.name,
                    artist: songDetail.ar.map(a => a.name).join('/'),
                    picUrl: picUrl,
                    isVip: isVip
                };
                if (isVip) showVipModal(song);
                else playSongById(song.id, song.name, song.artist, song.picUrl);
            } catch (err) {
                playErrorMsg.value = '获取歌曲信息失败，请检查ID';
                console.error(err);
            }
        };
        
        // 设置弹窗关闭
        const openSettingsModal = () => { document.getElementById('settingsModal').style.display = 'flex'; };
        const closeSettingsModal = () => { document.getElementById('settingsModal').style.display = 'none'; };
        const openFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'flex'; };
        const closeFeedbackModal = () => { document.getElementById('feedbackModal').style.display = 'none'; };
        
        // 初始化弹窗事件
        const initModalEvents = () => {
            const modals = ['themeModal', 'settingsModal', 'feedbackModal', 'vipModal', 'playQueueModal', 'similarSongsModal', 'mvPlayerModal', 'commentsModal', 'sleepTimerModal'];
            modals.forEach(id => {
                const modal = document.getElementById(id);
                if (modal) {
                    const closeBtn = modal.querySelector('.modal-close');
                    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
                    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
                }
            });
            // VIP 特殊按钮
            const vipModal = document.getElementById('vipModal');
            if (vipModal) {
                const cancelBtn = document.getElementById('modalCancelBtn');
                const confirmBtn = document.getElementById('modalConfirmBtn');
                if (cancelBtn) cancelBtn.onclick = hideVipModal;
                if (confirmBtn) confirmBtn.onclick = goToNetEase;
            }
            // 设置弹窗导入导出
            const importInput = document.getElementById('importSettingsInput');
            if (importInput) importInput.onchange = importSettings;
        };
        
        onMounted(() => {
            loadTheme();
            loadPlaylists();
            loadBgSettings();
            initModalEvents();
            window.addEventListener('keydown', handleKeydown);
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW注册失败', err));
            }
            // 显示启动公告
            const announcementModal = document.getElementById('announcementModal');
            if (announcementModal) {
                announcementModal.style.display = 'flex';
                const closeAnnouncement = document.getElementById('closeAnnouncementBtn');
                const confirmAnnouncement = document.getElementById('confirmAnnouncementBtn');
                const hideAnnouncement = () => announcementModal.style.display = 'none';
                if (closeAnnouncement) closeAnnouncement.onclick = hideAnnouncement;
                if (confirmAnnouncement) confirmAnnouncement.onclick = hideAnnouncement;
                announcementModal.onclick = (e) => { if (e.target === announcementModal) hideAnnouncement(); };
            }
        });
        
        return {
            searchKeyword, songIdInput, playlistUrlInput, searchResults, loadingSearch, searchPerformed,
            currentSongName, currentArtist, currentCover, loadingPlay, playErrorMsg, audioPlayer,
            isPlaying, currentTime, duration, progressValue, volumeValue,
            lyricsLines, currentLyricIndex, lyricsContainer,
            playHistory, recommendPlaylists,
            formatDuration, formatTime, searchSongs, parseById,
            togglePlayPause, stopAudio, updateProgress, onLoadedMetadata, seekAudio, changeVolume,
            onAudioEnded, onAudioError, loadPlaylists, fetchPlaylistTracks, loadCustomPlaylist,
            handlePlayClick, downloadCurrentSong, onImageLoad, onImageError,
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
            // 队列相关
            queue, playFromQueue, addToPlayQueue, removeFromQueue, clearQueue, toggleLoopMode, loopMode,
            openPlayQueueModal, closePlayQueueModal,
            // 迷你播放器
            miniPlayerVisible, toggleMiniPlayer, restoreFromMini, closeMiniPlayer,
            // 相似歌曲
            similarSongs, showSimilarSongs, playSimilarSong, closeSimilarModal,
            // MV
            showMV, closeMvModal,
            // 评论
            comments, showComments, closeCommentsModal,
            // 睡眠定时
            openSleepTimerModal, closeSleepModal, setSleepTimer, cancelSleepTimer,
            // 分享
            shareCurrentSong,
            // 自定义字体
            applyCustomFont,
            // 导入导出
            exportSettings,
            // VIP 弹窗（对外暴露）
            showVipModal, hideVipModal, goToNetEase,
            // 其他
            playSongById
        };
    }
}).mount('#app');
