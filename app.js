let data;
let photoIndex = 0;
let activeOverlay = null;
let returnFocus = null;
const closeTimers = new WeakMap();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const icon = name => `<svg viewBox="0 0 ${name === 'arrow' ? '12 12' : '16 16'}" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="${data.icons[name]}"></path></svg>`;

function showOverlay(id) {
  const overlay = document.getElementById(id);
  if (activeOverlay && activeOverlay !== overlay) hideOverlay(activeOverlay, true);
  returnFocus = document.activeElement;
  clearTimeout(closeTimers.get(overlay));
  overlay.hidden = false;
  overlay.classList.remove('is-closing');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-visible')));
  activeOverlay = overlay;
  (overlay.querySelector('[data-close-about]') || overlay.querySelector('.overlay-card')).focus({preventScroll:true});
}

function hideOverlay(overlay = activeOverlay, immediate = false) {
  if (!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.classList.add('is-closing');
  if (activeOverlay === overlay) activeOverlay = null;
  const finish = () => { overlay.hidden = true; overlay.classList.remove('is-closing'); };
  clearTimeout(closeTimers.get(overlay));
  if (immediate || reducedMotion.matches) finish();
  else closeTimers.set(overlay, setTimeout(finish, overlay.id === 'about-overlay' ? 180 : 600));
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
}

function showPhoto(index) {
  if (index < 0 || index >= data.photos.length) return;
  photoIndex = index;
  const photo = data.photos[index];
  const image = document.getElementById('active-photo');
  image.src = photo.src;
  image.alt = photo.name;
  document.getElementById('photo-overlay').setAttribute('aria-label', photo.name);
  for (const next of [index-1,index+1]) if(data.photos[next]) { const prefetch = new Image(); prefetch.src = data.photos[next].src; }
}

async function initialize() {
  const response = await fetch('./data.json');
  if(!response.ok) throw new Error('Could not load file index');
  data = await response.json();
  initializeBackgroundGallery(data.photos);
  document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
  const photoFiles = document.getElementById('photo-files');
  data.photos.forEach((photo,index) => {
    const row = document.createElement('div'); row.className = 'tree-row depth-two';
    const button = document.createElement('button'); button.className = 'file-row'; button.type = 'button';
    const imageIcon = document.createElement('span'); imageIcon.className = 'icon'; imageIcon.innerHTML = icon('photo');
    const label = document.createElement('span'); label.textContent = photo.name;
    button.append(imageIcon,label);
    button.addEventListener('click', () => { showPhoto(index); showOverlay('photo-overlay'); });
    row.append(button); photoFiles.append(row);
  });
}

function initializeBackgroundGallery(photos) {
  const backgrounds = photos;
  const image = document.querySelector('.background-photo');
  const controls = document.querySelector('.background-controls');
  const count = document.getElementById('background-count');
  const message = document.querySelector('.background-message');
  const cache = new Map();
  let displayedIndex = 0;
  let requestedIndex = 0;
  let requestVersion = 0;
  const wrap = index => (index + backgrounds.length) % backgrounds.length;

  function load(photo) {
    if (cache.has(photo.src)) return cache.get(photo.src);
    const preload = new Image();
    preload.decoding = 'async';
    preload.src = photo.src;
    let timeout;
    const promise = Promise.race([
      preload.decode(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Photo loading timed out')), 15000); })
    ]).then(() => preload).finally(() => clearTimeout(timeout));
    cache.set(photo.src, promise);
    if (cache.size > 4) cache.delete(cache.keys().next().value);
    promise.catch(() => { if (cache.get(photo.src) === promise) cache.delete(photo.src); });
    return promise;
  }

  function updateCount() {
    count.textContent = `${String(displayedIndex + 1).padStart(2, '0')} / ${backgrounds.length}`;
    count.setAttribute('aria-label', `Background photo ${displayedIndex + 1} of ${backgrounds.length}`);
  }

  function preloadNeighbors() {
    for (const offset of [-1, 1]) load(backgrounds[wrap(displayedIndex + offset)]).catch(() => {});
  }

  async function navigate(step) {
    requestedIndex = wrap(requestedIndex + step);
    const index = requestedIndex;
    const version = ++requestVersion;
    controls.setAttribute('aria-busy', 'true');
    count.textContent = 'Loading…';
    message.hidden = true;
    try {
      const loaded = await load(backgrounds[index]);
      if (version !== requestVersion) return;
      image.src = loaded.src;
      image.style.objectPosition = backgrounds[index].objectPosition || '50% 50%';
      displayedIndex = index;
      image.dataset.photo = backgrounds[index].name;
      updateCount();
      preloadNeighbors();
    } catch {
      if (version !== requestVersion) return;
      requestedIndex = displayedIndex;
      updateCount();
      message.textContent = "This photo couldn't load. Try another.";
      message.hidden = false;
    } finally {
      if (version === requestVersion) controls.setAttribute('aria-busy', 'false');
    }
  }

  controls.querySelectorAll('[data-background-step]').forEach(button => {
    button.disabled = backgrounds.length < 2;
    button.addEventListener('click', () => navigate(Number(button.dataset.backgroundStep)));
  });
  controls.addEventListener('keydown', event => {
    if (activeOverlay || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    navigate(event.key === 'ArrowRight' ? 1 : -1);
  });
  image.dataset.photo = backgrounds[0].name;
  image.style.objectPosition = backgrounds[0].objectPosition || '50% 50%';
  updateCount();
  preloadNeighbors();
}

document.querySelectorAll('[data-folder]').forEach(button => {
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    const folder = document.getElementById(button.dataset.folder);
    folder.classList.toggle('is-open', open);
    folder.inert = !open;
  });
});
document.querySelectorAll('.disclosure:not(.is-open)').forEach(folder=>{folder.inert=true;});
document.querySelector('[data-action="about"]').addEventListener('click', () => showOverlay('about-overlay'));
document.querySelector('[data-close-about]').addEventListener('click', () => hideOverlay());
document.querySelectorAll('.overlay').forEach(overlay => overlay.addEventListener('click', event => { if(event.target === overlay) hideOverlay(overlay); }));
document.addEventListener('keydown', event => {
  if(!activeOverlay) return;
  if(event.key === 'Escape') { event.preventDefault(); hideOverlay(); }
  if(activeOverlay?.id === 'photo-overlay') {
    if(event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(photoIndex-1); }
    if(event.key === 'ArrowRight') { event.preventDefault(); showPhoto(photoIndex+1); }
  }
  if(event.key === 'Tab') {
    const items = [...activeOverlay.querySelectorAll('a[href],button:not(:disabled)')].filter(item=>item.getClientRects().length);
    if(!items.length) { event.preventDefault(); activeOverlay.querySelector('.overlay-card').focus(); }
    else if(event.shiftKey && document.activeElement===items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if(!event.shiftKey && document.activeElement===items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
});
let dragStart = null;
const photoCard = document.querySelector('.photo-card');
photoCard.addEventListener('pointerdown', event=>{dragStart=event.clientX;photoCard.setPointerCapture(event.pointerId);});
photoCard.addEventListener('pointerup', event=>{
  if(dragStart === null) return;
  const offset = event.clientX-dragStart;
  if(offset > 50) showPhoto(photoIndex-1);
  if(offset < -50) showPhoto(photoIndex+1);
  dragStart=null;
});
photoCard.addEventListener('pointercancel', ()=>{dragStart=null;});
initialize().catch(error => console.error(error));
