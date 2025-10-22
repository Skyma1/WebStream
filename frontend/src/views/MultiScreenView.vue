<template>
  <div class="ms-page">
    <div class="ms-toolbar">
      <div class="left">
        <h1>Мультискрин</h1>
        <div class="layouts">
          <button v-for="l in availableLayouts" :key="l.id" class="btn btn-secondary btn-sm" :class="{active: layout.id===l.id}" @click="setLayout(l)">
            {{ l.label }}
          </button>
        </div>
      </div>
      <div class="right">
        <button class="btn btn-secondary btn-sm" @click="toggleAll">{{ isPlaying ? 'Пауза всем' : 'Пуск всем' }}</button>
        <router-link to="/dashboard" class="btn btn-primary btn-sm">Назад</router-link>
      </div>
    </div>

    <div class="ms-grid" :style="gridStyle">
      <div v-for="(slotItem, idx) in slots" :key="idx" class="ms-tile" :class="{ activeAudio: activeAudioIndex===idx }">
        <div class="tile-actions">
          <button class="icon" :title="activeAudioIndex===idx ? 'Активный звук' : 'Включить звук здесь'" @click="setActiveAudio(idx)">🔊</button>
          <button class="icon" title="Поменять местами" @click="startSwap(idx)">⇄</button>
          <button class="icon" title="Заменить поток" @click="openReplace(idx)">🔁</button>
        </div>
        <MultiScreenPlayer v-if="slotItem" ref="playerRefs" :stream="slotItem" :muted="activeAudioIndex!==idx" />
        <div v-else-if="waitingIds.has(idx)" class="empty">Ожидание HLS...</div>
        <div v-else class="empty" @click="openReplace(idx)">+ Добавить поток</div>
      </div>
    </div>

    <div v-if="showReplace" class="replace-modal">
      <div class="modal-card">
        <h3>Выберите трансляцию</h3>
        <div class="streams-list">
          <div v-for="s in streamStore.activeStreams" :key="s.id" class="stream-item" @click="applyReplace(s)">
            <span class="title">{{ s.title }}</span>
            <span class="meta">{{ s.operator_username || s.operator_email }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeReplace">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStreamStore } from '@/store/stream'
import MultiScreenPlayer from '@/components/MultiScreenPlayer.vue'

const streamStore = useStreamStore()

// Layouts
const availableLayouts = [
  { id: '1x1', label: '1x1', cols: 1, rows: 1, slots: 1 },
  { id: '1x2', label: '1x2', cols: 2, rows: 1, slots: 2 },
  { id: '2x2', label: '2x2', cols: 2, rows: 2, slots: 4 },
  { id: 'pip', label: 'PiP', cols: 2, rows: 2, slots: 2, pip: true }
]
const layout = ref(availableLayouts[2])
const slots = ref(Array(layout.value.slots).fill(null))
const playerRefs = ref([])
const activeAudioIndex = ref(0)
const isPlaying = ref(true)
const waitingIds = ref(new Set())

const gridStyle = computed(() => {
  if (layout.value.id === 'pip') {
    return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '10px' }
  }
  return { display: 'grid', gridTemplateColumns: `repeat(${layout.value.cols}, 1fr)`, gridTemplateRows: `repeat(${layout.value.rows}, 1fr)`, gap: '10px' }
})

const setLayout = (l) => {
  layout.value = l
  const newSlots = Array(l.slots).fill(null)
  for (let i = 0; i < Math.min(slots.value.length, newSlots.length); i++) newSlots[i] = slots.value[i]
  slots.value = newSlots
  if (activeAudioIndex.value >= newSlots.length) activeAudioIndex.value = 0
}

const setActiveAudio = (idx) => {
  activeAudioIndex.value = idx
}

const startSwap = (idx) => {
  if (swapIndex.value === null) {
    swapIndex.value = idx
  } else if (swapIndex.value === idx) {
    swapIndex.value = null
  } else {
    const a = swapIndex.value
    const b = idx
    const tmp = slots.value[a]
    slots.value[a] = slots.value[b]
    slots.value[b] = tmp
    swapIndex.value = null
  }
}

const swapIndex = ref(null)

// Replace
const showReplace = ref(false)
const replaceIndex = ref(0)
const openReplace = (idx) => { replaceIndex.value = idx; showReplace.value = true }
const closeReplace = () => { showReplace.value = false }
const applyReplace = (stream) => {
  slots.value[replaceIndex.value] = stream
  showReplace.value = false
  waitingIds.value.delete(replaceIndex.value)
}

const toggleAll = () => {
  isPlaying.value = !isPlaying.value
  // trigger all player refs
  const comps = playerRefs.value
  comps?.forEach?.((c) => {
    if (!c) return
    if (isPlaying.value) c.play?.(); else c.pause?.()
  })
}

onMounted(async () => {
  try {
    await streamStore.fetchStreams()
    // Автозаполнение первыми активными потоками
    const act = streamStore.activeStreams.slice(0, layout.value.slots)
    act.forEach((s, i) => slots.value[i] = s)
  } catch {}
})
</script>

<style scoped>
.ms-page { min-height: calc(100vh - 60px); background:#0f0f0f; color:white; padding: 1rem; }
.ms-toolbar { display:flex; justify-content: space-between; align-items:center; margin-bottom: 1rem; }
.ms-toolbar .left { display:flex; align-items:center; gap:1rem; }
.ms-toolbar h1 { margin:0; font-size:1.25rem; }
.layouts { display:flex; gap:0.5rem; }
.btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; border:none; border-radius:6px; cursor:pointer; transition:all .2s ease; font-size:0.875rem; }
.btn-primary { background:#ff0000; color:white; border:1px solid #ff0000; }
.btn-secondary { background:#2a2a2a; color:white; border:1px solid #3a3a3a; }
.btn-sm { padding:0.375rem 0.75rem; font-size:0.75rem; }
.btn.active { background:#3a3a3a; border-color:#4a4a4a; }

.ms-grid { width:100%; height: calc(100vh - 140px); }
.ms-tile { position: relative; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:8px; overflow:hidden; }
.ms-tile.activeAudio { outline: 2px solid #ff0000; }
.tile-actions { position:absolute; right:8px; top:8px; display:flex; gap:6px; z-index:5; }
.tile-actions .icon { background: rgba(0,0,0,0.6); color:white; border:none; border-radius:4px; padding:4px 6px; cursor:pointer; }
.empty { height:100%; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.6); cursor:pointer; }

/* replace modal */
.replace-modal { position:fixed; inset:0; background: rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal-card { width: 520px; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:8px; padding:1rem; }
.streams-list { max-height: 360px; overflow:auto; display:flex; flex-direction:column; gap:8px; margin: 0.5rem 0; }
.stream-item { display:flex; justify-content:space-between; padding:0.75rem; border:1px solid #3a3a3a; border-radius:6px; cursor:pointer; }
.stream-item:hover { background:#2a2a2a; }
.title { font-weight:600; }
.meta { color:rgba(255,255,255,0.7); }
.modal-actions { display:flex; justify-content:flex-end; gap:0.5rem; }
</style>
