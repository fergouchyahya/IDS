import { PoseLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('status');

let poseLandmarker;
let lastVideoTime = -1;
let drawingUtils = new DrawingUtils(ctx);

// On prépare l'IA en chargeant le moteur Wasm et notre modèle local
async function initializeMediaPipe() {
    statusText.innerText = "Préparation du moteur Wasm...";
    
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    statusText.innerText = "Chargement du modèle local...";
    
    // Configuration du détecteur pour épargner le processeur
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "models/pose_landmarker_lite.task",
            delegate: "GPU" // On délègue les calculs graphiques si possible
        },
        runningMode: "VIDEO",
        numPoses: 1, // On se concentre sur une seule personne à la fois
        minPoseDetectionConfidence: 0.5, 
        minPosePresenceConfidence: 0.5
    });
    
    startWebcam();
}

// Allumage de la webcam avec une résolution volontairement basse pour soulager le matériel
async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 320 }, 
                height: { ideal: 240 } 
            }
        });
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        statusText.innerText = "Prêt. Place-toi devant la caméra !";
    } catch (err) {
        statusText.innerText = "Erreur de caméra.";
        console.error(err);
    }
}

// Réglages pour limiter l'utilisation de la Pi4
const MAX_FPS = 4; // On bride l'analyse à quelques images par seconde
const DELAY_MS = 1000 / MAX_FPS; 

// Mémoire pour détecter les swipes
let prevRightWristX = null;  
let prevLeftWristX = null;   
let lastSwipeTime = 0;
const SWIPE_THRESHOLD = 0.15; // Le geste doit traverser au moins 15% de l'écran
const SWIPE_COOLDOWN = 1000; // Pause d'une seconde requise entre chaque action

async function predictWebcam() {
    // On rafraîchit l'affichage en dessinant la dernière image de la caméra
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // On s'assure d'avoir une nouvelle image avant de lancer un calcul lourd
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        // Extraction de la posture via MediaPipe
        const pose = poseLandmarker.detectForVideo(video, performance.now());

        if (pose.landmarks && pose.landmarks.length > 0) {
            statusText.innerText = "Bras détectés !";
            statusText.style.color = "#4CAF50";

            for (const landmark of pose.landmarks) {
                // Tracé visuel du squelette pour le retour utilisateur
                drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: "white", lineWidth: 2 });
                drawingUtils.drawLandmarks(landmark, { color: "#ff0000", lineWidth: 1, radius: 3 });

                // On isole les deux poignets pour analyser leurs mouvements
                const rightWrist = landmark[16]; 
                const leftWrist = landmark[15];  
                const now = performance.now();

                // On évite le spam d'actions grâce au cooldown
                if (now - lastSwipeTime > SWIPE_COOLDOWN) {
                    let aSwiped = false; 

                    // On surveille le bras droit pour un éventuel swipe vers la droite
                    if (prevRightWristX !== null) {
                        // On calcule le mouvement et on inverse le signe pour annuler l'effet miroir
                        const deltaRightX = (rightWrist.x - prevRightWristX) * -1;

                        if (deltaRightX > SWIPE_THRESHOLD) {
                            console.log("SWIPE DROITE (par le bras droit)");
                            statusText.innerText = "👉 Swipe Droite !";
                            statusText.style.color = "#2196F3";
                            aSwiped = true;
                            // envoyerEvenement("SWIPE_RIGHT"); (Quand on aura la liaison avec la logique)
                        }
                    }

                    // On surveille le bras gauche pour un swipe gauche (sauf si le bras droit vient d'agir)
                    if (!aSwiped && prevLeftWristX !== null) {
                        const deltaLeftX = (leftWrist.x - prevLeftWristX) * -1;

                        if (deltaLeftX < -SWIPE_THRESHOLD) {
                            console.log("SWIPE GAUCHE (par le bras gauche)");
                            statusText.innerText = "👈 Swipe Gauche !";
                            statusText.style.color = "#FF9800";
                            aSwiped = true;
                            // envoyerEvenement("SWIPE_LEFT"); (Quand on aura la liaison avec la logique)
                        }
                    }

                    if (aSwiped) {
                        lastSwipeTime = now;
                    }
                }

                // Sauvegarde de la position des mains pour comparer à la prochaine frame
                prevRightWristX = rightWrist.x;
                prevLeftWristX = leftWrist.x;
            }
        } else {
            statusText.innerText = "Personne en vue...";
            statusText.style.color = "#f44336";
        }
    }

    // L'astuce vitale pour le Pi 4 : on fait une pause avant la prochaine analyse
    setTimeout(() => {
        requestAnimationFrame(predictWebcam);
    }, DELAY_MS); 
}

initializeMediaPipe();