// Interaction reference: https://cursify.ui-layouts.com/components/dot-particles
(() => {
  const stage = document.querySelector('.stage');
  const canvas = stage.querySelector('.dot-particles');
  const context = canvas.getContext('2d');
  if (!context) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const particles = [];
  let width = 0;
  let height = 0;
  let frame = null;
  let previousTime = null;

  function clear() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previousTime = null;
    particles.length = 0;
    context.clearRect(0, 0, width, height);
  }

  function resize() {
    clear();
    width = stage.clientWidth;
    height = stage.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw(time) {
    const delta = previousTime === null ? 1 / 60 : Math.min((time - previousTime) / 1000, 0.032);
    previousTime = time;
    context.clearRect(0, 0, width, height);
    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index];
      particle.life += delta;
      particle.vx *= Math.exp(-0.3 * delta);
      particle.vy = (particle.vy + 72 * delta) * Math.exp(-0.3 * delta);
      particle.x += (particle.vx + Math.sin(time * 0.00036 + particle.angle) * 18) * delta;
      particle.y += (particle.vy + Math.cos(time * 0.00036 + particle.angle * 0.7) * 12) * delta;
      const progress = particle.life / particle.duration;
      if (progress >= 1 || particle.x < -50 || particle.x > width + 50 || particle.y > height + 50) {
        particles.splice(index, 1);
        continue;
      }
      context.fillStyle = `rgba(255,255,255,${(1 - progress) * 0.8})`;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size * (1 - progress * 0.3), 0, Math.PI * 2);
      context.fill();
    }
    if (particles.length) frame = requestAnimationFrame(draw);
    else { frame = null; previousTime = null; }
  }

  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || reducedMotion.matches || document.hidden) return;
    if (event.target.closest('a,button,nav,.overlay,.background-controls') || stage.querySelector('.overlay:not([hidden])')) return;
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left - stage.clientLeft;
    const y = event.clientY - rect.top - stage.clientTop;
    const count = 34;
    if (particles.length > 240 - count) particles.splice(0, particles.length - (240 - count));
    for (let index = 0; index < count; index++) {
      const angle = Math.PI * 2 * index / count + (Math.random() - 0.5) * 0.5;
      const slow = index < 8;
      const speed = slow ? 30 + Math.random() * 90 : 120 + Math.random() * 240;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0, duration: slow ? 4 + Math.random() * 2 : 2 + Math.random() * 3,
        size: slow ? 2 + Math.random() * 2 : 1 + Math.random() * 3, angle
      });
    }
    if (frame === null) frame = requestAnimationFrame(draw);
  }, { passive: true });

  new ResizeObserver(resize).observe(stage);
  reducedMotion.addEventListener('change', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  window.addEventListener('pagehide', clear);
})();
