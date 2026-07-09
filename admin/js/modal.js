/**
 * Modal management for Add and Edit Movie forms.
 */

import { showToast, isIdUnique, formatDate } from './utils.js';

let isEditMode = false;
let originalMovieId = null; // Used to bypass uniqueness check for editing the same movie
let currentList = [];
let onSave = null;

// DOM elements
let modalElement = null;
let formElement = null;
let imageInputElement = null;
let imagePreviewElement = null;
let modalTitleElement = null;

/**
 * Initialize modal DOM events.
 * @param {Function} onSaveCallback - Function to call when a valid movie is saved.
 */
export function initModal(onSaveCallback) {
  modalElement = document.getElementById('movie-modal');
  formElement = document.getElementById('movie-form');
  imageInputElement = document.getElementById('movie-image');
  imagePreviewElement = document.getElementById('modal-image-preview');
  modalTitleElement = document.getElementById('modal-title');
  onSave = onSaveCallback;

  if (!modalElement || !formElement) {
    console.error('Modal DOM elements not found.');
    return;
  }

  // Cancel button click
  const cancelBtn = modalElement.querySelector('.cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  // Close header button (x)
  const closeHeaderBtn = modalElement.querySelector('.modal-close-btn');
  if (closeHeaderBtn) {
    closeHeaderBtn.addEventListener('click', closeModal);
  }

  // Close on outside click
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) {
      closeModal();
    }
  });

  // Image input change - Live Poster Preview
  if (imageInputElement) {
    imageInputElement.addEventListener('input', updatePosterPreview);
    imageInputElement.addEventListener('change', updatePosterPreview);
  }

  // Also listen to type/year changes to update preview path dynamically
  const typeSelect = document.getElementById('movie-type');
  const yearSelect = document.getElementById('movie-year');
  if (typeSelect) {
    typeSelect.addEventListener('change', updatePosterPreview);
  }
  if (yearSelect) {
    yearSelect.addEventListener('change', updatePosterPreview);
  }

  // Form submit handler
  formElement.addEventListener('submit', handleFormSubmit);
}

/**
 * Update the poster preview element based on current input value.
 */
function updatePosterPreview() {
  if (!imageInputElement || !imagePreviewElement) return;
  var url = imageInputElement.value.trim();
  if (url) {
    // If it's a relative filename, construct the dynamic preview path
    if (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('.')) {
      const typeSelect = document.getElementById('movie-type');
      const yearSelect = document.getElementById('movie-year');
      const typeVal = (typeSelect ? typeSelect.value : 'tamil').toLowerCase();
      const yearVal = yearSelect ? yearSelect.value : '2026';
      url = '../src/images/' + typeVal + '/' + yearVal + '/' + url;
    }
    imagePreviewElement.src = url;
    imagePreviewElement.style.display = 'block';
  } else {
    // Show fallback text or image
    imagePreviewElement.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop';
  }
}

/**
 * Open modal in ADD mode.
 * @param {Array} moviesList - Current list of movies to check unique IDs.
 */
export function openAddModal(moviesList) {
  if (!modalElement || !formElement) return;
  isEditMode = false;
  originalMovieId = null;
  currentList = moviesList;

  formElement.reset();
  modalTitleElement.textContent = 'Add New Movie';
  
  // Make ID input writable
  const idInput = document.getElementById('movie-id');
  if (idInput) idInput.removeAttribute('readonly');

  // Autofill current date/time in ISO format for created_at
  const createdAtInput = document.getElementById('movie-created-at');
  if (createdAtInput) {
    createdAtInput.value = new Date().toISOString();
  }

  // Reset poster preview
  updatePosterPreview();

  // Show Modal
  modalElement.classList.add('active');
}

/**
 * Open modal in EDIT mode.
 * @param {Object} movieData - The movie details to populate.
 * @param {Array} moviesList - Current list of movies to check unique IDs.
 */
export function openEditModal(movieData, moviesList) {
  if (!modalElement || !formElement) return;
  isEditMode = true;
  originalMovieId = movieData.id;
  currentList = moviesList;

  modalTitleElement.textContent = 'Edit Movie Details';

  // Fill form inputs mapping to the JSON fields exactly
  const fields = [
    'id', 'title', 'image', 'release', 'language', 'year', 
    'category', 'duration', 'director', 'starring', 'story', 
    'p360', 'p720', 'p1080', 'created_at', 'type', 'status'
  ];

  fields.forEach(field => {
    const input = document.getElementById(`movie-${field.replace('_', '-')}`);
    if (input) {
      input.value = movieData[field] !== undefined ? movieData[field] : '';
    }
  });

  // ID is read-only in Edit mode
  const idInput = document.getElementById('movie-id');
  if (idInput) idInput.setAttribute('readonly', 'true');

  // Update poster preview
  updatePosterPreview();

  // Show Modal
  modalElement.classList.add('active');
}

/**
 * Close modal and reset fields.
 */
export function closeModal() {
  if (!modalElement) return;
  modalElement.classList.remove('active');
}

/**
 * Handles movie form submission, runs validations, and passes data to callback.
 * @param {Event} e
 */
function handleFormSubmit(e) {
  e.preventDefault();

  // Get input values mapping exactly to JSON fields
  const movieData = {
    id: document.getElementById('movie-id').value.trim(),
    title: document.getElementById('movie-title').value.trim(),
    image: document.getElementById('movie-image').value.trim(),
    release: document.getElementById('movie-release').value,
    language: document.getElementById('movie-language').value.trim(),
    year: document.getElementById('movie-year').value.trim(),
    category: document.getElementById('movie-category').value.trim(),
    duration: document.getElementById('movie-duration').value.trim(),
    director: document.getElementById('movie-director').value.trim(),
    starring: document.getElementById('movie-starring').value.trim(),
    story: document.getElementById('movie-story').value.trim(),
    p360: document.getElementById('movie-p360').value.trim(),
    p720: document.getElementById('movie-p720').value.trim(),
    p1080: document.getElementById('movie-p1080').value.trim(),
    created_at: document.getElementById('movie-created-at').value.trim(),
    type: document.getElementById('movie-type').value,
    status: document.getElementById('movie-status').value
  };

  // Validations: Required fields: id, title, year, type, status
  const errors = [];
  if (!movieData.id) errors.push('ID is required.');
  if (!movieData.title) errors.push('Title is required.');
  if (!movieData.year) errors.push('Year is required.');
  if (!movieData.type) errors.push('Type (Genre) is required.');
  if (!movieData.status) errors.push('Status is required.');

  // Validate duplicate ID (only for creation, or if changed)
  if (movieData.id && !isIdUnique(movieData.id, currentList, originalMovieId)) {
    errors.push(`Duplicate ID: Movie with ID "${movieData.id}" already exists.`);
  }

  if (errors.length > 0) {
    showToast(errors.join(' '), 'error', 4500);
    return;
  }

  // Call save callback
  if (onSave) {
    onSave(movieData, isEditMode);
  }
}
