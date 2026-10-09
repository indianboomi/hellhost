import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  GithubAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDuQ1uw_bqhgj_wEJ5--KujbRJByQpiF8U",
  authDomain: "hellhostlogin.firebaseapp.com",
  projectId: "hellhostlogin",
  storageBucket: "hellhostlogin.firebasestorage.app",
  messagingSenderId: "943477772588",
  appId: "1:943477772588:web:d93ef8a3f225a09aa79c89",
  measurementId: "G-HZ1Z82Q6HH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function showMessage(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}
function friendlyError(error) {
  const messages = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account found with this email. Create an account first.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use": "This email already has an account. Please log in.",
    "auth/weak-password": "Please use a password with at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/popup-closed-by-user": "The sign-in window was closed before finishing.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication settings."
  };
  return messages[error?.code] || error?.message || "Something went wrong. Please try again.";
}

window.login = async function(event) {
  event.preventDefault();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const button = document.querySelector(".login-page .auth-submit");
  if (button) button.disabled = true;
  showMessage("login-message", "Signing in…");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    location.href = "dashboard.html";
  } catch (error) {
    showMessage("login-message", friendlyError(error));
  } finally {
    if (button) button.disabled = false;
  }
};

window.signup = async function(event) {
  event.preventDefault();
  const email = document.getElementById("signup-email")?.value.trim();
  const password = document.getElementById("signup-password")?.value;
  const confirm = document.getElementById("signup-confirm")?.value;
  if (password !== confirm) {
    showMessage("signup-message", "Passwords do not match.");
    return;
  }
  const button = document.querySelector(".signup-page .auth-submit");
  if (button) button.disabled = true;
  showMessage("signup-message", "Creating your account…");
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    location.href = "dashboard.html";
  } catch (error) {
    showMessage("signup-message", friendlyError(error));
  } finally {
    if (button) button.disabled = false;
  }
};

window.startOAuth = async function(providerName) {
  if (providerName === "Discord") {
    showMessage("login-message", "Discord is not a built-in Firebase provider. Google and GitHub sign-in are supported here; Discord needs a separate OAuth/OIDC setup.");
    return;
  }
  const provider = providerName === "Google" ? googleProvider : githubProvider;
  showMessage("login-message", "Opening " + providerName + " sign-in…");
  try {
    await signInWithPopup(auth, provider);
    location.href = "dashboard.html";
  } catch (error) {
    showMessage("login-message", friendlyError(error));
  }
};

window.logout = async function(event) {
  if (event) event.preventDefault();
  try {
    await signOut(auth);
    location.href = "index.html";
  } catch (error) {
    alert("Could not log out: " + friendlyError(error));
  }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

onAuthStateChanged(auth, user => {
  document.querySelectorAll(".auth-menu").forEach(el => {
    if (user) {
      const label = user.displayName || (user.email ? user.email.split("@")[0] : "Host");
      el.innerHTML = '<a class="user-link" href="dashboard.html"><span class="user-icon">👤</span> ' + escapeHtml(label) + '</a><a class="logout-link" href="#" onclick="logout(event)"><span>🚪</span> Logout</a>';
    } else {
      el.innerHTML = '<a class="login-nav" href="login.html">Login</a>';
    }
  });

  const name = document.getElementById("user-name");
  if (name) {
    if (!user) {
      location.replace("login.html");
    } else {
      name.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "Host");
    }
  }
  if (user && (location.pathname.endsWith("/login.html") || location.pathname.endsWith("/signup.html"))) {
    location.replace("dashboard.html");
  }
});
