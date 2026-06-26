if(localStorage.getItem("loggedin")!="true"){

window.location="login.html";

}

function logout(){

localStorage.removeItem("loggedin");

window.location="login.html";

}
