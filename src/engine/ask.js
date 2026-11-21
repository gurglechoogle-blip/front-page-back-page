// An in-game yes/no box, instead of the browser's own pop-up.
export function ask(text, yes = 'Yes', no = 'No') {
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'modal askbox';
    d.innerHTML = `<div class="mbox"><p class="evtext">${text.replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]))}</p><div class="endBtns"><button class="btn red" data-a="1">${yes}</button><button class="btn" data-a="0">${no}</button></div></div>`;
    document.body.appendChild(d);
    d.querySelectorAll('[data-a]').forEach(b => b.onclick = e => { e.stopPropagation(); d.remove(); res(b.dataset.a === '1'); });
  });
}
