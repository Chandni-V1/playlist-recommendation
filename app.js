class SpotifyPlaylistDiscovery {
    constructor() {
        this.token = null;
        this.initializeApp();
    }

    async getRecommendations() {
        this.showLoading(true);
        try {
            console.log('Starting recommendation flow with token:', this.token ? 'Token exists' : 'No token');
            
            const topArtists = await this.fetchTopArtists();
            console.log('Fetched top artists:', topArtists);
            
            const playlists = await this.searchPlaylists(topArtists);
            console.log('Fetched playlists:', playlists);
            
            this.displayPlaylists(playlists);
        } catch (error) {
            console.error('Detailed error:', error);
            
            // More specific error messages
            if (!this.token) {
                alert('Authentication token is missing. Please try logging in again.');
            } else if (error.status === 401) {
                alert('Authentication expired. Please log in again.');
                // Clear the invalid token
                sessionStorage.removeItem('spotify_token');
                window.location.reload();
            } else {
                alert(`Error: ${error.message || 'Unknown error occurred'}. Please try again.`);
            }
        }
        this.showLoading(false);
    }

    async fetchTopArtists() {
        const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=5', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status;
            throw error;
        }
        
        const data = await response.json();
        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Invalid response format from top artists endpoint');
        }
        return data.items;
    }

    async searchPlaylists(artists) {
        if (!Array.isArray(artists) || artists.length === 0) {
            throw new Error('No artists available to search playlists');
        }

        const playlists = [];
        for (const artist of artists) {
            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(artist.name)}&type=playlist&limit=3`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }
            );
            
            if (!response.ok) {
                const error = new Error(`HTTP error! status: ${response.status}`);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            if (!data.playlists || !data.playlists.items) {
                throw new Error('Invalid response format from playlist search endpoint');
            }

            playlists.push(...data.playlists.items.filter(playlist => 
                playlist.owner.id !== 'spotify' && 
                !playlist.owner.id.startsWith('spotify')
            ));
        }
        return playlists;
    }

    // ... rest of the class remains the same
}
