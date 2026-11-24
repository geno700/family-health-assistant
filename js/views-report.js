// Report for the doctor (#/report/:personId): one printable page with a person's details,
// current and stopped medicines, what was taken / skipped / not recorded in the last 14 days,
// upcoming appointments and the papers kept in the app. It lists what the family recorded and
// counts it; it never judges or advises. "Print" uses the phone's print dialog (or save as PDF).

import { t, ltr, joinList, countWords, dateLong } from './i18n.js';
import * as store from './store.js';
import { isoDate, addDays, dosesOn, medTitle, doseLine, howOften, hhmm, parseDate } from './doses.js';
import { esc, icon, emptyState } from './ui.js';
import { age } from './views-family.js';
import { isPast } from './views-appts.js';

const DAYS = 14;

/** Planned doses from the last 14 days up to now, and how each one went. */
export function doseCounts(med, logs, nowMs) {
  const byKey = new Map(logs.filter((l) => l.medicineId === med.id).map((l) => [l.scheduledAt, l]));
  const today = isoDate(new Date(nowMs));
  const out = { taken: 0, skipped: 0, unrecorded: 0 };
  for (let i = DAYS - 1; i >= 0; i--) {
    for (const d of dosesOn(med, addDays(today, -i))) {
      if (d.at > nowMs || (med.createdAt && d.at < med.createdAt - 60000)) continue;
      const s = byKey.get(d.at)?.status;
      if (s === 'TAKEN') out.taken += 1;
      else if (s === 'SKIPPED') out.skipped += 1;
      else out.unrecorded += 1;
    }
  }
  return out;
}

export function render(main, params) {
  const [personId] = params;
  const draw = () => {
    const p = store.person(personId);
    if (!p) { main.innerHTML = `<section class="page">${emptyState('family', t('no_results'), '')}</section>`; return; }
    const now = Date.now();
    const since = now - DAYS * 86400000;
    const all = store.meds().filter((m) => m.personId === personId);
    const current = store.currentMeds(personId, now);
    const stopped = all.filter((m) => !current.includes(m));
    const scheduled = current.filter((m) => m.scheduleType !== 'AS_NEEDED');
    const logs = store.logs();
    const appts = store.appts().filter((a) => a.personId === personId && !isPast(a, now));
    const papers = store.papers().filter((x) => x.personId === personId);
    const years = age(p.birthYear);
    const day = (iso) => (iso ? dateLong(parseDate(iso).getTime()) : '');
    const none = `<p class="muted">${esc(t('report_none'))}</p>`;

    main.innerHTML = `
      <section class="page report">
        <div class="no-print row-between">
          <a class="back" href="#/family/${esc(personId)}">${esc(t('back'))}</a>
        </div>
        <button class="btn btn-primary btn-big no-print" id="print">${icon('print')}${esc(t('print_report'))}</button>
        <header class="report-head">
          <h1 class="flat">${esc(t('report_title', p.name))}</h1>
          <div class="muted">${esc(t('report_made', `${dateLong(now)} ${hhmm(now)}`))}</div>
        </header>

        <h2>${esc(t('report_details'))}</h2>
        <dl class="report-dl">
          ${years != null ? `<dt>${esc(t('em_age'))}</dt><dd>${esc(t('age_years', years))}${p.birthYear ? ` (${esc(p.birthYear)})` : ''}</dd>` : ''}
          <dt>${esc(t('em_blood'))}</dt><dd>${p.bloodType ? esc(ltr(p.bloodType)) : esc(t('unknown'))}</dd>
          <dt>${esc(t('em_allergies'))}</dt><dd class="${(p.allergies || []).length ? 'danger-text strong' : ''}">${(p.allergies || []).length ? esc(joinList(p.allergies.map(ltr))) : esc(t('em_no_allergies'))}</dd>
          <dt>${esc(t('em_conditions'))}</dt><dd>${(p.conditions || []).length ? esc(joinList(p.conditions)) : esc(t('report_none'))}</dd>
          ${p.contactPhone ? `<dt>${esc(t('report_contact'))}</dt><dd>${esc(p.contactName || '')} ${esc(ltr(p.contactPhone))}</dd>` : ''}
        </dl>

        <h2>${esc(t('report_meds'))}</h2>
        ${current.length ? `<ul class="report-list">${current.map((m) => `
          <li><span class="strong">${esc(medTitle(m))}</span><br>
            ${esc(doseLine(m))} • ${esc(howOften(m))}<br>
            <span class="muted">${esc([m.startDate ? t('report_since', day(m.startDate)) : '', m.endDate ? t('report_until', day(m.endDate)) : ''].filter(Boolean).join(' • '))}</span></li>`).join('')}</ul>` : none}

        ${stopped.length ? `<h2>${esc(t('report_stopped'))}</h2>
          <ul class="report-list">${stopped.map((m) => `<li><span class="strong">${esc(medTitle(m))}</span> — ${esc(doseLine(m))}
            ${m.endDate ? `<span class="muted"> • ${esc(t('report_until', day(m.endDate)))}</span>` : ''}</li>`).join('')}</ul>` : ''}

        <h2>${esc(t('report_doses'))}</h2>
        ${scheduled.length ? `<table class="report-table">
          <thead><tr><th>${esc(t('report_med'))}</th><th>${esc(t('report_taken'))}</th><th>${esc(t('report_skipped'))}</th><th>${esc(t('report_unrecorded'))}</th></tr></thead>
          <tbody>${scheduled.map((m) => { const c = doseCounts(m, logs, now); return `<tr><td>${esc(medTitle(m))}</td><td>${c.taken}</td><td>${c.skipped}</td><td>${c.unrecorded}</td></tr>`; }).join('')}</tbody>
        </table>` : none}
        ${current.filter((m) => m.scheduleType === 'AS_NEEDED').map((m) => {
          const n = logs.filter((l) => l.medicineId === m.id && l.status === 'TAKEN' && l.scheduledAt >= since).length;
          return `<p><span class="strong">${esc(medTitle(m))}</span> — ${esc(t('report_as_needed', countWords(n, 'TIME')))}</p>`;
        }).join('')}

        <h2>${esc(t('report_appts'))}</h2>
        ${appts.length ? `<ul class="report-list">${appts.map((a) => `<li><span class="strong">${esc(a.name)}</span> — ${esc(dateLong(a.at))} ${esc(ltr(hhmm(a.at)))}${a.place ? ` • ${esc(a.place)}` : ''}</li>`).join('')}</ul>` : none}

        <h2>${esc(t('report_papers'))}</h2>
        ${papers.length ? `<ul class="report-list">${papers.map((x) => `<li><span class="strong">${esc(x.title)}</span> — ${esc([t(`pk_${x.kind}`), day(x.date), x.doctor].filter(Boolean).join(' • '))}</li>`).join('')}</ul>` : none}

        <p class="hint report-foot">${esc(t('report_footer'))}</p>
      </section>`;
    main.querySelector('#print').onclick = () => window.print();
  };
  draw();
  return store.onChange(draw);
}
