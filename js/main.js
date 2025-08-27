// Year in footer
document.getElementById('y').textContent = new Date().getFullYear();

// ====== Header scroll background ======
(function() {
  const header = document.querySelector('header');
  if (!header) return;

  let ticking = false;

  function updateHeader() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    
    ticking = false;
  }

  function requestTick() {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  
  // Initial check
  updateHeader();
})();

// ====== Waitlist (front-end only; replace with your backend when ready) ======
(function(){
  const form = document.querySelector('form[data-waitlist]');
  if(!form) return;
  const status = form.querySelector('[data-status]') || document.getElementById('status');
  const input = form.querySelector('#email');

  function setStatus(msg, ok){ if(!status) return; status.textContent = msg; status.setAttribute('data-ok', ok ? '1' : '0'); }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = (input.value || '').trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if(!valid){ setStatus('Please enter a valid email address.', 0); input.focus(); return; }

    // Local persistence as a placeholder; replace with fetch('/api/early-access') later
    try {
      const key = 'hive_waitlist';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      if(!list.includes(email)) list.push(email);
      localStorage.setItem(key, JSON.stringify(list));
    } catch(e) { /* ignore */ }

    setStatus("You're on the list! We'll email you when Hive opens.", 1);
    form.reset();
  });
})();
