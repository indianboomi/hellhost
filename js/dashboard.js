import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {

getAuth,

onAuthStateChanged,

signOut

} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// same firebaseConfig here

const app=initializeApp(firebaseConfig);

const auth=getAuth(app);

onAuthStateChanged(auth,user=>{
const user = JSON.parse(localStorage.getItem("discordUser"));

if(user){

document.getElementById("username").innerText =
user.global_name || user.username;

document.getElementById("avatar").src =
`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

}
window.location="login.html";

}

});

window.logout=()=>{

signOut(auth);

}
