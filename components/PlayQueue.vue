<template>
  <div class="modal" v-show="visible" @click.self="close">
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <span>📋 播放队列</span>
        <button class="modal-close" @click="close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="play-queue-controls">
          <button class="btn btn-outline" @click="clear">清空队列</button>
          <button class="btn btn-outline" @click="toggleLoopMode">
            {{ loopMode === 'none' ? '单曲循环' : (loopMode === 'one' ? '列表循环' : '随机播放') }}
          </button>
        </div>
        <div class="play-queue-list" ref="queueListRef">
          <div 
            v-for="(song, idx) in queue" 
            :key="song.id" 
            class="queue-item" 
            :class="{ active: currentIndex === idx }"
            @click="playFromQueue(idx)"
          >
            <span class="queue-index">{{ idx+1 }}</span>
            <img :src="song.picUrl" class="queue-cover" alt="">
            <div class="queue-info">
              <div class="queue-name">{{ song.name }}</div>
              <div class="queue-artist">{{ song.artist }}</div>
            </div>
            <button class="queue-remove" @click.stop="removeFromQueue(idx)">✕</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn confirm" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, nextTick } from 'vue';

export default {
  name: 'PlayQueueModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    queue: {
      type: Array,
      default: () => []
    },
    currentIndex: {
      type: Number,
      default: -1
    },
    loopMode: {
      type: String,
      default: 'none'  // 'none', 'one', 'all'
    }
  },
  emits: ['update:visible', 'play', 'remove', 'clear', 'toggleLoopMode'],
  setup(props, { emit }) {
    const queueListRef = ref(null);

    const close = () => {
      emit('update:visible', false);
    };

    const playFromQueue = (idx) => {
      emit('play', idx);
    };

    const removeFromQueue = (idx) => {
      emit('remove', idx);
    };

    const clear = () => {
      emit('clear');
    };

    const toggleLoopMode = () => {
      emit('toggleLoopMode');
    };

    // 当队列变化或当前索引变化时，自动滚动到活动项
    watch([() => props.queue, () => props.currentIndex], async () => {
      await nextTick();
      if (queueListRef.value) {
        const activeItem = queueListRef.value.querySelector('.queue-item.active');
        if (activeItem) {
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });

    return {
      queueListRef,
      close,
      playFromQueue,
      removeFromQueue,
      clear,
      toggleLoopMode
    };
  }
};
</script>

<style scoped>
/* 样式已在全局 style.css 中定义，此处仅保留组件特定样式 */
.play-queue-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.play-queue-list {
  max-height: 400px;
  overflow-y: auto;
}
.queue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: 0.2s;
}
.queue-item:hover {
  background: var(--lyrics-active-bg);
}
.queue-item.active {
  background: var(--lyrics-active-bg);
  border-left: 3px solid #ea8c5c;
}
.queue-index {
  width: 30px;
  text-align: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
}
.queue-cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
}
.queue-info {
  flex: 1;
}
.queue-name {
  font-weight: 600;
  font-size: 0.9rem;
}
.queue-artist {
  font-size: 0.7rem;
  color: var(--text-secondary);
}
.queue-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  color: #d44c2f;
}
.btn {
  border: none;
  background: var(--btn-bg);
  color: var(--btn-text);
  padding: 0 24px;
  border-radius: 48px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
  font-size: 0.9rem;
}
.btn-outline {
  background: rgba(255,255,240,0.9);
  color: #b45a3b;
  border: 1px solid #e2c7b5;
}
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff9f2;
  border-radius: 32px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 35px rgba(0,0,0,0.3);
  overflow: hidden;
  animation: modalFadeIn 0.2s ease;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  background: #f5e6d8;
  font-weight: bold;
  font-size: 1.2rem;
  color: #b64926;
}
.modal-close {
  background: none;
  border: none;
  font-size: 1.8rem;
  cursor: pointer;
  color: #9b6a4a;
  line-height: 1;
}
.modal-close:hover {
  color: #d44c2f;
}
.modal-body {
  padding: 24px 20px;
  text-align: center;
  color: #4f3524;
  line-height: 1.5;
}
.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px 24px;
  justify-content: center;
}
.modal-btn.confirm {
  background: #d44c2f;
  color: white;
  padding: 10px 24px;
  border-radius: 60px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
