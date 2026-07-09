/**
 * API layer for the Movie Admin Panel.
 *
 * ALL reads and writes go directly to the Cloudflare Worker API.
 * No localStorage is used for data storage.
 *
 * ─── ADDING A NEW TABLE ────────────────────────────────────────────────────
 * To add a new language/type (e.g. telugu_2026), simply add to TABLE_CONFIG:
 *   types: ['tamil', 'hollywood', 'telugu', 'kannada']
 * The UI dropdowns are built dynamically from this config — nothing else changes.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { showToast } from './utils.js';

const API_BASE_URL = 'https://api-database.akatsuki-pvt-ltd.workers.dev/api';

/**
 * TABLE_CONFIG — The single source of truth for all table types and years.
 * Add a new type or year here and every dropdown updates automatically.
 */
export const TABLE_CONFIG = {
  types: ['tamil', 'hollywood'],
  years: ['2026', '2025', '2024', '2023', '2022']
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Build the endpoint URL for a type + year combination.
 * @param {string} type - e.g. 'tamil'
 * @param {string|number} year - e.g. '2026'
 * @param {string} [id] - Optional movie ID for PUT/DELETE
 * @returns {string}
 */
function buildUrl(type, year, id) {
  const base = `${API_BASE_URL}/${type.toLowerCase()}_${year}`;
  return id ? `${base}/${id}` : base;
}

/**
 * Internal fetch wrapper with timeout and error handling.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<any>} - Parsed JSON response
 */
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    clearTimeout(timeoutId);

    // Parse JSON regardless of status (error bodies often contain useful messages)
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const msg = (data && data.message) ? data.message : `Server error ${response.status}`;
      throw new Error(msg);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw error;
  }
}

// ─── READ ────────────────────────────────────────────────────────────────────

/**
 * Fetch movies list from the API for a specific type + year table.
 * @param {string} type - e.g. 'tamil'
 * @param {string|number} year - e.g. '2026'
 * @returns {Promise<Array>}
 */
export async function getMovies(type, year) {
  const url = buildUrl(type, year);
  try {
    const data = await apiFetch(url);

    // Handle both plain array and wrapped { success, data: [] } responses
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;

    return [];
  } catch (error) {
    console.warn(`GET failed for ${type}_${year}:`, error.message);
    throw error;
  }
}

// ─── WRITE ───────────────────────────────────────────────────────────────────

/**
 * Add a new movie to the Cloudflare D1 table via POST.
 * @param {string} type
 * @param {string|number} year
 * @param {Object} movieData - Full movie object
 * @returns {Promise<any>}
 */
export async function addMovie(type, year, movieData) {
  const url = buildUrl(type, year);
  return await apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(movieData)
  });
}

/**
 * Update an existing movie in the Cloudflare D1 table via PUT.
 * @param {string} type
 * @param {string|number} year
 * @param {string} id - Movie ID
 * @param {Object} movieData - Updated movie object
 * @returns {Promise<any>}
 */
export async function updateMovie(type, year, id, movieData) {
  const url = buildUrl(type, year, id);
  return await apiFetch(url, {
    method: 'PUT',
    body: JSON.stringify(movieData)
  });
}

/**
 * Delete a movie from the Cloudflare D1 table via DELETE.
 * @param {string} type
 * @param {string|number} year
 * @param {string} id - Movie ID to delete
 * @returns {Promise<any>}
 */
export async function deleteMovie(type, year, id) {
  const url = buildUrl(type, year, id);
  return await apiFetch(url, {
    method: 'DELETE'
  });
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

/**
 * Fetch and compile movie counts for all type+year combinations in TABLE_CONFIG.
 * @returns {Promise<Object>} - { total, tamil, hollywood, ... per-type counts }
 */
export async function compileDashboardStats() {
  const counts = {};
  TABLE_CONFIG.types.forEach(t => { counts[t] = 0; });

  const promises = [];

  for (const type of TABLE_CONFIG.types) {
    for (const year of TABLE_CONFIG.years) {
      promises.push(
        getMovies(type, year)
          .then(movies => {
            counts[type] = (counts[type] || 0) + movies.length;
          })
          .catch(err => {
            console.warn(`Stats fetch failed for ${type}_${year}:`, err.message);
          })
      );
    }
  }

  await Promise.all(promises);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { total, ...counts };
}

/**
 * (Legacy stub) — kept so existing imports don't break.
 * Clears nothing since localStorage is no longer used for data.
 */
export function clearCache() {
  showToast('Data is now live from the API — no local cache to clear.', 'info');
}
