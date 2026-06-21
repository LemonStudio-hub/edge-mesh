<script setup lang="ts">
import { ref } from 'vue';
import { MAX_FILE_SIZE } from '@edge-mesh/shared';

const emit = defineEmits<{
  fileSelected: [file: File];
}>();

const isDragging = ref(false);
const selectedFile = ref<File | null>(null);
const error = ref('');
let dragCounter = 0;

function handleDragEnter(e: DragEvent) {
  e.preventDefault();
  dragCounter++;
  isDragging.value = true;
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    isDragging.value = false;
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  dragCounter = 0;
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    validateAndSelect(files[0]);
  }
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    validateAndSelect(input.files[0]);
  }
}

function validateAndSelect(file: File) {
  error.value = '';
  if (file.size > MAX_FILE_SIZE) {
    const maxMB = MAX_FILE_SIZE / (1024 * 1024);
    const label = maxMB >= 1024 ? `${(maxMB / 1024).toFixed(0)} GB` : `${maxMB} MB`;
    error.value = `File too large (max ${label})`;
    return;
  }
  selectedFile.value = file;
  emit('fileSelected', file);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function clearSelection() {
  selectedFile.value = null;
  error.value = '';
}
</script>

<template>
  <div
    class="drop-zone"
    :class="{ dragging: isDragging, 'has-file': !!selectedFile }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div v-if="selectedFile" class="file-info">
      <div class="file-details">
        <span class="file-name">{{ selectedFile.name }}</span>
        <span class="file-size">{{ formatSize(selectedFile.size) }}</span>
      </div>
      <button class="btn-clear" @click="clearSelection">×</button>
    </div>
    <div v-else class="placeholder">
      <p class="drop-text">Drop a file here</p>
      <p class="or-text">or</p>
      <label class="file-label">
        Browse files
        <input type="file" hidden @change="handleFileInput" />
      </label>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.drop-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
}

.drop-zone:hover,
.dragging {
  border-color: var(--primary);
  background: rgba(37, 99, 235, 0.04);
}

.has-file {
  border-style: solid;
  border-color: var(--success);
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.drop-text {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.or-text {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.file-label {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  background: var(--primary);
  color: white;
  border-radius: var(--radius);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}

.file-label:hover {
  background: var(--primary-hover);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-details {
  flex: 1;
  text-align: left;
}

.file-name {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.btn-clear {
  background: transparent;
  color: var(--text-muted);
  font-size: 1.2rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.btn-clear:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.error {
  color: var(--danger);
  font-size: 0.8rem;
  margin-top: 0.5rem;
}
</style>
