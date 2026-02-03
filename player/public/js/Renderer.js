/**
 * IDS — Browser Renderer (Phase 5)
 * File: player/public/js/renderer.js
 * * Rôle : Afficher les items dans le navigateur.
 * Respecte strictement l'interface du DummyRenderer.
 */
class Renderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.timer = null; // Pour stocker le setTimeout et pouvoir l'annuler
        
        if (!this.container) {
            console.error(`FATAL: Conteneur #${containerId} introuvable.`);
        }
    }

    // Nettoie l'écran et annule le timer en cours (pour éviter les conflits)
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * Gère la boucle d'affichage (Logic Mirror of DummyRenderer)
     */
    displayPlaylist(items, index = 0) {
        // 1. Gestion de la boucle infinie
        if (!items || items.length === 0) return;

        if (index >= items.length) {
            console.log("--- 🔄 Fin de playlist, retour au début ---");
            return this.displayPlaylist(items, 0);
        }

        const item = items[index];

        // 2. On affiche l'item
        this.render(item);

        // 3. Gestion du temps (identique au Dummy)
        // On utilise la durée du JSON, sinon 5 secondes par défaut
        const durationMs = (item.durationSec || 5) * 1000;

        console.log(`[Renderer] Reste affiché pendant ${durationMs/1000}s...`);

        // 4. Programmation de la suite
        this.timer = setTimeout(() => {
            this.displayPlaylist(items, index + 1);
        }, durationMs);
    }

    /**
     * Aiguillage vers la bonne méthode d'affichage
     */
    render(item) {
        // On nettoie l'écran précédent AVANT d'afficher le nouveau
        // (Note: on n'appelle pas this.clear() ici car cela tuerait le timer qu'on vient de lancer dans displayPlaylist)
        if (this.container) this.container.innerHTML = ''; 

        console.log(`[Renderer] Displaying item #${item.order} (${item.type})`);

        try {
            switch (item.type) {
                case 'TEXT':
                    this._renderText(item.data);
                    break;
                case 'IMAGE':
                    this._renderImage(item.data);
                    break;
                case 'VIDEO':
                    this._renderVideo(item.data);
                    break;
                default:
                    console.warn(`Type inconnu : ${item.type}`);
                    this._renderText(`Type non supporté : ${item.type}`);
            }
        } catch (e) {
            console.error("Erreur de rendu:", e);
        }
    }

    // --- IMPLÉMENTATIONS SPÉCIFIQUES (DOM) ---

    _renderText(text) {
        const el = document.createElement('h1');
        el.className = 'ids-content-text';
        // Remplace les \n par des sauts de ligne HTML
        el.innerText = text; 
        this.container.appendChild(el);
    }

    _renderImage(url) {
        const img = document.createElement('img');
        img.className = 'ids-content-media';
        img.src = url;
        
        img.onerror = () => {
            console.error(`Impossible de charger l'image : ${url}`);
            this._renderText("Image indisponible");
        };
        
        this.container.appendChild(img);
    }

    _renderVideo(url) {
        const vid = document.createElement('video');
        vid.className = 'ids-content-media';
        vid.src = url;
        
        // Configuration indispensable pour l'autoplay moderne
        vid.autoplay = true;
        vid.muted = true; // Obligatoire sur Chrome/Firefox sans interaction utilisateur
        vid.loop = true;  // On boucle la vidéo tant que le timer de displayPlaylist n'a pas expiré
        
        vid.onerror = () => {
            console.error(`Impossible de charger la vidéo : ${url}`);
            this._renderText("Vidéo indisponible");
        };

        this.container.appendChild(vid);
    }
}