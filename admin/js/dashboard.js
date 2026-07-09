/**
 * Dashboard view controller.
 */

import { compileDashboardStats } from './api.js';

let totalMoviesEl = null;
let tamilMoviesEl = null;
let hollywoodMoviesEl = null;
let dashboardContainer = null;

/**
 * Initialize dashboard elements.
 */
export function initDashboard() {
  totalMoviesEl = document.getElementById('stat-total-movies');
  tamilMoviesEl = document.getElementById('stat-tamil-movies');
  hollywoodMoviesEl = document.getElementById('stat-hollywood-movies');
  dashboardContainer = document.getElementById('dashboard-section');
  
  if (!totalMoviesEl || !tamilMoviesEl || !hollywoodMoviesEl) {
    console.warn('Dashboard DOM elements not found.');
  }
}

/**
 * Load dashboard counts and update UI.
 */
export async function renderDashboard() {
  if (!totalMoviesEl || !tamilMoviesEl || !hollywoodMoviesEl) return;

  // Show loading indicator
  totalMoviesEl.innerHTML = '<span class="loading-dots">...</span>';
  tamilMoviesEl.innerHTML = '<span class="loading-dots">...</span>';
  hollywoodMoviesEl.innerHTML = '<span class="loading-dots">...</span>';

  try {
    const stats = await compileDashboardStats();
    
    // Animate numbers counting up for a premium micro-interaction
    animateCount(totalMoviesEl, stats.total);
    animateCount(tamilMoviesEl, stats.tamil);
    animateCount(hollywoodMoviesEl, stats.hollywood);
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    totalMoviesEl.textContent = 'Err';
    tamilMoviesEl.textContent = 'Err';
    hollywoodMoviesEl.textContent = 'Err';
  }
}

/**
 * Animate numbers counting up.
 * @param {HTMLElement} element - The target element.
 * @param {number} target - The final count value.
 */
function animateCount(element, target) {
  let current = 0;
  const duration = 800; // ms
  const stepTime = Math.max(Math.floor(duration / (target || 1)), 15);
  
  if (target === 0) {
    element.textContent = '0';
    return;
  }

  const timer = setInterval(() => {
    current += Math.ceil(target / (duration / stepTime));
    if (current >= target) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = current;
    }
  }, stepTime);
}
