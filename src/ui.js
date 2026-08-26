// src/ui.js
import { formatMonthYear, formatCurrency, formatDate } from './utils.js';

export function renderHeaderDate(date) {
  const el = document.getElementById('current-month-display');
  if (el) {
    el.textContent = formatMonthYear(date);
  }
}

export function renderBadge(text, type = 'default') {
  const badge = document.createElement('span');
  badge.className = `badge badge-${type}`;
  badge.textContent = text;
  return badge;
}

export function renderHighlightCard(containerId, title, badgeText, badgeType, player, note, emptyMsg) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!player) {
    container.innerHTML = `
      <div class="highlight-card empty">
        <h3>${title}</h3>
        <p>${emptyMsg}</p>
      </div>
    `;
    return;
  }

  // CORREÇÃO AQUI: Em vez de usar renderBadge() dentro do template string, 
  // geramos a classe do badge diretamente em texto HTML.
  const badgeClass = `badge badge-${badgeType}`;

  container.innerHTML = `
    <div class="highlight-card flex items-start gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-lg shrink-0">
        ${player.name ? player.name.substring(0, 2).toUpperCase() : '??'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="${badgeClass}">${badgeText}</span>
          <h4 class="font-semibold text-zinc-100 truncate">${player.name}</h4>
        </div>
        <p class="text-xs text-zinc-400 capitalize mb-1">${player.position || 'Jogador'}</p>
        <p class="text-xs text-zinc-300 italic bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
          "${note || 'Sem observações para a rodada.'}"
        </p>
      </div>
    </div>
  `;
}

export function renderRankingTable(containerId, players) {
  const tbody = document.getElementById(containerId);
  if (!tbody) return;

  if (!players || players.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-6 text-zinc-500">
          Nenhum jogador cadastrado ou sem partidas no período.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = players.map((p, index) => {
    const isLeader = index === 0 && p.points > 0;
    const posBadge = isLeader 
      ? `<span class="inline-flex items-center justify-center w-6 h-6 bg-amber-500 text-zinc-950 font-bold text-xs rounded-full">1º</span>`
      : `<span class="text-zinc-500 text-xs font-semibold">${index + 1}º</span>`;

    const initials = p.name ? p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';

    return `
      <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${isLeader ? 'bg-amber-500/5' : ''}">
        <td class="py-3 px-3 text-center">${posBadge}</td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold text-xs shrink-0 border border-zinc-700">
              ${initials}
            </div>
            <div>
              <div class="font-medium text-sm text-zinc-200 flex items-center gap-1">
                ${p.name}
                ${isLeader ? '⭐' : ''}
              </div>
              <div class="text-[10px] text-zinc-500 capitalize">${p.position || 'Jogador'}</div>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 text-center font-bold text-amber-500 text-base">${p.points}</td>
        <td class="py-3 px-3 text-center text-zinc-300 text-sm">${p.matches}</td>
        <td class="py-3 px-3 text-center text-zinc-400 text-sm">${p.wins}</td>
        <td class="py-3 px-3 text-center text-zinc-400 text-sm">${p.draws}</td>
        <td class="py-3 px-3 text-center text-zinc-400 text-sm">${p.losses}</td>
        <td class="py-3 px-3 text-center font-semibold text-zinc-200 text-sm">${p.goals}</td>
        <td class="py-3 px-3 text-center text-amber-400 text-sm">${p.yellowCards}</td>
        <td class="py-3 px-3 text-center text-red-400 text-sm">${p.redCards}</td>
      </tr>
    `;
  }).join('');
}

export function renderMiniRanking(containerId, items, valueKey, valueSuffix = '', badgeColor = 'amber') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `<p class="text-xs text-zinc-500 text-center py-4">Nenhum dado registrado.</p>`;
    return;
  }

  container.innerHTML = items.slice(0, 3).map((item, index) => {
    const initials = item.name ? item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    return `
      <div class="flex items-center justify-between p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800/60">
        <div class="flex items-center gap-2.5">
          <span class="text-xs font-bold text-zinc-500 w-4">${index + 1}</span>
          <div class="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-[10px] border border-zinc-700">
            ${initials}
          </div>
          <div>
            <p class="text-xs font-semibold text-zinc-200">${item.name}</p>
            <p class="text-[10px] text-zinc-500 capitalize">${item.position || 'Jogador'}</p>
          </div>
        </div>
        <div class="text-xs font-bold text-${badgeColor}-500">
          ${item[valueKey]} <span class="text-[10px] text-zinc-500 font-normal">${valueSuffix}</span>
        </div>
      </div>
    `;
  }).join('');
}