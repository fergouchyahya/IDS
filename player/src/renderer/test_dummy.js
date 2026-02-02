const DummyRenderer = require("./DummyRenderer");

const myRenderer = new DummyRenderer();

console.log("--- Début du test ---");


// Cas 1 : Afficher du texte
myRenderer.render({
  type: "TEXT",
  data: "Bienvenue à Polytech",
  durationSec: 10 
});

// Cas 2 : Afficher une image
myRenderer.render({
  type: "IMAGE",
  data: "/assets/plan.png"
});

// Cas 3 : Afficher une vidéo
myRenderer.render({
  type: "VIDEO",
  data: "/assets/film_bde.mp4"
});

// Cas 4 : Type inconnu (Gestion d'erreur)
myRenderer.render({
  type: "HOLOGRAM",
  data: "Test"
});

console.log("--- Fin du test ---");