const { createApp, ref, onMounted } = Vue;

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
        
        // ✅ 使用您自己部署的 API 地址
        const API_BASE = 'https://api-enhanced-wine-tau.vercel.app';
        
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
                playHistory.value.unshift({ id, name, artist, cover });
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
        
        // ---------- 核心播放函数 ----------
        const playSongById = async (songId, songName, artistName, coverUrl) => {
            if (!songId) return;
            loadingPlay.value = true;
            playErrorMsg.value = '';
            try {
                const urlRes = await axios.get(`${API_BASE}/song/url?id=${songId}`, { timeout: 15000 });
                if (urlRes.data && urlRes.data.data && urlRes.data.data[0] && urlRes.data.data[0].url) {
                    const musicUrl = urlRes.data.data[0].url;
                    currentSongName.value = songName || '未知歌曲';
                    currentArtist.value = artistName || '网易云音乐';
                    currentCover.value = coverUrl || '';
                    addToHistory(songId, songName, currentArtist.value, currentCover.value);
                    
                    const audio = audioPlayer.value;
                    if (audio) {
                        audio.src = musicUrl;
                        currentAudioSrc = musicUrl;
                        audio.volume = volumeValue.value;
                        await audio.play();
                        isPlaying.value = true;
                    }
                    fetchLyrics(songId);
                } else {
                    throw new Error('未获取到播放地址，可能为VIP歌曲或版权限制');
                }
            } catch (err) {
                playErrorMsg.value = err.message || '网络错误，请重试';
                console.error(err);
            } finally {
                loadingPlay.value = false;
            }
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
                    searchResults.value = res.data.result.songs.map(item => ({
                        id: String(item.id),
                        name: item.name,
                        artist: item.artists.map(a => a.name).join('/'),
                        duration: item.duration,
                        picUrl: item.album.picUrl || ''
                    }));
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
        
        const parseById = () => {
            const id = extractSongId(songIdInput.value);
            if (!id) return alert('请输入正确的歌曲ID或链接');
            playSongById(id, `歌曲ID:${id}`, '网易云音乐', '');
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
                            coverImgUrl: res.data.playlist.coverImgUrl,
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
                    searchResults.value = tracks.map(track => ({
                        id: String(track.id),
                        name: track.name,
                        artist: track.ar.map(a => a.name).join('/'),
                        duration: track.dt,
                        picUrl: track.al?.picUrl || ''
                    }));
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
            if (audio) { audio.pause(); audio.currentTime = 0; isPlaying.value = false; }
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
        const onAudioEnded = () => { isPlaying.value = false; };
        const onAudioError = () => { playErrorMsg.value = '播放失败，可能是版权限制或链接过期'; isPlaying.value = false; };
        
        onMounted(() => {
            loadPlaylists();
        });
        
        return {
            searchKeyword, songIdInput, searchResults, loadingSearch, searchPerformed,
            currentSongName, currentArtist, currentCover, loadingPlay, playErrorMsg, audioPlayer,
            isPlaying, currentTime, duration, progressValue, volumeValue,
            lyricsLines, currentLyricIndex, lyricsContainer, playHistory, recommendPlaylists,
            formatDuration, formatTime, searchSongs, parseById, playSongById,
            togglePlayPause, stopAudio, updateProgress, onLoadedMetadata, seekAudio, changeVolume,
            onAudioEnded, onAudioError, loadPlaylists, fetchPlaylistTracks
        };
    }
}).mount('#app');
