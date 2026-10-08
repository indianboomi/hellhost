function authLinks(){
  const logged=localStorage.getItem('hellhost_user');
  document.querySelectorAll('.auth-menu').forEach(el=>{
    el.innerHTML=logged
      ? '<a class="user-link" href="dashboard.html">👤 '+escapeHtml(logged.split('@')[0])+'</a><a class="logout-link" href="#" onclick="logout(event)">🚪 Logout</a>'
      : '<a class="oauth google" href="#" onclick="oauthLogin(event,\'Google\')">G Continue with Google</a><a class="oauth github" href="#" onclick="oauthLogin(event,\'GitHub\')">● Continue with GitHub</a><a class="oauth discord" href="#" onclick="oauthLogin(event,\'Discord\')">◈ Continue with Discord</a>';
  });
}
function escapeHtml(value){return value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function oauthLogin(e,provider){
  e.preventDefault();
  alert(provider+' login needs OAuth provider configuration. Connect Google, GitHub and Discord OAuth in the backend before enabling real sign-in.');
}
function logout(e){
  if(e)e.preventDefault();
  localStorage.removeItem('hellhost_user');
  localStorage.removeItem('hellhost_free_month');
  location.href='index.html';
}
function sendContact(e){
  e.preventDefault();
  const m=document.getElementById('form-message');
  if(m)m.textContent='Thanks! Your message has been received. Connect a backend/email service to send it for real.';
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
    if(!u) location.href='index.html';
    else name.textContent=u.split('@')[0];
  }
});