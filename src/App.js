// import necessary modules
import {Player} from "textalive-app-api";

import * as THREE from "three";

import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Text} from 'troika-three-text'
import { maxTextScale, minTextScale, baseTextSize, fov, songList } from "./constants";
import WebGL from "three/addons/capabilities/WebGL.js";
import {isValidUrl} from "./utils";
import CameraControls from 'camera-controls';
CameraControls.install({THREE: THREE});
import {cameraPosition} from "three/nodes";

// #region initialize variables
const playBtns = document.querySelectorAll(".play");
const jumpBtn = document.querySelector("#jump");
const pauseBtn = document.querySelector("#pause");
const rewindBtn = document.querySelector("#rewind");
const colorPicker = document.querySelector("#color");
const volumeSlider = document.querySelector("#volume");
const progressBar = document.querySelector("#progress");
const songSelector = document.querySelector("#song");
const customSong = document.querySelector("#custom-song");

const positionDisplay = document.querySelector("#position strong");
const artistSpan = document.querySelector("#artist-name span");
const songSpan = document.querySelector("#song-name span");


// textalive
let player;
let position = 0;

// threejs
let threeMng;
let camera, scene, renderer, cameraControls, clock, lyrics;
let width = window.innerWidth;
let height = window.innerHeight;

const cameraPos = [-3.5, 3.7, 50];
const cameraRot = [0, Math.PI/2];

// text scaling
let textScale = maxTextScale;
let textScaleDelta = textScale;
let stretch = 0;
let lyricsTextOld;
let isNewLyrics = false;

// input
let inputX = 0;
let inputY = 0;
let isTouching = false;

// #endregion

// initialize main function
function initMain() {
    if (WebGL.isWebGLAvailable()) {
        threeMng = new ThreeManager();
        window.addEventListener("resize", () => threeMng.resize());
        update();
    } else {
        const warning = WebGL.getWebGLErrorMessage();
        document.getElementById("view").appendChild(warning);
    }

    _initPlayer();
}

// initialize textalive player
function _initPlayer() {
    player = new Player({
        app: {
            appAuthor: "Andrew Dai",
            appName: "miku miku",
            token: "voiEWpeaIFwNII7p",
        },
        mediaElement: document.querySelector("#media"),
        mediaBannerPosition: "top right",
        vocalAmplitudeEnabled: true,
        valenceArousalEnabled: true,
    });

    player.addListener({
        onAppReady,
        onVideoReady,
        onTimerReady,
        onTimeUpdate,
        onPlay,
        onPause,
        onStop,
    });
}

// player event handlers
function onAppReady(app) {
    if (!app.managed) {
        document.querySelector("#control").style.display = "block";

        // set up controls
        playBtns.forEach((playBtn) =>
            playBtn.addEventListener("click", () => {
                player.video && player.requestPlay();
            })
        );

        jumpBtn.addEventListener(
            "click",
            () =>
                player.video &&
                player.requestMediaSeek(player.video.firstChar.startTime)
        );

        pauseBtn.addEventListener(
            "click",
            () => player.video && player.requestPause()
        );

        rewindBtn.addEventListener(
            "click",
            () => player.video && player.requestMediaSeek(0)
        );

        colorPicker.addEventListener(
            "change",
            () => lyrics.outlineColor = colorPicker.value
        );

        volumeSlider.addEventListener(
            "input",
            () => player.volume = volumeSlider.value
        );

        progressBar.addEventListener(
            "input",
            () => player.requestMediaSeek(progressBar.value * player.video.duration)
        );

        songSelector.addEventListener(
            "change",
            () => {
                if (songSelector.value >= 0) {
                    customSong.style.display = "none";
                    loadSong(songSelector.value, false);
                } else {
                    customSong.style.display = "inline";
                    loadSong(customSong.value, true);
                }
            });

        customSong.addEventListener(
            "change",
            () => {
                loadSong(customSong.value, true);
            }
        );
    }

    if (!app.songUrl) {
        console.log("first load")
        if (songSelector.value >= 0) {
            customSong.style.display = "none";
            loadSong(songSelector.value, false);
        } else {
            customSong.style.display = "inline";
            loadSong(customSong.value, true);
        }
    }
}

function onVideoReady(v) {
    artistSpan.textContent = player.data.song.artist.name;
    songSpan.textContent = player.data.song.name;

    let w = player.video.firstWord;
    let lyricsList = [w];

    while (w) {
        w.animate = animateWord.bind(this);
        w = w.next;

        lyricsList.push(w)
    }

    position = 0;

    console.log(lyricsList);
}

function onTimerReady(t) {
    if (!player.app.managed) {
        document
            .querySelectorAll("#control *")
            .forEach((item) => (item.disabled = false));
    }

    jumpBtn.disabled = !player.video.firstChar;
}

function onTimeUpdate(pos) {
    positionDisplay.textContent = String(Math.floor(pos));
    progressBar.value = pos / player.video.duration;

    if (pos < player.video.firstChar.startTime) {
        lyrics.text = "-";
    }

    position = pos;

}

function onPlay() {
    playBtns.forEach((playBtn) => playBtn.style.display = "none");
    pauseBtn.style.display = "inline"
}

function onPause() {
    playBtns.forEach((playBtn) => playBtn.style.display = "inline");
    pauseBtn.style.display = "none"
}

function onStop() {
    lyrics.text = "-";

    playBtns.forEach((playBtn) => playBtn.style.display = "inline");
    pauseBtn.style.display = "none"
}

function loadSong(value, isCustom) {
    // song loading system
    player.video && player.requestPause();
    player.volume = volumeSlider.value

    textScale = 1
    textScaleDelta = 1
    stretch = 0

    lyrics.text = "loading...";
    songSpan.textContent = "";
    artistSpan.textContent = "";

    document
        .querySelectorAll("#control *")
        .forEach((item) => (item.disabled = true));

    if (!isCustom) {
        player.createFromSongUrl(songList[value][0], {
            video: {
                beatId: songList[value][1],
                chordId: songList[value][2],
                repetitiveSegmentId: songList[value][3],
                lyricId: songList[value][4],
                lyricDiffId: songList[value][5]
            }
        }).then(() => lyrics.text = "-");
    } else {
        if (isValidUrl(value)) {
            player.createFromSongUrl(value).then(() => lyrics.text = "-");
        } else {
            lyrics.text = "invalid url";

            document
                .querySelectorAll("#control *")
                .forEach((item) => (item.disabled = false));
        }
    }
}

function animateWord(pos, unit) {
    if (unit.contains(pos)) {
        // update lyrics
        lyrics.text = unit.text;
        isNewLyrics = lyrics.text !== lyricsTextOld;
        lyricsTextOld = lyrics.text
    }

    // calculate text effects
    textScaleDelta = textScale
    let ratio = player.getVocalAmplitude(pos) / player.getMaxVocalAmplitude();

    textScale = minTextScale + (maxTextScale - minTextScale) * Math.log(ratio * maxTextScale + 1) / Math.log(maxTextScale + 1)
    stretch += (textScale - textScaleDelta) * 5;
    stretch *= 0.9999; // decay
    stretch = Math.min(Math.max(-0.7, stretch), 0.7)
}

function update() {
    // rerender the scene if something changed
    threeMng.update(position);

    window.requestAnimationFrame(() => update());
}

// everything 3d
class ThreeManager {
    constructor() {
        // set up renderer
        renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio)
        document.getElementById("view").appendChild(renderer.domElement);

<<<<<<< HEAD
        clock = new THREE.Clock();

        this.initCamera();
        this.initControls();
=======
        // set up camera
        camera = new THREE.PerspectiveCamera(Math.max(50, Math.min(fov / (width / height) / 2, 90)),
            width / height, 0.1, 1000);
        camera.position.set(cameraPos[0][0], cameraPos[0][1], cameraPos[0][2]);

        // set up controls
        clock = new THREE.Clock();

        cameraControls = new CameraControls(camera, renderer.domElement);
        cameraControls.minDistance = cameraControls.maxDistance = 0;
        this.rotateStrength = 0.05;
        this.movementStrength = 0.5;
>>>>>>> d30645d45bf8820aa1b0cc795357f5cdaa7f3897

        // set up scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2d2a2e);

<<<<<<< HEAD
        this._loadScene();
    }
=======
        cameraControls.touches.one = CameraControls.ACTION.NONE;
        cameraControls.touches.two = CameraControls.ACTION.NONE;
        cameraControls.touches.three = CameraControls.ACTION.NONE;

        cameraControls.moveTo(cameraPos[0][0], cameraPos[0][1], cameraPos[0][2]);

        cameraControls.update(clock.getDelta())
        cameraControls.saveState();
>>>>>>> d30645d45bf8820aa1b0cc795357f5cdaa7f3897

    initControls(){
        // track the cursor/finger position
        document.addEventListener("mousemove", (event) => {
            this.normalizeInput(event.clientX, event.clientY);
            isTouching = true;
        })

        document.addEventListener("touchstart", (event) => {
            if (event.touches.length === 1) {
                this.normalizeInput(event.touches[0].clientX, event.touches[0].clientY);
                isTouching = true;
            }
        })

        document.addEventListener("touchmove", (event) => {
            if (event.touches.length === 1) {
                this.normalizeInput(event.touches[0].clientX, event.touches[0].clientY);
                isTouching = true;
            }
        })

        document.addEventListener("touchend", (event) => {
            setTimeout(() => {
                isTouching = false;
            }, 30);
        })

        document.addEventListener("touchcancel", (event) => {
            setTimeout(() => {
                isTouching = false;
            }, 30);
        })

        document.addEventListener("mouseleave", (event) => {
            setTimeout(() => {
                isTouching = false;
            }, 30);
        })
    }

    initCamera(){
        camera = new THREE.PerspectiveCamera(Math.max(50, Math.min(fov / (width / height) / 2, 90)),
        width / height, 0.1, 1000);
        camera.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
        cameraControls = new CameraControls(camera, renderer.domElement);
        cameraControls.minDistance = cameraControls.maxDistance = 0;

        this.movementStrength = 0.5;
        this.rotateStrength = 0.5;

        cameraControls.mouseButtons.left = CameraControls.ACTION.ROTATE;
        cameraControls.mouseButtons.right = CameraControls.ACTION.NONE;
        cameraControls.mouseButtons.middle = CameraControls.ACTION.NONE;
        cameraControls.mouseButtons.wheel = CameraControls.ACTION.ZOOM;

        cameraControls.touches.one = CameraControls.ACTION.NONE;
        cameraControls.touches.two = CameraControls.ACTION.NONE;
        cameraControls.touches.three = CameraControls.ACTION.NONE;

        cameraControls.moveTo(cameraPos[0], cameraPos[1], cameraPos[2], false);
        cameraControls.rotateTo(cameraRot[0], cameraRot[1], false);

        cameraControls.saveState();

        cameraControls.update(clock.getDelta())
    }

    _loadScene() {
        // load lyrics into scene
        lyrics = new Text()
        scene.add(lyrics)

        lyrics.fontSize = baseTextSize;
        lyrics.font = "src/assets/NotoSansJP-Bold.ttf"

        lyrics.textAlign = "center"
        lyrics.anchorX = "50%";
        lyrics.anchorY = "50%";

        lyrics.outlineOffsetX = "8%";
        lyrics.outlineOffsetY = "6%";
        lyrics.outlineColor = colorPicker.value;

        lyrics.sdfGlyphSize = 128;

        if (camera.aspect < 0.75) {
            lyrics.maxWidth = 1;
            lyrics.overflowWrap = "break-word";
        } else {
            lyrics.maxWidth = Infinity;
            lyrics.overflowWrap = "none";
        }

        // load the environment
        const loader = new GLTFLoader();

        loader.load("src/assets/bedroom_base.glb", function (gltf) {
            let object = gltf.scene;
            const testMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, side: THREE.BackSide})

            object.traverse((item) => {
                if (item.isMesh) object.material = testMaterial;
            })

            scene.add(object);
        })
    }

    update(t) {
        lyrics.fontSize = baseTextSize * textScale;
        lyrics.letterSpacing = stretch / 10;
        lyrics.scale.set(1 + (stretch) ** 3, 1 - (stretch) ** 3);
        lyrics.sync();

        let multiplierX = 100 / camera.fov;
        let multiplierY = 100 / camera.fov;

        // stop the tracking if it exits the radius
        if (inputX ** 2 + inputY ** 2 > 1) {
            multiplierX = 100 / Math.sqrt(inputX ** 2 + inputY ** 2) / camera.fov;
            multiplierY = 100 / Math.sqrt(inputX ** 2 + inputY ** 2) / camera.fov;
        }

        // rotate and move the camera a little
        if (isTouching) {
            cameraControls.moveTo(cameraPos[0] + inputX * this.movementStrength * multiplierX,
                cameraPos[1] + inputY * this.movementStrength * multiplierY, cameraPos[2], true)

<<<<<<< HEAD
            cameraControls.rotateTo(cameraRot[0] - inputX * this.rotateStrength, cameraRot[1] - inputY * this.rotateStrength, true)
=======
            cameraControls.rotateTo(cameraPos[1][0] - inputX * this.rotateStrength * multiplierX,
                cameraPos[1][1] + inputY * this.rotateStrength * multiplierY, true)
>>>>>>> d30645d45bf8820aa1b0cc795357f5cdaa7f3897
        } else {
            cameraControls.moveTo(cameraPos[0],
                cameraPos[1], cameraPos[2], true)

<<<<<<< HEAD
            cameraControls.rotateTo(cameraRot[0], cameraRot[1], true)
=======
            cameraControls.rotateTo(cameraPos[1][0], cameraPos[1][1], true)
>>>>>>> d30645d45bf8820aa1b0cc795357f5cdaa7f3897
        }


        cameraControls.update(clock.getDelta())
        renderer.render(scene, camera);
    }

    resize() {
        width = window.innerWidth;
        height = window.innerHeight;

        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio)

        camera.aspect = width / height;
        camera.fov = Math.max(50, Math.min(fov / camera.aspect / 2, 90));

        if (camera.aspect < 0.75) {
            lyrics.maxWidth = 0;
            lyrics.overflowWrap = "break-word";
        } else {
            lyrics.maxWidth = Infinity;
            lyrics.overflowWrap = "none";
        }

        camera.updateProjectionMatrix();
        this.update()
    }

    normalizeInput(clientX, clientY) {
        inputX = (clientX / window.innerWidth) * 2 - 1;
        inputY = -(clientY / window.innerHeight) * 2 + 1;
    }
}

initMain();