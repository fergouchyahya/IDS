const DummyRenderer = require('./DummyRenderer');

const renderer = new DummyRenderer();

const playlist = [
    { type: 'TEXT', data: 'Bienvenue (5s)', order: 1 },
    { type: 'VIDEO', data: 'film_promo.mp4 (Simulé 8s)', order: 2 },
    { type: 'IMAGE', data: 'plan.png (5s)', order: 3 }
];

console.log("=== DÉBUT DU TEST DE DURÉE ===");
renderer.displayPlaylist(playlist);