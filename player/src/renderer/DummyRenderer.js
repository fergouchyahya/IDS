/**
 * DUMMY RENDERER (Version Structurée)
 * Rôle : Simuler l'affichage dans le terminal en respectant les méthodes spécifiques
 * et les durées de la configuration.
 */
class DummyRenderer {
    constructor() {
        this.timer = null;
    }

    // Nettoie la "scène" (annule le timer précédent)
    clear() {
        if (this.timer) clearTimeout(this.timer);
    }

    displayPlaylist(items, index = 0) {
        if (!items || index >= items.length) {
            console.log("--- Fin de playlist, retour au début ---");
            return this.displayPlaylist(items, 0);
        }

        const item = items[index];

        this.render(item);

        // On récupère la durée du JSON (ou 5s par défaut si malformé)
        const durationMs = (item.durationSec || 5) * 1000;
    
        console.log(`   Reste affiché pendant ${item.durationSec} secondes...`);

        // 4. Programmation de la suite
        this.timer = setTimeout(() => {
            this.displayPlaylist(items, index + 1);
        }, durationMs);
    }


    render(item) {
        this.clear();
        console.log(`\n[DISPLAY] Affichage de l'item #${item.order} (${item.type})`);

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
                console.warn(`  Type inconnu : ${item.type}`);
        }
    }


    _renderText(text) {
        console.log(`  CONTENU TEXTE : "${text}"`);
        // Plus tard, on pourrait simuler ici des calculs de taille de police...
    }

    _renderImage(path) {
        console.log(`  SOURCE IMAGE : "${path}"`);
        // Plus tard, on pourrait vérifier ici si le fichier existe sur le disque...
    }

    _renderVideo(path) {
        console.log(`  FICHIER VIDÉO : "${path}"`);
        // Plus tard, on pourrait simuler le chargement des codecs...
    }
}

module.exports = DummyRenderer;