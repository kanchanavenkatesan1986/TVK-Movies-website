/**
 * Akatsuki Cloud Uploader - Cloudflare R2 Multipart Uploader
 * Frontend Core Application Logic
 */

// Constants
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks
const API_BASE = 'https://tvk-file.akatsuki-pvt-ltd.workers.dev';
const STORAGE_KEY = 'r2_uploader_sessions';

// State
let uploadQueue = [];
let maxConcurrency = 1;
let globalSpeedInterval = null;

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');
const btnSelectFiles = document.getElementById('btn-select-files');
const btnSelectFolder = document.getElementById('btn-select-folder');
const queueList = document.getElementById('queue-list');
const queueEmptyState = document.getElementById('queue-empty-state');
const queueCount = document.getElementById('queue-count');
const restorePanel = document.getElementById('restore-panel');
const restoreList = document.getElementById('restore-list');
const clearRestorablesBtn = document.getElementById('clear-restorables-btn');
const folderPathInput = document.getElementById('folder-path');
const concurrencyRange = document.getElementById('concurrency-range');
const concurrencyVal = document.getElementById('concurrency-val');
const globalStatusText = document.getElementById('global-status');
const globalSpeedText = document.getElementById('global-speed');
const globalEtaText = document.getElementById('global-eta');
const globalProgressText = document.getElementById('global-progress');
const statUploadIcon = document.getElementById('stat-upload-icon');
const queueGlobalActions = document.getElementById('queue-global-actions');
const btnGlobalPause = document.getElementById('btn-global-pause');
const btnGlobalResume = document.getElementById('btn-global-resume');
const btnGlobalClear = document.getElementById('btn-global-clear');

// -------------------------------------------------------------
// Initialization & Event Listeners
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Load concurrency settings
  const storedConcurrency = localStorage.getItem('r2_upload_concurrency');
  if (storedConcurrency) {
    maxConcurrency = parseInt(storedConcurrency);
    concurrencyRange.value = maxConcurrency;
    concurrencyVal.textContent = maxConcurrency;
  }

  // Load folder path settings
  const storedFolder = localStorage.getItem('r2_upload_folder');
  if (storedFolder !== null) {
    folderPathInput.value = storedFolder;
  }

  // Bind settings listeners
  concurrencyRange.addEventListener('input', (e) => {
    maxConcurrency = parseInt(e.target.value);
    concurrencyVal.textContent = maxConcurrency;
    localStorage.setItem('r2_upload_concurrency', maxConcurrency);
    
    // Update concurrency of active uploads
    uploadQueue.forEach(up => {
      if (up.status === 'uploading') {
        uploadNextChunks(up);
      }
    });
  });

  folderPathInput.addEventListener('input', (e) => {
    let val = e.target.value;
    localStorage.setItem('r2_upload_folder', val);
  });

  // Bind select buttons
  btnSelectFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  btnSelectFolder.addEventListener('click', (e) => {
    e.stopPropagation();
    folderInput.click();
  });

  fileInput.addEventListener('change', handleFileSelect);
  folderInput.addEventListener('change', handleFolderSelect);

  // Bind Drag & Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', handleDrop);
  dropZone.addEventListener('click', () => fileInput.click());

  // Bind Restore Clear
  clearRestorablesBtn.addEventListener('click', clearAllStoredSessions);

  // Bind Global Actions
  btnGlobalPause.addEventListener('click', pauseAllUploads);
  btnGlobalResume.addEventListener('click', resumeAllUploads);
  btnGlobalClear.addEventListener('click', clearQueueAndAbortAll);

  // Event Delegation for Restore List Actions
  restoreList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const uploadId = btn.getAttribute('data-upload-id');
    if (!uploadId) return;

    const sessions = getStoredSessions();
    const session = sessions[uploadId];
    if (!session) return;

    if (btn.classList.contains('btn-restore-run')) {
      triggerRestoreFileSelect(session);
    } else if (btn.classList.contains('btn-restore-del')) {
      if (confirm(`Abort upload for "${session.name}"? Completed parts in the bucket will be deleted.`)) {
        apiAbortUpload(session.uploadId, session.key);
        deleteStoredSession(session.uploadId);
        showToast('Session Discarded', `Upload progress for ${session.name} discarded.`, 'info');
      }
    }
  });

  // Event Delegation for Queue List Card Actions (Pause, Resume, Cancel/Delete)
  queueList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const card = btn.closest('.queue-card');
    if (!card) return;

    const id = card.id.replace('card-', '');

    if (btn.classList.contains('btn-pause')) {
      pauseUpload(id);
    } else if (btn.classList.contains('btn-resume')) {
      resumeUpload(id);
    } else if (btn.classList.contains('btn-cancel')) {
      cancelUpload(id);
    }
  });

  // Load stored sessions
  renderRestorePanel();

  // Start stats calculator loop
  startGlobalStatsCalculator();

  showToast('Welcome!', 'Cloud uploader initialized. Ready for large files.', 'info');
}

// -------------------------------------------------------------
// Drag & Drop / File Select Handlers
// -------------------------------------------------------------

function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    addFilesToQueue(files);
  }
  fileInput.value = ''; // Reset input
}

function handleFolderSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    // webkitRelativePath contains the directory structure
    const filesWithRelativePaths = files.map(file => {
      file.relativePath = file.webkitRelativePath || file.name;
      return file;
    });
    addFilesToQueue(filesWithRelativePaths);
  }
  folderInput.value = ''; // Reset input
}

async function handleDrop(e) {
  e.preventDefault();
  dropZone.classList.remove('dragover');

  const items = e.dataTransfer.items;
  if (!items) return;

  const files = [];
  const entriesPromises = [];

  // Recursive Directory Traversal
  async function traverseEntry(entry, path = '') {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => {
        entry.file(resolve, reject);
      });
      file.relativePath = path + file.name;
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await readAllEntries(dirReader);
      for (const childEntry of entries) {
        await traverseEntry(childEntry, path + entry.name + '/');
      }
    }
  }

  // Read all entries in a directory, handling pagination
  async function readAllEntries(dirReader) {
    let allEntries = [];
    const readBatch = () => {
      return new Promise((resolve) => {
        dirReader.readEntries((entries) => resolve(entries));
      });
    };
    let entries = await readBatch();
    while (entries.length > 0) {
      allEntries = allEntries.concat(entries);
      entries = await readBatch();
    }
    return allEntries;
  }

  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry();
    if (entry) {
      entriesPromises.push(traverseEntry(entry));
    }
  }

  try {
    await Promise.all(entriesPromises);
    if (files.length > 0) {
      addFilesToQueue(files);
    }
  } catch (err) {
    console.error('Error parsing dropped items:', err);
    showToast('Upload Error', 'Failed to parse dropped files/folders.', 'error');
  }
}

// -------------------------------------------------------------
// Session Restore Management (localStorage)
// -------------------------------------------------------------

function getStoredSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to parse stored sessions:', e);
    return {};
  }
}

function saveSession(uploadObj) {
  const sessions = getStoredSessions();
  
  // Only save essential serializable upload state
  sessions[uploadObj.uploadId] = {
    id: uploadObj.id,
    name: uploadObj.name,
    path: uploadObj.path,
    key: uploadObj.key,
    size: uploadObj.size,
    uploadId: uploadObj.uploadId,
    totalChunks: uploadObj.totalChunks,
    parts: uploadObj.parts.map(p => ({ partNumber: p.partNumber, etag: p.etag }))
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function deleteStoredSession(uploadId) {
  const sessions = getStoredSessions();
  if (sessions[uploadId]) {
    delete sessions[uploadId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
  renderRestorePanel();
}

function clearAllStoredSessions() {
  const sessions = getStoredSessions();
  const keys = Object.keys(sessions);
  if (keys.length === 0) return;

  if (confirm(`Are you sure you want to clear all ${keys.length} saved upload sessions? This will also try to abort the uploads on the server.`)) {
    keys.forEach(uploadId => {
      const sess = sessions[uploadId];
      // Fire-and-forget abort API call
      apiAbortUpload(uploadId, sess.key);
      deleteStoredSession(uploadId);
    });
    showToast('Sessions Cleared', 'Stored upload states removed.', 'info');
  }
}

function renderRestorePanel() {
  const sessions = getStoredSessions();
  const sessionList = Object.values(sessions);

  if (sessionList.length === 0) {
    restorePanel.style.display = 'none';
    return;
  }

  restorePanel.style.display = 'block';
  restoreList.innerHTML = '';

  sessionList.forEach(session => {
    const pct = Math.round((session.parts.length / session.totalChunks) * 100) || 0;
    
    const item = document.createElement('div');
    item.className = 'restore-item';
    item.innerHTML = `
      <div class="restore-info">
        <span class="restore-name" title="${session.name}">${session.name}</span>
        <span class="restore-meta">
          ${formatSize(session.size)} &bull; ${pct}% complete (${session.parts.length}/${session.totalChunks} chunks)
        </span>
      </div>
      <div class="restore-actions">
        <button class="btn btn-secondary btn-icon btn-restore-run" data-upload-id="${session.uploadId}" title="Select file to resume">
          <i class="fa-solid fa-file-import" style="color: var(--warning-color)"></i>
        </button>
        <button class="btn btn-icon btn-icon-danger btn-icon btn-restore-del" data-upload-id="${session.uploadId}" title="Discard progress">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    restoreList.appendChild(item);
  });
}

function triggerRestoreFileSelect(session) {
  // Create a temporary file input specifically to prompt file linking
  const tempInput = document.createElement('input');
  tempInput.type = 'file';
  tempInput.multiple = false;
  
  tempInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate if the selected file matches the stored metadata
    if (file.name !== session.name || file.size !== session.size) {
      alert(`Mismatch! The selected file must be exactly "${session.name}" (${formatSize(session.size)}). Selected file was "${file.name}" (${formatSize(file.size)}).`);
      return;
    }

    // Reinstate session into active upload queue
    resumeStoredUpload(session, file);
  });

  tempInput.click();
}

function resumeStoredUpload(session, file) {
  // Check if it's already in the queue
  if (uploadQueue.some(up => up.uploadId === session.uploadId)) {
    showToast('Already in Queue', 'This upload is already active.', 'warning');
    return;
  }

  // Re-build standard queue object
  const totalChunks = session.totalChunks;
  const chunkStatus = Array(totalChunks + 1).fill('idle');
  const chunkUploadedBytes = Array(totalChunks + 1).fill(0);
  const chunkSizes = Array(totalChunks + 1).fill(0);

  // Compute chunk sizes
  for (let i = 1; i <= totalChunks; i++) {
    const start = (i - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    chunkSizes[i] = end - start;
  }

  // Populate already completed parts
  session.parts.forEach(p => {
    chunkStatus[p.partNumber] = 'completed';
    chunkUploadedBytes[p.partNumber] = chunkSizes[p.partNumber];
  });

  const uploadObj = {
    id: session.id,
    file: file,
    name: session.name,
    path: session.path,
    key: session.key,
    size: session.size,
    status: 'paused', // Set to paused initially, let them start it
    uploadId: session.uploadId,
    totalChunks: totalChunks,
    parts: session.parts,
    activeChunkUploads: 0,
    chunkStatus: chunkStatus,
    chunkSizes: chunkSizes,
    chunkUploadedBytes: chunkUploadedBytes,
    chunkRetries: {},
    activeXHRs: {},
    speedHistory: [],
    speed: 0,
    eta: null,
    errorMsg: null
  };

  uploadQueue.push(uploadObj);
  deleteStoredSession(session.uploadId); // Delete from restore list, since it's now active
  
  renderQueue();
  updateGlobalStats();
  
  // Auto-start upload
  resumeUpload(uploadObj.id);
  showToast('Upload Restored', `Resuming "${file.name}" from chunk ${session.parts.length + 1}.`, 'success');
}

// -------------------------------------------------------------
// Queue Management Logic
// -------------------------------------------------------------

function addFilesToQueue(files) {
  let folderPrefix = folderPathInput.value.trim();
  if (folderPrefix && !folderPrefix.endsWith('/')) {
    folderPrefix += '/';
  }
  
  files.forEach(file => {
    const relativePath = file.relativePath || file.name;
    const cleanKey = folderPrefix + relativePath.replace(/\\/g, '/');
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    const fileId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    
    const chunkStatus = Array(totalChunks + 1).fill('idle');
    const chunkUploadedBytes = Array(totalChunks + 1).fill(0);
    const chunkSizes = Array(totalChunks + 1).fill(0);

    for (let i = 1; i <= totalChunks; i++) {
      const start = (i - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      chunkSizes[i] = end - start;
    }

    const uploadObj = {
      id: fileId,
      file: file,
      name: file.name,
      path: relativePath,
      key: cleanKey,
      size: file.size,
      status: 'queued',
      uploadId: null,
      totalChunks: totalChunks,
      parts: [],
      activeChunkUploads: 0,
      chunkStatus: chunkStatus,
      chunkSizes: chunkSizes,
      chunkUploadedBytes: chunkUploadedBytes,
      chunkRetries: {},
      activeXHRs: {},
      speedHistory: [],
      speed: 0,
      eta: null,
      errorMsg: null
    };

    uploadQueue.push(uploadObj);
    showToast('File Queued', `"${file.name}" added to upload queue.`, 'info');
  });

  renderQueue();
  updateGlobalStats();

  // Auto-start first queued item
  startQueueProcessor();
}

function startQueueProcessor() {
  const nextQueued = uploadQueue.find(up => up.status === 'queued');
  if (nextQueued) {
    initiateMultipartUpload(nextQueued);
  }
}

async function initiateMultipartUpload(uploadObj) {
  uploadObj.status = 'uploading';
  updateQueueCardStatus(uploadObj);
  updateGlobalStats();

  try {
    const uploadId = await apiCreateUpload(uploadObj.key, uploadObj.file.type);
    uploadObj.uploadId = uploadId;
    saveSession(uploadObj);
    
    updateQueueCardStatus(uploadObj);
    uploadNextChunks(uploadObj);
  } catch (err) {
    console.error('Failed to create upload session:', err);
    uploadObj.status = 'failed';
    uploadObj.errorMsg = `Initial API error: ${err.message || 'Failed to initialize multipart upload.'}`;
    updateQueueCardStatus(uploadObj);
    updateGlobalStats();
    showToast('Upload Error', `Failed to initialize "${uploadObj.name}" upload.`, 'error');
    
    // Continue with next in queue
    startQueueProcessor();
  }
}

function pauseUpload(id) {
  const up = uploadQueue.find(item => item.id === id);
  if (!up || up.status !== 'uploading') return;

  up.status = 'paused';
  
  // Abort all active chunk HTTP requests immediately to save bandwidth
  Object.keys(up.activeXHRs).forEach(partNum => {
    const xhr = up.activeXHRs[partNum];
    if (xhr) {
      xhr.abort();
    }
  });

  // Re-adjust cancelled chunks to idle or failed depending on retry count
  for (let i = 1; i <= up.totalChunks; i++) {
    if (up.chunkStatus[i] === 'uploading') {
      up.chunkStatus[i] = 'idle';
      up.chunkUploadedBytes[i] = 0;
    }
  }

  up.activeChunkUploads = 0;
  up.activeXHRs = {};
  up.speed = 0;
  up.speedHistory = [];
  
  // Save updated session state to localStorage
  saveSession(up);
  
  updateQueueCardStatus(up);
  updateQueueCardProgress(up);
  updateGlobalStats();
  
  showToast('Upload Paused', `"${up.name}" upload paused.`, 'warning');
}

function resumeUpload(id) {
  const up = uploadQueue.find(item => item.id === id);
  if (!up) return;

  if (up.status === 'paused' || up.status === 'failed') {
    up.status = 'uploading';
    up.errorMsg = null;
    updateQueueCardStatus(up);
    updateGlobalStats();

    if (!up.uploadId) {
      // Re-create multipart if uploadId is lost
      initiateMultipartUpload(up);
    } else {
      uploadNextChunks(up);
    }
    showToast('Upload Resumed', `"${up.name}" upload resumed.`, 'info');
  }
}

async function cancelUpload(id) {
  const up = uploadQueue.find(item => item.id === id);
  if (!up) return;

  if (confirm(`Are you sure you want to cancel upload for "${up.name}"? All progress will be deleted from the cloud.`)) {
    up.status = 'aborting';
    updateQueueCardStatus(up);
    updateGlobalStats();

    // Abort active connections
    Object.keys(up.activeXHRs).forEach(partNum => {
      const xhr = up.activeXHRs[partNum];
      if (xhr) xhr.abort();
    });

    try {
      if (up.uploadId) {
        await apiAbortUpload(up.uploadId, up.key);
        deleteStoredSession(up.uploadId);
      }
    } catch (err) {
      console.warn('Abort API request failed, clearing local state anyway:', err);
    }

    // Remove from queue
    uploadQueue = uploadQueue.filter(item => item.id !== id);
    renderQueue();
    updateGlobalStats();
    showToast('Upload Cancelled', `"${up.name}" was cancelled and aborted.`, 'error');

    // Process next queued items
    startQueueProcessor();
  }
}

// Global Operations
function pauseAllUploads() {
  uploadQueue.forEach(up => {
    if (up.status === 'uploading') {
      pauseUpload(up.id);
    }
  });
}

function resumeAllUploads() {
  uploadQueue.forEach(up => {
    if (up.status === 'paused' || up.status === 'failed' || up.status === 'queued') {
      resumeUpload(up.id);
    }
  });
}

function clearQueueAndAbortAll() {
  const activeCount = uploadQueue.filter(up => up.status === 'uploading' || up.status === 'paused').length;
  if (activeCount === 0) {
    uploadQueue = [];
    renderQueue();
    updateGlobalStats();
    return;
  }

  if (confirm(`Abort and cancel all ${activeCount} active uploads in the queue?`)) {
    uploadQueue.forEach(up => {
      if (up.status === 'uploading' || up.status === 'paused' || up.status === 'failed') {
        Object.keys(up.activeXHRs).forEach(partNum => {
          const xhr = up.activeXHRs[partNum];
          if (xhr) xhr.abort();
        });
        if (up.uploadId) {
          apiAbortUpload(up.uploadId, up.key);
          deleteStoredSession(up.uploadId);
        }
      }
    });

    uploadQueue = [];
    renderQueue();
    updateGlobalStats();
    showToast('Queue Cleared', 'All uploads aborted and queue cleared.', 'error');
  }
}

// -------------------------------------------------------------
// Multipart Upload Scheduling Core
// -------------------------------------------------------------

function uploadNextChunks(uploadObj) {
  if (uploadObj.status !== 'uploading') return;

  // Find all incomplete chunks
  const pendingIndices = [];
  for (let i = 1; i <= uploadObj.totalChunks; i++) {
    if (uploadObj.chunkStatus[i] === 'idle' || uploadObj.chunkStatus[i] === 'failed') {
      // Limit retries
      const retries = uploadObj.chunkRetries[i] || 0;
      if (retries < 3) {
        pendingIndices.push(i);
      }
    }
  }

  // Check if fully finished
  const allCompleted = uploadObj.chunkStatus.slice(1).every(s => s === 'completed');
  if (allCompleted) {
    finalizeUpload(uploadObj);
    return;
  }

  // Check if queue has run out of retries and is stuck
  const activeCount = uploadObj.activeChunkUploads;
  if (pendingIndices.length === 0 && activeCount === 0) {
    uploadObj.status = 'failed';
    uploadObj.errorMsg = 'Upload stuck. Some chunks failed all 3 network retries.';
    updateQueueCardStatus(uploadObj);
    updateGlobalStats();
    showToast('Upload Failed', `"${uploadObj.name}" failed due to persistent network errors.`, 'error');
    
    // Start next file
    startQueueProcessor();
    return;
  }

  // Schedule up to maxConcurrency parallel parts
  while (uploadObj.activeChunkUploads < maxConcurrency && pendingIndices.length > 0) {
    const partNumber = pendingIndices.shift();
    uploadObj.chunkStatus[partNumber] = 'uploading';
    uploadObj.activeChunkUploads++;
    
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, uploadObj.size);
    const chunkBlob = uploadObj.file.slice(start, end);

    executeChunkUploadXHR(uploadObj, partNumber, chunkBlob);
  }
}

function executeChunkUploadXHR(uploadObj, partNumber, chunkBlob) {
  const xhr = new XMLHttpRequest();
  uploadObj.activeXHRs[partNumber] = xhr;

  const formData = new FormData();
  formData.append('uploadId', uploadObj.uploadId);
  formData.append('partNumber', partNumber.toString());
  formData.append('key', uploadObj.key);
  formData.append('chunk', chunkBlob, `part-${partNumber}`);

  xhr.open('POST', `${API_BASE}/upload-part`);

  // Real-time progress tracking
  xhr.upload.addEventListener('progress', (e) => {
    if (uploadObj.status !== 'uploading') return;
    if (e.lengthComputable) {
      uploadObj.chunkUploadedBytes[partNumber] = e.loaded;
      updateQueueCardProgress(uploadObj);
    }
  });

  xhr.onload = () => {
    if (uploadObj.status !== 'uploading') return;

    delete uploadObj.activeXHRs[partNumber];
    uploadObj.activeChunkUploads--;

    if (xhr.status === 200) {
      try {
        const resObj = JSON.parse(xhr.responseText);
        if (resObj.etag) {
          uploadObj.chunkStatus[partNumber] = 'completed';
          uploadObj.chunkUploadedBytes[partNumber] = uploadObj.chunkSizes[partNumber];
          
          // Store etag
          const existingPartIdx = uploadObj.parts.findIndex(p => p.partNumber === partNumber);
          const partData = { partNumber, etag: resObj.etag };
          if (existingPartIdx > -1) {
            uploadObj.parts[existingPartIdx] = partData;
          } else {
            uploadObj.parts.push(partData);
          }
          uploadObj.parts.sort((a, b) => a.partNumber - b.partNumber);

          // Persist progress state
          saveSession(uploadObj);
          
          updateQueueCardProgress(uploadObj);
          uploadNextChunks(uploadObj);
        } else {
          handleChunkFailure(uploadObj, partNumber, new Error('ETag missing in response'));
        }
      } catch (e) {
        handleChunkFailure(uploadObj, partNumber, new Error('Invalid JSON response'));
      }
    } else {
      let errMsg = `Server returned status ${xhr.status}`;
      try {
        const errObj = JSON.parse(xhr.responseText);
        if (errObj.error) errMsg = errObj.error;
      } catch(e) {}
      handleChunkFailure(uploadObj, partNumber, new Error(errMsg));
    }
  };

  xhr.onerror = () => {
    if (uploadObj.status !== 'uploading') return;
    delete uploadObj.activeXHRs[partNumber];
    uploadObj.activeChunkUploads--;
    handleChunkFailure(uploadObj, partNumber, new Error('Network request failed'));
  };

  xhr.send(formData);
}

function handleChunkFailure(uploadObj, partNumber, error) {
  console.warn(`Chunk ${partNumber} failed for "${uploadObj.name}":`, error.message);
  
  const currentRetries = uploadObj.chunkRetries[partNumber] || 0;
  uploadObj.chunkRetries[partNumber] = currentRetries + 1;
  uploadObj.chunkUploadedBytes[partNumber] = 0;

  if (currentRetries + 1 < 5) {
    uploadObj.chunkStatus[partNumber] = 'idle'; // Reset to idle for auto-retry
    showToast('Retrying Chunk', `Part ${partNumber} of "${uploadObj.name}" failed. Retrying... (${currentRetries + 1}/3)`, 'warning');
  } else {
    uploadObj.chunkStatus[partNumber] = 'failed';
  }

  updateQueueCardProgress(uploadObj);
  uploadNextChunks(uploadObj);
}

async function finalizeUpload(uploadObj) {
  uploadObj.status = 'completing';
  updateQueueCardStatus(uploadObj);
  updateGlobalStats();

  try {
    await apiCompleteUpload(uploadObj.uploadId, uploadObj.key, uploadObj.parts);
    
    uploadObj.status = 'completed';
    uploadObj.speed = 0;
    uploadObj.eta = null;
    
    // Remove from localStorage upon success
    deleteStoredSession(uploadObj.uploadId);
    
    updateQueueCardStatus(uploadObj);
    updateQueueCardProgress(uploadObj);
    updateGlobalStats();
    showToast('Upload Finished!', `"${uploadObj.name}" successfully uploaded to R2.`, 'success');
    
    // Move on to next files
    startQueueProcessor();
  } catch (err) {
    console.error('Complete upload API request failed:', err);
    uploadObj.status = 'failed';
    uploadObj.errorMsg = `Completion error: ${err.message || 'Failed to assemble uploaded parts.'}`;
    updateQueueCardStatus(uploadObj);
    updateGlobalStats();
    showToast('Finalization Error', `Failed to finalize "${uploadObj.name}" upload.`, 'error');
    
    // Move on to next files
    startQueueProcessor();
  }
}

// -------------------------------------------------------------
// Cloudflare R2 API Service Calls
// -------------------------------------------------------------

async function apiCreateUpload(filename, mimeType) {
  const response = await fetch(`${API_BASE}/create-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: filename,
      type: mimeType || 'application/octet-stream'
    })
  });

  if (!response.ok) {
    let errMsg = `Create Upload failed: ${response.statusText}`;
    try {
      const err = await response.json();
      if (err.error) errMsg = err.error;
    } catch(e) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (!data.uploadId) {
    throw new Error('API did not return a valid uploadId.');
  }
  return data.uploadId;
}

async function apiCompleteUpload(uploadId, key, parts) {
  const response = await fetch(`${API_BASE}/complete-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, key, parts })
  });

  if (!response.ok) {
    let errMsg = `Complete Upload failed: ${response.statusText}`;
    try {
      const err = await response.json();
      if (err.error) errMsg = err.error;
    } catch(e) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

async function apiAbortUpload(uploadId, key) {
  try {
    const response = await fetch(`${API_BASE}/abort-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, key })
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Abort upload request failed:', err);
    throw err;
  }
}

// -------------------------------------------------------------
// UI Rendering Helpers & DOM Creators
// -------------------------------------------------------------

function renderQueue() {
  queueList.innerHTML = '';
  
  if (uploadQueue.length === 0) {
    queueEmptyState.style.display = 'flex';
    queueCount.textContent = '0';
    queueGlobalActions.style.display = 'none';
    return;
  }

  queueEmptyState.style.display = 'none';
  queueCount.textContent = uploadQueue.length.toString();
  queueGlobalActions.style.display = 'flex';

  uploadQueue.forEach(up => {
    const card = document.createElement('div');
    card.id = `card-${up.id}`;
    card.className = `queue-card ${up.status}`;
    
    // Dynamic media icon selection
    const previewHTML = generateFilePreviewHTML(up);
    const badgeHTML = getStatusBadgeHTML(up.status);
    const pct = getUploadPercentage(up);
    const formattedUploaded = formatSize(getUploadedBytes(up));
    const formattedTotal = formatSize(up.size);
    const speedStr = up.speed > 0 ? formatSpeed(up.speed) : '0.0 MB/s';
    const etaStr = up.status === 'uploading' && up.speed > 0 ? formatTime(up.eta) : '--:--';
    const activeChunkNum = up.status === 'uploading' ? up.parts.length + 1 : up.parts.length;
    const currentChunkStr = `Chunk ${Math.min(activeChunkNum, up.totalChunks)} / ${up.totalChunks}`;

    card.innerHTML = `
      <div class="queue-card-main">
        <div class="file-preview" id="preview-box-${up.id}">
          ${previewHTML}
        </div>
        <div class="file-details">
          <div class="file-name" title="${up.name}">${up.name}</div>
          <div class="file-path" title="${up.key}">
            <i class="fa-solid fa-folder"></i> ${up.key}
          </div>
          <div class="file-meta">
            <div class="file-meta-item">
              <i class="fa-solid fa-hard-drive"></i> <span>${formattedUploaded} / ${formattedTotal}</span>
            </div>
            <div class="file-meta-item">
              <i class="fa-solid fa-layer-group"></i> <span id="chunk-info-${up.id}">${currentChunkStr}</span>
            </div>
            <div class="file-meta-item status-badge-wrapper" id="badge-container-${up.id}">
              ${badgeHTML}
            </div>
          </div>
        </div>
        <div class="file-actions" id="actions-container-${up.id}">
          ${getActionButtonsHTML(up)}
        </div>
      </div>
      <div class="queue-card-progress">
        <div class="progress-bar-container">
          <div class="progress-bar-fill" id="progress-bar-${up.id}" style="width: ${pct}%"></div>
        </div>
        <div class="progress-info">
          <span class="progress-speed" id="speed-${up.id}">${speedStr}</span>
          <span class="progress-eta" id="eta-${up.id}">Remaining: ${etaStr}</span>
          <span class="progress-pct" id="pct-${up.id}">${pct}%</span>
        </div>
      </div>
      <div class="card-error-msg" id="error-${up.id}" style="display: ${up.errorMsg ? 'flex' : 'none'}">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>${up.errorMsg || ''}</span>
      </div>
    `;

    queueList.appendChild(card);

    // Async load live previews for media files
    triggerMediaPreviewLoad(up);
  });
}

function updateQueueCardStatus(up) {
  const card = document.getElementById(`card-${up.id}`);
  if (!card) return;

  // Update classes
  card.className = `queue-card ${up.status}`;

  // Update Status Badge
  const badgeContainer = document.getElementById(`badge-container-${up.id}`);
  if (badgeContainer) {
    badgeContainer.innerHTML = getStatusBadgeHTML(up.status);
  }

  // Update action buttons
  const actionsContainer = document.getElementById(`actions-container-${up.id}`);
  if (actionsContainer) {
    actionsContainer.innerHTML = getActionButtonsHTML(up);
  }

  // Update Error Msg
  const errorContainer = document.getElementById(`error-${up.id}`);
  if (errorContainer) {
    if (up.errorMsg) {
      errorContainer.querySelector('span').textContent = up.errorMsg;
      errorContainer.style.display = 'flex';
    } else {
      errorContainer.style.display = 'none';
    }
  }

  // Update details
  updateQueueCardProgress(up);
}

function updateQueueCardProgress(up) {
  const card = document.getElementById(`card-${up.id}`);
  if (!card) return;

  const pct = getUploadPercentage(up);
  const progressBar = document.getElementById(`progress-bar-${up.id}`);
  if (progressBar) progressBar.style.width = `${pct}%`;

  const pctText = document.getElementById(`pct-${up.id}`);
  if (pctText) pctText.textContent = `${pct}%`;

  const sizeText = card.querySelector('.file-meta-item span');
  if (sizeText) {
    sizeText.textContent = `${formatSize(getUploadedBytes(up))} / ${formatSize(up.size)}`;
  }

  const chunkText = document.getElementById(`chunk-info-${up.id}`);
  if (chunkText) {
    const activeChunkNum = up.status === 'uploading' ? up.parts.length + 1 : up.parts.length;
    chunkText.textContent = `Chunk ${Math.min(activeChunkNum, up.totalChunks)} / ${up.totalChunks}`;
  }

  const speedText = document.getElementById(`speed-${up.id}`);
  if (speedText) {
    speedText.textContent = up.speed > 0 ? formatSpeed(up.speed) : '0.0 MB/s';
  }

  const etaText = document.getElementById(`eta-${up.id}`);
  if (etaText) {
    if (up.status === 'uploading' && up.speed > 0) {
      etaText.textContent = `Remaining: ${formatTime(up.eta)}`;
    } else if (up.status === 'completed') {
      etaText.textContent = 'Completed';
    } else if (up.status === 'paused') {
      etaText.textContent = 'Paused';
    } else {
      etaText.textContent = 'Remaining: --:--';
    }
  }
}

// HTML Generative Methods
function generateFilePreviewHTML(up) {
  const extension = up.name.split('.').pop().toLowerCase();
  
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    return `<i class="fa-solid fa-image" style="color: #6366f1;"></i>`;
  } else if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(extension)) {
    return `<i class="fa-solid fa-video" style="color: #06b6d4;"></i>`;
  } else if (extension === 'pdf') {
    return `<i class="fa-solid fa-file-pdf" style="color: #f43f5e;"></i>`;
  } else {
    return `<i class="fa-solid fa-file" style="color: #9ca3af;"></i>`;
  }
}

function triggerMediaPreviewLoad(up) {
  if (!up.file) return; // session restore placeholder
  const extension = up.name.split('.').pop().toLowerCase();
  const previewBox = document.getElementById(`preview-box-${up.id}`);
  if (!previewBox) return;

  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewBox.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    // Only read small files or small slice for fast rendering
    if (up.file.size < 15 * 1024 * 1024) {
      reader.readAsDataURL(up.file);
    } else {
      reader.readAsDataURL(up.file.slice(0, 1024 * 1024)); // preview of first 1MB
    }
  } else if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(extension)) {
    // We can create an object URL for video elements
    try {
      const url = URL.createObjectURL(up.file);
      previewBox.innerHTML = `
        <video src="${url}" muted autoplay loop playsinline controls="false" style="pointer-events: none;"></video>
        <i class="fa-solid fa-play" style="position: absolute; color: white; font-size: 0.8rem; text-shadow: 0 0 5px black;"></i>
      `;
    } catch(e) {
      console.warn('Could not load video preview URL', e);
    }
  }
}

function getStatusBadgeHTML(status) {
  switch (status) {
    case 'queued':
      return `<span class="badge badge-queued"><i class="fa-solid fa-clock"></i> Queued</span>`;
    case 'uploading':
      return `<span class="badge badge-uploading"><i class="fa-solid fa-spinner animate-spin-custom"></i> Uploading</span>`;
    case 'paused':
      return `<span class="badge badge-paused"><i class="fa-solid fa-circle-pause"></i> Paused</span>`;
    case 'completing':
      return `<span class="badge badge-uploading"><i class="fa-solid fa-spinner animate-spin-custom"></i> Assembling...</span>`;
    case 'completed':
      return `<span class="badge badge-completed"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
    case 'failed':
      return `<span class="badge badge-failed"><i class="fa-solid fa-circle-xmark"></i> Failed</span>`;
    case 'aborting':
      return `<span class="badge badge-aborting"><i class="fa-solid fa-circle-notch animate-spin-custom"></i> Aborting</span>`;
    default:
      return '';
  }
}

function getActionButtonsHTML(up) {
  if (up.status === 'uploading') {
    return `
      <button class="btn btn-secondary btn-icon btn-pause" title="Pause Upload">
        <i class="fa-solid fa-pause"></i>
      </button>
      <button class="btn btn-icon btn-icon-danger btn-cancel" title="Cancel & Delete">
        <i class="fa-solid fa-ban"></i>
      </button>
    `;
  } else if (up.status === 'paused' || up.status === 'failed') {
    return `
      <button class="btn btn-secondary btn-icon btn-resume" title="Resume Upload">
        <i class="fa-solid fa-play"></i>
      </button>
      <button class="btn btn-icon btn-icon-danger btn-cancel" title="Cancel & Delete">
        <i class="fa-solid fa-ban"></i>
      </button>
    `;
  } else if (up.status === 'queued') {
    return `
      <button class="btn btn-icon btn-icon-danger btn-cancel" title="Remove from Queue">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `;
  }
  return '';
}

// -------------------------------------------------------------
// Speed, Progress, Stats Math & Computations
// -------------------------------------------------------------

function getUploadedBytes(up) {
  return up.chunkUploadedBytes.reduce((acc, bytes) => acc + bytes, 0);
}

function getUploadPercentage(up) {
  if (up.status === 'completed') return 100;
  if (up.size === 0) return 0;
  return Math.round((getUploadedBytes(up) / up.size) * 100);
}

function updateGlobalStats() {
  const activeUploads = uploadQueue.filter(up => up.status === 'uploading' || up.status === 'completing');
  const allCompleted = uploadQueue.length > 0 && uploadQueue.every(up => up.status === 'completed');

  // 1. Status Text & Icons
  if (activeUploads.length > 0) {
    globalStatusText.textContent = `Uploading (${activeUploads.length})`;
    statUploadIcon.className = 'fa-solid fa-spinner animate-spin-custom';
    statUploadIcon.style.color = 'var(--info-color)';
  } else if (allCompleted) {
    globalStatusText.textContent = 'All Completed';
    statUploadIcon.className = 'fa-solid fa-circle-check';
    statUploadIcon.style.color = 'var(--success-color)';
  } else {
    globalStatusText.textContent = 'Idle';
    statUploadIcon.className = 'fa-solid fa-cloud-arrow-up';
    statUploadIcon.style.color = 'var(--accent-color)';
  }

  // 2. Global Speed Summary
  const aggregateSpeed = uploadQueue.reduce((acc, up) => acc + (up.speed || 0), 0);
  globalSpeedText.textContent = aggregateSpeed > 0 ? formatSpeed(aggregateSpeed) : '0.0 MB/s';

  // 3. Global ETA Summary
  let totalRemainingBytes = 0;
  uploadQueue.forEach(up => {
    if (up.status === 'uploading' || up.status === 'queued' || up.status === 'paused') {
      totalRemainingBytes += (up.size - getUploadedBytes(up));
    }
  });

  if (aggregateSpeed > 0 && totalRemainingBytes > 0) {
    const globalEta = totalRemainingBytes / aggregateSpeed;
    globalEtaText.textContent = formatTime(globalEta);
  } else {
    globalEtaText.textContent = '--:--';
  }

  // 4. Global progress bar
  let totalBytes = 0;
  let totalUploaded = 0;
  
  uploadQueue.forEach(up => {
    totalBytes += up.size;
    totalUploaded += getUploadedBytes(up);
  });

  const globalPct = totalBytes > 0 ? Math.round((totalUploaded / totalBytes) * 100) : 0;
  globalProgressText.textContent = `${globalPct}%`;
}

function startGlobalStatsCalculator() {
  if (globalSpeedInterval) clearInterval(globalSpeedInterval);

  globalSpeedInterval = setInterval(() => {
    const now = Date.now();
    
    uploadQueue.forEach(up => {
      if (up.status !== 'uploading') {
        up.speed = 0;
        up.speedHistory = [];
        return;
      }

      const uploaded = getUploadedBytes(up);
      up.speedHistory.push({ time: now, bytes: uploaded });

      // Prune history older than 5 seconds
      up.speedHistory = up.speedHistory.filter(h => now - h.time <= 5000);

      if (up.speedHistory.length >= 2) {
        const first = up.speedHistory[0];
        const last = up.speedHistory[up.speedHistory.length - 1];
        const dt = (last.time - first.time) / 1000; // time delta in sec
        const db = last.bytes - first.bytes; // bytes uploaded delta

        if (dt > 0 && db >= 0) {
          up.speed = db / dt; // bytes per second
          // Calculate ETA
          const remainingBytes = up.size - uploaded;
          up.eta = up.speed > 0 ? (remainingBytes / up.speed) : null;
        }
      } else {
        up.speed = 0;
        up.eta = null;
      }
      
      // Update UI cards with speed and ETA values
      updateQueueCardProgress(up);
    });

    updateGlobalStats();
  }, 1000);
}

// -------------------------------------------------------------
// Toast Alerts Controller
// -------------------------------------------------------------

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  if (type === 'error') iconClass = 'fa-exclamation-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';

  toast.innerHTML = `
    <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Close event listener
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto remove after 4.5s
  setTimeout(() => {
    removeToast(toast);
  }, 4500);
}

function removeToast(toast) {
  if (toast.classList.contains('removing')) return;
  toast.classList.add('removing');
  toast.addEventListener('animationend', () => {
    toast.remove();
  });
}

// -------------------------------------------------------------
// Format Formatting Utilities
// -------------------------------------------------------------

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec) {
  const mb = bytesPerSec / (1024 * 1024);
  if (mb < 0.1) {
    const kb = bytesPerSec / 1024;
    return kb.toFixed(1) + ' KB/s';
  }
  return mb.toFixed(1) + ' MB/s';
}

function formatTime(seconds) {
  if (seconds === null || isNaN(seconds) || seconds === Infinity) return '--:--';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}
