class SpotifyPlaylistDiscovery {
    constructor() {
        this.token = null;
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeApp();
        });
    }

    initializeApp() {
        const loginButton = document.getElementById('login-button');
        const playlistButton = document.getElementById('get-playlists');
        
        if (loginButton) {
            loginButton.onclick = () => this.login();
        }
        
        if (playlistButton) {
            playlistButton.onclick = () => this.getRecommendations();
        }

        if (window.location.hash) {
            this.handleAuthCallback();
        }

        const existingToken = sessionStorage.getItem('spotify_token');
        if (existingToken) {
            this.token = existingToken;
            this.showAppView();
        }
    }

    login() {
        const scopes = encodeURIComponent(SPOTIFY_CONFIG.SCOPES.join(' '));
        const redirectUri = encodeURIComponent(SPOTIFY_CONFIG.REDIRECT_URI);
        
        const authUrl = 'https://accounts.spotify.com/authorize' +
            '?client_id=' + SPOTIFY_CONFIG.CLIENT_ID +
            '&response_type=token' +
            '&redirect_uri=' + redirectUri +
            '&scope=' + scopes +
            '&show_dialog=true';

        window.location.href = authUrl;
    }

    handleAuthCallback() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        if (accessToken) {
            this.token = accessToken;
            sessionStorage.setItem('spotify_token', accessToken);
            this.showAppView();
            history.pushState("", document.title, window.location.pathname);
        }
    }

    showAppView() {
        const loginView = document.getElementById('login-view');
        const appView = document.getElementById('app-view');
        
        if (loginView && appView) {
            loginView.classList.add('hidden');
            appView.classList.remove('hidden');
        }
    }

    async getRecommendations() {
        if (!this.token) {
            alert('Please connect your Spotify account first.');
            return;
        }

        this.showLoading(true);

        try {
            // Get available genres first
            const availableGenres = await this.getAvailableGenres();
            
            // Use pop as a fallback if no genres are available
            const seedGenre = availableGenres.length > 0 ? availableGenres[0] : 'pop';
            
            // Get recommendations using genre seed
            const recommendedTracks = await this.getRecommendedTracks(seedGenre);
            
            if (!recommendedTracks || recommendedTracks.length === 0) {
                throw new Error('No recommendations found');
            }

            // Find playlists
            const playlists = await this.findPlaylistsWithTracks(recommendedTracks);
            this.displayPlaylists(playlists);

        } catch (error) {
            console.error('Error:', error);
            if (error.status === 401) {
                alert('Session expired. Please log in again.');
                sessionStorage.removeItem('spotify_token');
                window.location.reload();
            } else {
                alert('An error occurred. Please try again.');
            }
        } finally {
            this.showLoading(false);
        }
    }

    async getAvailableGenres() {
        try {
            const response = await fetch('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch genres');
            }

            const data = await response.json();
            return data.genres || [];
        } catch (error) {
            console.error('Error fetching genres:', error);
            return [];
        }
    }

    async getRecommendedTracks(seedGenre) {
        const params = new URLSearchParams({
            seed_genres: seedGenre,
            limit: 20,
            market: 'US'
        });

        const response = await fetch('https://api.spotify.com/v1/recommendations?' + params.toString(), {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) {
            throw { status: response.status, message: 'Failed to get recommendations' };
        }

        const data = await response.json();
        return data.tracks || [];
    }

    async findPlaylistsWithTracks(tracks) {
        const playlists = new Set();
        const processedIds = new Set();

        for (const track of tracks.slice(0, 3)) {
            try {
                const query = `${track.name} ${track.artists[0].name}`;
                const response = await fetch(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=3`,
                    {
                        headers: { 'Authorization': `Bearer ${this.token}` }
                    }
                );

                if (!response.ok) continue;

                const data = await response.json();
                for (const playlist of data.playlists.items) {
                    if (!processedIds.has(playlist.id) && playlist.tracks.total >= 20) {
                        processedIds.add(playlist.id);
                        playlists.add(playlist);
                    }
                }
            } catch (error) {
                console.error('Error searching playlists:', error);
            }
        }

        return Array.from(playlists);
    }

    displayPlaylists(playlists) {
        const container = document.getElementById('playlists-container');
        
        if (!playlists.length) {
            container.innerHTML = '<p>No matching playlists found. Try again!</p>';
            return;
        }

        container.innerHTML = playlists.map(playlist => `
            <div class="playlist-card">
                <img src="${playlist.images[0]?.url || 'https://via.placeholder.com/300'}" 
                     alt="${playlist.name}"
                     onerror="this.src='https://via.placeholder.com/300'">
                <div class="playlist-info">
                    <h3>${playlist.name}</h3>
                    <p>By ${playlist.owner.display_name}</p>
                    <p>${playlist.tracks.total} tracks</p>
                    <a href="${playlist.external_urls.spotify}" 
                       target="_blank" 
                       class="spotify-button">
                        Open in Spotify
                    </a>
                </div>
            </div>
        `).join('');
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const container = document.getElementById('playlists-container');
        
        if (loading && container) {
            loading.classList.toggle('hidden', !show);
            container.innerHTML = '';
        }
    }
}

// Initialize the app
new SpotifyPlaylistDiscovery();
