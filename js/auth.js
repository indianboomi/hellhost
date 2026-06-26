// Firebase v10 Modular SDK

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
createUserWithEmailAndPassword,
signInWithEmailAndPassword,
GoogleAuthProvider,
GithubAuthProvider,
signInWithPopup,
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {

apiKey:"AIzaSyCQhjd3TkMLEhX_UuBQMN_us5yjV3igg-Y",

authDomain:"hellhost-c199c.firebaseapp.com",

projectId:"hellhost-c199c",

storageBucket:"hellhost-c199c.firebasestorage.app",

messagingSenderId:"812756184123",

appId:"1:812756184123:web:7474904a05c10f3fdf801e"

measurementId: "G-2GVC29QMLM"

};

const app = initializeApp(firebaseConfig);

const auth=getAuth(app);

// SIGNUP

const signup=document.getElementById("signupForm");

if(signup){

signup.addEventListener("submit",async(e)=>{

e.preventDefault();

const email=document.getElementById("email").value;

const password=document.getElementById("password").value;

await createUserWithEmailAndPassword(auth,email,password);

window.location="dashboard.html";

});

}

// LOGIN

const login=document.getElementById("loginForm");

if(login){

login.addEventListener("submit",async(e)=>{

e.preventDefault();

const email=document.getElementById("loginEmail").value;

const password=document.getElementById("loginPassword").value;

await signInWithEmailAndPassword(auth,email,password);

window.location="dashboard.html";

});

}

// GOOGLE

window.googleLogin=async()=>{

const provider=new GoogleAuthProvider();

await signInWithPopup(auth,provider);

window.location="dashboard.html";

}

// GITHUB

window.githubLogin=async()=>{

const provider=new GithubAuthProvider();

await signInWithPopup(auth,provider);

window.location="dashboard.html";

}

// LOGIN CHECK

onAuthStateChanged(auth,(user)=>{

if(user && location.pathname.includes("login")){

window.location="dashboard.html";

}

});
