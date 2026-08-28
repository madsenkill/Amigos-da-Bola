// ============================================================
//  src/public.js
//  Página pública - visão dos jogadores.
//  Ranking, destaques, artilharia e filtro por mês.
// ============================================================
import { CONFIG } from './config.js'
import { db, initDB, getMode } from './db.js'
import { esc, formatarMes, formatarMoeda, mesAtual, mesDaData, mesesDeRodadas, diasAteProximaTerca } from './utils.js'
import { computarRanking, topArtilheiros, topCartoes, RESULTADO_LABEL } from './ranking.js'
import { avatar, emptyState, toast } from './ui.js'

/* ---------- estado ---------- */
const state = {
  jogadores: [],
  rodadas: [],
  mes: mesAtual(),
}

const els = {
  nomePelada: document.querySelector('[data-nome-pelada]'),
  subtitulo: document.querySelector('[data-subtitulo]'),
  seletorMes: document.getElementById('seletor-mes'),
  periodo: document.getElementById('periodo-ranking'),
  proximoJogo: document.getElementById('proximo-jogo'),
  destaques: document.getElementById('destaques'),
  ranking: document.getElementById('corpo-ranking'),
  estatisticas: document.getElementById('estatisticas'),
}

/* ---------- helpers ---------- */
const byId = (id) => state.jogadores.find(j => j.id === id)

function nomeDo(id) { return byId(id)?.nome || '—' }

/* ---------- Seletor de mês ---------- */
function montarSeletorMeses() {
  const meses = mesesDeRodadas(state.rodadas)
  const atual = mesAtual()
  if (!meses.includes(atual)) meses.unshift(atual)

  els.seletorMes.innerHTML = meses.map(m =>
    `<option value="${m}" ${m === state.mes ? 'selected' : ''}>${formatarMes(m)}</option>`).join('')

  els.seletorMes.addEventListener('change', () => {
    state.mes = els.seletorMes.value
    renderAll()
  })
}

/* ---------- Próximo jogo (countdown) ---------- */
function renderProximoJogo() {
  const dias = diasAteProximaTerca()
  const texto = dias === 0 ? 'É HOJE, TERRÃO!' : dias === 1 ? 'Amanhã tem pelada!' : `Faltam ${dias} dias`

  const rodadaFutura = state.rodadas.find(r => r.data > new Date().toISOString().slice(0, 10))
  const rodadaLabel = rodadaFutura ? `${rodadaFutura.titulo} · ${rodadaFutura.data.slice(8, 10)}/${rodadaFutura.data.slice(5, 7)}` : 'Vem aí'

  els.proximoJogo.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-amber-500/10 via-transparent to-emerald-500/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <span class="badge badge-amber mb-2">PRÓXIMA RODADA</span>
        <h2 class="font-display font-extrabold text-2xl sm:text-3xl text-white leading-tight">${esc(texto)}</h2>
        <p class="text-sm text-zinc-400 mt-1">${esc(CONFIG.SUBTITULO)} · <span class="text-amber-300/90 font-semibold">${esc(rodadaLabel)}</span></p>
      </div>
      <div class="flex items-center gap-2 text-3xl font-display font-extrabold text-amber-300/90" title="${dias} dia(s) restante(s)">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="text-amber-400"><circle cx="12" cy="12" r="9"/><path d="M12 7.5 14.2 10l.6-3.1L12 5l-2.8 1.9L9.8 10 12 7.5z" fill="currentColor" stroke="none"/></svg>
        ${dias === 0 ? 'HOJE' : `${dias}<span class="text-base text-zinc-500">dias</span>`}
      </div>
    </div>`
}

/* ---------- Destaques: Craque do Dia & Bola Murcha ---------- */
function renderDestaques() {
  const rodadasMes = state.rodadas.filter(r => mesDaData(r.data) === state.mes)
  const ultima = rodadasMes[rodadasMes.length - 1] || null

  if (!ultima) {
    els.destaques.innerHTML = `
      <div class="text-center py-6 text-zinc-500 text-sm">
        Nenhuma rodada lançada em ${esc(formatarMes(state.mes))}.
        <a href="/admin.html" class="text-amber-400 hover:underline">Lançar a primeira súmula →</a>
      </div>`
    return
  }

  const craque = byId(ultima.craque_id)
  const murcha = byId(ultima.bola_murcha_id)

  const cartao = (titulo, jogador, motivo, tipo, icone) => `
    <div class="card card-hover relative overflow-hidden ${tipo === 'craque' ? 'border-amber-500/30' : 'border-red-500/25'}">
      <div class="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none ${tipo === 'craque' ? 'bg-amber-500/15' : 'bg-red-500/10'}"></div>
      <div class="relative flex items-start gap-4">
        <div class="flex flex-col items-center gap-2 flex-none">
          ${avatar(jogador, 'lg').outerHTML}
          <span class="badge ${tipo === 'craque' ? 'badge-amber' : 'badge-red'}">${icone} ${titulo}</span>
        </div>
        <div class="min-w-0 pt-1">
          <h3 class="font-display font-bold text-lg text-white leading-tight">${jogador ? esc(jogador.nome) : '—'}</h3>
          <p class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">${jogador?.posicao || ''}</p>
          <p class="text-sm text-zinc-400 leading-relaxed">${motivo ? esc(motivo) : '<span class="text-zinc-600">Sem motivo registrado.</span>'}</p>
        </div>
      </div>
    </div>`

  els.destaques.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-display font-bold text-lg text-white">Destaques da Rodada</h2>
      <span class="text-xs text-zinc-500">${esc(ultima.titulo)} · ${esc(ultima.data.slice(8, 10))}/${esc(ultima.data.slice(5, 7))}/${esc(ultima.data.slice(0, 4))}</span>
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      ${cartao('Craque do Dia', craque, ultima.craque_motivo, 'craque', '★')}
      ${cartao('Bola Murcha', murcha, ultima.bola_murcha_motivo, 'murcha', '☆')}
    </div>`
}

/* ---------- Ranking ---------- */
function renderRanking() {
  const ranking = computarRanking(state.jogadores, state.rodadas, state.mes)
  els.periodo.textContent = formatarMes(state.mes)
  els.periodo.setAttribute('title', `Pontuação válida para ${formatarMes(state.mes)}`)

  if (!ranking.length) {
    els.ranking.innerHTML = emptyState(`Sem jogos em ${esc(formatarMes(state.mes))}. A tabela aparece após a primeira terça lançada.`)
    return
  }

  const medalhas = ['text-amber-400', 'text-zinc-300', 'text-amber-700']
  const nomeFantasia = (j) => j.nome.split(' ')[0]

  const linhas = ranking.map((l, i) => {
    const pos = i + 1
    const lider = pos === 1
    const medalha = pos <= 3
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" class="${medalhas[pos - 1]}"><path d="M12 2l2.5 5.1 5.6.8-4.05 4 .95 5.6L12 15l-5 2.5.95-5.6-4.05-4 5.6-.8z"/></svg>`
      : `<span class="font-display font-bold ${pos <= 3 ? 'text-white' : 'text-zinc-500'}">${pos}º</span>`

    return `
      <tr class="${lider ? 'row-lider' : ''}">
        <td class="!pl-2">${medalha}</td>
        <td>
          <div class="flex items-center gap-2.5">
            ${avatar(l.jogador, '').outerHTML}
            <div class="min-w-0">
              <span class="font-semibold text-white block truncate max-w-[160px]">${esc(nomeFantasia(l.jogador))}</span>
              <span class="text-[10px] text-zinc-500 block">${esc(l.jogador.posicao || '')}</span>
            </div>
          </div>
        </td>
        <td class="font-display font-extrabold text-lg ${lider ? 'text-amber-400' : 'text-white'}">${l.pontos}</td>
        <td class="text-zinc-400">${l.jogos}</td>
        <td class="text-zinc-400">${l.vitorias}</td>
        <td class="text-zinc-400">${l.empates}</td>
        <td class="text-zinc-400">${l.derrotas}</td>
        <td class="text-zinc-300 font-medium">${l.gols}</td>
        <td class="text-yellow-200/90">${l.amarelos || ''}</td>
        <td class="text-red-300/90">${l.vermelhos || ''}</td>
      </tr>`
  }).join('')

  els.ranking.innerHTML = `
    <table class="tbl">
      <thead>
        <tr>
          <th class="!pl-2">#</th>
          <th>Jogador</th>
          <th>Pts</th>
          <th>Jogos</th>
          <th>V</th>
          <th>E</th>
          <th>D</th>
          <th>Gols</th>
          <th>Amarelo</th>
          <th>Vermelho</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`
}

/* ---------- Artilharia & cartões ---------- */
function renderEstatisticas() {
  const ranking = computarRanking(state.jogadores, state.rodadas, state.mes)
  const artilheiros = topArtilheiros(ranking, 3)
  const cartoeses = topCartoes(ranking, 3)

  const medalha = ['1', '2', '3']

  const cardArtilheiro = (l, i) => l ? `
    <div class="card card-hover flex items-center gap-3">
      <span class="font-display font-extrabold text-2xl ${i === 0 ? 'text-amber-400' : 'text-zinc-600'} w-8">${medalha[i]}</span>
      ${avatar(l.jogador, '').outerHTML}
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-white truncate">${esc(l.jogador.nome.split(' ')[0])}</p>
        <p class="text-[11px] text-zinc-500">${esc(l.jogador.posicao || '')}</p>
      </div>
      <div class="text-right">
        <p class="font-display font-extrabold text-xl text-neon-soft leading-none">${l.gols}</p>
        <p class="text-[10px] text-zinc-500">gols</p>
      </div>
    </div>` : `<div class="card">${emptyState('Sem gols ainda').innerHTML}</div>`

  const cardCartao = (l, i) => l ? `
    <div class="card card-hover flex items-center gap-3">
      <span class="font-display font-extrabold text-2xl ${i === 0 ? 'text-red-400' : 'text-zinc-600'} w-8">${medalha[i]}</span>
      ${avatar(l.jogador, '').outerHTML}
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-white truncate">${esc(l.jogador.nome.split(' ')[0])}</p>
        <p class="text-[11px] text-zinc-500">${esc(l.jogador.posicao || '')}</p>
      </div>
      <div class="flex items-center gap-1">
        ${l.amarelos ? `<span class="inline-block w-2.5 h-4 rounded-[2px] bg-yellow-400" title="${l.amarelos} amarelos"></span>` : ''}
        ${l.vermelhos ? `<span class="inline-block w-2.5 h-4 rounded-[2px] bg-red-500" title="${l.vermelhos} vermelhos"></span>` : ''}
        <span class="font-display font-extrabold text-lg text-red-300 ml-1">${l.amarelos + l.vermelhos * 2}</span>
      </div>
    </div>` : `<div class="card">${emptyState('Ninguém foi punido ainda').innerHTML}</div>`

  els.estatisticas.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-4">
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h3 class="font-display font-bold text-white flex items-center gap-2">
            <span class="text-emerald-400 inline-grid place-items-center w-7 h-7 rounded-lg bg-emerald-400/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5 14.2 10l.6-3.1L12 5l-2.8 1.9L9.8 10 12 7.5z" fill="currentColor" stroke="none"/></svg>
            </span>
            Artilharia do Mês
          </h3>
        </div>
        <div class="space-y-2.5">${artilheiros.map(cardArtilheiro).join('')}</div>
      </div>
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h3 class="font-display font-bold text-white flex items-center gap-2">
            <span class="text-yellow-300 inline-grid place-items-center w-7 h-7 rounded-lg bg-yellow-300/10">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4" stroke="#241503" stroke-width="2"/></svg>
            </span>
            Ranking de Cartões
          </h3>
        </div>
        <div class="space-y-2.5">${cartoeses.map(cardCartao).join('')}</div>
      </div>
    </div>`
}

/* ---------- render ---------- */
function renderAll() {
  renderProximoJogo()
  renderDestaques()
  renderRanking()
  renderEstatisticas()
}

/* ---------- init ---------- */
async function init() {
  try {
    await initDB()
  } catch (e) {
    console.error(e)
    toast('Erro ao carregar os dados. Verifique o console.', 'err')
  }

  const [jogadores, rodadas] = await Promise.all([db.getJogadores(), db.getRodadas()])
  state.jogadores = jogadores
  state.rodadas = rodadas

  // Ajusta o filtro: se o mês selecionado não tiver rodadas, vai para o último mês com rodadas
  const meses = mesesDeRodadas(rodadas)
  if (meses.length && !meses.includes(state.mes)) state.mes = meses[0]
  if (meses.length === 0) state.mes = mesAtual()

  els.nomePelada.textContent = CONFIG.NOME_PELADA
  els.subtitulo.textContent = CONFIG.SUBTITULO

  montarSeletorMeses()
  renderAll()
}

init()
