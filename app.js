class SpotifyPlaylistDiscovery {
    constructor() {
        this.token = null;
        this.initializeApp();
    }

    initializeApp() {
        // Check if we're returning from Spotify auth
        if (window.location.hash) {
            this.handleAuthCallback();
        }

        // Setup button listeners
        document.getElementById('login-button').addEventListener('click', () => this.login());
        document.getElementById('get-playlists').addEventListener('click', () => this.getRecommendations());

        // Check if we have a token
        if (sessionStorage.getItem('spotify_token')) {
            this.token = sessionStorage.getItem('spotify_token');
            this.showAppView();
        }
    }

    login() {
        const authUrl = 
            'https://accounts.spotify.com/authorize' +
            '?client_id=' + SPOTIFY_CONFIG.CLIENT_ID +
            '&response_type=token' +
            '&redirect_uri=' + encodeURIComponent(SPOTIFY_CONFIG.REDIRECT_URI) +
            '&scope=' + SPOTIFY_CONFIG.SCOPES.join('%20') +
            '&show_dialog=true';
        
        window.location.href = authUrl;
    }

    handleAuthCallback() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        this.token = params.get('access_token');
        
        if (this.token) {
            sessionStorage.setItem('spotify_token', this.token);
            this.showAppView();
            // Clear the URL hash
            history.pushState("", document.title, window.location.pathname);
        }
    }

    showAppView() {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
    }

    async getRecommendations() {
        this.showLoading(true);
        try {
            console.log('Starting recommendation flow...');
            console.log('Token exists:', !!this.token);

            // First get user's top items
            const topArtists = await this.fetchTopArtists();
            console.log('Top artists:', topArtists);

            const topTracks = await this.fetchTopTracks();
            console.log('Top tracks:', topTracks);

            if (!topArtists.length || !topTracks.length) {
                throw new Error('No top artists or tracks found');
            }

            // Get recommendations using just the first artist and track
            const recommendedTracks = await this.getRecommendedTracks(
                [topArtists[0]],  // Just use first artist
                [topTracks[0]]    // Just use first track
            );
            console.log('Recommended tracks:', recommendedTracks);

            const playlists = await this.findPlaylistsWithTracks(recommendedTracks);
            console.log('Found playlists:', playlists);
            
            this.displayPlaylists(playlists);
        } catch (error) {
            console.error('Detailed error:', error);
            if (!this.token) {
                alert('Authentication token is missing. Please try logging in again.');
            } else if (error.status === 401) {
                alert('Authentication expired. Please log in again.');
                sessionStorage.removeItem('spotify_token');
                window.location.reload();
            } else {
                alert(`Error: ${error.message || 'Unknown error occurred'}. Please try again.`);
            }
        }
        this.showLoading(false);
    }

    async fetchTopArtists() {
        console.log('Fetching top artists...');
        const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=10', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Top artists error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.items || [];
    }

    async fetchTopTracks() {
        console.log('Fetching top tracks...');
        const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=10', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Top tracks error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.items || [];
    }

    async getRecommendedTracks(seedArtists, seedTracks) {
        console.log('Getting recommendations with seeds:', {
            artists: seedArtists.map(a => a.id),
            tracks: seedTracks.map(t => t.id)
        });

        let baseUrl = 'https://api.spotify.com/v1/recommendations';
        const params = {
            limit: 20
        };

        if (seedArtists.length > 0) {
            params.seed_artists = seedArtists[0].id;
        }
        if (seedTracks.length > 0) {
            params.seed_tracks = seedTracks[0].id;
        }

        // Build query string
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        const url = `${baseUrl}?${queryString}`;
        console.log('Recommendations URL:', url);

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Recommendations API error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.tracks || [];
    }

    async findPlaylistsWithTracks(recommendedTracks) {
        const playlists = new Set();
        const processedPlaylistIds = new Set();

        for (const track of recommendedTracks) {
            try {
                const response = await fetch(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(track.name)}${
                        encodeURIComponent(' ' + track.artists[0].name)
                    }&type=playlist&limit=5`, {
                        headers: { 'Authorization': `Bearer ${this.token}` }
                    }
                );
                
                if (!response.ok) {
                    console.error(`Failed to search playlists for track ${track.name}:`, response.status);
                    continue;
                }

                const data = await response.json();
                const validPlaylists = (data.playlists?.items || []).filter(playlist => 
                    playlist &&
                    playlist.owner &&
                    playlist.owner.id !== 'spotify' &&
                    !playlist.owner.id.startsWith('spotify') &&
                    !processedPlaylistIds.has(playlist.id) &&
                    playlist.tracks.total >= 20
                );

                for (const playlist of validPlaylists) {
                    processedPlaylistIds.add(playlist.id);
                    playlists.add(playlist);
                }
            } catch (error) {
                console.error(`Error processing track ${track.name}:`, error);
                continue;
            }
        }

        return Array.from(playlists);
    }

    displayPlaylists(playlists) {
        const container = document.getElementById('playlists-container');
        
        if (playlists.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p>No matching playlists found. Try again later!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = playlists.map(playlist => `
            <div class="playlist-card">
                <img src="${playlist.images[0]?.url || 'default-playlist.png'}" alt="${playlist.name || 'Untitled Playlist'}">
                <div class="playlist-info">
                    <h3>${playlist.name || 'Untitled Playlist'}</h3>
                    <p>Created by: ${playlist.owner?.display_name || 'Unknown Creator'}</p>
                    <p>${playlist.tracks?.total || 0} tracks</p>
                    <a href="${playlist.external_urls?.spotify || '#'}" target="_blank" class="spotify-button">
                        Open in Spotify
                    </a>
                </div>
            </div>
        `).join('');
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
        document.getElementById('playlists-container').innerHTML = '';
    }
}

// Initialize the app
new SpotifyPlaylistDiscovery();
