// Emergency cards: #/emergency (pick a person) and #/emergency/:personId (one card).
// Every role sees the cards of the people it can see. The same screen also opens with no
// internet, from the copy kept on this device (store.readEmergencyCopy), so it works from
// plain card objects, never from the live store directly.

import { t, ltr, joinList, dateLong } from './i18n.js';
import { medTitle, doseLine, howOften, hhmm } from './doses.js';
import { esc, icon, toast, copyText, plain } from './ui.js';
import { age, personColor } from './views-family.js';

/**
 * cards: from store.emergencyCards() or the offline copy.
 * offlineAt: when the offline copy was saved (null when online). backHref: where "back" goes.
 */
export function render(main, params, { cards, offlineAt = null, backHref = '#/today' }) {
  const [id] = params;
  const offline = offlineAt ? `<div class="card notice">${esc(t('em_offline', `${dateLong(offlineAt)} ${ltr(hhmm(offlineAt))}`))}</div>` : '';
  const ambulance = `<a class="btn btn-danger btn-big" href="tel:123">${icon('phone')}${esc(t('call_ambulance'))}</a>`;

  if (!cards || cards.length === 0) {
    main.innerHTML = `<section class="page"><a class="back" href="${esc(backHref)}">${esc(t('back'))}</a>
      <h1>${esc(t('emergency_title'))}</h1>${offline}<p class="muted">${esc(t('em_none'))}</p>${ambulance}</section>`;
    return;
  }

  const card = id ? cards.find((c) => c.id === id) : (cards.length === 1 ? cards[0] : null);
  if (!card) {
    main.innerHTML = `
      <section class="page">
        <a class="back" href="${esc(backHref)}">${esc(t('back'))}</a>
        <h1>${esc(t('emergency_title'))}</h1>
        ${offline}
        <p class="muted">${esc(t('emergency_pick'))}</p>
        ${cards.map((c) => `
          <a class="card row link" href="#/emergency/${esc(c.id)}">
            <span class="avatar" style="background:${personColor(c.color)}">${esc((c.name || '?').trim().charAt(0))}</span>
            <div class="grow"><div class="strong">${esc(c.name)}</div>
              ${c.allergies.length ? `<div class="danger-text small">${esc(t('allergy_line', joinList(c.allergies.map(ltr))))}</div>` : ''}</div>
            <span class="chev" aria-hidden="true">›</span></a>`).join('')}
        ${ambulance}
        <p class="hint">${esc(t('em_saved_note'))}</p>
      </section>`;
    return;
  }

  const years = age(card.birthYear);
  main.innerHTML = `
    <section class="page">
      <a class="back" href="${cards.length > 1 ? '#/emergency' : esc(backHref)}">${esc(t('back'))}</a>
      ${offline}
      <article class="card em-card">
        <div class="em-head">${icon('alert')}<span>${esc(t('emergency_card'))}</span></div>
        <h1 class="flat em-name">${esc(card.name)}</h1>
        <div class="em-facts">
          <div><div class="muted small">${esc(t('em_age'))}</div><div class="strong">${years != null ? esc(t('age_years', years)) : '—'}</div></div>
          <div><div class="muted small">${esc(t('em_blood'))}</div><div class="strong">${card.bloodType ? esc(ltr(card.bloodType)) : esc(t('unknown'))}</div></div>
        </div>
        <div class="em-box ${card.allergies.length ? 'em-danger' : ''}">
          <div class="strong">${esc(t('em_allergies'))}</div>
          <div>${card.allergies.length ? esc(joinList(card.allergies.map(ltr))) : esc(t('em_no_allergies'))}</div>
        </div>
        ${card.conditions.length ? `<div class="em-box"><div class="strong">${esc(t('em_conditions'))}</div><div>${esc(joinList(card.conditions))}</div></div>` : ''}
        <div class="em-box">
          <div class="strong">${esc(t('em_meds'))}</div>
          ${card.meds.length ? `<ul class="em-meds">${card.meds.map((m) => `<li><span class="strong">${esc(medTitle(m))}</span>
            <span class="muted"> — ${esc(doseLine(m))} • ${esc(howOften(m))}</span></li>`).join('')}</ul>` : `<div>${esc(t('em_no_meds'))}</div>`}
        </div>
        ${card.contactPhone ? `<div class="em-box"><div class="strong">${esc(t('em_contact'))}</div>
          <div>${esc(card.contactName || '')} ${esc(ltr(card.contactPhone))}</div></div>` : ''}
      </article>
      ${ambulance}
      ${card.contactPhone ? `<a class="btn btn-secondary btn-big" href="tel:${esc(card.contactPhone)}">${icon('phone')}${esc(t('call_contact', card.contactName || ltr(card.contactPhone)))}</a>` : ''}
      <button class="btn btn-secondary" id="share">${icon('share')}${esc(t('em_share'))}</button>
    </section>`;

  main.querySelector('#share').onclick = async () => {
    const text = cardText(card);
    if (navigator.share) {
      try { await navigator.share({ title: t('emergency_card'), text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    if (await copyText(text)) toast(t('em_copied'));
  };
}

/** The card as plain text, for WhatsApp or SMS. */
function cardText(c) {
  const years = age(c.birthYear);
  return [
    `${t('emergency_card')}: ${c.name}`,
    years != null ? `${t('em_age')}: ${t('age_years', years)}` : '',
    `${t('em_blood')}: ${c.bloodType || t('unknown')}`,
    `${t('em_allergies')}: ${c.allergies.length ? joinList(c.allergies) : t('em_no_allergies')}`,
    c.conditions.length ? `${t('em_conditions')}: ${joinList(c.conditions)}` : '',
    `${t('em_meds')}:`,
    ...(c.meds.length ? c.meds.map((m) => `- ${plain(medTitle(m))}: ${plain(doseLine(m))} • ${plain(howOften(m))}`) : [t('em_no_meds')]),
    c.contactPhone ? `${t('em_contact')}: ${c.contactName || ''} ${c.contactPhone}` : '',
  ].filter(Boolean).join('\n');
}
