export function startHeroVideo() {
  const play = document.getElementById('heroPlayBtn');
  const video = document.getElementById('heroVideo');
  if (!play || !video) return;

  play.addEventListener('click', () => {
    play.remove();
    video.closest('.lp-demo-photo')?.classList.add('is-playing');
    video.hidden = false;
    video.focus();
    video.play();
  });
}
