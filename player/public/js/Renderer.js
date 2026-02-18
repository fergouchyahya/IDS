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
     * Gère la boucle d'affichage
     */
    displayPlaylist(items, index=0) {
        
        // Gestion de la boucle infinie
        if (!items || items.length === 0) return;

        // Au premier passage, on s'assure que les items sont dans l'ordre spécifié par 'order"
        if (index === 0) {
            items.sort((a, b) => a.order - b.order);
            console.log("[Renderer] Playlist réordonnée :", items);
        }

        if (index >= items.length) {
            console.log("--- Fin de playlist, retour au début ---");
            return this.displayPlaylist(items, 0); // on relance depuis le début
        }

        const item = items[index];

        // On affiche l'item
        this.render(item);

        // Gestion du temps d'affichage, on utilise la durée du JSON, sinon 5 secondes par défaut
        const durationMs = (item.durationSec || 5) * 1000;

        console.log(`[Renderer] Reste affiché pendant ${durationMs/1000}s...`);

        this.timer = setTimeout(() => {
            this.displayPlaylist(items, index + 1);
        }, durationMs);
    }

    /**
     * Dispatch vers la bonne méthode d'affichage
     */
    render(item) {
        // On nettoie l'écran précédent avant d'afficher le nouveau
        // (Note: on n'appelle pas this.clear() ici car cela tuerait le timer qu'on vient de lancer dans displayPlaylist)
        if (this.container) this.container.innerHTML = ''; 

        console.log(`[Renderer] Displaying item #${item.order} (${item.type})`);

        try {
            switch (item.type) {
                case 'TEXT':
                    this._renderText(item);
                    break;
                case 'CLOCK':
                    this._renderClock(item);
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
            if (item.showClock === true) {
                this._addOverlayClock(item);
            }
        } catch (e) {
            console.error("Erreur de rendu:", e);
        }
    }

    // --- IMPLÉMENTATIONS SELON TYPE DE DOC ---

    _renderText(itemOrText) {
        const payload = typeof itemOrText === 'string'
            ? { data: itemOrText }
            : (itemOrText || {});
        const el = document.createElement('h1');
        el.className = 'ids-content-text';
        // Remplace les \n par des sauts de ligne HTML
        el.innerText = payload.data || '';

        // si le json impose un style on l'applique
        if (payload.style) {
            if (payload.style.fontFamily) el.style.fontFamily = payload.style.fontFamily;
            if (payload.style.color) el.style.color = payload.style.color;
        }
        // Si le JSON impose une taille, on la prend. Sinon, on calcule.
        if (payload.style && payload.style.fontSize) {
            el.style.fontSize = payload.style.fontSize;
        } else {
            el.style.fontSize = this.calculateAutoFontSize(payload.data || '');
        }

        this.container.appendChild(el);
    }

    _addOverlayClock(item) {
        const clockEl = document.createElement('div');
        clockEl.className = 'ids-overlay-clock';

        // Calcul de l'heure
        const now = new Date();
        const timeString = now.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        clockEl.innerText = timeString;

        if (item.style && item.style.clockColor) {
            clockEl.style.color = item.style.clockColor;
        }

        this.container.appendChild(clockEl);
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
        
        vid.autoplay = true;
        vid.muted = true; // Obligatoire sur Chrome/Firefox sans interaction utilisateur
        vid.loop = true;  // On boucle la vidéo tant que le timer de displayPlaylist n'a pas expiré
        
        vid.onerror = () => {
            console.error(`Impossible de charger la vidéo : ${url}`);
            this._renderText("Vidéo indisponible");
        };

        this.container.appendChild(vid);
    }


    calculateAutoFontSize(text) {
        if (!text) return "5rem";

        const len = text.length;

        // ÉCHELLE DE TAILLES (Ajustable selon tes goûts)
        if (len <= 5) {
            return "25rem"; // Très court (ex: "14:00" ou "NON") -> GIGANTESQUE
        } else if (len <= 10) {
            return "15rem"; // Court (ex: "Bienvenue") -> TRÈS GROS
        } else if (len <= 30) {
            return "8rem";  // Moyen (ex: "Réunion en salle B") -> GROS
        } else if (len <= 60) {
            return "5rem";  // Long (ex: une phrase complète) -> MOYEN
        } else {
            return "3rem";  // Paragraphe -> PETIT
        }
    }
}
