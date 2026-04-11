const { createApp, ref, onMounted, nextTick } = Vue;

createApp({
    setup() {
        // ---------- 响应式数据 ----------
        const searchKeyword = ref('');
        const songIdInput = ref('');
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
        
        const isDarkMode = ref(false);
        
        // ========== API 列表（共 10 个）==========
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
        
        const extractSongId = (input) => {
            if (!input) return null;
            if (/^\d+$/.test(input.trim())) return input.trim();
            const match = input.match(/[?&]id=(\d+)/);
            if (match && match[1]) return match[1];
            const match2 = input.match(/\/song\/(\d+)/);
            return match2 ? match2[1] : null;
        };
        
        const addToHistory = (id, name, artist, cover) => {
            const existing = playHistory.value.find(item => item.id === id);
            if (!existing) {
                playHistory.value.unshift({ id, name, artist, cover: toHttps(cover) });
                if (playHistory.value.length > 8) playHistory.value.pop();
            }
        };
        
        // ---------- 主题切换 ----------
        const toggleTheme = () => {
            isDarkMode.value = !isDarkMode.value;
            if (isDarkMode.value) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            localStorage.setItem('darkMode', isDarkMode.value);
        };
        
        const loadTheme = () => {
            const saved = localStorage.getItem('darkMode');
            if (saved !== null) {
                isDarkMode.value = saved === 'true';
            } else {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                isDarkMode.value = prefersDark;
            }
            if (isDarkMode.value) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        };
        
        // ---------- 歌词滚动 ----------
        const scrollLyricsToActive = () => {
            if (!lyricsContainer.value) return;
            const container = lyricsContainer.value;
            const activeLine = container.querySelector('.lyric-line.active');
            if (activeLine) {
                const containerRect = container.getBoundingClientRect();
                const activeRect = activeLine.getBoundingClientRect();
                const offset = activeRect.top - containerRect.top - container.clientHeight / 2 + activeRect.height / 2;
                container.scrollTop += offset;
            }
        };
        
        const scrollFullscreenLyricsToActive = () => {
            const container = document.querySelector('.fullscreen-lyrics-scroll');
            if (!container) return;
            const activeLine = container.querySelector('.fullscreen-lyric-line.active');
            if (activeLine) {
                const containerRect = container.getBoundingClientRect();
                const activeRect = activeLine.getBoundingClientRect();
                const offset = activeRect.top - containerRect.top - container.clientHeight / 2 + activeRect.height / 2;
                container.scrollTop += offset;
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
                if (line.time >= 0 && currentSec >= line.time) {
                    idx = i;
                } else if (line.time > currentSec) {
                    break;
                }
            }
            if (idx !== currentLyricIndex.value) {
                currentLyricIndex.value = idx;
                fullscreenLyricIndex.value = idx;
                nextTick(() => {
                    scrollLyricsToActive();
                    if (fullscreenPlayerVisible.value) {
                        scrollFullscreenLyricsToActive();
                    }
                });
            }
        };
        
        // ---------- 通用请求函数（自动故障转移）----------
        const requestWithFallback = async (urlPath, options = {}) => {
            const maxRetries = API_LIST.length;
            let lastError = null;
            for (let i = 0; i < maxRetries; i++) {
                const apiIndex = (currentApiIndex + i) % maxRetries;
                const apiBase = API_LIST[apiIndex];
                const fullUrl = `${apiBase}${urlPath}`;
                try {
                    const response = await axios.get(fullUrl, { 
                        timeout: options.timeout || 10000,
                        ...options 
                    });
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
        
        // ---------- 搜索函数（快速返回，封面后续修复）----------
        const searchSongs = async () => {
            const keyword = searchKeyword.value.trim();
            if (!keyword) return alert('请输入歌名或歌手');
            loadingSearch.value = true;
            searchPerformed.value = true;
            
            let songsData = null;
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[i];
                try {
                    const res = await axios.get(`${apiBase}/search?keywords=${encodeURIComponent(keyword)}&limit=30`, { timeout: 10000 });
                    let songs = null;
                    if (res.data && res.data.result && res.data.result.songs) {
                        songs = res.data.result.songs;
                    } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
                        songs = res.data.data;
                    } else if (Array.isArray(res.data)) {
                        songs = res.data;
                    }
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
            
            const results = [];
            for (let item of songsData) {
                const id = item.id || item.song_id;
                const name = item.name || item.title;
                const artist = item.artists?.[0]?.name || item.artist || item.singer || '未知';
                const duration = item.duration || item.dt || 0;
                const fee = item.fee || 0;
                const isVip = (fee === 1 || fee === 4);
                // 提取原始封面（可能无效，但先使用，后面由 @error 修复）
                let picUrl = item.picUrl || item.cover || item.album?.picUrl || '';
                if (picUrl) picUrl = toHttps(picUrl);
                else picUrl = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                results.push({
                    id: String(id),
                    name: name,
                    artist: artist,
                    duration: duration,
                    picUrl: picUrl,
                    isVip: isVip
                });
            }
            searchResults.value = results;
            loadingSearch.value = false;
        };
        
        // ---------- 图片加载失败时，尝试从其他 API 获取真实封面 ----------
        const handleImageError = async (event, songId) => {
            const img = event.target;
            if (img.getAttribute('data-retrying') === 'true') return;
            img.setAttribute('data-retrying', 'true');
            
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[i];
                try {
                    const res = await axios.get(`${apiBase}/song/detail?ids=${songId}`, { timeout: 5000 });
                    let detail = null;
                    if (res.data && res.data.songs && res.data.songs[0]) {
                        detail = res.data.songs[0];
                    } else if (res.data && res.data.data && res.data.data[0]) {
                        detail = res.data.data[0];
                    }
                    if (detail) {
                        const coverUrl = detail.al?.picUrl || detail.album?.picUrl || detail.cover || detail.picUrl;
                        if (coverUrl && coverUrl.startsWith('http')) {
                            const httpsUrl = toHttps(coverUrl);
                            // 测试图片是否可用
                            const testImg = new Image();
                            testImg.onload = () => {
                                img.src = httpsUrl;
                                img.setAttribute('data-retrying', 'false');
                            };
                            testImg.onerror = () => {
                                console.warn(`备用封面也无法加载: ${httpsUrl}`);
                                img.setAttribute('data-retrying', 'false');
                            };
                            testImg.src = httpsUrl;
                            return;
                        }
                    }
                } catch(e) { console.warn(e); }
            }
            // 所有尝试失败，保持默认图片
            img.setAttribute('data-retrying', 'false');
        };
        
        // ---------- 获取播放地址 ----------
        const getSongUrl = async (songId) => {
            const maxRetries = API_LIST.length;
            for (let i = 0; i < maxRetries; i++) {
                const apiIndex = (currentApiIndex + i) % maxRetries;
                const apiBase = API_LIST[apiIndex];
                const url = `${apiBase}/song/url?id=${songId}`;
                try {
                    const res = await axios.get(url, { timeout: 15000 });
                    let musicUrl = null;
                    if (res.data && res.data.data && res.data.data[0] && res.data.data[0].url) {
                        musicUrl = res.data.data[0].url;
                    } else if (res.data && res.data.url) {
                        musicUrl = res.data.url;
                    } else if (typeof res.data === 'string') {
                        musicUrl = res.data;
                    } else if (res.data && res.data.data && typeof res.data.data === 'string') {
                        musicUrl = res.data.data;
                    }
                    if (musicUrl) {
                        currentApiIndex = apiIndex;
                        console.log(`[播放] ✅ 成功: ${apiBase}`);
                        return toHttps(musicUrl);
                    }
                } catch (err) {
                    console.warn(`[播放] ${apiBase} 失败:`, err.message);
                }
            }
            throw new Error('无法获取播放地址');
        };
        
        // ---------- 获取歌曲详情（用于 ID 解析）----------
        const getSongDetail = async (songId) => {
            const maxRetries = API_LIST.length;
            for (let i = 0; i < maxRetries; i++) {
                const apiIndex = (currentApiIndex + i) % maxRetries;
                const apiBase = API_LIST[apiIndex];
                const url = `${apiBase}/song/detail?ids=${songId}`;
                try {
                    const res = await axios.get(url, { timeout: 8000 });
                    let songDetail = null;
                    if (res.data && res.data.songs && res.data.songs[0]) {
                        songDetail = res.data.songs[0];
                    } else if (res.data && res.data.data && res.data.data[0]) {
                        songDetail = res.data.data[0];
                    }
                    if (songDetail) {
                        currentApiIndex = apiIndex;
                        return songDetail;
                    }
                } catch (err) {
                    console.warn(`[详情] ${apiBase} 失败:`, err.message);
                }
            }
            throw new Error('无法获取歌曲详情');
        };
        
        // ---------- 核心播放函数 ----------
        const playSongById = async (songId, songName, artistName, coverUrl) => {
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
                
                fullscreenSongName.value = currentSongName.value;
                fullscreenArtist.value = currentArtist.value;
                fullscreenCover.value = currentCover.value;
                
                const audio = audioPlayer.value;
                if (audio) {
                    audio.src = musicUrl;
                    currentAudioSrc = musicUrl;
                    audio.volume = volumeValue.value;
                    await audio.play();
                    isPlaying.value = true;
                    fullscreenIsPlaying.value = true;
                }
                fetchLyrics(songId);
            } catch (err) {
                console.error('播放错误:', err);
                playErrorMsg.value = err.message || '网络错误，请重试';
            } finally {
                loadingPlay.value = false;
            }
        };
        
        // 下载当前歌曲
        const downloadCurrentSong = async () => {
            const audio = audioPlayer.value;
            if (!audio || !audio.src || audio.src === '') {
                playErrorMsg.value = '没有正在播放的歌曲';
                setTimeout(() => { if (playErrorMsg.value === '没有正在播放的歌曲') playErrorMsg.value = ''; }, 2000);
                return;
            }
            if (currentIsVip.value) {
                playErrorMsg.value = 'VIP歌曲暂不支持下载，请支持正版';
                setTimeout(() => { if (playErrorMsg.value === 'VIP歌曲暂不支持下载，请支持正版') playErrorMsg.value = ''; }, 2000);
                return;
            }
            try {
                const musicUrl = audio.src;
                const ext = musicUrl.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'mp3';
                const fileName = `${currentSongArtist || '未知艺术家'} - ${currentSongName.value || '未知歌曲'}.${ext}`;
                const response = await fetch(musicUrl);
                const blob = await response.blob();
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                playErrorMsg.value = `✅ 已下载: ${fileName}`;
                setTimeout(() => { if (playErrorMsg.value === `✅ 已下载: ${fileName}`) playErrorMsg.value = ''; }, 3000);
            } catch (err) {
                console.error('下载失败:', err);
                playErrorMsg.value = '下载失败，可能是跨域限制';
                setTimeout(() => { if (playErrorMsg.value === '下载失败，可能是跨域限制') playErrorMsg.value = ''; }, 2000);
            }
        };
        
        // ---------- VIP 弹窗逻辑 ----------
        let pendingVipSong = null;
        const showVipModal = (song) => {
            pendingVipSong = song;
            const modal = document.getElementById('vipModal');
            if (modal) modal.style.display = 'flex';
        };
        
        const hideVipModal = () => {
            const modal = document.getElementById('vipModal');
            if (modal) modal.style.display = 'none';
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
                let picUrl = songDetail.al?.picUrl || songDetail.album?.picUrl || songDetail.cover || songDetail.picUrl;
                if (picUrl) picUrl = toHttps(picUrl);
                else picUrl = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                const song = {
                    id: String(songDetail.id),
                    name: songDetail.name,
                    artist: songDetail.ar.map(a => a.name).join('/'),
                    picUrl: picUrl,
                    isVip: isVip
                };
                if (isVip) {
                    showVipModal(song);
                } else {
                    playSongById(song.id, song.name, song.artist, song.picUrl);
                }
            } catch (err) {
                playErrorMsg.value = '获取歌曲信息失败，请检查ID';
                console.error(err);
            }
        };
        
        // ---------- 歌单 ----------
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
            if (plist.length) {
                recommendPlaylists.value = plist;
            } else {
                recommendPlaylists.value = [
                    { id: '3778678', name: '热歌榜', coverImgUrl: 'https://picsum.photos/80/80?random=1', trackCount: 100 },
                    { id: '19723756', name: '欧美流行', coverImgUrl: 'https://picsum.photos/80/80?random=2', trackCount: 50 }
                ];
            }
        };
        
        const fetchPlaylistTracks = async (playlistId, plName) => {
            loadingSearch.value = true;
            try {
                const res = await requestWithFallback(`/playlist/track/all?id=${playlistId}&limit=30`, { timeout: 10000 });
                if (res.data && res.data.songs) {
                    const tracks = res.data.songs;
                    searchResults.value = tracks.map(track => {
                        const fee = track.fee || 0;
                        const isVip = (fee === 1 || fee === 4);
                        let picUrl = track.al?.picUrl || track.album?.picUrl || track.cover || '';
                        if (picUrl) picUrl = toHttps(picUrl);
                        else picUrl = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
                        return {
                            id: String(track.id),
                            name: track.name,
                            artist: track.ar.map(a => a.name).join('/'),
                            duration: track.dt,
                            picUrl: picUrl,
                            isVip: isVip
                        };
                    });
                    searchPerformed.value = true;
                    playErrorMsg.value = `✅ 已加载歌单: ${plName}`;
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
                currentIsVip.value = false;
                if (fullscreenInterval) clearInterval(fullscreenInterval);
            }
        };
        const updateProgress = () => {
            const audio = audioPlayer.value;
            if (audio && audio.duration) {
                currentTime.value = audio.currentTime;
                progressValue.value = (audio.currentTime / audio.duration) * 100;
                fullscreenCurrentTime.value = audio.currentTime;
                fullscreenDuration.value = audio.duration;
                fullscreenProgressValue.value = (audio.currentTime / audio.duration) * 100;
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
            currentIsVip.value = false;
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
            const modal = document.getElementById('fullscreenPlayer');
            if (modal) modal.style.display = 'flex';
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
            const modal = document.getElementById('fullscreenPlayer');
            if (modal) modal.style.display = 'none';
            if (fullscreenInterval) clearInterval(fullscreenInterval);
        };
        
        const fullscreenTogglePlayPause = () => {
            togglePlayPause();
        };
        
        const fullscreenSeek = () => {
            const audio = audioPlayer.value;
            if (audio && fullscreenDuration.value) {
                audio.currentTime = (fullscreenProgressValue.value / 100) * fullscreenDuration.value;
            }
        };
        
        const fullscreenPrev = () => {
            if (playHistory.value.length < 2) {
                playErrorMsg.value = '没有上一曲';
                setTimeout(() => { if (playErrorMsg.value === '没有上一曲') playErrorMsg.value = ''; }, 1500);
                return;
            }
            const currentIndex = playHistory.value.findIndex(item => item.id === currentSongId);
            if (currentIndex === -1 || currentIndex === 0) {
                playErrorMsg.value = '已经是第一首';
                setTimeout(() => { if (playErrorMsg.value === '已经是第一首') playErrorMsg.value = ''; }, 1500);
                return;
            }
            const prevSong = playHistory.value[currentIndex - 1];
            playSongById(prevSong.id, prevSong.name, prevSong.artist, prevSong.cover);
        };
        
        const fullscreenNext = () => {
            if (playHistory.value.length < 2) {
                playErrorMsg.value = '没有下一曲';
                setTimeout(() => { if (playErrorMsg.value === '没有下一曲') playErrorMsg.value = ''; }, 1500);
                return;
            }
            const currentIndex = playHistory.value.findIndex(item => item.id === currentSongId);
            if (currentIndex === -1 || currentIndex === playHistory.value.length - 1) {
                playErrorMsg.value = '已经是最后一首';
                setTimeout(() => { if (playErrorMsg.value === '已经是最后一首') playErrorMsg.value = ''; }, 1500);
                return;
            }
            const nextSong = playHistory.value[currentIndex + 1];
            playSongById(nextSong.id, nextSong.name, nextSong.artist, nextSong.cover);
        };
        
        const initModalEvents = () => {
            const vipModal = document.getElementById('vipModal');
            if (vipModal) {
                const closeBtn = document.getElementById('closeModalBtn');
                const cancelBtn = document.getElementById('modalCancelBtn');
                const confirmBtn = document.getElementById('modalConfirmBtn');
                if (closeBtn) closeBtn.onclick = hideVipModal;
                if (cancelBtn) cancelBtn.onclick = hideVipModal;
                if (confirmBtn) confirmBtn.onclick = goToNetEase;
                vipModal.onclick = (e) => { if (e.target === vipModal) hideVipModal(); };
            }
        };
        
        onMounted(() => {
            loadTheme();
            loadPlaylists();
            nextTick(() => {
                initModalEvents();
                const fsModal = document.getElementById('fullscreenPlayer');
                if (fsModal) fsModal.style.display = 'none';
            });
        });
        
        return {
            searchKeyword, songIdInput, searchResults, loadingSearch, searchPerformed,
            currentSongName, currentArtist, currentCover, loadingPlay, playErrorMsg, audioPlayer,
            isPlaying, currentTime, duration, progressValue, volumeValue,
            lyricsLines, currentLyricIndex, lyricsContainer, playHistory, recommendPlaylists,
            formatDuration, formatTime, searchSongs, parseById, playSongById,
            togglePlayPause, stopAudio, updateProgress, onLoadedMetadata, seekAudio, changeVolume,
            onAudioEnded, onAudioError, loadPlaylists, fetchPlaylistTracks,
            handlePlayClick, downloadCurrentSong, handleImageError,
            openFullscreenPlayer, closeFullscreenPlayer,
            fullscreenCover, fullscreenSongName, fullscreenArtist,
            fullscreenLyrics, fullscreenLyricIndex, fullscreenCurrentTime,
            fullscreenDuration, fullscreenProgressValue, fullscreenIsPlaying,
            fullscreenTogglePlayPause, fullscreenSeek, fullscreenPrev, fullscreenNext,
            isDarkMode, toggleTheme
        };
    }
}).mount('#app');
