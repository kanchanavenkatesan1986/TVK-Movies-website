/**
 * TVK Movies Admin - Movies Catalog Controller
 * Manages search, filters, pagination, Details View Modal, and Delete confirmations.
 */

// Local catalogs state cache
let rawMovies = [];
let filteredMovies = [];
let currentPage = 1;
const pageSize = 5; // 5 items per page for clean table view
let activeDeleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialise session user profiles
    initUserProfile();

    // 2. Setup Responsive Sidebar controls
    setupSidebarToggle();

    // 3. Bind Search and Filter listeners
    setupFilters();

    // 4. Fetch movies list
    await fetchCatalog();
});

function initUserProfile() {
    const userNameElement = document.getElementById('profile-name');
    const avatarLetters = document.getElementById('avatar-letters');
    const logoutBtn = document.getElementById('sidebar-logout');

    if (window.auth) {
        const username = window.auth.getUsername();
        if (userNameElement) userNameElement.textContent = username;
        if (avatarLetters) {
            avatarLetters.textContent = username.slice(0, 2).toUpperCase();
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to sign out?')) {
                window.auth.logout();
            }
        });
    }
}

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('app-sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggleBtn) {
                sidebar.classList.remove('open');
            }
        });
    }
}

// Global Modal handlers
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
};

window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
};

/* --- FETCH & RENDER ENGINE --- */
async function fetchCatalog() {
    try {
        rawMovies = await window.api.getMovies();
        applyFilters();
    } catch (err) {
        console.error('Failed to query movie catalog: ', err);
        showToast('Database Error', 'Could not load movies list.', 'error');
        
        // Update table UI to show actionable CORS/connection error instead of sticking on "Loading..."
        const tableBody = document.getElementById('movies-catalog-rows');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:50px 20px;">
                        <div style="color:var(--status-error); font-weight:600; font-size:1.1rem; margin-bottom:8px;">
                            Connection to Database Failed
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-muted); max-width:600px; margin:0 auto; line-height:1.6;">
                            This is usually caused by a CORS policy block or a network issue. <br>
                            If you are running the Admin Panel locally, the browser blocks requests to the Cloudflare Worker unless it returns 
                            <code>Access-Control-Allow-Origin: *</code> (and handles preflight <code>OPTIONS</code> requests).
                        </div>
                        <div style="margin-top:20px; font-size:0.85rem; color:var(--text-muted);">
                            Current Endpoint: <code style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1); color:var(--text-main); font-family:monospace;">https://database.kanchanavenkatesan1986.workers.dev/movies</code>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

function setupFilters() {
    const searchBar = document.getElementById('search-bar');
    const filterCat = document.getElementById('filter-category');
    const filterLang = document.getElementById('filter-language');

    if (searchBar) searchBar.addEventListener('input', () => { currentPage = 1; applyFilters(); });
    if (filterCat) filterCat.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    if (filterLang) filterLang.addEventListener('change', () => { currentPage = 1; applyFilters(); });
}

function applyFilters() {
    const query = document.getElementById('search-bar').value.toLowerCase().trim();
    const catFilter = document.getElementById('filter-category').value;
    const langFilter = document.getElementById('filter-language').value;

    filteredMovies = rawMovies.filter(movie => {
        // 1. Search Query mapping
        const matchesSearch = !query || 
            (movie.title && movie.title.toLowerCase().includes(query)) ||
            (movie.year && movie.year.toString().toLowerCase().includes(query)) ||
            (movie.language && movie.language.toLowerCase().includes(query)) ||
            (movie.director && movie.director.toLowerCase().includes(query));

        // 2. Category Dropdown mapping
        const matchesCategory = catFilter === 'ALL' || (movie.category && movie.category === catFilter);

        // 3. Language Dropdown mapping
        const matchesLanguage = langFilter === 'ALL' || (movie.language && movie.language === langFilter);

        return matchesSearch && matchesCategory && matchesLanguage;
    });

    renderTable();
}

function renderTable() {
    const tableBody = document.getElementById('movies-catalog-rows');
    const statusText = document.getElementById('pagination-status');
    
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const total = filteredMovies.length;
    
    if (total === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;color:var(--text-muted);padding:60px 0;">
                    No matching movies found in this view.
                </td>
            </tr>
        `;
        if (statusText) statusText.textContent = `Showing 0 of 0 movies`;
        renderPagination(0);
        return;
    }

    // Pagination bounds
    const totalPages = Math.ceil(total / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    
    const pageMovies = filteredMovies.slice(startIdx, endIdx);

    pageMovies.forEach(movie => {
        const row = document.createElement('tr');
        const posterSrc = movie.image && movie.image.startsWith('http') 
            ? movie.image 
            : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=100';

        row.innerHTML = `
            <td>
                <div class="poster-thumbnail-wrapper">
                    <img class="poster-thumbnail" src="${posterSrc}" alt="${movie.title}" onerror="this.src='https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=100'">
                </div>
            </td>
            <td>
                <div class="movie-title-cell" title="${movie.title}">${movie.title}</div>
            </td>
            <td><span class="badge ${movie.category === 'Tamil' ? 'badge-primary' : 'badge-accent'}">${movie.category || 'N/A'}</span></td>
            <td><span class="badge badge-secondary">${movie.language || 'N/A'}</span></td>
            <td><span style="font-weight:600">${movie.year || 'N/A'}</span></td>
            <td style="color:var(--text-muted); max-width: 140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${movie.director || 'N/A'}</td>
            <td>
                <div class="action-buttons" style="justify-content:center;">
                    <button class="btn-action btn-action-view" onclick="viewMovieDetails(${movie.id})" title="View Complete Details">
                        <svg viewBox="0 0 24 24"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17Z"/></svg>
                    </button>
                    <button class="btn-action btn-action-edit" onclick="editMovieRoute(${movie.id})" title="Edit Movie Record">
                        <svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.07,6.18L3,17.25Z"/></svg>
                    </button>
                    <button class="btn-action btn-action-delete" onclick="triggerDeleteMovie(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')" title="Delete Movie Record">
                        <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    if (statusText) {
        statusText.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${total} movie${total === 1 ? '' : 's'}`;
    }

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const buttonsContainer = document.getElementById('pagination-buttons');
    if (!buttonsContainer) return;
    buttonsContainer.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous Page Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.disabled = currentPage === 1;
    prevBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/></svg>`;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });
    buttonsContainer.appendChild(prevBtn);

    // Page Number Buttons
    for (let i = 1; i <= totalPages; i++) {
        // Show max 5 buttons (always include active, first, and last)
        if (totalPages > 5 && i !== 1 && i !== totalPages && Math.abs(currentPage - i) > 1) {
            if (i === 2 && currentPage > 3) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '0 6px';
                ellipsis.style.color = 'var(--text-muted)';
                buttonsContainer.appendChild(ellipsis);
            }
            if (i === totalPages - 1 && currentPage < totalPages - 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '0 6px';
                ellipsis.style.color = 'var(--text-muted)';
                buttonsContainer.appendChild(ellipsis);
            }
            continue;
        }

        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${currentPage === i ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
        });
        buttonsContainer.appendChild(pageBtn);
    }

    // Next Page Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.59Z"/></svg>`;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
    buttonsContainer.appendChild(nextBtn);
}

/* --- ACTION CONTROLLERS --- */

window.editMovieRoute = function(id) {
    window.location.href = `edit-movie.html?id=${id}`;
};

// Details Modal population
window.viewMovieDetails = async function(id) {
    try {
        const movie = await window.api.getMovie(id);
        if (!movie) throw new Error('Movie records look blank.');

        // Populate text nodes
        document.getElementById('detail-title').textContent = movie.title || 'Untitled Movie';
        document.getElementById('detail-release').textContent = movie.release || 'N/A';
        document.getElementById('detail-cat').textContent = movie.category || 'N/A';
        document.getElementById('detail-lang').textContent = movie.language || 'N/A';
        document.getElementById('detail-duration').textContent = movie.duration || 'N/A';
        document.getElementById('detail-year').textContent = movie.year || 'N/A';
        document.getElementById('detail-director').textContent = movie.director || 'N/A';
        document.getElementById('detail-starring').textContent = movie.starring || 'N/A';
        document.getElementById('detail-story').textContent = movie.story || 'No synopsis storyline available for this title.';

        // Poster image fallback
        const posterEl = document.getElementById('detail-poster');
        posterEl.src = movie.image && movie.image.startsWith('http') 
            ? movie.image 
            : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=200';
        posterEl.alt = movie.title || 'Movie Poster';

        // Stream and download buttons
        const downloadsContainer = document.getElementById('detail-downloads');
        downloadsContainer.innerHTML = '';

        const resolMap = [
            { key: '460p', label: '460p SD Stream' },
            { key: '720p', label: '720p HD Stream' },
            { key: '1080p', label: '1080p Full HD' }
        ];

        let hasLinks = false;
        resolMap.forEach(res => {
            const url = movie[res.key];
            if (url && url.trim() && url !== 'https://example.com/360.mp4' && url !== 'https://example.com/720.mp4' && url !== 'https://example.com/1080.mp4') {
                hasLinks = true;
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.className = 'download-link-btn';
                link.innerHTML = `
                    <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/></svg>
                    <span>${res.label}</span>
                `;
                downloadsContainer.appendChild(link);
            }
        });

        if (!hasLinks) {
            downloadsContainer.innerHTML = `
                <div style="font-size:0.8rem;color:var(--text-muted);font-style:italic">
                    No active stream links mapped for this item.
                </div>
            `;
        }

        openModal('detail-modal');
    } catch (err) {
        console.error('Failed to populate movie details: ', err);
        showToast('Load Error', 'Could not open movie profile.', 'error');
    }
};

// Delete confirmation handlers
window.triggerDeleteMovie = function(id, title) {
    activeDeleteId = id;
    const titleEl = document.getElementById('delete-movie-title');
    if (titleEl) titleEl.textContent = `"${title}"`;
    openModal('delete-modal');
};

const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!activeDeleteId) return;

        closeModal('delete-modal');
        
        try {
            const success = await window.api.deleteMovie(activeDeleteId);
            if (success) {
                showToast('Record Deleted', 'Movie record was purged successfully.', 'success');
                // Reload grid
                await fetchCatalog();
            } else {
                throw new Error('Server rejected deletion request.');
            }
        } catch (err) {
            console.error('Failed to delete movie record:', err);
            showToast('Deletion Failed', 'Could not clean record from database.', 'error');
        } finally {
            activeDeleteId = null;
        }
    });
}

// Toast Alerts system (identical style)
window.showToast = function(title, desc, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconPath = '';
    if (type === 'success') {
        iconPath = '<path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>';
    } else if (type === 'error') {
        iconPath = '<path d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2Z"/>';
    } else {
        iconPath = '<path d="M11,9H13V11H11V9M11,13H13V17H11V13M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2Z"/>';
    }

    toast.innerHTML = `
        <div class="toast-icon">
            <svg viewBox="0 0 24 24">${iconPath}</svg>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-desc">${desc}</div>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
};
