const { createApp, ref, onMounted, nextTick } = Vue;

createApp({
    setup() {
        // ---------- 响应式数据 ----------
        const searchKeyword = ref('');
        const songIdInput = ref('');
        const searchResults = ref([]);
        const loadingSearch = ref(false);
        const searchPerformed = ref(false);
        
        // 播放相关
        const currentSongName = ref('');
        const currentArtist = ref('');
        const currentCover = ref('');
        const loadingPlay = ref(false);
        const playErrorMsg = ref('');
        const audioPlayer = ref(null);
        let currentAudioSrc = '';
        
        // 播放器控制
        const isPlaying = ref(false);
        const currentTime = ref(0);
        const duration = ref(0);
        const progressValue = ref(0);
        const volumeValue = ref(0.7);
        
        // 歌词相关
        const lyricsLines = ref([]);
        const currentLyricIndex = ref(-1);
        const lyricsContainer = ref(null);
        
        // 播放历史
        const playHistory = ref([]);
        
        // 推荐歌单
        const recommendPlaylists = ref([]);
        
        // 当前播放歌曲的 VIP 状态
        const currentIsVip = ref(false);
        
        // API 地址（您的自建地址）
        const API_BASE = 'https://api-enhanced-wine-tau.vercel.app';
        
        // 弹窗相关
        let pendingVipSong = null;
        
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
        
        // 强制将 HTTP URL 转为 HTTPS
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
        
        // ---------- 歌词解析 ----------
        const fetchLyrics = async (songId) => {
            try {
                const res = await axios.get(`${API_BASE}/lyric?id=${songId}`, { timeout: 8000 });
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
                } else {
                    lyricsLines.value = [];
                }
            } catch (e) {
                console.warn('歌词加载失败', e);
                lyricsLines.value = [];
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
                if (idx >= 0 && lyricsContainer.value) {
                    const activeEl = lyricsContainer.value.querySelector('.lyric-line.active');
                    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        };
        
        // ---------- 核心播放函数（增加调试和 HTTPS 转换）----------
        const playSongById = async (songId, songName, artistName, coverUrl) => {
            if (!songId) return;
            loadingPlay.value = true;
            playErrorMsg.value = '';
            try {
                const urlRes = await axios.get(`${API_BASE}/song/url?id=${songId}`, { timeout: 15000 });
                // 调试：打印完整返回数据
                console.log('[DEBUG] /song/url 返回:', urlRes.data);
                
                if (urlRes.data && urlRes.data.data && urlRes.data.data[0]) {
                    const musicUrlRaw = urlRes.data.data[0].url;
                    if (musicUrlRaw) {
                        const musicUrl = toHttps(musicUrlRaw);
                        currentSongName.value = songName || '未知歌曲';
                        currentArtist.value = artistName || '网易云音乐';
                        currentCover.value = toHttps(coverUrl || '');
                        currentIsVip.value = false;
                        addToHistory(songId, songName, currentArtist.value, currentCover.value);
                        
                        const audio = audioPlayer.value;
                        if (audio) {
                            audio.src = musicUrl;
                            currentAudioSrc = musicUrl;
                            audio.volume = volumeValue.value;
                            await audio.play();
                            isPlaying.value = true;
                            // 播放成功后清空错误信息
                            playErrorMsg.value = '';
                        }
                        fetchLyrics(songId);
                    } else {
                        // 返回的 url 为空
                        console.warn('API 返回的播放地址为空，歌曲可能受版权保护');
                        playErrorMsg.value = '该歌曲暂无可用播放地址（可能是 VIP 或版权限制）';
                        throw new Error('播放地址为空');
                    }
                } else {
                    throw new Error('API 返回数据格式异常，未找到播放链接');
                }
            } catch (err) {
                console.error('播放错误:', err);
                playErrorMsg.value = err.message || '网络错误，请重试';
                // 若因跨域或网络问题，给出更友好提示
                if (err.message.includes('Network Error')) {
                    playErrorMsg.value = '网络错误，请检查 API 服务是否正常';
                }
            } finally {
                loadingPlay.value = false;
            }
        };
        
        // ---------- VIP 弹窗逻辑 ----------
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
        
        // 下载当前歌曲
        const downloadCurrentSong = () => {
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
            const musicUrl = audio.src;
            window.open(musicUrl, '_blank');
            playErrorMsg.value = '✅ 已打开音频链接，可右键另存为';
            setTimeout(() => { if (playErrorMsg.value === '✅ 已打开音频链接，可右键另存为') playErrorMsg.value = ''; }, 3000);
        };
        
        // 初始化弹窗事件
        const initModalEvents = () => {
            const modal = document.getElementById('vipModal');
            if (!modal) return;
            const closeBtn = document.getElementById('closeModalBtn');
            const cancelBtn = document.getElementById('modalCancelBtn');
            const confirmBtn = document.getElementById('modalConfirmBtn');
            if (closeBtn) closeBtn.onclick = hideVipModal;
            if (cancelBtn) cancelBtn.onclick = hideVipModal;
            if (confirmBtn) confirmBtn.onclick = goToNetEase;
            modal.onclick = (e) => {
                if (e.target === modal) hideVipModal();
            };
        };
        
        // ---------- 搜索歌曲 ----------
        const searchSongs = async () => {
            const keyword = searchKeyword.value.trim();
            if (!keyword) return alert('请输入歌名或歌手');
            loadingSearch.value = true;
            searchPerformed.value = true;
            try {
                const res = await axios.get(`${API_BASE}/search?keywords=${encodeURIComponent(keyword)}&limit=30`, { timeout: 12000 });
                if (res.data && res.data.result && res.data.result.songs) {
                    searchResults.value = res.data.result.songs.map(item => {
                        const fee = item.fee || 0;
                        // 修正 VIP 判断：fee 为 1 或 4 才是真正付费
                        const isVip = (fee === 1 || fee === 4);
                        return {
                            id: String(item.id),
                            name: item.name,
                            artist: item.artists.map(a => a.name).join('/'),
                            duration: item.duration,
                            picUrl: toHttps(item.album.picUrl || ''),
                            isVip: isVip,
                            fee: fee
                        };
                    });
                } else {
                    searchResults.value = [];
                }
            } catch (e) {
                console.error(e);
                searchResults.value = [];
                playErrorMsg.value = '搜索接口异常，请稍后重试';
            } finally {
                loadingSearch.value = false;
            }
        };
        
        const parseById = async () => {
            const id = extractSongId(songIdInput.value);
            if (!id) return alert('请输入正确的歌曲ID或链接');
            try {
                const res = await axios.get(`${API_BASE}/song/detail?ids=${id}`, { timeout: 8000 });
                if (res.data && res.data.songs && res.data.songs[0]) {
                    const songDetail = res.data.songs[0];
                    const fee = songDetail.fee || 0;
                    const isVip = (fee === 1 || fee === 4);
                    const song = {
                        id: String(songDetail.id),
                        name: songDetail.name,
                        artist: songDetail.ar.map(a => a.name).join('/'),
                        picUrl: toHttps(songDetail.al.picUrl || ''),
                        isVip: isVip
                    };
                    if (isVip) {
                        showVipModal(song);
                    } else {
                        playSongById(song.id, song.name, song.artist, song.picUrl);
                    }
                } else {
                    throw new Error('未找到歌曲信息');
                }
            } catch (err) {
                playErrorMsg.value = '获取歌曲信息失败，请检查ID';
                console.error(err);
            }
        };
        
        // ---------- 热门歌单 ----------
        const loadPlaylists = async () => {
            const playlistIds = ['3778678', '19723756', '3136952023', '6727748870', '2253631882'];
            const randomIds = playlistIds.sort(() => 0.5 - Math.random()).slice(0, 4);
            const plist = [];
            for (let pid of randomIds) {
                try {
                    const res = await axios.get(`${API_BASE}/playlist/detail?id=${pid}`, { timeout: 8000 });
                    if (res.data && res.data.playlist) {
                        plist.push({
                            id: res.data.playlist.id,
                            name: res.data.playlist.name,
                            coverImgUrl: toHttps(res.data.playlist.coverImgUrl || ''),
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
                const res = await axios.get(`${API_BASE}/playlist/track/all?id=${playlistId}&limit=30`, { timeout: 10000 });
                if (res.data && res.data.songs) {
                    const tracks = res.data.songs;
                    searchResults.value = tracks.map(track => {
                        const fee = track.fee || 0;
                        const isVip = (fee === 1 || fee === 4);
                        return {
                            id: String(track.id),
                            name: track.name,
                            artist: track.ar.map(a => a.name).join('/'),
                            duration: track.dt,
                            picUrl: toHttps(track.al?.picUrl || ''),
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
            } else {
                audio.pause();
                isPlaying.value = false;
            }
        };
        const stopAudio = () => {
            const audio = audioPlayer.value;
            if (audio) { 
                audio.pause(); 
                audio.currentTime = 0; 
                isPlaying.value = false;
                currentIsVip.value = false;
            }
        };
        const updateProgress = () => {
            const audio = audioPlayer.value;
            if (audio && audio.duration) {
                currentTime.value = audio.currentTime;
                progressValue.value = (audio.currentTime / audio.duration) * 100;
                updateLyrics(audio.currentTime);
            }
        };
        const onLoadedMetadata = () => {
            const audio = audioPlayer.value;
            if (audio) {
                duration.value = audio.duration;
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
            currentIsVip.value = false;
        };
        const onAudioError = (e) => { 
            console.error('Audio 元素错误:', e);
            playErrorMsg.value = '播放失败，可能是音频链接无效或跨域问题'; 
            isPlaying.value = false;
            currentIsVip.value = false;
        };
        
        onMounted(() => {
            loadPlaylists();
            nextTick(() => {
                initModalEvents();
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
            handlePlayClick, downloadCurrentSong
        };
    }
}).mount('#app');
