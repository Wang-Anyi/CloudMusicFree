<template>
  <div class="modal" v-show="visible" @click.self="close">
    <div class="modal-content" style="max-width: 550px;">
      <div class="modal-header">
        <span>⚙️ 设置</span>
        <button class="modal-close" @click="close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="settings-section">
          <div class="settings-title">🖼️ 自定义背景图片</div>
          <div class="settings-desc">输入图片URL（支持 http/https）</div>
          <input type="text" v-model="localBgImageUrl" class="settings-input" placeholder="https://example.com/background.jpg">
          <div class="settings-buttons">
            <button class="btn btn-outline" @click="saveBgImage">应用背景</button>
            <button class="btn btn-outline" @click="resetBgImage">重置默认</button>
          </div>
          
          <div class="settings-title" style="margin-top: 20px;">✨ 背景模糊度</div>
          <div class="settings-desc">范围 0-100，数值越大越模糊（0 = 不模糊）</div>
          <div class="slider-container">
            <input type="range" v-model.number="localBgBlur" min="0" max="100" step="1" class="settings-slider" @input="saveBgBlur">
            <span class="slider-value">{{ localBgBlur }}%</span>
          </div>
          
          <div class="settings-title" style="margin-top: 20px;">🎴 卡片透明度</div>
          <div class="settings-desc">范围 20-100%，数值越大越不透明</div>
          <div class="slider-container">
            <input type="range" v-model.number="localCardOpacity" min="20" max="100" step="1" class="settings-slider" @input="saveCardOpacity">
            <span class="slider-value">{{ localCardOpacity }}%</span>
          </div>
          
          <div class="settings-title" style="margin-top: 20px;">🎭 卡片遮罩透明度</div>
          <div class="settings-desc">范围 20-100%，数值越大遮罩越明显（仅当模糊开关开启时生效）</div>
          <div class="slider-container">
            <input type="range" v-model.number="localMaskOpacity" min="20" max="100" step="1" class="settings-slider" @input="saveMaskOpacity">
            <span class="slider-value">{{ localMaskOpacity }}%</span>
          </div>
          
          <div class="settings-title" style="margin-top: 20px;">🔮 毛玻璃强度（背景模糊）</div>
          <div class="settings-desc">范围 0-30px，数值越大背景模糊越强</div>
          <div class="slider-container">
            <input type="range" v-model.number="localGlassIntensity" min="0" max="30" step="1" class="settings-slider" @input="saveGlassIntensity">
            <span class="slider-value">{{ localGlassIntensity }}px</span>
          </div>
          
          <div class="settings-title" style="margin-top: 20px;">✨ 卡片背景模糊化开关</div>
          <label class="switch-label">
            <span class="switch-text">启用模糊效果</span>
            <label class="switch">
              <input type="checkbox" v-model="localBlurEnabled" @change="saveBlurEnabled">
              <span class="slider round"></span>
            </label>
          </label>
          
          <div class="settings-title" style="margin-top: 20px;">🔤 自定义字体（TTF/OTF）</div>
          <div class="settings-desc">上传字体文件，立即应用</div>
          <div class="font-upload">
            <input type="file" accept=".ttf,.otf,.woff,.woff2" @change="applyCustomFont">
          </div>
          
          <div class="settings-title" style="margin-top: 20px;">📦 导入/导出设置</div>
          <div class="import-export-buttons">
            <button class="btn btn-outline" @click="exportSettings">导出设置</button>
            <label class="btn btn-outline" style="cursor:pointer;">导入设置
              <input type="file" accept=".json" @change="importSettings" style="display:none;">
            </label>
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
import { ref, watch } from 'vue';

export default {
  name: 'SettingsPanel',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    bgImageUrl: {
      type: String,
      default: ''
    },
    bgBlur: {
      type: Number,
      default: 0
    },
    cardOpacity: {
      type: Number,
      default: 100
    },
    maskOpacity: {
      type: Number,
      default: 30
    },
    glassIntensity: {
      type: Number,
      default: 12
    },
    blurEnabled: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'update:visible',
    'saveBgImage',
    'resetBgImage',
    'saveBgBlur',
    'saveCardOpacity',
    'saveMaskOpacity',
    'saveGlassIntensity',
    'saveBlurEnabled',
    'applyCustomFont',
    'exportSettings',
    'importSettings'
  ],
  setup(props, { emit }) {
    const localBgImageUrl = ref(props.bgImageUrl);
    const localBgBlur = ref(props.bgBlur);
    const localCardOpacity = ref(props.cardOpacity);
    const localMaskOpacity = ref(props.maskOpacity);
    const localGlassIntensity = ref(props.glassIntensity);
    const localBlurEnabled = ref(props.blurEnabled);

    // 监听 props 变化，同步到本地
    watch(() => props.bgImageUrl, (val) => { localBgImageUrl.value = val; });
    watch(() => props.bgBlur, (val) => { localBgBlur.value = val; });
    watch(() => props.cardOpacity, (val) => { localCardOpacity.value = val; });
    watch(() => props.maskOpacity, (val) => { localMaskOpacity.value = val; });
    watch(() => props.glassIntensity, (val) => { localGlassIntensity.value = val; });
    watch(() => props.blurEnabled, (val) => { localBlurEnabled.value = val; });

    const close = () => {
      emit('update:visible', false);
    };

    const saveBgImage = () => {
      emit('saveBgImage', localBgImageUrl.value);
    };
    const resetBgImage = () => {
      emit('resetBgImage');
      localBgImageUrl.value = '';
    };
    const saveBgBlur = () => {
      emit('saveBgBlur', localBgBlur.value);
    };
    const saveCardOpacity = () => {
      emit('saveCardOpacity', localCardOpacity.value);
    };
    const saveMaskOpacity = () => {
      emit('saveMaskOpacity', localMaskOpacity.value);
    };
    const saveGlassIntensity = () => {
      emit('saveGlassIntensity', localGlassIntensity.value);
    };
    const saveBlurEnabled = () => {
      emit('saveBlurEnabled', localBlurEnabled.value);
    };
    const applyCustomFont = (event) => {
      emit('applyCustomFont', event);
    };
    const exportSettings = () => {
      emit('exportSettings');
    };
    const importSettings = (event) => {
      emit('importSettings', event);
    };

    return {
      localBgImageUrl,
      localBgBlur,
      localCardOpacity,
      localMaskOpacity,
      localGlassIntensity,
      localBlurEnabled,
      close,
      saveBgImage,
      resetBgImage,
      saveBgBlur,
      saveCardOpacity,
      saveMaskOpacity,
      saveGlassIntensity,
      saveBlurEnabled,
      applyCustomFont,
      exportSettings,
      importSettings
    };
  }
};
</script>

<style scoped>
/* 样式已在全局 style.css 中定义，此处仅补充组件特定样式 */
.settings-input {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: white;
  font-size: 0.85rem;
}
.settings-buttons {
  display: flex;
  gap: 10px;
  margin: 10px 0;
}
.settings-title {
  font-weight: 600;
  margin: 12px 0 4px;
  color: var(--text-primary);
}
.settings-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}
.settings-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: var(--progress-bg);
  border-radius: 5px;
  outline: none;
}
.settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--progress-thumb);
  border-radius: 50%;
  cursor: pointer;
}
.slider-value {
  min-width: 45px;
  font-size: 0.8rem;
  color: var(--text-primary);
}
.switch-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}
.switch-text {
  font-size: 0.9rem;
  color: var(--text-primary);
}
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 24px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}
input:checked + .slider {
  background-color: #ea8c5c;
}
input:checked + .slider:before {
  transform: translateX(26px);
}
.font-upload {
  margin: 12px 0;
}
.font-upload input {
  display: block;
  width: 100%;
  margin-top: 8px;
}
.import-export-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
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
  max-width: 550px;
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
