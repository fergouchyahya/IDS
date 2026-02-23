# Réunion IDS — État du Projet et Prochaines Étapes

**Date:** 18 février 2026  
**Participants:** Équipe IDS + Collaborateur  
**Objectif:** Expliquer le progrès réalisé et clarifier la direction future

---

## 📊 Qu'est-ce qu'IDS? (Interactive Digital Signage)

IDS est un système complet de gestion d'affichages numériques (comme les kiosques dans les magasins, les écoles, les aéroports). C'est un projet de **signalétique intelligente** qui réagit aux événements en temps réel.

### Architecture en Trois Couches

1. **Admin** (Port 8081)
   - Service backend Node.js
   - Permet aux opérateurs de télécharger des configurations
   - Stocke les configurations en JSONL (append-only)
   - API REST simple: `POST /configs`, `GET /configs`, `GET /configs/<id>`

2. **Player** (Port 7070)
   - Service Node.js qui s'exécute sur le appareil d'affichage (ex: Raspberry Pi)
   - Récupère les configurations depuis Admin au démarrage
   - Gère les événements (détection de mouvement, tap NFC, timeouts)
   - Expose une interface web pour le rendu
   - Envoie les événements de rendu en temps réel via SSE (Server-Sent Events)

3. **Shared Contract** (Contrat Partagé)
   - Schéma JSON (`config.schema.json`) qui définit la structure exacte d'une configuration valide
   - C'est la **source de vérité unique** entre Admin et Player
   - Les deux services valident strictement contre ce schéma
   - Exemples fournis: `config.welcome.json`, `config.media.json`, etc.

### Flux de Données Complet

```
Opérateur → Admin (POST /configs) → Validation schéma
    ↓
    → Config stockée (configs.jsonl)
    ↓
Player (startup) → Récupère config d'Admin → Valide
    ↓
    → Événements reçus (API /events)
    ↓
    → Logique FSM/Scheduler → Événements de rendu
    ↓
    → SSE vers navigateur (/render-stream)
    ↓
Utilisateur voit le contenu dynamiquement mis à jour
```

---

## ✅ Ce Que Nous Avons Fait (Travail Passé)

### 1. **Fondation Solide et Contrat Clair**
   - Architecture monorepo bien organisée: `admin/`, `player/`, `shared/`, `infra/`, `deploy/`, `docs/`
   - Schéma JSON partagé qui garantit que Admin et Player communiquent correctement
   - Validation stricte: tout config doit passer le schéma, sinon refusée immédiatement
   - Règles de nommage établies: camelCase pour JS/variables, kebab-case pour fichiers, UPPER_SNAKE pour constantes

### 2. **Infrastructure Locale Fonctionnelle**
   - Docker Compose pour orchestrer les services localement
   - Nginx en tant que reverse proxy (prêt pour production)
   - Service systemd prêt pour Raspberry Pi
   - Variables d'environnement bien structurées

### 3. **Composants Noyau Implémentés**
   - **Admin Server** (`admin/src/server.js`): 
     - Routes API pour CRUD des configurations
     - Stockage append-only en JSONL
     - Validation des uploads
   - **Player Runtime** (`player/src/`):
     - Chargement et validation des configs
     - Machine à états finie (FSM) pour gérer les transitions
     - Scheduler pour orchestrer les événements
     - Rendu via navigateur (Renderer.js)
   - **Validation partagée** (`shared/contract/scripts/validate-config.js`):
     - Outil pour valider exemples de configs
     - Utilisé en développement et CI
     - Messages d'erreur clairs et lisibles

### 4. **Documentation et Démonstration**
   - Guide complet `howto.md` pour lancer le système localement
   - Flux de démonstration guidée en 3 écrans:
     1. "Hello" au chargement
     2. "Visitor" + "Tap to connect" après détection de mouvement
     3. "Hello <nom>" après tap NFC
   - Architecture documentée, décisions enregistrées (ADR format)
   - Exemples concrets d'événements: VISION_PRESENT, NFC_TAP, IDLE, etc.

### 5. **Workflows et Outils**
   - `Makefile` pour simplifier les commandes courantes
   - `make validate` pour valider le schéma et les exemples
   - Scripts Shell pour démarrer services en dev, guided flow, etc.
   - Repository propre avec `.gitignore` et `.editorconfig`

### 6. **Modes de Fonctionnement Flexibles**
   - Mode Admin-backed: Player récupère config depuis Admin
   - Mode fichier local: Player charge config depuis disque
   - Mode guided flow: Événements envoyés automatiquement ou manuellement
   - Mode debug: Endpoints pour consulter l'état du Player

---

## 🚀 Ce Que Nous Ferons Ensuite (Travail Futur)

### **Phase 1: Tests (Priorité Haute)**
   - **Tests Unitaires**
     - `player/src/fsm.js`: Valider transitions d'état, gestion des événements invalides
     - `player/src/scheduler.js`: Timing des items, ordre d'exécution
     - `admin/src/server.js`: Routes CRUD, validation des payloads
   - **Tests API**
     - Tests Admin: POST/GET/DELETE configs, codes d'erreur
     - Tests Player: POST /events, vérifier les états, réactions
   - **Test E2E (End-to-End)**
     - Démarrer Admin + Player
     - Uploader une config
     - Envoyer des événements
     - Vérifier le rendu dans SSE stream
   - **Bénéfice**: Confiance que le système fonctionne, et regressions détectées immédiatement

### **Phase 2: Observabilité (Priorité Haute)**
   - **Logs Structurés** (JSON lines)
     - Format: `{ timestamp, component, eventType, state, campaignId, correlationId }`
     - Traçabilité depuis l'événement jusqu'au rendu
   - **Health Endpoints**
     - `/healthz` (Admin/Player): Service est alive
     - `/readyz` (Admin/Player): Service est prêt à servir (dépendances OK)
   - **Monitoring**
     - Compter événements reçus/traitéss
     - Latence event → rendu
     - Erreurs de validation
   - **Bénéfice**: En production, on sait immédiatement ce qui se passe, debug facile

### **Phase 3: Sécurité (Priorité Moyenne-Haute)**
   - **Authentification**
     - Token-based auth pour Admin write endpoints (POST /configs)
     - Empêcher upload non-autorisé
   - **Rate Limiting**
     - Limite d'événements par seconde
     - Limite d'uploads par jour
   - **CORS Stricte**
     - Définir origins autorisés
   - **Validation Stricte des Entrées**
     - Taille max des payloads
     - Rejeter données suspectes
   - **Bénéfice**: En production sur Raspberry Pi, le système est protégé contre les attaques simples

### **Phase 4: Déploiement Production (Priorité Moyenne)**
   - **Nginx Wire-up**
     - Routes réelles vers Admin/Player (pas localhost)
     - SSL/TLS
     - Gestion des fichiers statiques
   - **Systemd Hardening**
     - Commandes ExecStart/ExecStop réelles
     - Restart policy (systemd-restart-on-failure)
     - User/permissions pour sécurité
     - Logs centralisés
   - **Stockage Persistant**
     - Chemins pour configs, logs, backups
     - Vérification intégrité au démarrage
     - Rotation des logs
   - **Bénéfice**: Système s'exécute correctement sur Pi, survit aux redémarrages, logs accessibles

### **Phase 5: Versioning du Schéma (Priorité Moyenne)**
   - **Versioning Formel**
     - Champ `version` explicite dans config.schema.json
     - Exemples versionnés: `config.v1.welcome.json`, `config.v2.media.json`
   - **Politique de Compatibilité**
     - Définir breaking vs non-breaking changes
     - Player supporte N versions précédentes
   - **CI Enforcement**
     - Valider tous les exemples anciens avec nouveau schéma (si compatibilité visée)
     - Rejeter PR qui cassent la compatibilité
   - **Bénéfice**: Éviter "nightmare" où une mise à jour Admin casse les players déployés

### **Phase 6: Clarté Architecturale (Priorité Moyenne)**
   - **Séparation Modes**
     - Demo Mode: Événements contrôlés, rendu déterministe (tests, démo)
     - Campaign Mode: Événements réels, scheduler classique (production)
   - **Render Intent Layer**
     - Domaine events indépendants du transport (SSE/WebSocket)
     - Facilite testing et futur support protocoles
   - **Integration Tests**
     - Demo mode: valider 3 écrans exacts dans l'ordre
     - Campaign mode: valider réaction aux événements aléatoires
   - **Bénéfice**: Code lisible, éviter regressions entre modes

---

## 📈 Résumé du Progrès

| Domaine | Avant | Maintenant | Après |
|---------|-------|-----------|--------|
| **Tests** | Aucun | Validations manuelles | Tests auto + E2E |
| **Logs** | Unstructured console | JSON structurés | Logs centralisés, traçables |
| **Sécurité** | Aucune (localhost) | Minimal (localhost) | Auth + Rate-limit + CORS |
| **Déploiement** | Placeholder | Local-only | Production-ready Raspberry Pi |
| **Schéma** | Simple | Lockdown | Versionnage + Compatibilité |
| **Architecture** | Demo + Campaign mélangés | Séparation logique | Modes formels avec tests dédiés |

---

## 🎯 Points Clés à Discuter en Réunion

### **1. Qu'avons-nous Accompli?**
   ✅ Contrat clair (Admin ↔ Player via schéma JSON)  
   ✅ Infrastructure locale fonctionnelle (Admin/Player/Nginx)  
   ✅ Démonstration complète (3 écrans guidés)  
   ✅ Documentation exploratrice et onboarding clair  

### **2. Quelle est la Qualité Actuelle?**
   ⚠️ Pas de tests automatisés → risque de regressions  
   ⚠️ Logs non-structurés → debugging en production difficile  
   ⚠️ Pas de sécurité → ok pour dev, dangereux pour production  
   ⚠️ Deployment files placeholder → pas prêt pour Raspberry Pi  

### **3. Pourquoi Cet Ordre de Prochaines Étapes?**
   - **Tests d'abord** → Base solide, confiance rapide
   - **Observabilité ensuite** → Production monitoring essentiel
   - **Sécurité** → Si on déploie sur réseau public
   - **Deployment** → Quand prêt pour vrai Pi
   - **Versioning + Clarté** → Scaling team + maintenance long-terme

### **4. Combien de Temps?**
   - Tests: ~1-2 semaines (unit + API + 1 E2E path)
   - Observabilité: ~3-4 jours (logs + health endpoints)
   - Sécurité: ~1 semaine (auth + rate-limit)
   - Deployment: ~1-2 semaines (Nginx + systemd + hardening)
   - Versioning + Clarté: ~1-2 semaines

   **Total estimé: 4-6 semaines pour un système production-ready**

### **5. Risques Identifiés?**
   - Rupture de compatibilité schéma → Plan versioning maintenant
   - Données perdues sur restart → Stratégie durabilité définie
   - Debugging en prod impossible → Logs structurés + health endpoints
   - Déploiement Pi chaotique → Wire-up Nginx + systemd dès maintenant

---

## 📋 Prochaines Actions Immédiates

**Pour cette semaine:**
1. Reviewe le branch actuel et valide que `make validate` fonctionne
2. Setup testing framework (Jest ou Mocha)
3. Écrire tests pour 1-2 fonctions critiques (proof of concept)
4. Refactoriser logs pour JSON (même simple au départ)

**Pour la prochaine réunion:**
- Montrer résultats tests
- Discuter schéma versioning strategy
- Décider priorité: Local deployment vs Remote deployment

---

## 📚 Références Rapides

- **Lancer localement**: `bash ids/howto.md` (section 2-10)
- **Valider configs**: `make validate` from `ids/`
- **Schéma source**: `shared/contract/schema/config.schema.json`
- **Exemples configs**: `shared/contract/examples/config.*.json`
- **Admin API**: `admin/openapi/openapi.yaml`
- **Architecture**: `docs/architecture/` (deployment.md, diagram.md)
- **Todos détaillés**: `docs/TODO.md`
- **Problèmes connus**: `docs/review.md`

---

**Fin de la Réunion**

