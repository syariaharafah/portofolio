const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 12);
}, { passive: true });

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  menuButton.classList.toggle('active', !open);
  navLinks.classList.toggle('open', !open);
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.classList.remove('active');
    navLinks.classList.remove('open');
  });
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const tabButtons = [...document.querySelectorAll('.tab-button')];
const tabPanels = [...document.querySelectorAll('.activity-panel')];

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.dataset.tab;
    tabButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    tabPanels.forEach((panel) => {
      const active = panel.id === `panel-${selected}`;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
  });
});

const filterButtons = [...document.querySelectorAll('.filter-button')];
const galleryItems = [...document.querySelectorAll('.gallery-item')];

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle('active', item === button));
    galleryItems.forEach((item) => {
      item.classList.toggle('is-hidden', filter !== 'all' && item.dataset.category !== filter);
    });
  });
});

const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxTitle = document.querySelector('#lightbox-title');
const lightboxClose = document.querySelector('.lightbox-close');

document.querySelectorAll('.lightbox-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const title = link.dataset.title || link.querySelector('img')?.alt || 'Lampiran';
    lightboxImage.src = link.href;
    lightboxImage.alt = title;
    lightboxTitle.textContent = title;
    lightbox.showModal();
    document.body.classList.add('no-scroll');
  });
});

function closeLightbox() {
  lightbox.close();
  lightboxImage.src = '';
  document.body.classList.remove('no-scroll');
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
lightbox.addEventListener('close', () => document.body.classList.remove('no-scroll'));

const copyButton = document.querySelector('.copy-email');
const toast = document.querySelector('#toast');
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(copyButton.dataset.email);
    toast.textContent = 'Alamat email berhasil disalin';
  } catch {
    toast.textContent = copyButton.dataset.email;
  }
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
});

document.querySelector('#current-year').textContent = String(new Date().getFullYear());
