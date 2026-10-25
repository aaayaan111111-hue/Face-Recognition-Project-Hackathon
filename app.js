// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBWHptQtcCR1hjlWes1l0ZqifV-T9vp_W4",
  authDomain: "face-recognition-project-d56cb.firebaseapp.com",
  projectId: "face-recognition-project-d56cb",
  storageBucket: "face-recognition-project-d56cb.firebasestorage.app",
  messagingSenderId: "77958831681",
  appId: "1:77958831681:web:e14dd86a9d7506d51cb0c0"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";
const $ = (id) => document.getElementById(id);

let auth = firebase.auth();
let db = firebase.firestore();
let currentUser = null;
let stream = null;
let modelsReady = false;
let scanning = false;
let scanTimer = null;
let savedProfiles = [];

function setMessage(id, text, kind = "") {
  const el = $(id);
  el.textContent = text;
  el.className = "message" + (kind ? " " + kind : "");
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function friendlyError(e) {
  const map = {
    "auth/email-already-in-use": "Ye email pehle se registered hai. Sign in karein.",
    "auth/invalid-email": "Email sahi format mein enter karein.",
    "auth/weak-password": "Password kam az kam 6 characters ka hona chahiye.",
    "auth/invalid-credential": "Email ya password galat hai.",
    "auth/user-not-found": "Is email ka account nahi mila.",
    "auth/wrong-password": "Email ya password galat hai.",
    "auth/too-many-requests": "Bohat ziada koshishein. Thori der baad try karein.",
    "auth/network-request-failed": "Internet connection check karein.",
    "permission-denied": "Permission denied. Firestore rules check karein."
  };
  return map[e.code] || e.message || "Kuch ghalat ho gaya.";
}

function updateAuthUI() {
  $("authStatus").textContent = currentUser
    ? `Signed in: ${currentUser.email}`
    : "Not signed in";

  $("signOutBtn").classList.toggle("hidden", !currentUser);
  $("registerBtn").disabled = !(currentUser && modelsReady && stream);
}

async function signUp() {
  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || password.length < 6) {
      throw new Error("Email aur kam az kam 6 characters ka password enter karein.");
    }

    setMessage("authMessage", "Creating account…");
    await auth.createUserWithEmailAndPassword(email, password);
    setMessage("authMessage", "Account created and signed in.", "success");
  } catch (e) {
    setMessage("authMessage", friendlyError(e), "error");
  }
}

async function signIn() {
  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || !password) {
      throw new Error("Email aur password enter karein.");
    }

    setMessage("authMessage", "Signing in…");
    await auth.signInWithEmailAndPassword(email, password);
    setMessage("authMessage", "Signed in successfully.", "success");
  } catch (e) {
    setMessage("authMessage", friendlyError(e), "error");
  }
}

async function signOut() {
  try {
    await auth.signOut();
    setMessage("authMessage", "Signed out.", "success");
  } catch (e) {
    setMessage("authMessage", friendlyError(e), "error");
  }
}

async function loadModels() {
  setMessage("scanMessage", "Loading face AI models…");

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);

    modelsReady = true;
    setMessage("scanMessage", "Models ready. Sign in and start the camera.", "success");
    updateAuthUI();
  } catch (e) {
    setMessage(
      "scanMessage",
      "Model download failed. Internet connection ya model URL check karein.",
      "error"
    );
    console.error(e);
  }
}

async function startCamera() {
  try {
    if (!modelsReady) {
      throw new Error("AI models abhi load ho rahe hain. Thori der baad try karein.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera ke liye HTTPS website ya localhost use karein.");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    $("video").srcObject = stream;
    $("video").style.display = "block";
    $("cameraPlaceholder").classList.add("hidden");

    $("cameraState").textContent = "Camera on";
    $("cameraState").classList.add("on");
    $("startCameraBtn").disabled = true;
    $("stopCameraBtn").disabled = false;

    updateAuthUI();
    await $("video").play();

    scanning = true;
    scanLoop();

    setMessage("scanMessage", "Camera running. Keep one face in view.", "success");
  } catch (e) {
    setMessage("scanMessage", e.message, "error");
  }
}

function stopCamera() {
  scanning = false;

  if (scanTimer) clearTimeout(scanTimer);
  if (stream) stream.getTracks().forEach(track => track.stop());

  stream = null;
  $("video").srcObject = null;
  $("video").style.display = "none";

  $("cameraPlaceholder").classList.remove("hidden");
  $("cameraState").textContent = "Camera off";
  $("cameraState").classList.remove("on");

  $("startCameraBtn").disabled = false;
  $("stopCameraBtn").disabled = true;
  $("faceCount").textContent = "0 faces";
  $("matchResult").textContent = "Not scanning";
  $("matchDetail").textContent = "A match is an estimate, not proof of identity.";

  updateAuthUI();
}

async function scanLoop() {
  if (!scanning) return;

  if (!$("video").videoWidth) {
    scanTimer = setTimeout(scanLoop, 400);
    return;
  }

  try {
    const detections = await faceapi
      .detectAllFaces(
        $("video"),
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    $("faceCount").textContent =
      `${detections.length} face${detections.length === 1 ? "" : "s"}`;

    if (!detections.length) {
      $("matchResult").textContent = "No face detected";
      $("matchDetail").textContent = "Camera ke samne aayein aur lighting behtar karein.";
    } else if (detections.length > 1) {
      $("matchResult").textContent = "Multiple faces";
      $("matchDetail").textContent = "Is demo mein ek waqt mein sirf ek face rakhein.";
    } else if (currentUser && savedProfiles.length) {
      const best = findBestMatch(detections[0].descriptor);

      $("matchResult").textContent = best ? best.name : "Unknown";
      $("matchDetail").textContent = best
        ? `Approximate descriptor distance: ${best.distance.toFixed(3)}. Identity verified nahi hai.`
        : "Koi saved profile demo matching threshold pass nahi kar saka.";
    } else {
      $("matchResult").textContent = currentUser
        ? "No profiles saved"
        : "Sign in to match";

      $("matchDetail").textContent =
        "Comparison ke liye pehle apne account mein face register karein.";
    }
  } catch (e) {
    console.error(e);
  }

  if (scanning) scanTimer = setTimeout(scanLoop, 350);
}

function findBestMatch(descriptor) {
  let best = null;

  for (const profile of savedProfiles) {
    const d = profile.descriptor;

    if (!Array.isArray(d) || d.length !== descriptor.length) continue;

    const distance = faceapi.euclideanDistance(
      descriptor,
      new Float32Array(d)
    );

    if (!best || distance < best.distance) {
      best = { name: profile.name, distance };
    }
  }

  return best && best.distance < 0.52 ? best : null;
}

async function registerFace() {
  try {
    if (!currentUser) throw new Error("Pehle sign in karein.");
    if (!stream || !modelsReady) {
      throw new Error("Pehle AI models load karke camera start karein.");
    }

    const name = $("personName").value.trim();
    if (!name) throw new Error("Display name enter karein.");

    setMessage("registerMessage", "Capturing face descriptor…");

    const detections = await faceapi
      .detectAllFaces(
        $("video"),
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.55
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length !== 1) {
      throw new Error("Exactly one clearly visible face hona chahiye.");
    }

    const descriptor = Array.from(detections[0].descriptor);

    await db.collection("face_profiles").add({
      owner_id: currentUser.uid,
      name,
      descriptor,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    $("personName").value = "";
    setMessage("registerMessage", "Face profile saved to your account.", "success");

    await loadProfiles();
    toast("Face profile registered.");
  } catch (e) {
    setMessage("registerMessage", friendlyError(e), "error");
  }
}

async function loadProfiles() {
  if (!currentUser || !db) return;

  try {
    const snap = await db
      .collection("face_profiles")
      .where("owner_id", "==", currentUser.uid)
      .get();

    savedProfiles = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        descriptor: data.descriptor,
        created_at: data.created_at ? data.created_at.toDate() : null
      };
    });

    savedProfiles.sort(
      (a, b) => (b.created_at?.getTime() || Date.now()) - (a.created_at?.getTime() || Date.now())
    );

    renderProfiles();
  } catch (e) {
    $("profilesList").innerHTML =
      '<p class="muted">Profiles load nahi huay. Firestore rules aur setup check karein.</p>';
    console.error(e);
  }
}

function renderProfiles() {
  const list = $("profilesList");
  list.innerHTML = "";

  if (!savedProfiles.length) {
    list.innerHTML =
      '<p class="muted">Abhi koi profile nahi. Permission ke saath test profile register karein.</p>';
    return;
  }

  savedProfiles.forEach(profile => {
    const row = document.createElement("div");
    row.className = "profile";

    const info = document.createElement("div");

    const name = document.createElement("div");
    name.className = "profile-name";
    name.textContent = profile.name;

    const date = document.createElement("small");
    date.textContent = profile.created_at
      ? profile.created_at.toLocaleDateString()
      : "Saved profile";

    info.append(name, date);

    const del = document.createElement("button");
    del.className = "delete-button";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteProfile(profile.id));

    row.append(info, del);
    list.append(row);
  });
}

async function deleteProfile(id) {
  if (!confirm("Kya aap is face profile ko permanently delete karna chahte hain?")) {
    return;
  }

  try {
    await db.collection("face_profiles").doc(id).delete();
    await loadProfiles();
    toast("Profile deleted.");
  } catch (e) {
    toast("Delete failed: " + friendlyError(e));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("signUpBtn").addEventListener("click", signUp);
  $("signInBtn").addEventListener("click", signIn);
  $("signOutBtn").addEventListener("click", signOut);
  $("startCameraBtn").addEventListener("click", startCamera);
  $("stopCameraBtn").addEventListener("click", stopCamera);
  $("registerBtn").addEventListener("click", registerFace);
  $("refreshBtn").addEventListener("click", () => loadProfiles());

  auth.onAuthStateChanged(async (user) => {
    currentUser = user || null;
    updateAuthUI();

    if (currentUser) {
      await loadProfiles();
    } else {
      savedProfiles = [];
      $("profilesList").innerHTML =
        '<p class="muted">Sign in to load your profiles.</p>';
    }
  });

  if (window.faceapi) {
    await loadModels();
  } else {
    setMessage(
      "scanMessage",
      "Face AI library load nahi hui. Internet/CDN check karein.",
      "error"
    );
  }

  window.addEventListener("beforeunload", stopCamera);
});