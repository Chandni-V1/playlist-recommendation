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
            const topArtists = await this.fetchTopArtists();
            const playlists = await this.searchPlaylists(topArtists);
            this.displayPlaylists(playlists);
        } catch (error) {
            console.error('Error:', error);
            alert('Error getting recommendations. Please try again.');
        }
        this.showLoading(false);
    }

    async fetchTopArtists() {
        const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=5', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await response.json();
        return data.items;
    }

    async searchPlaylists(artists) {
        const playlists = [];
        for (const artist of artists) {
            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(artist.name)}&type=playlist&limit=3`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }
            );
            const data = await response.json();
            playlists.push(...data.playlists.items.filter(playlist => 
                playlist.owner.id !== 'spotify' && 
                !playlist.owner.id.startsWith('spotify')
            ));
        }
        return playlists;
    }

    displayPlaylists(playlists) {
        const container = document.getElementById('playlists-container');
        container.innerHTML = playlists.map(playlist => `
            <div class="playlist-card">
                <img src="${playlist.images[0]?.url || 'default-playlist.png'}" alt="${playlist.name}">
                <div class="playlist-info">
                    <h3>${playlist.name}</h3>
                    <p>Created by: ${playlist.owner.display_name}</p>
                    <p>${playlist.tracks.total} tracks</p>
                    <a href="${playlist.external_urls.spotify}" target="_blank" class="spotify-button">Open in Spotify</a>
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
