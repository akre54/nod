const easing = 'cubic-bezier(0.23, 1, 0.32, 1)';
const duration = 240;

export function startFaq() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  for (const item of document.querySelectorAll('.lp-faq')) {
    const summary = item.querySelector('summary');
    const answer = item.querySelector('p');
    if (!summary || !answer) continue;
    let height = null;
    let fade = null;

    summary.addEventListener('click', (event) => {
      event.preventDefault();
      const opening = !item.open || item.classList.contains('is-closing');
      if (opening) {
        for (const other of document.querySelectorAll('.lp-faq[open]:not(.is-closing)')) {
          if (other !== item) other.querySelector('summary').click();
        }
      }

      if (reduce.matches) {
        item.open = opening;
        return;
      }

      const from = item.offsetHeight;
      const opacity = item.open ? Number(getComputedStyle(answer).opacity) : 0;
      height?.cancel();
      fade?.cancel();
      item.open = false;
      const closed = item.offsetHeight;
      item.open = true;
      const open = item.offsetHeight;

      item.classList.toggle('is-closing', !opening);
      item.style.overflow = 'hidden';
      const options = { duration, easing, fill: 'forwards' };
      height = item.animate({ height: [`${from}px`, `${opening ? open : closed}px`] }, options);
      fade = answer.animate({ opacity: [opacity, opening ? 1 : 0] }, options);
      const current = height;
      current.onfinish = () => {
        if (current !== height) return;
        if (!opening) item.open = false;
        item.classList.remove('is-closing');
        item.style.overflow = '';
        height.cancel();
        fade.cancel();
        height = null;
        fade = null;
      };
    });
  }
}
