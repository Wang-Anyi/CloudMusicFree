<template>
  <div 
    class="mini-player" 
    v-show="visible" 
    @click="restore"
  >
    <img :src="cover" class="mini-cover" alt="">
    <div class="mini-info">
      <div class="mini-title">{{ title }}</div>
      <div class="mini-artist">{{ artist }}</div>
    </div>
    <div class="mini-controls" @click.stop>
      <button class="mini-btn" @click="prev">⏮️</button>
      <button class="mini-btn" @click="togglePlay">{{ isPlaying ? '⏸️' : '▶️' }}</button>
      <button class="mini-btn" @click="next">⏭️</button>
    </div>
    <button class="mini-close" @click.stop="close">✕</button>
  </div>
</template>

<script>
import { ref, watch } from 'vue';

export default {
  name: 'MiniPlayer',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: ''
    },
    artist: {
      type: String,
      default: ''
    },
    cover: {
      type: String,
      default: ''
    },
    isPlaying: {
      type: Boolean,
      default: false
    }
  },
  emits: ['togglePlay', 'prev', 'next', 'restore', 'close'],
  setup(props, { emit }) {
    const localVisible = ref(props.visible);

    watch(() => props.visible, (val) => {
      localVisible.value = val;
    });

    const togglePlay = () => emit('togglePlay');
    const prev = () => emit('prev');
    const next = () => emit('next');
    const restore = () => emit('restore');
    const close = () => emit('close');

    return {
      localVisible,
      togglePlay,
      prev,
      next,
      restore,
      close
    };
  }
};
</script>

<style scoped>
.mini-player {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 300px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 60px;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 10px;
  z-index: 2000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: 0.2s;
}
.mini-player:hover {
  transform: scale(1.02);
}
.mini-cover {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  object-fit: cover;
}
.mini-info {
  flex: 1;
  overflow: hidden;
}
.mini-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mini-artist {
  font-size: 0.7rem;
  color: #ccc;
}
.mini-controls {
  display: flex;
  gap: 8px;
}
.mini-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}
.mini-close {
  background: none;
  border: none;
  color: #aaa;
  font-size: 1rem;
  cursor: pointer;
}
</style>
