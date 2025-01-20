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
            // Get top artists and tracks
            const [artists, tracks] = await Promise.all([
                this.fetchTopArtists(),
                this.fetchTopTracks()
            ]);

            if (!artists.length && !tracks.length) {
                throw new Error('No top artists or tracks found');
            }

            // Get recommendations using both artist and track seeds
            const recommendedTracks = await this.getRecommendedTracks(
                artists[0]?.id, 
                tracks[0]?.id
            );
            
            if (!recommendedTracks.length) {
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
                alert(error.message || 'An error occurred. Please try again.');
            }
        } finally {
            this.showLoading(false);
        }
    }

    async fetchTopArtists() {
        const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=2&time_range=medium_term', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) {
            throw { status: response.status, message: 'Failed to fetch top artists' };
        }

        const data = await response.json();
        return data.items || [];
    }

    async fetchTopTracks() {
        const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=3&time_range=medium_term', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) {
            throw { status: response.status, message: 'Failed to fetch top tracks' };
        }

        const data = await response.json();
        return data.items || [];
    }

    async getRecommendedTracks(artistId, trackId) {
        // Ensure we have at least one seed
        if (!artistId && !trackId) {
            // If no user top items, use a popular genre as fallback
            return this.getGenreBasedRecommendations();
        }

        const params = new URLSearchParams();
        params.append('limit', '10');

        if (artistId) params.append('seed_artists', artistId);
        if (trackId) params.append('seed_tracks', trackId);
        
        // Add market parameter to ensure available tracks
        params.append('market', 'US');

        const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) {
            if (response.status === 404) {
                // If 404, try genre-based recommendations as fallback
                return this.getGenreBasedRecommendations();
            }
            throw { status: response.status, message: 'Failed to get recommendations' };
        }

        const data = await response.json();
        return data.tracks || [];
    }

    async getGenreBasedRecommendations() {
        // Fallback to using popular genres if we can't get user-based recommendations
        const params = new URLSearchParams({
            seed_genres: 'pop,rock',  // Using popular genres as fallback
            limit: '10',
            market: 'US'
        });

        const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
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
