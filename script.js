const { createApp, ref, onMounted, nextTick, computed } = Vue;

createApp({
    setup() {
        // ---------- 响应式数据 ----------
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
        
        // 用于全屏播放器的歌单切换
        let currentPlaylistSongs = [];
        let currentPlaylistType = 'history';
        let currentPlaylistIndex = -1;
        
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
        
        // 背景设置
        const bgImageUrl = ref('');
        const blurEnabled = ref(false);
        const bgBlur = ref(0);
        const cardOpacity = ref(100);   // 卡片背景透明度百分比
        const maskOpacity = ref(30);    // 卡片遮罩透明度百分比，默认30%
        
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
        
        // ---------- 主题切换 ----------
        const openThemeModal = () => {
            const modal = document.getElementById('themeModal');
            if (modal) modal.style.display = 'flex';
        };
        
        const closeThemeModal = () => {
            const modal = document.getElementById('themeModal');
            if (modal) modal.style.display = 'none';
        };
        
        const setTheme = (themeName) => {
            console.log('[主题] 切换到:', themeName);
            currentTheme.value = themeName;
            localStorage.setItem('appTheme', themeName);
            document.body.className = currentTheme.value;
            if (blurEnabled.value) {
                document.body.classList.add('blur-enabled');
            }
            closeThemeModal();
        };
        
        const loadTheme = () => {
            const savedTheme = localStorage.getItem('appTheme');
            if (savedTheme && ['theme-default', 'theme-dark', 'theme-ocean', 'theme-purple', 'theme-sunset'].includes(savedTheme)) {
                currentTheme.value = savedTheme;
            } else {
                currentTheme.value = 'theme-default';
            }
            document.body.className = currentTheme.value;
            console.log('[主题] 加载主题:', currentTheme.value);
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
        
        // ---------- 通用请求 ----------
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
        
        // ---------- 获取真实封面 ----------
        const fetchRealCover = async (songId) => {
            for (let i = 0; i < API_LIST.length; i++) {
                const apiBase = API_LIST[(currentApiIndex + i) % API_LIST.length];
                try {
                    const res = await axios.get(`${apiBase}/song/detail?ids=${songId}`, { timeout: 5000 });
                    let detail = null;
                    if (res.data && res.data.songs && res.data.songs[0]) {
                        detail = res.data.songs[0];
                    } else if (res.data && res.data.data && res.data.data[0]) {
                        detail = res.data.data[0];
                    }
                    if (detail) {
                        const coverUrl = extractCover(detail);
                        if (coverUrl && coverUrl.startsWith('http')) {
                            return toHttps(coverUrl);
                        }
                    }
                } catch (e) {
                    console.warn(`获取封面失败 ${apiBase}:`, e.message);
                }
            }
            return null;
        };
        
        // ---------- 图片加载 ----------
        const onImageLoad = (event, songId) => {
            const wrapper = event.target.closest('.cover-wrapper');
            if (wrapper) {
                const loadingDiv = wrapper.querySelector('.cover-loading');
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
        };
        
        const onImageError = (event, songId) => {
            const img = event.target;
            const wrapper = img.closest('.cover-wrapper');
            if (wrapper) {
                const loadingDiv = wrapper.querySelector('.cover-loading');
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
            if (!img.src.includes('cdn-icons-png.flaticon.com')) {
                img.src = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
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
            
            const defaultCover = 'https://cdn-icons-png.flaticon.com/512/727/727245.png';
            const tempResults = songsData.map(item => {
                const id = item.id || item.song_id;
                const name = item.name || item.title;
                const artist = item.artists?.[0]?.name || item.artist || item.singer || '未知';
                const duration = item.duration || item.dt || 0;
                const fee = item.fee || 0;
                const isVip = (fee === 1 || fee === 4);
                return {
                    id: String(id),
                    name: name,
                    artist: artist,
                    duration: duration,
                    picUrl: defaultCover,
                    isVip: isVip,
                    loadingCover: true
                };
            });
            searchResults.value = tempResults;
            
            const coverPromises = tempResults.map(async (song, index) => {
                try {
                    const realCover = await fetchRealCover(song.id);
                    if (realCover) {
                        searchResults.value[index].picUrl = realCover;
                    } else {
                        searchResults.value[index].loadingCover = false;
                    }
                } catch (e) {
                    console.warn(`获取歌曲 ${song.id} 封面失败:`, e);
                    searchResults.value[index].loadingCover = false;
                }
            });
            await Promise.allSettled(coverPromises);
            loadingSearch.value = false;
        };
        
        // ---------- 播放地址获取 ----------
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
        
        // ---------- 歌曲详情 ----------
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
        
        // ---------- 播放 ----------
        const playSongById = async (songId, songName, artistName, coverUrl, playlistSongs = null, playlistIndex = -1, playlistType = 'history') => {
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
                
                if (playlistSongs && playlistIndex >= 0) {
                    currentPlaylistSongs = playlistSongs;
                    currentPlaylistIndex = playlistIndex;
                    currentPlaylistType = playlistType;
                } else {
                    currentPlaylistSongs = [];
                    currentPlaylistIndex = -1;
                    currentPlaylistType = 'history';
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
                    await new Promise((resolve) => {
                        audio.addEventListener('canplay', resolve, { once: true });
                    });
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
        
        // ---------- 下载 ----------
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
                playErrorMsg.value = '⏳ 正在准备下载（含封面）...';
                const musicUrl = audio.src;
                const audioResponse = await fetch(musicUrl);
                if (!audioResponse.ok) throw new Error('音频获取失败');
                const audioBuffer = await audioResponse.arrayBuffer();
                
                let coverBuffer = null;
                const coverUrl = currentCover.value;
                if (coverUrl && coverUrl !== 'https://cdn-icons-png.flaticon.com/512/727/727245.png') {
                    try {
                        const imgResponse = await fetch(coverUrl);
                        if (imgResponse.ok) {
                            coverBuffer = await imgResponse.arrayBuffer();
                        }
                    } catch (e) {
                        console.warn('获取封面图片失败，将不嵌入封面', e);
                    }
                }
                
                const writer = new window.ID3Writer(audioBuffer);
                writer.setFrame('TIT2', currentSongName.value || '未知歌曲')
                      .setFrame('TPE1', [currentArtist.value || '未知艺术家'])
                      .setFrame('TALB', '云音匣下载')
                      .setFrame('TYER', new Date().getFullYear().toString())
                      .setFrame('TCON', ['流行']);
                if (coverBuffer) {
                    const coverType = coverUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
                    writer.setFrame('APIC', {
                        type: 3,
                        data: coverBuffer,
                        description: 'Cover',
                        mime: coverType
                    });
                }
                writer.addTag();
                const taggedBuffer = writer.arrayBuffer;
                
                const blob = new Blob([taggedBuffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const fileName = `${currentArtist.value || '未知艺术家'} - ${currentSongName.value || '未知歌曲'}.mp3`;
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                playErrorMsg.value = `✅ 已下载（含封面）: ${fileName}`;
                setTimeout(() => { if (playErrorMsg.value === `✅ 已下载（含封面）: ${fileName}`) playErrorMsg.value = ''; }, 3000);
            } catch (err) {
                console.error('下载失败:', err);
                playErrorMsg.value = '下载失败，可能是网络或跨域限制，请重试';
                setTimeout(() => { if (playErrorMsg.value === '下载失败，可能是网络或跨域限制，请重试') playErrorMsg.value = ''; }, 3000);
            }
        };
        
        // ---------- VIP 弹窗 ----------
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
                        if (picUrl && picUrl.startsWith('http')) {
                            picUrl = toHttps(picUrl);
                        } else {
                            picUrl = defaultCover;
                        }
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
                        currentPlaylistSongs = songList;
                        currentPlaylistType = 'custom';
                    } else {
                        currentPlaylistType = 'history';
                        currentPlaylistSongs = [];
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
        
        const onDefaultPlaylistClick = (playlistId, plName) => {
            fetchPlaylistTracks(playlistId, plName, false);
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
        
        // ---------- 上一曲/下一曲 ----------
        const playPrev = () => {
            if (currentPlaylistType === 'custom' && currentPlaylistSongs.length > 0) {
                if (currentPlaylistIndex <= 0) {
                    playErrorMsg.value = '已经是歌单第一首';
                    setTimeout(() => { if (playErrorMsg.value === '已经是歌单第一首') playErrorMsg.value = ''; }, 1500);
                    return;
                }
                const prevSong = currentPlaylistSongs[currentPlaylistIndex - 1];
                playSongById(prevSong.id, prevSong.name, prevSong.artist, prevSong.picUrl, currentPlaylistSongs, currentPlaylistIndex - 1, 'custom');
            } else {
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
            }
        };
        
        const playNext = () => {
            if (currentPlaylistType === 'custom' && currentPlaylistSongs.length > 0) {
                if (currentPlaylistIndex >= currentPlaylistSongs.length - 1) {
                    playErrorMsg.value = '已经是歌单最后一首';
                    setTimeout(() => { if (playErrorMsg.value === '已经是歌单最后一首') playErrorMsg.value = ''; }, 1500);
                    return;
                }
                const nextSong = currentPlaylistSongs[currentPlaylistIndex + 1];
                playSongById(nextSong.id, nextSong.name, nextSong.artist, nextSong.picUrl, currentPlaylistSongs, currentPlaylistIndex + 1, 'custom');
            } else {
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
                if (blurEnabled.value) {
                    document.body.classList.add('blur-enabled');
                } else {
                    document.body.classList.remove('blur-enabled');
                }
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
        };
        
        const saveBgImage = () => {
            if (!bgImageUrl.value.trim()) {
                playErrorMsg.value = '请输入图片URL';
                setTimeout(() => { if (playErrorMsg.value === '请输入图片URL') playErrorMsg.value = ''; }, 2000);
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
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundAttachment = '';
            playErrorMsg.value = '✅ 已恢复默认背景';
            setTimeout(() => { if (playErrorMsg.value === '✅ 已恢复默认背景') playErrorMsg.value = ''; }, 2000);
        };
        
        const saveBlurEnabled = () => {
            localStorage.setItem('blurEnabled', blurEnabled.value);
            if (blurEnabled.value) {
                document.body.classList.add('blur-enabled');
            } else {
                document.body.classList.remove('blur-enabled');
            }
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
        
        const openSettingsModal = () => {
            const modal = document.getElementById('settingsModal');
            if (modal) modal.style.display = 'flex';
        };
        
        const closeSettingsModal = () => {
            const modal = document.getElementById('settingsModal');
            if (modal) modal.style.display = 'none';
        };
        
        // ---------- 空格键控制 ----------
        const handleKeydown = (event) => {
            const target = event.target;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            if (isInput) return;
            if (event.code === 'Space') {
                event.preventDefault();
                togglePlayPause();
            }
        };
        
        // ---------- 公告 ----------
        const showAnnouncement = () => {
            const modal = document.getElementById('announcementModal');
            if (!modal) return;
            modal.style.display = 'flex';
            const closeBtn = document.getElementById('closeAnnouncementBtn');
            const confirmBtn = document.getElementById('confirmAnnouncementBtn');
            const hideModal = () => { modal.style.display = 'none'; };
            if (closeBtn) closeBtn.onclick = hideModal;
            if (confirmBtn) confirmBtn.onclick = hideModal;
            modal.onclick = (e) => { if (e.target === modal) hideModal(); };
        };
        
        // ---------- 初始化 ----------
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
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal) {
                const closeBtn = document.getElementById('closeSettingsBtn');
                if (closeBtn) closeBtn.onclick = closeSettingsModal;
                settingsModal.onclick = (e) => { if (e.target === settingsModal) closeSettingsModal(); };
            }
        };
        
        onMounted(() => {
            loadTheme();
            loadPlaylists();
            loadBgSettings();
            nextTick(() => {
                initModalEvents();
                const fsModal = document.getElementById('fullscreenPlayer');
                if (fsModal) fsModal.style.display = 'none';
                const themeModal = document.getElementById('themeModal');
                if (themeModal) themeModal.style.display = 'none';
                showAnnouncement();
            });
            window.addEventListener('keydown', handleKeydown);
        });
        
        return {
            searchKeyword, songIdInput, playlistUrlInput, searchResults, loadingSearch, searchPerformed,
            currentSongName, currentArtist, currentCover, loadingPlay, playErrorMsg, audioPlayer,
            isPlaying, currentTime, duration, progressValue, volumeValue,
            lyricsLines, currentLyricIndex, lyricsContainer, playHistory, recommendPlaylists,
            formatDuration, formatTime, searchSongs, parseById, playSongById,
            togglePlayPause, stopAudio, updateProgress, onLoadedMetadata, seekAudio, changeVolume,
            onAudioEnded, onAudioError, loadPlaylists, fetchPlaylistTracks: onDefaultPlaylistClick, loadCustomPlaylist,
            handlePlayClick, downloadCurrentSong, onImageLoad, onImageError,
            openFullscreenPlayer, closeFullscreenPlayer,
            fullscreenCover, fullscreenSongName, fullscreenArtist,
            fullscreenLyrics, fullscreenLyricIndex, fullscreenCurrentTime,
            fullscreenDuration, fullscreenProgressValue, fullscreenIsPlaying,
            fullscreenTogglePlayPause, fullscreenSeek,
            playPrev, playNext,
            currentTheme, openThemeModal, closeThemeModal, setTheme,
            bgImageUrl, blurEnabled, bgBlur, cardOpacity, maskOpacity, bodyBackgroundStyle,
            saveBgImage, resetBgImage, saveBlurEnabled, saveBgBlur, saveCardOpacity, saveMaskOpacity,
            openSettingsModal, closeSettingsModal
        };
    }
}).mount('#app');
