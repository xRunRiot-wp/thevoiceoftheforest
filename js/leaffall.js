// her ask 11-07: maple leaves drifting down behind the page while the Autumn Harvest theme is on.
// Only moved with transforms so phones stay smooth; never catches a tap (see .leaffall in site.css).
const COLORS = ['#d9661c', '#c0392b', '#f2b437', '#a0522d', '#e0702a'];
const LEAF = 'M12 1 14 6 17 4.5 16 9.5 20.5 8 19 11.5 22.5 13 17.5 16.5 18.5 19 13 18 12.6 23H11.4L11 18 5.5 19 6.5 16.5 1.5 13 5 11.5 3.5 8 8 9.5 7 4.5 10 6Z';
const img = (color) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${LEAF}' fill='${color}'/><path d='M12 21V6M12 14 7 10M12 14 17 10' fill='none' stroke='#5a2a10' stroke-opacity='.4' stroke-width='.7'/></svg>`)}")`;
const rnd = (a, b) => a + Math.random() * (b - a);

function build() {
  const box = document.createElement('div');
  box.className = 'leaffall'; box.setAttribute('aria-hidden', 'true');
  const count = window.innerWidth < 700 ? 12 : 18;
  for (let n = 0; n < count; n++) {
    const fall = rnd(11, 22);
    const leaf = document.createElement('i');
    // spread evenly across the width, with a little wobble, so they never bunch up on one side
    leaf.style.cssText = `left:${((n + rnd(0.1, 0.9)) / count * 100).toFixed(1)}%;--y:${rnd(4, 90).toFixed(0)}vh;animation-duration:${fall.toFixed(1)}s;animation-delay:-${rnd(0, fall).toFixed(1)}s`;
    const size = rnd(18, 34).toFixed(0);
    const sway = document.createElement('b');
    sway.style.cssText = `width:${size}px;height:${size}px;background-image:${img(COLORS[n % COLORS.length])};--drift:${rnd(30, 80).toFixed(0)}px;--turn:${rnd(50, 170).toFixed(0)}deg;animation-duration:${rnd(2.6, 5).toFixed(1)}s;animation-delay:-${rnd(0, 5).toFixed(1)}s`;
    leaf.append(sway); box.append(leaf);
  }
  return box;
}

export function setLeafFall(on) {
  if (!document.body) return;
  const cur = document.querySelector('.leaffall');
  if (on && !cur) document.body.prepend(build());
  else if (!on && cur) cur.remove();
}
