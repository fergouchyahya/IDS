class Renderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentTimeout = null;
    }

    clear() {
        if (this.container) this.container.innerHTML = '';
        if (this.currentTimeout) clearTimeout(this.currentTimeout);
    }

    /**
     * Lit une liste complète d'items (Playlist)
     * @param {Array} items - La liste issue du JSON (IMAGE, TEXT, VIDEO)
     */
    displayPlaylist(items, index = 0) {
        if (!items || index >= items.length) {
            // Optionnel : boucler au début si on veut une lecture infinie en IDLE
            return this.displayPlaylist(items, 0); 
        }

        const item = items[index];
        this.render(item);

        // --- Logique de gestion du temps demandée ---
        let duration = 5000; // Par défaut 5 secondes pour IMAGE et TEXT 

        if (item.type === 'VIDEO') {
            // Pour une vidéo, on attend l'événement 'ended' au lieu d'un timer
            const videoElement = this.container.querySelector('video');
            if (videoElement) {
                videoElement.onended = () => this.displayPlaylist(items, index + 1);
                return; // On sort de la fonction, le callback ended prend le relais
            }
        }

        // Pour IMAGE et TEXT, on passe au suivant après 5s
        this.currentTimeout = setTimeout(() => {
            this.displayPlaylist(items, index + 1);
        }, duration);
    }

    render(item) {
        this.clear();
        console.log(`[Renderer] Affichage de : ${item.type}`);

        if (item.type === 'TEXT') this._renderText(item.data);
        else if (item.type === 'IMAGE') this._renderImage(item.data);
        else if (item.type === 'VIDEO') this._renderVideo(item.data);
    }

    _renderText(text) {
        const el = document.createElement('h1');
        el.className = 'ids-text';
        el.textContent = text;
        this.container.appendChild(el);
    }

    _renderImage(url) {
        const img = document.createElement('img');
        img.className = 'ids-media';
        img.src = url;
        this.container.appendChild(img);
    }

    _renderVideo(url) {
        const vid = document.createElement('video');
        vid.className = 'ids-media';
        vid.src = url;
        vid.autoplay = true;
        vid.muted = true; // Nécessaire pour l'autoplay
        // Note : pas de "loop" ici car on veut détecter la fin (onended)
        this.container.appendChild(vid);
    }
}