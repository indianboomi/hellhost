function signup(){

localStorage.setItem("visited","true");

window.location="login.html";

}

document.querySelectorAll("button").forEach(btn=>{

btn.addEventListener("click",function(){

if(this.innerText.includes("Login")){

localStorage.setItem("loggedin","true");

window.location="dashboard.html";

}

});

});
