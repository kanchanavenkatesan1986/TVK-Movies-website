/**
 * TVK Movies Admin - Dashboard Controller
 * Computes analytics, loads database metrics, and controls global sidebar flows.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialise session user profiles
    initUserProfile();

    // 2. Setup Responsive Sidebar controls
    setupSidebarToggle();

    // 3. Load & Process Movie analytics
    await loadDashboardData();
});

function initUserProfile() {
    const userNameElement = document.getElementById('profile-name');
    const avatarLetters = document.getElementById('avatar-letters');
    const logoutBtn = document.getElementById('sidebar-logout');

    if (window.auth) {
        const username = window.auth.getUsername();
        if (userNameElement) userNameElement.textContent = username + ' (Admin)';
        
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

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggleBtn) {
                sidebar.classList.remove('open');
            }
        });
    }
}

async function loadDashboardData() {
    const totalCountEl = document.getElementById('stat-total-movies');
    const tamilCountEl = document.getElementById('stat-tamil-movies');
    const hollywoodCountEl = document.getElementById('stat-hollywood-movies');
    const otherCountEl = document.getElementById('stat-other-movies');
    const recentListEl = document.getElementById('recent-movies-list');
    const distributionEl = document.getElementById('category-distribution');

    try {
        // Fetch movies from API module (automatically falls back to storage if network fails)
        const movies = await window.api.getMovies();
        
        // --- COUNTER STATS ---
        const total = movies.length;
        const tamil = movies.filter(m => m.category === 'Tamil' ).length;
        const hollywood = movies.filter(m => m.category === 'Hollywood').length;
        const other = total - (tamil + hollywood);

        // Bind counts to cards
        if (totalCountEl) totalCountEl.textContent = total;
        if (tamilCountEl) tamilCountEl.textContent = tamil;
        if (hollywoodCountEl) hollywoodCountEl.textContent = hollywood;
        if (otherCountEl) otherCountEl.textContent = other >= 0 ? other : 0;

        // --- RECENT UPLOADS (Latest 5 items) ---
        if (recentListEl) {
            recentListEl.innerHTML = '';
            
            if (movies.length === 0) {
                recentListEl.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px 0;">
                            No movies found in the database. Use 'Add Movie' to create one!
                        </td>
                    </tr>
                `;
            } else {
                // Clone array and sort descending by id (assumed chronological)
                const sortedMovies = [...movies].sort((a, b) => b.id - a.id).slice(0, 5);
                
                sortedMovies.forEach(movie => {
                    const row = document.createElement('tr');
                    
                    // Fallback poster image
                    const posterSrc = movie.image && movie.image.startsWith('http') 
                        ? movie.image 
                        : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=100';

                    row.innerHTML = `
                        <td>
                            <div class="movie-row-info">
                                <img class="movie-row-poster" src="${posterSrc}" alt="${movie.title}" onerror="this.src='https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=100'">
                                <span class="movie-row-title">${movie.title}</span>
                            </div>
                        </td>
                        <td><span class="badge ${movie.category === 'Tamil' ? 'badge-primary' : 'badge-accent'}">${movie.category || 'N/A'}</span></td>
                        <td><span class="badge badge-secondary">${movie.language || 'N/A'}</span></td>
                        <td><span style="font-weight: 500">${movie.year || 'N/A'}</span></td>
                    `;
                    recentListEl.appendChild(row);
                });
            }
        }

        // --- CATEGORY DISTRIBUTION & PROGRESS ANIMATION ---
        if (distributionEl) {
            distributionEl.innerHTML = '';
            
            // Defined categories in TVK requirements
            const allCategories = ['Tamil', 'Hollywood', 'Telugu', 'Malayalam', 'Kannada', 'Hindi', 'Web Series'];
            const categoryCounts = {};
            
            // Initialize count
            allCategories.forEach(cat => categoryCounts[cat] = 0);
            
            // Compute real counts
            movies.forEach(movie => {
                const cat = movie.category || 'Other';
                if (categoryCounts.hasOwnProperty(cat)) {
                    categoryCounts[cat]++;
                } else {
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                }
            });

            // Clean categories with 0 counts but show defined ones
            const displayCategories = Object.keys(categoryCounts).sort((a,b) => categoryCounts[b] - categoryCounts[a]);

            if (total === 0) {
                distributionEl.innerHTML = `
                    <div style="text-align:center;color:var(--text-muted);padding:30px 0;">
                        No distribution statistics available.
                    </div>
                `;
            } else {
                displayCategories.forEach(catName => {
                    const count = categoryCounts[catName];
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    
                    // Only show categories that have items OR are core categories (top 4)
                    if (count > 0 || catName === 'Tamil' || catName === 'Hollywood' || catName === 'Web Series') {
                        const distItem = document.createElement('div');
                        distItem.className = 'dist-item';
                        
                        distItem.innerHTML = `
                            <div class="dist-meta">
                                <span class="dist-name">${catName}</span>
                                <span class="dist-count">${count} Movie${count === 1 ? '' : 's'} (${percentage}%)</span>
                            </div>
                            <div class="progress-track">
                                <div class="progress-fill" id="progress-${catName.replace(/\s+/g, '')}" style="width: 0%"></div>
                            </div>
                        `;
                        
                        distributionEl.appendChild(distItem);
                        
                        // Micro animation helper - delay setting width to trigger CSS transitions
                        setTimeout(() => {
                            const fill = document.getElementById(`progress-${catName.replace(/\s+/g, '')}`);
                            if (fill) fill.style.width = `${percentage}%`;
                        }, 100);
                    }
                });
            }
        }
    } catch (err) {
        console.error('Failed to load dashboard metrics: ', err);
        // Display toast error using global container
        if (window.showToast) {
            window.showToast('Data Error', 'Could not query movie records database.', 'error');
        }

        // Bind failure indicator to metric values
        if (totalCountEl) totalCountEl.textContent = 'ERR';
        if (tamilCountEl) tamilCountEl.textContent = 'ERR';
        if (hollywoodCountEl) hollywoodCountEl.textContent = 'ERR';
        if (otherCountEl) otherCountEl.textContent = 'ERR';

        // Display inline connection error inside recent movies list
        if (recentListEl) {
            recentListEl.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; color:var(--status-error); padding:40px 15px; font-size:0.85rem;">
                        <span style="font-weight:600; display:block; margin-bottom:4px;">Database Connection Failed</span>
                        Please check CORS policy configuration on your Cloudflare Worker.
                    </td>
                </tr>
            `;
        }

        // Display inline connection error inside distribution chart
        if (distributionEl) {
            distributionEl.innerHTML = `
                <div style="text-align:center; color:var(--status-error); padding:40px 15px; font-size:0.85rem;">
                    <span style="font-weight:600; display:block; margin-bottom:4px;">Failed to Compute Analytics</span>
                    Blocked by browser CORS checks.
                </div>
            `;
        }
    }
}
