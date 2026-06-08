const menuButton = document.querySelector('[data-menu-button]');
const nav = document.querySelector('[data-site-nav]');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const isOpen = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', String(!isOpen));
    menuButton.setAttribute('aria-expanded', String(!isOpen));
  });
}

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const target = button.getAttribute('data-copy') || '';
    const text = document.querySelector(target)?.textContent?.trim() || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = 'Copiado';
      window.setTimeout(() => {
        button.textContent = original;
      }, 1400);
    } catch {
      button.textContent = 'Copie manualmente';
    }
  });
});
