// Get Discord user
const user = JSON.parse(localStorage.getItem("discordUser"));

// If not logged in
if (!user) {
    window.location.href = "login.html";
}

// Username
document.getElementById("username").textContent =
    user.global_name || user.username;

// Email
document.getElementById("email").textContent =
    user.email || "";

// Avatar
const avatar = document.getElementById("avatar");

if (user.avatar) {

    avatar.src =
        `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

} else {

    avatar.src =
        "https://cdn.discordapp.com/embed/avatars/0.png";

}

// Logout
function logout() {

    localStorage.removeItem("discordUser");

    window.location.href = "login.html";

}

// Make it available for onclick=""
window.logout = logout;
