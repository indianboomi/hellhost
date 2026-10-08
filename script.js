function authLinks(){
  const logged=localStorage.getItem('hellhost_user');
  document.querySelectorAll('.auth-menu').forEach(el=>{
    el.innerHTML=logged
      ? '<a class="user-link" href="dashboard.html"><span class="user-icon">👤</span> '+escapeHtml(logged.split('@')[0])+'</a><a class="logout-link" href="#" onclick="logout(event)">Logout</a>'
      : '<button class="oauth-link google" type="button" onclick="oauthLogin("google")">🔵 Login with Google</button><button class="oauth-link github" type="button" onclick="oauthLogin("github")">⚫ Login with GitHub</button><button class="oauth-link discord" type="button" onclick="oauthLogin("discord")">💬 Login with Discord</button>';
  });
}
function oauthLogin(provider){
  alert('Hell Host '+provider+' login needs OAuth credentials to be connected. The button is ready for the real provider setup.');
}
function escapeHtml(value){
  return value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function logout(e){
  if(e)e.preventDefault();
  localStorage.removeItem('hellhost_user');
  localStorage.removeItem('hellhost_free_month');
  location.href='index.html';
}
function login(e){
  e.preventDefault();
  const email=document.getElementById('email').value.trim();
  if(!email)return;
  localStorage.setItem('hellhost_user',email);
  localStorage.setItem('hellhost_free_month','active');
  location.href='dashboard.html';
}
function demoSignup(e){
  e.preventDefault();
  const email=prompt('Enter your email to create your Hell Host account:');
  if(email&&email.includes('@')){
    localStorage.setItem('hellhost_user',email);
    localStorage.setItem('hellhost_free_month','active');
    location.href='dashboard.html';
  }
}
function sendContact(e){
  e.preventDefault();
  document.getElementById('form-message').textContent='Thanks! Your message has been received. Connect a backend/email service to send it for real.';
  e.target.reset();
}
document.addEventListener('DOMContentLoaded',()=>{
  authLinks();
  const trigger=document.getElementById('menu-trigger');
  const menu=document.getElementById('site-menu');
  if(trigger&&menu){
    trigger.addEventListener('click',e=>{
      e.stopPropagation();
      const open=menu.classList.toggle('show');
      trigger.setAttribute('aria-expanded',String(open));
    });
    menu.addEventListener('click',e=>e.stopPropagation());
    document.addEventListener('click',()=>{
      menu.classList.remove('show');
      trigger.setAttribute('aria-expanded','false');
    });
  }
  const name=document.getElementById('user-name');
  if(name){
    const u=localStorage.getItem('hellhost_user');
    if(!u) location.href='login.html';
    else name.textContent=u.split('@')[0];
  }
});