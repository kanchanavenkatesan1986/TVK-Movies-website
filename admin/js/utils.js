/**
 * Utility functions for the Movie Admin Panel.
 */

/**
 * Show a toast notification with styling based on type.
 * @param {string} message - The message to show.
 * @param {'success'|'error'|'warning'|'info'} type - The type of toast.
 * @param {number} duration - Time in milliseconds before toast disappears.
 */
export function showToast(message, type = 'success', duration = 3000) {
  let container = document.getElementById('toast-container');
  
  // Create container if it doesn't exist
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Custom icons based on toast type
  let icon = '🔔';
  if (type === 'success') icon = '✅';
  else if (type === 'error') icon = '❌';
  else if (type === 'warning') icon = '⚠️';
  else if (type === 'info') icon = 'ℹ️';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close-btn">&times;</button>
  `;

  // Append toast
  container.appendChild(toast);

  // Close on click of the close button
  const closeBtn = toast.querySelector('.toast-close-btn');
  closeBtn.addEventListener('click', () => {
    dismissToast(toast);
  });

  // Auto-dismiss after duration
  const timeoutId = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  // Store timeout on elements in case of manual clear
  toast.dataset.timeoutId = timeoutId;
}

/**
 * Dismisses a toast with a smooth slide-out animation.
 * @param {HTMLElement} toast - The toast element to dismiss.
 */
function dismissToast(toast) {
  if (toast.classList.contains('dismissing')) return;
  toast.classList.add('dismissing');
  
  if (toast.dataset.timeoutId) {
    clearTimeout(parseInt(toast.dataset.timeoutId, 10));
  }

  // Wait for animation to finish then remove
  toast.addEventListener('animationend', () => {
    toast.remove();
    // Remove container if it has no children left
    const container = document.getElementById('toast-container');
    if (container && container.childElementCount === 0) {
      container.remove();
    }
  });
}

/**
 * Generate a standard readable date string (YYYY-MM-DD) from current time or an ISO string.
 * @param {string|Date} dateVal - Optional date string or Date object.
 * @returns {string} - Date formatted as YYYY-MM-DD.
 */
export function formatDate(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Verify if a movie ID is unique.
 * @param {string} id - The ID to verify.
 * @param {Array} moviesList - The current list of movies.
 * @param {string|null} currentEditingId - The ID of the movie being edited (if editing).
 * @returns {boolean} - True if ID is unique/valid, false if duplicate.
 */
export function isIdUnique(id, moviesList, currentEditingId = null) {
  if (!id) return false;
  
  // If we are editing a movie and the ID remains unchanged, it is valid.
  if (currentEditingId && id === currentEditingId) {
    return true;
  }
  
  return !moviesList.some(movie => movie.id === id);
}

/**
 * Get placeholder image if URL is missing or broken.
 * @param {string} url - Poster image URL.
 * @returns {string} - Poster image URL or fallback.
 */
export function getPosterPlaceholder(url) {
  if (!url || url.trim() === '') {
    return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop';
  }
  return url;
}
