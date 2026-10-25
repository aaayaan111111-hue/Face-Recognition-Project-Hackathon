# FaceID — Facial Recognition Demo

## Technologies
- HTML, CSS and JavaScript
- face-api.js for face detection and matching
- Firebase (Authentication + Firestore) for login and database (free Spark plan)
- GitHub Pages for free static hosting

## Step 1: Set up Firebase
1. Go to https://console.firebase.google.com and click **Add project** (Spark plan, no card needed).
2. **Build > Authentication > Get started > Email/Password** and enable it.
3. **Build > Firestore Database > Create database** (production mode).
4. Open the **Rules** tab, paste the contents of `firestore.rules`, and click **Publish**.
5. **Project settings > Your apps > Web (`</>`)**: register an app and copy the `firebaseConfig`.
6. Paste that config at the top of `app.js`.

## Step 2: Test on your computer
1. Open this folder in VS Code.
2. Install the Live Server extension.
3. Right-click `index.html` and select Open with Live Server.
4. Create an account or sign in.
5. Start the camera and register a consenting test face.

(`localhost` is authorized in Firebase by default.)

## Step 3: Publish on GitHub Pages
1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, `app.js`, `firestore.rules` and `README.md`.
3. Open repository Settings > Pages.
4. Select Deploy from a branch, then `main` and `/ (root)`.
5. Save and wait for deployment.
6. In Firebase: **Authentication > Settings > Authorized domains > Add domain** and add `USERNAME.github.io`.
   Without this step, login will not work on the published site.

## Important notes
- Webcam access requires HTTPS or localhost.
- An internet connection is needed to download the face AI library and models.
- Face descriptors are sensitive biometric data. Register people only with their explicit consent.
- The matching result can be wrong. This is an educational demo, not a secure identity verification system.
- The Firebase config in `app.js` is public by design. Security comes from the Firestore rules, so do not skip step 1.4.
- GitHub Pages hosts static files; it does not run a backend.
- Free service limits and terms may change.