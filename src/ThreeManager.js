// import necessary modules
import * as THREE from "three";

import {Text} from "https://cdn.jsdelivr.net/npm/troika-three-text@0.49.1/+esm";
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';

import {Camera} from "./Camera.js";

import {
    BASE_TEXT_SIZE,
    BEDROOM,
    cameraPositions,
    FULL_VIEW,
    MAX_CHARS_PER_LINE,
    MAX_LINES,
    noShadows,
    NOTEBOOK_TEXT_SIZE,
    POLAROID_COUNT,
    polaroidPositions,
    POLAROID_TEXT_SIZE,
    WINDOW,
    WINDOW_TEXT_SIZE,
    songList
} from "./constants.js";

// everything 3d
export class ThreeManager {
    constructor(app) {
        this.app = app;

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio)
        document.getElementById("view").appendChild(this.renderer.domElement);

        this.camera = new Camera(app, this.renderer);

        this.skySpeed = 1;

        this.textObjects = [];

        this.innerSky = null;
        this.coloredSky = null;
        this.outerSky = null;
        this.newsTitle = null;

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.needsUpdate = true;

        this.ready = false;
        this.initAllThree().then(() => this.app.update());
    }

    initScene() {
        this.scene = new THREE.Scene();
        const loader = new GLTFLoader();

        loader.load("src/assets/models/bedroom_base.glb", function (gltf) {
            const room = gltf.scene;

            // edit the bedroom
            room.traverse(function (item) {
                if (item instanceof THREE.Light) {
                    // disable blender lights, they don't translate well
                    item.intensity = 0;
                    item.dispose();
                }

                if (item.material) {
                    if (noShadows.includes(item.material.name)) {
                        item.castShadow = false;
                        item.receiveShadow = false;
                    }

                    if (item.material.name === "mirror") {
                        // swap out the mirror with a reflector object
                        const mirrorGeometry = new THREE.PlaneGeometry(0.8, 1.6, 1, 1);
                        const mirror = new Reflector(mirrorGeometry, {
                            clipBias: 0.003,
                            textureWidth: window.innerWidth * window.devicePixelRatio,
                            textureHeight: window.innerHeight * window.devicePixelRatio,
                            color: 0xbbbbbb
                        });

                        mirror.position.copy(item.position);
                        mirror.rotation.set(0, -Math.PI / 2, 0)

                        this.mirrorBase = item;
                        this.mirrorReflector = mirror;
                        this.mirrorReflector.visible = false;

                        this.scene.add(this.mirrorReflector);
                    }

                    if (item.material.name === "news color") {
                        this.newsTitle = item;
                    }

                    // if (item.material.name === "polaroid"){
                    //     // log positions of the polaroids in the gltf
                    //     console.log([Math.round(item.position.x * 1000)/1000, Math.round(item.position.y * 1000)/1000].join(", "))
                    // }
                }

                if (item.name === "inner_sky") {
                    item.material.color = new THREE.Color(1, 1, 1);
                    item.material.blending = THREE.AdditiveBlending;
                    item.material.opacity = 0.2;

                    this.innerSky = item;
                }

                if (item.name === "colored_sky") {
                    item.material.color = new THREE.Color(0, 0, 0);
                    item.material.opacity = 0.8;

                    this.coloredSky = item;
                }

                if (item.name === "outer_sky") {

                    this.outerSky = item;
                }
            }.bind(this));

            this.scene.add(room);
        }.bind(this))

        this.light = new THREE.PointLight(0xffe7d0, 3, 0, 1);
        this.light.position.set(2.93, 2.08, 0);
        this.light.castShadow = true;
        this.light.shadow.mapSize.width = 256;
        this.light.shadow.mapSize.height = 256;
        this.light.shadow.radius = 5;
        this.light.shadow.blurSamples = 25;
        this.light.shadow.bias = -0.0001;
        this.light.shadow.camera.near = 0.1;
        this.light.shadow.camera.far = 500;

        this.lamp = new THREE.PointLight(0xffe7d0, 1, 0, 1);
        this.lamp.position.set(4, 1.2, -1.6);
        this.lamp.castShadow = true;
        this.lamp.shadow.mapSize.width = 256;
        this.lamp.shadow.mapSize.height = 256;
        this.lamp.shadow.radius = 5;
        this.lamp.shadow.blurSamples = 25;
        this.lamp.shadow.bias = -0.0001;
        this.lamp.shadow.camera.near = 0.1;
        this.lamp.shadow.camera.far = 500;

        this.moodLight = new THREE.RectAreaLight(0xffffff, 0.5, 5, 3);
        this.moodLight.position.set(3.30, 2.67, -0.05);
        this.moodLight.lookAt(this.moodLight.position.x, -10, this.moodLight.position.z);

        const ambientLight = new THREE.AmbientLight(0xd4f8ff, 0.2);

        this.scene.add(this.light);
        this.scene.add(this.lamp);
        this.scene.add(this.moodLight);
        this.scene.add(ambientLight);
    }

    initControls() {
        this.inputX = 0;
        this.inputY = 0;
        this.isTouching = false;

        // track the cursor/finger position
        document.addEventListener("mousemove", (event) => {
            this.inputX = (event.clientX / window.innerWidth) * 2 - 1;
            this.inputY = -(event.clientY / window.innerHeight) * 2 + 1;
            this.isTouching = true;
        });

        document.addEventListener("touchstart", (event) => {
            if (event.touches.length === 1) {
                this.inputX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
                this.inputY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
                this.isTouching = true;
            }
        });

        document.addEventListener("touchmove", (event) => {
            if (event.touches.length === 1) {
                this.inputX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
                this.inputY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
                this.isTouching = true;
            }
        });

        document.addEventListener("touchend", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30); // delay to fix bug where it gets stuck
        });

        document.addEventListener("touchcancel", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30);
        });

        document.addEventListener("mouseleave", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30);
        });

        document.querySelectorAll(".left").forEach((leftArrow) => leftArrow.addEventListener("click", () => this.camera.goLeft()));
        document.querySelectorAll(".right").forEach((rightArrow) => rightArrow.addEventListener("click", () => this.camera.goRight()));
    }

    initBigLyrics() {
        this.bigLyrics = new Text();
        this.scene.add(this.bigLyrics);
        this.textObjects.push(this.bigLyrics);

        // set properties for the text
        this.bigLyrics.fontSize = BASE_TEXT_SIZE;
        this.bigLyrics.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

        this.bigLyrics.textAlign = "center"
        this.bigLyrics.anchorX = "50%";
        this.bigLyrics.anchorY = "50%";
        this.bigLyrics.outlineOffsetX = "8%";
        this.bigLyrics.outlineOffsetY = "6%";
        this.bigLyrics.sdfGlyphSize = this.app.lyricsData.glyphSize;

        this.bigLyrics.position.set(...cameraPositions[this.camera.index].text);
        this.bigLyrics.lookAt(...cameraPositions[this.camera.index].pos);
    }

    initFloatingChars() {
        for (let i = 0; i < this.app.lyricsData.floatingChars.length; i++) {
            let currChar = this.app.lyricsData.floatingChars[i];
            if (currChar.object == null) {
                let charObject = new Text();
                this.scene.add(charObject);

                charObject.fontSize = WINDOW_TEXT_SIZE;
                charObject.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

                charObject.textAlign = "center"
                charObject.anchorX = "50%";
                charObject.anchorY = "50%";
                charObject.outlineOffsetX = "8%";
                charObject.outlineOffsetY = "6%";
                charObject.sdfGlyphSize = this.app.lyricsData.glyphSize;
                charObject.text = currChar.text;

                charObject.position.set(...currChar.currentPosition);
                charObject.rotation.y = Math.PI;
                charObject.rotation.z = (0.5 - Math.random()) / 4;

                currChar.object = charObject;
            }
        }
    }

    initTv() {
        let songTitle = new Text();
        this.scene.add(songTitle);
        this.textObjects.push(songTitle);

        songTitle.fontSize = 0.05;
        songTitle.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

        songTitle.textAlign = "left"
        songTitle.anchorX = "0%";
        songTitle.anchorY = "50%";
        songTitle.sdfGlyphSize = this.app.lyricsData.glyphSize;
        songTitle.text = songList[this.app.songId][6];

        songTitle.position.set(0.29, 0.937, 0.52);
        songTitle.rotation.y = Math.PI / 2;
        songTitle.sync();

        this.timeStamp = new Text();
        this.scene.add(this.timeStamp);
        this.textObjects.push(this.timeStamp);

        this.timeStamp.fontSize = 0.04;
        this.timeStamp.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

        this.timeStamp.textAlign = "right"
        this.timeStamp.anchorX = "50%";
        this.timeStamp.anchorY = "50%";

        this.timeStamp.sdfGlyphSize = this.app.lyricsData.glyphSize;
        this.timeStamp.text = "0:00";

        this.timeStamp.position.set(0.29, 0.937, 0.6);
        this.timeStamp.rotation.y = Math.PI / 2;
        this.timeStamp.sync();

        this.tvText = new Text();
        this.scene.add(this.tvText);
        this.textObjects.push(this.tvText);

        this.tvText.fontSize = 0.06;
        this.tvText.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

        this.tvText.textAlign = "left"
        this.tvText.anchorX = "0%";
        this.tvText.anchorY = "50%";

        this.tvText.sdfGlyphSize = this.app.lyricsData.glyphSize;
        this.tvText.text = "0:00";

        this.tvText.position.set(0.282, 1.032, 0.65);
        this.tvText.clipRect = [-1, -1, 1.6, 1]
        this.tvText.rotation.y = Math.PI / 2;
        this.tvText.sync();
    }

    initNotebook() {
        this.notebookText = new Text();
        this.scene.add(this.notebookText)
        this.textObjects.push(this.notebookText);

        this.notebookText.fontSize = NOTEBOOK_TEXT_SIZE;
        this.notebookText.lineHeight = 1.02;
        this.notebookText.color = (0, 0, 0);
        this.notebookText.font = "src/assets/fonts/Yomogi-Regular.ttf"

        this.notebookText.sdfGlyphSize = this.app.lyricsData.glyphSize;

        this.notebookText.position.set(1.65, 0.35, 0.25);
        this.notebookText.rotation.x = -Math.PI / 2;
        this.notebookText.rotation.z = 16 * Math.PI / 31;
    }

    initPolaroids() {
        this.polaroids = [];

        for (let i = 0; i < POLAROID_COUNT; i++) {
            let polaroidText = new Text();
            let position = polaroidPositions[i];
            polaroidText.position.set(position[0], position[1], position[2]);
            polaroidText.rotation.z = position[3];

            polaroidText.fontSize = POLAROID_TEXT_SIZE;
            polaroidText.font = "src/assets/fonts/NotoSansJP-Bold.ttf"
            polaroidText.text = ""

            polaroidText.textAlign = "center"
            polaroidText.anchorX = "50%";
            polaroidText.anchorY = "50%";
            polaroidText.outlineBlur = 0.05;
            polaroidText.sdfGlyphSize = this.app.lyricsData.glyphSize;

            polaroidText.sync();
            this.scene.add(polaroidText);
            this.polaroids.push(polaroidText);
            this.textObjects.push(polaroidText);
        }
    }

    updateBigLyrics() {
        if (this.camera.index !== BEDROOM && this.camera.index !== FULL_VIEW) {
            this.bigLyrics.visible = false;
        } else {
            this.bigLyrics.visible = true;
            this.bigLyrics.text = this.app.lyricsData.word;
            this.bigLyrics.fontSize = BASE_TEXT_SIZE * this.app.lyricsData.textScale;
            this.bigLyrics.letterSpacing = this.app.lyricsData.stretch / 10;
            this.bigLyrics.scale.set(1 + (this.app.lyricsData.stretch) ** 3, 1 - (this.app.lyricsData.stretch) ** 3);
            this.bigLyrics.outlineColor = this.app.lyricsData.moodColor;
        }

        this.bigLyrics.sync();
    }

    updateFloatingChars() {
        for (let i = 0; i < this.app.lyricsData.floatingChars.length; i++) {
            let currChar = this.app.lyricsData.floatingChars[i];

            if (this.camera.index === WINDOW) {
                // only calculate for the positions where you can see the window
                if (0 < currChar.currentPosition[0] < 3.5) {
                    // only run calculations for characters in frame
                    currChar.object.visible = true;

                    // Increment position of char based on a normalized vector of the end - start position
                    currChar.currentPosition[0] = currChar.startPosition[0] + currChar.movementVector[0] * (this.app.player.videoPosition - currChar.creationTime + 200) * 0.001;
                    currChar.currentPosition[1] = currChar.startPosition[1] + currChar.movementVector[1] * (this.app.player.videoPosition - currChar.creationTime + 200) * 0.001;
                    currChar.currentPosition[2] = currChar.startPosition[2] + currChar.movementVector[2] * (this.app.player.videoPosition - currChar.creationTime + 200) * 0.001;

                    currChar.object.outlineColor = this.app.lyricsData.moodColor;
                    currChar.object.position.set(...currChar.currentPosition);
                    currChar.object.sync();
                } else {
                    currChar.object.visible = false;
                }
            } else {
                currChar.object.visible = false;
            }
        }
    }

    updateTv() {
        this.timeStamp.text = this.posToTimestamp(this.app.player.videoPosition);
        this.timeStamp.sync();

        this.tvText.text = this.app.lyricsData.phrase;
        this.tvText.sync();

        if (this.newsTitle) {
            this.newsTitle.material.color = this.app.lyricsData.moodColor;
        }
    }

    updateNotebook() {
        if (this.app.lyricsData.sortedCharsList.length === 0) {
            this.app.lyricsData.calculateNotebook();
        }

        let lastChar = this.getLastChar(this.app.lyricsData.sortedCharsList);

        let newText = [];
        let cnt = 0;

        let startPos = Math.max(0, Math.floor(lastChar / (MAX_CHARS_PER_LINE * MAX_LINES)) * MAX_CHARS_PER_LINE * MAX_LINES)
        for (let i = startPos; i <= lastChar; i++) {
            newText.push(this.app.lyricsData.sortedCharsList[i].text);
            if (cnt % MAX_CHARS_PER_LINE === MAX_CHARS_PER_LINE - 1) {
                newText.push("\n");
            }
            cnt += 1;
        }

        if (!(newText.length === 1 && newText[0] === "　")) {
            this.notebookText.text = newText.join("");
            this.notebookText.sync();
        }
    }

    updatePolaroids() {
        let lastChar = this.getLastChar(this.app.lyricsData.rawCharList);
        this.polaroids.forEach((polaroid, i) => {
            if (this.app.lyricsData.rawCharList[lastChar]) {
                if (lastChar % POLAROID_COUNT === i) {
                    polaroid.text = this.app.lyricsData.rawCharList[lastChar].text;
                    polaroid.fillOpacity = 1;
                    polaroid.outlineOpacity = 1;
                    polaroid.outlineColor = this.app.lyricsData.moodColor;

                    const outlineAge = this.app.player.videoPosition - this.app.lyricsData.rawCharList[lastChar].startTime
                    polaroid.outlineOpacity = 0.995 ** outlineAge;

                    // text movement (exaggerated, because it's smaller)
                    polaroid.fontSize = POLAROID_TEXT_SIZE * this.app.lyricsData.textScale ** 2;
                    polaroid.scale.set(1 + this.app.lyricsData.stretch / 5, 1 - this.app.lyricsData.stretch / 5);
                } else {
                    // calculate how far behind the active polaroid this polaroid is
                    const relativeIndex = (((lastChar % POLAROID_COUNT - i) % POLAROID_COUNT) + POLAROID_COUNT) % POLAROID_COUNT // weird modulo to fix javascript bug
                    if (lastChar - relativeIndex >= 0) {
                        const fillAge = this.app.player.videoPosition - this.app.lyricsData.rawCharList[lastChar - relativeIndex].endTime;

                        polaroid.text = this.app.lyricsData.rawCharList[lastChar - relativeIndex]

                        // fade out polaroids age they age
                        polaroid.fillOpacity = 0.995 ** fillAge;
                        polaroid.outlineOpacity = 0;
                    }
                }
            }

            if (lastChar === -1) {
                polaroid.text = "";
            }

            polaroid.sync();
        })
    }

    update(pos) {
        if (this.app.lyricsData.textLoaded) {
            this.updateAllText();
        }

        // calculate colors to update lighting based on valence/arousal values
        this.moodLight.color = this.app.lyricsData.moodColor;

        // update sky rotation
        if (this.innerSky && this.coloredSky && this.outerSky) {
            this.innerSky.rotation.y = -1 / 6000 * pos * this.skySpeed;
            this.coloredSky.material.color = new THREE.Color().addColors(this.app.lyricsData.moodColor, new THREE.Color(0.2, 0.2, 0.2));
            this.coloredSky.rotation.y = 1 / 6000 * pos * this.skySpeed;
            this.outerSky.rotation.y = -1 / 8000 * pos * this.skySpeed;
        }

        this.camera.update(this.inputX, this.inputY, this.isTouching);
        this.renderer.render(this.scene, this.camera.camera);
    }

    initAllThree() {
        return new Promise((resolve, reject) => {
            try {
                this.initScene();
                this.camera.initCamera();
                this.initControls();
                resolve(this.ready = true);
            } catch (error) {
                reject(error);
            }
        });
    }

    initAllText() {
        return new Promise((resolve, reject) => {
            try {
                this.textObjects.forEach((object => {
                    this.scene.remove(object);
                    object.dispose();
                }));

                this.initBigLyrics();
                this.initFloatingChars();
                this.initTv();
                this.initNotebook();
                this.initPolaroids();

                resolve(this.app.lyricsData.textLoaded = true);
            } catch (error) {
                reject(error);
            }
        });
    }

    updateAllText() {
        this.updateBigLyrics();
        this.updateFloatingChars();
        this.updateTv();
        this.updateNotebook();
        this.updatePolaroids();
    }

    getLastChar(li) {
        // Binary Search the last character to be rendered
        let left = 0;
        let right = li.length - 1;

        let lastChar = right;

        while (left <= right) {
            let mid = Math.floor((right + left) / 2);
            if (li[mid]._data.startTime > this.app.player.videoPosition) {
                right = mid - 1;
                lastChar = mid;
            } else {
                left = mid + 1;
            }
        }

        lastChar -= 1;
        while (li[lastChar] === "　") {
            lastChar -= 1;
        }

        return lastChar;
    }

    posToTimestamp(pos) {
        const minutes = Math.floor(Math.floor(pos / 1000) / 60);
        const seconds = Math.floor(pos / 1000) % 60;

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    resize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio)

        this.camera.resize();

        this.update()
    }

}
