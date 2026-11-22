// Fame and Money pop-ups for Step 8: social media, community, staff, business.
// H: { c, age, modal, closeModal, toast, save, render, root }
import { esc } from '../engine/util.js';
import { L3, postedThisWeek, postOptions, post, sponsored, community, hire, fire, hasStaff, launchMerch, invest, cashOutInvestment } from '../sim/fame.js';
import { applyEffects } from '../sim/life.js';

const money = n => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
const box = H => H.root.querySelector("#modal") || H.root;
const q = (H, s) => box(H).querySelector(s), qa = (H, s) => box(H).querySelectorAll(s);
const k = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'm' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : n;

export function showSocial(H) {
  const c = H.c, done = postedThisWeek(c), opts = postOptions(c), late = c.weekLog.some(x => x.t === 'night');
  H.modal(`<h2>Social media</h2><div class="row"><span>Followers</span><b>${k(c.followers)}</b></div>
    ${done ? '<p class="dim">You\'ve posted this week. Put the phone down.</p>' : `<h3>${late ? 'Post something (it\'s 3am and you\'ve had a few)' : 'Post something'}</h3><div class="choices">${opts.map((p, i) => `<button class="btn choice" data-p="${i}">${esc(p.text)} <small>${p.tone}</small></button>`).join('')}</div>
    ${c.followers >= 5000 ? `<h3>Sponsored posts</h3><div class="choices">${L3.sponsors.map(s => `<button class="btn choice" data-s="${s.id}">#ad ${esc(s.name)} <small>${money(c.followers * s.per)}</small></button>`).join('')}</div>` : '<p class="dim">Brands come knocking at 5,000 followers.</p>'}`}
    <h3>Recent posts</h3><div class="chatlog">${c.posts.slice(0, 8).map(p => `<div class="cm me">${esc(p.text)}<br><small>❤ ${k(p.likes)}</small></div>`).join('') || '<p class="dim">Nothing yet.</p>'}</div>`);
  qa(H, '[data-p]').forEach(b => b.onclick = () => { const g = post(c, +b.dataset.p); H.save(); H.render(); H.closeModal(); H.toast(`Posted. +${k(g)} followers.`); });
  qa(H, '[data-s]').forEach(b => b.onclick = () => { const v = sponsored(c, b.dataset.s); H.save(); H.render(); H.closeModal(); H.toast(`Ker-ching: ${money(v)}.`); });
}
export function showTroll(H, next) {
  const c = H.c;
  H.modal(`<div class="evvia">📱 Notifications</div><h2>The trolls are out</h2><p class="evtext">"@${esc(c.name)} my nan could've scored that. and she's DEAD" (and 3,000 more like it)</p><div class="choices">${L3.trollReplies.map((r, i) => `<button class="btn choice" data-t="${i}">${esc(r[0])}</button>`).join('')}${hasStaff(c, 'pr') ? '<button class="btn choice" data-t="pr">Hand the account to your PR manager</button>' : ''}</div>`, true);
  qa(H, '[data-t]').forEach(b => b.onclick = () => { if (b.dataset.t === 'pr') { applyEffects(c, { honour: 1 }); H.toast('Your PR manager posts a heartfelt statement. Nobody believes you wrote it. Nobody minds.'); } else { const r = L3.trollReplies[+b.dataset.t]; applyEffects(c, r[2]); H.toast(r[1]); } H.save(); H.render(); next(); });
}
export function showCommunity(H) {
  const c = H.c;
  H.modal(`<h2>Community & charity</h2><p class="dim">${c.redeeming > 0 ? `Your pledge is running: honour counts double for ${c.redeeming} more weeks.` : 'Takes a day or two. Honest, slow, safe.'} Events attended: ${c.charity}.</p><div class="scroll shop">${L3.community.map(a => { const why = H.slotsLeft() < a.slots ? 'Not enough slots' : c.bank < a.cost ? 'Can\'t afford it' : a.flag && c.flags[a.flag] ? 'Done' : null; return `<div class="item"><div><b>${esc(a.label)}</b><span class="price">${a.cost ? money(a.cost) + ' · ' : ''}${a.slots} slot${a.slots > 1 ? 's' : ''}</span><p>${esc(a.blurb)}</p></div><button class="btn small gold" data-a="${a.id}" ${why ? 'disabled' : ''}>${why || 'Do it'}</button></div>`; }).join('')}</div>`);
  qa(H, '[data-a]').forEach(b => b.onclick = () => { const r = community(c, b.dataset.a); H.save(); H.render(); H.closeModal(); H.toast(r.ok ? r.line : r.why); });
}
export function showInvite(H, next) {
  const c = H.c, a = L3.community[Math.floor(Math.random() * 4)];
  H.modal(`<div class="evvia">💌 Invitation</div><h2>${esc(a.label)}</h2><p class="evtext">They'd love you to come along this week. Saying no will be noticed.</p><div class="choices"><button class="btn choice" id="yes" ${H.slotsLeft() <= 0 ? 'disabled' : ''}>Go (takes your day)</button><button class="btn choice" id="no">Politely decline</button></div>`, true);
  q(H, '#yes').onclick = () => { community(c, a.id); H.save(); H.render(); H.toast(a.blurb); next(); };
  q(H, '#no').onclick = () => { applyEffects(c, { honour: -2 }); H.save(); H.render(); H.toast('"Too busy," says the local paper. Honour -2.'); next(); };
}
export function showStaff(H) {
  const c = H.c;
  H.modal(`<h2>Staff</h2><p class="dim">Each costs a weekly wage, gives a real bonus, and has quirks.</p><div class="scroll shop">${L3.staff.map(s => { const has = hasStaff(c, s.id); return `<div class="item ${has ? 'owned' : ''}"><div><b>${esc(s.name)}</b><span class="price">${money(s.wage)}/wk</span><p>${esc(s.perk)}. <i>Risk: ${esc(s.oops.split('.')[0].toLowerCase())}.</i></p></div><button class="btn small ${has ? 'red' : 'gold'}" data-s="${s.id}" ${!has && c.contract.wage < s.wage * 2 ? 'disabled' : ''}>${has ? 'Let go' : c.contract.wage < s.wage * 2 ? 'Can\'t afford' : 'Hire'}</button></div>`; }).join('')}</div>`);
  qa(H, '[data-s]').forEach(b => b.onclick = () => { hasStaff(c, b.dataset.s) ? fire(c, b.dataset.s) : hire(c, b.dataset.s); H.save(); H.render(); showStaff(H); });
}
export function showBusiness(H) {
  const c = H.c, m = c.business.merch;
  H.modal(`<h2>Businesses & merch</h2><div class="scroll">
    <h3>Your merch line</h3>${m ? `<div class="row"><span>Status</span><b>${m.closed ? 'Closed (the garage is full)' : 'Trading'}</b></div><div class="row"><span>Profit so far</span><b>${money(m.profit)}</b></div>${!m.closed ? `<div class="endBtns"><button class="btn gold" id="work" ${H.slotsLeft() <= 0 ? 'disabled' : ''}>Put in a shift on it (a slot)</button></div>` : ''}` :
      `<p class="dim">Your face on hoodies, mugs and slippers. Sales follow your followers and your fans.</p><div class="shop">${L3.merchSuppliers.map(s => `<div class="item"><div><b>${esc(s.label)}</b><span class="price">${money(s.cost)}</span></div><button class="btn small gold" data-mx="${s.id}" ${c.bank < s.cost ? 'disabled' : ''}>Launch</button></div>`).join('')}</div>`}
    <h3>Investments</h3>${c.business.inv.map((v, i) => { const I = L3.investments.find(x => x.id === v.id); return `<div class="item"><div><b>${esc(I.label.replace("[Name]", c.name.split(" ").pop()))}</b><span class="price">put in ${money(v.amount)} · now ${money(v.value)}</span></div><button class="btn small" data-x="${i}">Cash out</button></div>`; }).join('')}
    <div class="shop">${L3.investments.map(I => { const lock = I.needs && (c.friends[I.needs] || {}).loyalty < 55 ? `Get closer to ${I.needs === 'priya' ? 'Priya' : 'Big Lee'} first` : c.bank < I.min ? 'Can\'t afford it' : null; return `<div class="item"><div><b>${esc(I.label.replace("[Name]", c.name.split(" ").pop()))}</b><span class="price">from ${money(I.min)}</span></div><button class="btn small gold" data-i="${I.id}" ${lock ? 'disabled' : ''}>${lock || 'Invest ' + money(I.min)}</button></div>`; }).join('')}</div></div>`);
  if (q(H, '#work')) q(H, '#work').onclick = () => { c.slotsUsed++; c.weekLog.push({ t: 'merch' }); H.save(); H.render(); H.closeModal(); H.toast('You spend the day signing hoodies and arguing about fonts.'); };
  qa(H, "[data-mx]").forEach(b => b.onclick = () => { const r = launchMerch(c, b.dataset.mx); H.save(); H.render(); showBusiness(H); H.toast(r.ok ? 'Launched! First order: 400 hoodies.' : r.why); });
  qa(H, '[data-i]').forEach(b => b.onclick = () => { const I = L3.investments.find(x => x.id === b.dataset.i); const r = invest(c, I.id, I.min); H.save(); H.render(); showBusiness(H); H.toast(r.ok ? 'Invested.' : r.why); });
  qa(H, '[data-x]').forEach(b => b.onclick = () => { const v = cashOutInvestment(c, +b.dataset.x); H.save(); H.render(); showBusiness(H); H.toast(`Cashed out: ${money(v)}.`); });
}
