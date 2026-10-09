function sendContact(e) {
  e.preventDefault();
  const message = document.getElementById("form-message");
  if (message) message.textContent = "Thanks! Your message has been received. Connect a backend/email service to send it for real.";
  e.target.reset();
}

document.addEventListener("DOMContentLoaded", () => {
  const trigger = document.getElementById("menu-trigger");
  const menu = document.getElementById("site-menu");
  if (trigger && menu) {
    trigger.addEventListener("click", event => {
      event.stopPropagation();
      const open = menu.classList.toggle("show");
      trigger.setAttribute("aria-expanded", String(open));
    });
    menu.addEventListener("click", event => event.stopPropagation());
    document.addEventListener("click", () => {
      menu.classList.remove("show");
      trigger.setAttribute("aria-expanded", "false");
    });
  }
});
