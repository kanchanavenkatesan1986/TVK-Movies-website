/**
 * Movies list view and CRUD operation logic.
 */

import { getMovies, addMovie, updateMovie, deleteMovie } from './api.js';
import { openAddModal, openEditModal, closeModal } from './modal.js';
import { showToast, getPosterPlaceholder, formatDate } from './utils.js';

// State variables
let movies = [];          // Current movies list in memory for the active Type/Year
let filteredMovies = [];  // Filtered movies based on search and status
let currentPage = 1;
const itemsPerPage = 8;  // Display 8 rows per page for good visual balance

// Filter and UI State
let selectedType = 'tamil';
let selectedYear = '2026';
let selectedStatus = 'all';
let searchQuery = '';
let movieToDeleteId = null;

// DOM Elements
let tableBody = null;
let filterTypeEl = null;
let filterYearEl = null;
let filterStatusEl = null;
let searchInputEl = null;
let navSearchInputEl = null;
let paginationContainer = null;
let addBtnEl = null;
let deleteModalEl = null;
let deleteConfirmBtnEl = null;
let deleteCancelBtnEl = null;

/**
 * Initialize movies page DOM elements and event listeners.
 */
export function initMovies() {
  tableBody = document.getElementById('movies-table-body');
  filterTypeEl = document.getElementById('filter-type');
  filterYearEl = document.getElementById('filter-year');
  filterStatusEl = document.getElementById('filter-status');
  searchInputEl = document.getElementById('search-title');
  navSearchInputEl = document.getElementById('nav-search');
  paginationContainer = document.getElementById('pagination-container');
  addBtnEl = document.getElementById('add-movie-btn');
  
  // Delete modal elements
  deleteModalEl = document.getElementById('delete-confirm-modal');
  deleteConfirmBtnEl = document.getElementById('confirm-delete-btn');
  deleteCancelBtnEl = document.getElementById('cancel-delete-btn');

  if (!tableBody || !filterTypeEl || !filterYearEl) {
    console.error('Movies table DOM elements missing.');
    return;
  }

  // Dropdown filter changes
  filterTypeEl.addEventListener('change', (e) => {
    selectedType = e.target.value;
    currentPage = 1;
    loadAndRenderMovies();
  });

  filterYearEl.addEventListener('change', (e) => {
    selectedYear = e.target.value;
    currentPage = 1;
    loadAndRenderMovies();
  });

  filterStatusEl.addEventListener('change', (e) => {
    selectedStatus = e.target.value;
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Local Search Input filter
  searchInputEl.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    // Sync with navbar search input if it exists
    if (navSearchInputEl) navSearchInputEl.value = e.target.value;
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Navbar Search Input filter (syncs back to search input)
  if (navSearchInputEl) {
    navSearchInputEl.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      searchInputEl.value = e.target.value;
      currentPage = 1;
      applyFiltersAndRender();
    });
  }

  // Add Movie Button
  addBtnEl.addEventListener('click', () => {
    openAddModal(movies);
  });

  // Delete modal actions
  if (deleteConfirmBtnEl && deleteCancelBtnEl && deleteModalEl) {
    deleteConfirmBtnEl.addEventListener('click', executeDelete);
    deleteCancelBtnEl.addEventListener('click', closeDeleteModal);
    
    // Close on overlay click
    deleteModalEl.addEventListener('click', (e) => {
      if (e.target === deleteModalEl) closeDeleteModal();
    });
  }
}

/**
 * Load movies from API/Cache, apply local filters, and render the table.
 */
export async function loadAndRenderMovies() {
  showLoader();
  try {
    movies = await getMovies(selectedType, selectedYear);
    applyFiltersAndRender();
  } catch (error) {
    console.error('Error loading movies:', error);
    showToast('Failed to load movies data.', 'error');
    movies = [];
    applyFiltersAndRender();
  }
}

/**
 * Filters movies list in memory by Search and Status, then triggers pagination and render.
 */
function applyFiltersAndRender() {
  filteredMovies = movies.filter(movie => {
    // Search only by title
    const matchesSearch = movie.title.toLowerCase().includes(searchQuery);
    
    // Filter by status (All, Active, Coming Soon)
    const matchesStatus = selectedStatus === 'all' || 
                          movie.status.toLowerCase() === selectedStatus.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  renderTable();
  renderPagination();
}

/**
 * Render movie rows in table.
 */
function renderTable() {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (filteredMovies.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="no-data-cell">
          <div class="no-data-msg">
            <span class="no-data-icon">🎬</span>
            <p>No movies found matching the filters.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Paginate list
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredMovies.slice(startIndex, startIndex + itemsPerPage);

  paginatedItems.forEach(movie => {
    const tr = document.createElement('tr');
    
    // UI Status Rules:
    // If status == "Coming Soon", apply reduced row opacity and a grayscale/dim poster style.
    const isComingSoon = movie.status.toLowerCase() === 'coming soon';
    if (isComingSoon) {
      tr.className = 'movie-row-coming-soon';
    } else {
      tr.className = 'movie-row-active';
    }

    const movieType = (movie.type || selectedType || "").toLowerCase();
    const movieYear = movie.year || selectedYear || "";
    const posterUrl = movie.image && !movie.image.startsWith('http') ? `../src/images/${movieType}/${movieYear}/${movie.image}` : getPosterPlaceholder(movie.image);
    const statusClass = isComingSoon ? 'status-badge-soon' : 'status-badge-active';
    
    // Format created date
    const formattedCreatedDate = movie.created_at ? formatDate(movie.created_at) : '-';

    tr.innerHTML = `
      <td class="col-poster">
        <img class="table-poster ${isComingSoon ? 'grayscale' : ''}" src="${posterUrl}" alt="${movie.title}" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop'" />
      </td>
      <td class="col-title highlight-title">${movie.title}</td>
      <td class="col-release">${movie.release || '-'}</td>
      <td class="col-lang">${movie.language || '-'}</td>
      <td class="col-year">${movie.year}</td>
      <td class="col-duration">${movie.duration || '-'}</td>
      <td class="col-status">
        <span class="status-badge ${statusClass}">${movie.status}</span>
      </td>
      <td class="col-created">${formattedCreatedDate}</td>
      <td class="col-actions">
        <div class="action-buttons-wrapper">
          <button class="action-btn view-btn" data-id="${movie.id}" title="View Movie Details">👁️</button>
          <button class="action-btn edit-btn" data-id="${movie.id}" title="Edit Movie">✏️</button>
          <button class="action-btn delete-btn" data-id="${movie.id}" title="Delete Movie">🗑️</button>
        </div>
      </td>
    `;

    // Bind view/edit/delete clicks to specific rows
    tr.querySelector('.view-btn').addEventListener('click', () => {
      openViewModal(movie);
    });

    tr.querySelector('.edit-btn').addEventListener('click', () => {
      openEditModal(movie, movies);
    });

    tr.querySelector('.delete-btn').addEventListener('click', () => {
      openDeleteConfirmation(movie.id);
    });

    tableBody.appendChild(tr);
  });
}

/**
 * Render pagination controls.
 */
function renderPagination() {
  if (!paginationContainer) return;
  paginationContainer.innerHTML = '';

  const totalPages = Math.ceil(filteredMovies.length / itemsPerPage);
  if (totalPages <= 1) return; // Hide pagination if only 1 page

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = `pag-btn ${currentPage === 1 ? 'disabled' : ''}`;
  prevBtn.textContent = '◀';
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
      renderPagination();
    }
  });
  paginationContainer.appendChild(prevBtn);

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `pag-btn page-num ${currentPage === i ? 'active' : ''}`;
    pageBtn.textContent = i;
    pageBtn.addEventListener('click', () => {
      currentPage = i;
      renderTable();
      renderPagination();
    });
    paginationContainer.appendChild(pageBtn);
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = `pag-btn ${currentPage === totalPages ? 'disabled' : ''}`;
  nextBtn.textContent = '▶';
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
      renderPagination();
    }
  });
  paginationContainer.appendChild(nextBtn);
}

/**
 * Handle save/edit callback from the Modal.
 * Sends a real POST (add) or PUT (edit) to the Cloudflare API,
 * then refreshes the table from the server.
 * @param {Object} movieData - The movie data fields matching JSON exactly.
 * @param {boolean} isEdit - True if editing, false if creating.
 */
export async function handleSaveMovie(movieData, isEdit) {
  // Disable save button to prevent double-submit
  const saveBtn = document.querySelector('#movie-form .save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    if (isEdit) {
      await updateMovie(selectedType, selectedYear, movieData.id, movieData);
      showToast('Movie updated successfully!', 'success');
    } else {
      await addMovie(selectedType, selectedYear, movieData);
      showToast('Movie added successfully!', 'success');
    }

    // Close modal and reload fresh data from API
    closeModal();
    await loadAndRenderMovies();

  } catch (error) {
    console.error('Save failed:', error);
    showToast(`Save failed: ${error.message}`, 'error', 5000);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  }
}

/**
 * Open confirmation modal before deleting.
 * @param {string} id - The movie ID.
 */
function openDeleteConfirmation(id) {
  movieToDeleteId = id;
  if (deleteModalEl) {
    deleteModalEl.classList.add('active');
  }
}

/**
 * Close confirmation modal.
 */
function closeDeleteModal() {
  movieToDeleteId = null;
  if (deleteModalEl) {
    deleteModalEl.classList.remove('active');
  }
}

/**
 * Execute delete operation — calls Cloudflare API DELETE then refreshes table.
 */
async function executeDelete() {
  if (!movieToDeleteId) return;

  const confirmBtn = deleteConfirmBtnEl;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';
  }

  try {
    await deleteMovie(selectedType, selectedYear, movieToDeleteId);
    showToast('Movie deleted successfully!', 'success');
    closeDeleteModal();
    await loadAndRenderMovies();
  } catch (error) {
    console.error('Delete failed:', error);
    showToast(`Delete failed: ${error.message}`, 'error', 5000);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Delete';
    }
  }
}

/**
 * Open the view-only movie details popup modal.
 * @param {Object} movie - Movie data object.
 */
function openViewModal(movie) {
  const viewModal = document.getElementById('view-movie-modal');
  if (!viewModal) return;

  // Helper: render a video quality check button
  function videoCheckBtn(label, url) {
    if (!url || url.trim() === '') {
      return `<span class="video-check-btn video-check-missing" title="No link available">${label} — Not Available</span>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener" class="video-check-btn video-check-available" title="Open ${label} link">${label} ✅ Check</a>`;
  }

  const isComingSoon = movie.status && movie.status.toLowerCase() === 'coming soon';
  const statusClass = isComingSoon ? 'status-badge-soon' : 'status-badge-active';
  const movieType = (movie.type || selectedType || "").toLowerCase();
  const movieYear = movie.year || selectedYear || "";
  const posterUrl = movie.image && !movie.image.startsWith('http') ? `../src/images/${movieType}/${movieYear}/${movie.image}` : getPosterPlaceholder(movie.image);

  // Populate all detail fields
  viewModal.querySelector('#view-poster').src = posterUrl;
  viewModal.querySelector('#view-poster').onerror = function() {
    this.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop';
  };
  viewModal.querySelector('#view-title').textContent = movie.title || '-';
  viewModal.querySelector('#view-status').textContent = movie.status || '-';
  viewModal.querySelector('#view-status').className = `status-badge ${statusClass}`;
  viewModal.querySelector('#view-id').textContent = movie.id || '-';
  viewModal.querySelector('#view-type').textContent = (movie.type || '-').toUpperCase();
  viewModal.querySelector('#view-year').textContent = movie.year || '-';
  viewModal.querySelector('#view-release').textContent = movie.release || '-';
  viewModal.querySelector('#view-language').textContent = movie.language || '-';
  viewModal.querySelector('#view-duration').textContent = movie.duration || '-';
  viewModal.querySelector('#view-category').textContent = movie.category || '-';
  viewModal.querySelector('#view-director').textContent = movie.director || '-';
  viewModal.querySelector('#view-starring').textContent = movie.starring || '-';
  viewModal.querySelector('#view-story').textContent = movie.story || 'No story description available.';
  viewModal.querySelector('#view-created').textContent = movie.created_at ? formatDate(movie.created_at) : '-';

  // Render video quality buttons
  const videoLinksContainer = viewModal.querySelector('#view-video-links');
  if (videoLinksContainer) {
    videoLinksContainer.innerHTML = `
      ${videoCheckBtn('360p', movie.p360)}
      ${videoCheckBtn('720p', movie.p720)}
      ${videoCheckBtn('1080p', movie.p1080)}
    `;
  }

  viewModal.classList.add('active');
}

/**
 * Show animated loading spinner in table body.
 */
function showLoader() {
  if (!tableBody) return;
  tableBody.innerHTML = `
    <tr>
      <td colspan="9" class="loader-cell">
        <div class="loader-wrapper">
          <div class="spinner"></div>
          <p>Fetching movies from database...</p>
        </div>
      </td>
    </tr>
  `;
}
