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

if(!user){

window.location="login.html";

}

});

window.logout=()=>{

signOut(auth);

}
