const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const sakuraLayer = document.querySelector('.sakura-layer');

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function initializeSakura() {
  if (!sakuraLayer) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const random = createSeededRandom(20261124);
  const petalCount = window.innerWidth < 560 ? 25 : 42;
  const animations = [];

  if (prefersReducedMotion) sakuraLayer.classList.add('is-static');

  for (let index = 0; index < petalCount; index += 1) {
    const petal = document.createElement('span');
    const size = 9 + random() * 15;
    const opacity = .28 + random() * .38;
    const duration = 13500 + random() * 12500;
    const horizontalDrift = (random() - .5) * 260;
    const rotation = (random() > .5 ? 1 : -1) * (320 + random() * 540);
    const scale = .72 + random() * .5;

    petal.className = 'sakura-petal';
    petal.style.setProperty('--petal-x', `${random() * 100}%`);
    petal.style.setProperty('--petal-size', `${size.toFixed(1)}px`);
    petal.style.setProperty('--petal-opacity', opacity.toFixed(2));
    petal.style.setProperty('--static-y', `${random() * 96}%`);
    petal.style.setProperty('--static-rotation', `${Math.round(random() * 360)}deg`);
    sakuraLayer.append(petal);

    if (prefersReducedMotion || typeof petal.animate !== 'function') continue;

    const animation = petal.animate([
      { transform: `translate3d(0,-14vh,0) rotate(0deg) scale(${scale})`, opacity: 0 },
      { opacity, offset: .08 },
      { transform: `translate3d(${horizontalDrift * .42}px,45vh,0) rotate(${rotation * .48}deg) scale(${scale * .92})`, opacity, offset: .48 },
      { transform: `translate3d(${horizontalDrift}px,116vh,0) rotate(${rotation}deg) scale(${scale})`, opacity: .08 }
    ], {
      duration,
      delay: -random() * duration,
      iterations: Infinity,
      easing: 'linear'
    });
    animations.push(animation);
  }

  if (!animations.length) return;

  let lastScrollY = window.scrollY;
  let currentRate = 1;
  let targetRate = 1;
  let rateFrame = 0;
  sakuraLayer.dataset.speed = '1.00';

  function applySakuraRate(rate) {
    animations.forEach((animation) => {
      if (typeof animation.updatePlaybackRate === 'function') {
        animation.updatePlaybackRate(rate);
      } else {
        animation.playbackRate = rate;
      }
    });
    sakuraLayer.dataset.speed = rate.toFixed(2);
  }

  function settleSakuraSpeed() {
    targetRate += (1 - targetRate) * .075;
    currentRate += (targetRate - currentRate) * .16;
    applySakuraRate(currentRate);

    if (Math.abs(currentRate - 1) > .015 || Math.abs(targetRate - 1) > .015) {
      rateFrame = window.requestAnimationFrame(settleSakuraSpeed);
    } else {
      currentRate = 1;
      targetRate = 1;
      applySakuraRate(1);
      rateFrame = 0;
    }
  }

  window.addEventListener('scroll', () => {
    const scrollDistance = Math.abs(window.scrollY - lastScrollY);
    lastScrollY = window.scrollY;
    targetRate = Math.max(targetRate, Math.min(4.6, 1.35 + scrollDistance / 14));
    if (!rateFrame) rateFrame = window.requestAnimationFrame(settleSakuraSpeed);
  }, { passive: true });
}

initializeSakura();

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
const lightboxCounter = document.querySelector('#lightbox-counter');
const lightboxClose = document.querySelector('.lightbox-close');
const lightboxPrev = document.querySelector('.lightbox-prev');
const lightboxNext = document.querySelector('.lightbox-next');
let lightboxSlides = [];
let lightboxSlideIndex = 0;

function renderLightboxSlide() {
  const slide = lightboxSlides[lightboxSlideIndex];
  if (!slide) return;
  lightboxImage.src = slide.src;
  lightboxImage.alt = slide.title;
  lightboxTitle.textContent = slide.title;
  lightboxCounter.textContent = lightboxSlides.length > 1
    ? `${lightboxSlideIndex + 1} / ${lightboxSlides.length}`
    : '';
  const hasMultipleSlides = lightboxSlides.length > 1;
  lightboxPrev.hidden = !hasMultipleSlides;
  lightboxNext.hidden = !hasMultipleSlides;
}

function moveLightboxSlide(direction) {
  if (lightboxSlides.length < 2) return;
  lightboxSlideIndex = (lightboxSlideIndex + direction + lightboxSlides.length) % lightboxSlides.length;
  renderLightboxSlide();
}

document.querySelectorAll('.lightbox-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const fallbackTitle = link.dataset.title || link.querySelector('img')?.alt || 'Lampiran';
    const slideSources = (link.dataset.slides || link.getAttribute('href')).split('|');
    const slideTitles = (link.dataset.slideTitles || fallbackTitle).split('|');
    lightboxSlides = slideSources.map((source, index) => ({
      src: new URL(source, document.baseURI).href,
      title: slideTitles[index] || `${fallbackTitle} · ${index + 1}`,
    }));
    lightboxSlideIndex = 0;
    renderLightboxSlide();
    lightbox.showModal();
    document.body.classList.add('no-scroll');
  });
});

lightboxPrev.addEventListener('click', () => moveLightboxSlide(-1));
lightboxNext.addEventListener('click', () => moveLightboxSlide(1));

let touchStartX = null;
lightboxImage.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0]?.clientX ?? null;
}, { passive: true });
lightboxImage.addEventListener('touchend', (event) => {
  if (touchStartX === null) return;
  const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
  const distance = touchEndX - touchStartX;
  if (Math.abs(distance) > 45) moveLightboxSlide(distance < 0 ? 1 : -1);
  touchStartX = null;
}, { passive: true });

lightbox.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') moveLightboxSlide(-1);
  if (event.key === 'ArrowRight') moveLightboxSlide(1);
});

function closeLightbox() {
  lightbox.close();
  lightboxImage.src = '';
  lightboxSlides = [];
  lightboxSlideIndex = 0;
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
