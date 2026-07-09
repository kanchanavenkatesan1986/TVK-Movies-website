/**
 * Main application entry point and router.
 */

import { initDashboard, renderDashboard } from './dashboard.js';
import { initMovies, loadAndRenderMovies, handleSaveMovie } from './movies.js';
import { initModal } from './modal.js';
import { clearCache, getMovies, TABLE_CONFIG } from './api.js';
import { showToast } from './utils.js';

// Slider view state
let sliderItems = [];
let currentCarouselIndex = 0;
let carouselTimer = null;

// DOM selectors
let sidebarToggle = null;
let sidebar = null;
let clearCacheBtn = null;
let breadcrumbTitle = null;

document.addEventListener('DOMContentLoaded', () => {
  // Select main UI components
  sidebarToggle = document.getElementById('sidebar-toggle');
  sidebar = document.getElementById('sidebar');
  clearCacheBtn = document.getElementById('clear-cache-btn');
  breadcrumbTitle = document.getElementById('breadcrumb-title');

  // Populate all Type dropdowns dynamically from TABLE_CONFIG
  populateTypeDropdowns();

  // Initialize all child modules
  initDashboard();
  initMovies();
  initModal(handleSaveMovie);
  
  // Setup SPA Routing (Tab switching)
  setupRouting();
  
  // Setup Mobile Drawer controls
  setupMobileDrawer();
  
  // Setup Clear Cache handler
  setupCacheReset();

  // Setup Slider management logic
  setupSliderManager();

  // Setup View Movie modal close button
  setupViewModal();

  // Initial Load (Dashboard is active on start)
  renderDashboard();
});

/**
 * Dynamically build all Type <select> dropdowns from TABLE_CONFIG.
 * Adding a new type to TABLE_CONFIG.types auto-adds it to every dropdown.
 */
function populateTypeDropdowns() {
  // IDs of all type <select> elements in the UI
  const typeSelectIds = ['filter-type', 'movie-type'];

  typeSelectIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = ''; // Clear any hardcoded options
    TABLE_CONFIG.types.forEach((type, index) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      if (index === 0) option.selected = true;
      el.appendChild(option);
    });
  });

  // Also populate Year dropdowns
  const yearSelectIds = ['filter-year', 'movie-year'];
  yearSelectIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    TABLE_CONFIG.years.forEach((year, index) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (index === 0) option.selected = true;
      el.appendChild(option);
    });
  });
}

/**
 * Wire up close handlers for the View Movie Details popup modal.
 */
function setupViewModal() {
  const viewModal = document.getElementById('view-movie-modal');
  const closeBtn  = document.getElementById('view-modal-close-btn');
  if (!viewModal) return;

  // X button closes modal
  if (closeBtn) {
    closeBtn.addEventListener('click', () => viewModal.classList.remove('active'));
  }

  // Clicking the dark backdrop overlay also closes modal
  viewModal.addEventListener('click', (e) => {
    if (e.target === viewModal) viewModal.classList.remove('active');
  });
}

/**
 * Handle Single Page Application tab routing.
 */
function setupRouting() {
  const menuItems = document.querySelectorAll('.menu-item');
  
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.target;
      
      // Update sidebar active link state
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');

      // Update Page Containers visible state
      document.querySelectorAll('.page-container').forEach(page => {
        page.classList.remove('active');
      });
      
      const targetPage = document.getElementById(`${target}-section`);
      if (targetPage) {
        targetPage.classList.add('active');
      }

      // Update Breadcrumbs header
      if (breadcrumbTitle) {
        const titleText = target.charAt(0).toUpperCase() + target.slice(1);
        breadcrumbTitle.innerHTML = `<span>Admin</span> / ${titleText}`;
      }

      // Trigger page-specific loads
      if (target === 'dashboard') {
        renderDashboard();
      } else if (target === 'movies') {
        loadAndRenderMovies();
      } else if (target === 'slider') {
        loadSliderView();
      }

      // Collapse mobile drawer if open
      if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
      }
    });
  });
}

/**
 * Setup navigation toggle drawer for mobile views.
 */
function setupMobileDrawer() {
  if (!sidebarToggle || !sidebar) return;

  sidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('active');
  });

  // Close sidebar drawer if clicked outside on mobile viewport
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
      if (!sidebar.contains(e.target) && e.target !== sidebarToggle) {
        sidebar.classList.remove('active');
      }
    }
  });
}

/**
 * Setup Cache Clearing action.
 */
function setupCacheReset() {
  if (!clearCacheBtn) return;

  clearCacheBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset cache? This will fetch fresh lists from the endpoints.')) {
      clearCache();
      
      // Refresh active page
      const activeTab = document.querySelector('.menu-item.active').dataset.target;
      if (activeTab === 'dashboard') {
        renderDashboard();
      } else if (activeTab === 'movies') {
        loadAndRenderMovies();
      } else if (activeTab === 'slider') {
        loadSliderView();
      }
    }
  });
}

/**
 * Slider tab core features.
 */
function setupSliderManager() {
  // Load slider state from localStorage
  const savedSlider = localStorage.getItem('movie_admin_slider_items');
  if (savedSlider) {
    try {
      sliderItems = JSON.parse(savedSlider);
    } catch (e) {
      console.error('Error loading slider items:', e);
      sliderItems = [];
    }
  }

  // If sliderItems is empty, seed it with fallback banner slide details
  if (sliderItems.length === 0) {
    sliderItems = [
      {
        id: "T2026-01",
        title: "Coolie (Promotional)",
        image: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=2670&auto=format&fit=crop",
        story: "Official upcoming Rajinikanth starrer action thriller directed by Lokesh Kanagaraj.",
        type: "tamil"
      },
      {
        id: "H2025-01",
        title: "Superman (Featured)",
        image: "https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=2574&auto=format&fit=crop",
        story: "Reconciling Kryptonian roots with raising on Earth, directed by James Gunn.",
        type: "hollywood"
      }
    ];
    saveSliderState();
  }

  // Carousel slider arrow click listeners
  const prevBtn = document.getElementById('carousel-prev-btn');
  const nextBtn = document.getElementById('carousel-next-btn');

  if (prevBtn) prevBtn.addEventListener('click', prevSlide);
  if (nextBtn) nextBtn.addEventListener('click', nextSlide);

  // Add slide button
  const addToSliderBtn = document.getElementById('add-to-slider-btn');
  if (addToSliderBtn) {
    addToSliderBtn.addEventListener('click', addMovieToSlider);
  }
}

/**
 * Loads Slider management section, populates options and renders slides.
 */
async function loadSliderView() {
  renderCarousel();
  renderSliderSettingsList();
  
  // Populate movie selection dropdown with Active movies from standard categories
  const dropdown = document.getElementById('slider-movie-select');
  if (!dropdown) return;
  
  dropdown.innerHTML = '<option value="">-- Choose active movie --</option>';

  try {
    // Collect active movies from current cache databases
    const movieOptions = [];
    const keys = ['tamil_2026', 'tamil_2025', 'hollywood_2026', 'hollywood_2025'];
    
    for (const key of keys) {
      const parts = key.split('_');
      const list = await getMovies(parts[0], parts[1]);
      list.forEach(movie => {
        if (movie.status === 'Active' && !sliderItems.some(s => s.id === movie.id)) {
          movieOptions.push(movie);
        }
      });
    }

    if (movieOptions.length === 0) {
      const opt = document.createElement('option');
      opt.value = "";
      opt.textContent = "No active movies available to feature";
      opt.disabled = true;
      dropdown.appendChild(opt);
    } else {
      movieOptions.forEach(movie => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify({
          id: movie.id,
          title: movie.title,
          image: movie.image,
          story: movie.story || '',
          type: movie.type
        });
        opt.textContent = `${movie.title} (${movie.type.toUpperCase()} - ${movie.year})`;
        dropdown.appendChild(opt);
      });
    }
  } catch (error) {
    console.error('Error populating slider selector dropdown:', error);
  }
}

/**
 * Render visual preview carousel.
 */
function renderCarousel() {
  const container = document.getElementById('carousel-preview');
  if (!container) return;

  // Remove existing slides (keeping control buttons)
  const slides = container.querySelectorAll('.carousel-slide');
  slides.forEach(s => s.remove());

  if (sliderItems.length === 0) {
    // Show a fallback empty slide message
    const emptySlide = document.createElement('div');
    emptySlide.className = 'carousel-slide active';
    emptySlide.style.backgroundColor = '#1e1b4b';
    emptySlide.innerHTML = `
      <div class="carousel-overlay" style="align-items:center; justify-content:center; height:100%;">
        <span style="font-size: 32px;">📭</span>
        <h3 class="carousel-title">No Featured Slides</h3>
        <p class="carousel-desc" style="text-align:center;">Add active movies from the side panel to preview.</p>
      </div>
    `;
    container.insertBefore(emptySlide, container.firstChild);
    return;
  }

  // Validate carousel index boundary
  if (currentCarouselIndex >= sliderItems.length) {
    currentCarouselIndex = 0;
  }

  // Create slide elements
  sliderItems.forEach((item, index) => {
    const slide = document.createElement('div');
    slide.className = `carousel-slide ${index === currentCarouselIndex ? 'active' : ''}`;
    
    const imageUrl = item.image || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop';
    slide.style.backgroundImage = `url('${imageUrl}')`;
    
    slide.innerHTML = `
      <div class="carousel-overlay">
        <span class="carousel-badge">${item.type}</span>
        <h4 class="carousel-title">${item.title}</h4>
        <p class="carousel-desc">${item.story || 'No story details provided.'}</p>
      </div>
    `;
    container.insertBefore(slide, container.firstChild);
  });

  // Reset autoplay timer
  startCarouselAutoplay();
}

/**
 * Autoplays slides every 5 seconds.
 */
function startCarouselAutoplay() {
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = setInterval(() => {
    nextSlide();
  }, 5000);
}

/**
 * Go to next carousel slide.
 */
function nextSlide() {
  if (sliderItems.length <= 1) return;
  currentCarouselIndex = (currentCarouselIndex + 1) % sliderItems.length;
  updateCarouselDOM();
}

/**
 * Go to previous carousel slide.
 */
function prevSlide() {
  if (sliderItems.length <= 1) return;
  currentCarouselIndex = (currentCarouselIndex - 1 + sliderItems.length) % sliderItems.length;
  updateCarouselDOM();
}

/**
 * Fast slide display toggle (avoids complete re-rendering).
 */
function updateCarouselDOM() {
  const container = document.getElementById('carousel-preview');
  if (!container) return;
  
  const slides = container.querySelectorAll('.carousel-slide');
  slides.forEach((slide, idx) => {
    if (idx === currentCarouselIndex) {
      slide.classList.add('active');
    } else {
      slide.classList.remove('active');
    }
  });
}

/**
 * Render slider panel lists with remove hooks.
 */
function renderSliderSettingsList() {
  const container = document.getElementById('slider-items-list');
  if (!container) return;

  container.innerHTML = '';

  if (sliderItems.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No movies featured. Select one below.</p>';
    return;
  }

  sliderItems.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'slider-list-item';
    
    const thumbUrl = item.image || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop';

    el.innerHTML = `
      <img src="${thumbUrl}" alt="" class="slider-thumb" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop'" />
      <div class="slider-item-info">
        <div class="slider-item-title">${item.title}</div>
        <div class="slider-item-subtitle">${item.type.toUpperCase()} | ID: ${item.id}</div>
      </div>
      <button class="slider-item-remove" data-index="${index}" title="Remove slide">&times;</button>
    `;

    el.querySelector('.slider-item-remove').addEventListener('click', (e) => {
      const idxToRemove = parseInt(e.target.dataset.index, 10);
      removeMovieFromSlider(idxToRemove);
    });

    container.appendChild(el);
  });
}

/**
 * Add movie slide option to list.
 */
function addMovieToSlider() {
  const dropdown = document.getElementById('slider-movie-select');
  if (!dropdown || !dropdown.value) {
    showToast('Please select a valid active movie.', 'warning');
    return;
  }

  try {
    const movieObj = JSON.parse(dropdown.value);
    sliderItems.push(movieObj);
    saveSliderState();
    
    showToast(`${movieObj.title} added to featured slider!`, 'success');
    
    // Refresh views
    loadSliderView();
  } catch (error) {
    console.error('Error adding movie to slider:', error);
    showToast('Failed to add movie slide.', 'error');
  }
}

/**
 * Remove slide item from list.
 * @param {number} idx - Index of item to remove.
 */
function removeMovieFromSlider(idx) {
  const removedTitle = sliderItems[idx].title;
  sliderItems.splice(idx, 1);
  saveSliderState();
  
  showToast(`${removedTitle} removed from featured slider.`, 'info');
  
  if (currentCarouselIndex >= sliderItems.length && currentCarouselIndex > 0) {
    currentCarouselIndex = sliderItems.length - 1;
  }
  
  loadSliderView();
}

/**
 * Persist slider state to local storage.
 */
function saveSliderState() {
  localStorage.setItem('movie_admin_slider_items', JSON.stringify(sliderItems));
}
