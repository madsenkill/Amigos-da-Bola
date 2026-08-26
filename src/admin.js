// ============================================================
//  src/admin.js
//  Painel administrativo - 4 abas:
//   1. Súmula  (lançar rodada / editar rodadas)
//   2. Jogadores (CRUD + observações internas)
//   3. Financeiro (mensalidades + caixa)
//   4. Demandas (kanban da diretoria)
// ============================================================
import { CONFIG } from './config.js'
import { db, initDB } from './db.js'
import {
  uid, esc, formatarDataCurta, formatarMes, formatarMoeda,
  mesAtual, mesDaData, parseMoeda, proximaTercaISO,
} from './utils.js'
import { resultadoDePlacar, RESULTADO_LABEL } from './ranking.js'
import { avatar, emptyState, multiSelect, openModal, toast } from './ui.js'

/* ------------------------------------------------------------
   Estado global
------------------------------------------------------------ */
const state = {
  jogadores: [],
  rodadas: [],
  mensalidades: [],
  caixa: [],
  demandas: [],
  rodadaEditando: null,
  mesMensalidades: mesAtual(),
  mesCaixa: mesAtual(),
  demandaEditando: null,
}

/* ------------------------------------------------------------
   Elementos
------------------------------------------------------------ */
const $ = (s) => document.querySelector(s)
const els = {
  // súmula
  fData: $('#f-data'),
  fTitulo: $('#f-titulo'),
  partidasContainer: $('#partidas-container'),
  statsContainer: $('#stats-container'),
  fCraque: $('#f-craque'),
  fCraqueMotivo: $('#f-craque-motivo'),
  fMurcha: $('#f-murcha'),
  fMurchaMotivo: $('#f-murcha-motivo'),
  btnSalvarRodada: $('#btn-salvar-rodada'),
  labelBtnRodada: $('#label-btn-rodada'),
  badgeEditando: $('#badge-editando-rodada'),
  btnAddPartida: $('#btn-add-partida'),
  btnLimpar: $('#btn-limpar-rodada'),
  listaRodadas: $('#lista-rodadas'),
  qtdRodadas: $('#qtd-rodadas'),
  // jogadores
  buscaJogadores: $('#busca-jogadores'),
  corpoJogadores: $('#corpo-jogadores'),
  // financeiro
  mesMensalidadesSel: $('#mes-mensalidades'),
  corpoMensalidades: $('#corpo-mensalidades'),
  mesCaixaSel: $('#mes-caixa'),
  corpoCaixa: $('#corpo-caixa'),
  cardsCaixa: $('#cards-caixa'),
  formCaixa: $('#form-caixa'),
  // demandas
  formDemanda: $('#form-demanda'),
  kanban: $('#kanban'),
  badgeDemandas: $('#badge-demandas-abertas'),
}

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */
const byId = (id) => state.jogadores.find(j => j.id === id)
const ativos = () => state.jogadores.filter(j => j.ativo !== false)
const num = (v) => { const n = parseInt(v); return isNaN(n) ? 0 : n }

const CATEGORIA_LABEL = { quadra: 'Quadra', colete: 'Colete', bola: 'Bola', mensalidade: 'Mensalidade', outros: 'Outros' }
const PRIORIDADE_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
const PRIORIDADE_COR = { alta: 'badge-red', media: 'badge-amber', baixa: 'badge-gray' }
const RESULTADO_COR = { VITORIA: 'badge-green', EMPATE: 'badge-amber', DERROTA: 'badge-red' }

/** Seta options de um <select> preservando o valor atual. */
function setSelectOptions(sel, options, placeholder) {
  const atual = sel.value
  sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') + options
  if ([...sel.options].some(o => o.value === atual)) sel.value = atual
  else sel.value = ''
}

/** Preenche os selects de destaque com jogadores ativos. */
function preencherSelectsDestaque() {
  const opts = ativos().map(j => `<option value="${j.id}">${esc(j.nome)}</option>`).join('')
  setSelectOptions(els.fCraque, opts, 'Selecionar craque...')
  setSelectOptions(els.fMurcha, opts, 'Selecionar bola murcha...')
}

/** Sincroniza as opções dos multi-selects da súmula (após CRUD de jogador). */
function sincronizarOptionsSumula() {
  sumula.partidas.forEach(p => {
    p.timeA.setOptions(ativos())
    p.timeB.setOptions(ativos())
  })
}

/* ============================================================
   ABA 1 - SÚMULA
============================================================ */
const sumula = {
  partidas: [], // { id, row, timeA, timeB, golsA, golsB }
}
const statsValores = new Map() // `${partidaId}:${jogadorId}` -> { gols, amarelos, vermelhos }

/** Adiciona uma linha de partida ao formulário. */
function addPartidaRow(inicial = {}) {
  const row = document.createElement('div')
  row.className = 'partida-row'
  row.innerHTML = `
    <div class="card !bg-panel-2/50 !p-4 space-y-3">
      <div class="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div>
          <span class="label !mb-2">Time A</span>
          <div class="ms-a"></div>
        </div>
        <div class="flex items-center justify-center gap-2 pb-1">
          <input type="number" min="0" max="30" data-gols-a class="input !w-16 !px-1 !py-2 text-center font-display font-bold" value="${num(inicial.gols_a)}" />
          <span class="text-zinc-600 font-bold">x</span>
          <input type="number" min="0" max="30" data-gols-b class="input !w-16 !px-1 !py-2 text-center font-display font-bold" value="${num(inicial.gols_b)}" />
        </div>
        <div>
          <span class="label !mb-2">Time B</span>
          <div class="ms-b"></div>
        </div>
      </div>
      <div class="flex justify-end">
        <button type="button" data-remove class="btn btn-danger btn-sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
          Remover partida
        </button>
      </div>
    </div>`

  const msA = multiSelect(row.querySelector('.ms-a'), ativos(), inicial.time_a || [], renderStats)
  const msB = multiSelect(row.querySelector('.ms-b'), ativos(), inicial.time_b || [], renderStats)
  const golsA = row.querySelector('[data-gols-a]')
  const golsB = row.querySelector('[data-gols-b]')
  golsA.addEventListener('input', renderStats)
  golsB.addEventListener('input', renderStats)
  row.querySelector('[data-remove]').addEventListener('click', () => {
    sumula.partidas = sumula.partidas.filter(p => p.row !== row)
    row.remove()
    renderStats()
  })

  const p = { id: inicial.id || uid(), row, timeA: msA, timeB: msB, golsA, golsB }
  sumula.partidas.push(p)
  els.partidasContainer.appendChild(row)
  renderStats()
}

/** Renderiza a tabela de estatísticas individuais com pontos automáticos. */
function renderStats() {
  if (!sumula.partidas.length) {
    els.statsContainer.innerHTML = emptyState('Adicione uma partida acima para lançar gols e cartões.').outerHTML
    return
  }
  let html = `<table class="tbl"><thead><tr>
    <th>Jogador</th><th>Time</th><th>Resultado</th><th>Pts</th>
    <th>Gols</th><th>Amar.</th><th>Verm.</th></tr></thead><tbody>`

  for (const p of sumula.partidas) {
    const resA = resultadoDePlacar(p.golsA.value, p.golsB.value)
    const resB = resultadoDePlacar(p.golsB.value, p.golsA.value)
    const times = [
      ['A', resA, p.timeA.getValue()],
      ['B', resB, p.timeB.getValue()],
    ]
    for (const [letra, res, ids] of times) {
      for (const jid of ids) {
        const jog = byId(jid)
        if (!jog) continue
        const key = `${p.id}:${jid}`
        const st = statsValores.get(key) || { gols: '', amarelos: '', vermelhos: '' }
        html += `
          <tr>
            <td><div class="flex items-center gap-2">${avatar(jog).outerHTML}<span class="font-medium">${esc(jog.nome)}</span></div></td>
            <td><span class="team-tag team-${letra}">TIME ${letra}</span></td>
            <td><span class="badge ${RESULTADO_COR[res.resultado]}">${RESULTADO_LABEL[res.resultado]}</span></td>
            <td class="font-display font-bold text-white">+${res.pontos}</td>
            <td><input type="number" min="0" max="20" data-stat="${key}" data-campo="gols" value="${esc(st.gols)}" class="input !w-16 !px-1 !py-1.5 !text-center" /></td>
            <td><input type="number" min="0" max="5" data-stat="${key}" data-campo="amarelos" value="${esc(st.amarelos)}" class="input !w-14 !px-1 !py-1.5 !text-center" /></td>
            <td><input type="number" min="0" max="3" data-stat="${key}" data-campo="vermelhos" value="${esc(st.vermelhos)}" class="input !w-14 !px-1 !py-1.5 !text-center" /></td>
          </tr>`
      }
    }
  }
  els.statsContainer.innerHTML = html + '</tbody></table>'
}

// Delegação: grava os valores digitados nas células de estatística
els.statsContainer.addEventListener('input', (e) => {
  const t = e.target
  if (!t.dataset.stat) return
  const cur = statsValores.get(t.dataset.stat) || {}
  cur[t.dataset.campo] = num(t.value)
  statsValores.set(t.dataset.stat, cur)
})

/** Limpa o formulário de súmula. */
function limparSumula() {
  sumula.partidas.forEach(p => p.row.remove())
  sumula.partidas = []
  statsValores.clear()
  state.rodadaEditando = null
  els.fData.value = proximaTercaISO()
  els.fTitulo.value = ''
  els.fCraque.value = ''
  els.fCraqueMotivo.value = ''
  els.fMurcha.value = ''
  els.fMurchaMotivo.value = ''
  els.labelBtnRodada.textContent = 'Salvar Rodada'
  els.badgeEditando.classList.add('hidden')
  renderStats()
}

/** Valida e salva a rodada. */
async function salvarRodada() {
  const data = els.fData.value
  if (!data) { toast('Informe a data da terça-feira.', 'err'); return }

  const partidas = sumula.partidas.map(p => ({
    id: p.id,
    time_a: p.timeA.getValue(),
    time_b: p.timeB.getValue(),
    gols_a: num(p.golsA.value),
    gols_b: num(p.golsB.value),
  }))
  const comJogadores = partidas.filter(p => p.time_a.length || p.time_b.length)
  if (!comJogadores.length) { toast('Adicione pelo menos uma partida com jogadores.', 'err'); return }

  const duplicada = state.rodadas.find(r =>
    r.data === data && r.id !== (state.rodadaEditando ? state.rodadaEditando.id : null))
  if (duplicada) { toast(`Já existe uma rodada para ${formatarDataCurta(data)}.`, 'err'); return }

  // Gera as estatísticas individuais com os pontos automáticos
  const estatisticas = []
  for (const p of comJogadores) {
    const resA = resultadoDePlacar(p.gols_a, p.gols_b)
    const resB = resultadoDePlacar(p.gols_b, p.gols_a)
    const times = [
      ['A', resA, p.time_a],
      ['B', resB, p.time_b],
    ]
    for (const [letra, res, ids] of times) {
      for (const jid of ids) {
        const st = statsValores.get(`${p.id}:${jid}`) || {}
        estatisticas.push({
          id: uid(), partida_id: p.id, jogador_id: jid, time: letra,
          resultado: res.resultado, pontos: res.pontos,
          gols: st.gols || 0, cartoes_amarelos: st.amarelos || 0, cartoes_vermelhos: st.vermelhos || 0,
        })
      }
    }
  }

  const rodada = {
    id: state.rodadaEditando ? state.rodadaEditando.id : uid(),
    data,
    titulo: els.fTitulo.value.trim() || `Terça ${formatarDataCurta(data)}`,
    partidas: comJogadores,
    estatisticas,
    craque_id: els.fCraque.value || null,
    craque_motivo: els.fCraqueMotivo.value.trim(),
    bola_murcha_id: els.fMurcha.value || null,
    bola_murcha_motivo: els.fMurchaMotivo.value.trim(),
  }

  try {
    await db.saveRodada(rodada)
    toast(state.rodadaEditando ? 'Rodada atualizada!' : 'Rodada lançada com sucesso!', 'ok')
    limparSumula()
    await loadDados()
    renderListaRodadas()
  } catch (e) {
    console.error(e)
    toast('Erro ao salvar a rodada: ' + (e.message || e), 'err')
  }
}

/** Carrega uma rodada existente no formulário para edição. */
function editarRodada(id) {
  const r = state.rodadas.find(x => x.id === id)
  if (!r) return
  state.rodadaEditando = r
  els.fData.value = r.data
  els.fTitulo.value = r.titulo || ''
  els.fCraque.value = r.craque_id || ''
  els.fCraqueMotivo.value = r.craque_motivo || ''
  els.fMurcha.value = r.bola_murcha_id || ''
  els.fMurchaMotivo.value = r.bola_murcha_motivo || ''
  els.labelBtnRodada.textContent = 'Atualizar Rodada'
  els.badgeEditando.classList.remove('hidden')

  sumula.partidas.forEach(p => p.row.remove())
  sumula.partidas = []
  statsValores.clear()

  for (const p of r.partidas) {
    addPartidaRow({ id: p.id, time_a: p.time_a, time_b: p.time_b, gols_a: p.gols_a, gols_b: p.gols_b })
  }
  for (const e of r.estatisticas) {
    statsValores.set(`${e.partida_id}:${e.jogador_id}`, {
      gols: e.gols, amarelos: e.cartoes_amarelos, vermelhos: e.cartoes_vermelhos,
    })
  }
  renderStats()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** Exclui uma rodada (com confirmação). */
async function excluirRodada(id) {
  const r = state.rodadas.find(x => x.id === id)
  const confirmar = window.confirm(`Excluir a rodada "${r?.titulo || ''}" de ${r?.data ? formatarDataCurta(r.data) : ''}?\nIsso apagará placares e estatísticas da data.`)
  if (!confirmar) return
  try {
    await db.deleteRodada(id)
    if (state.rodadaEditando?.id === id) limparSumula()
    toast('Rodada excluída.', 'ok')
    await loadDados()
    renderListaRodadas()
  } catch (e) {
    console.error(e)
    toast('Erro ao excluir rodada.', 'err')
  }
}

/** Lista as rodadas lançadas (ordem decrescente). */
function renderListaRodadas() {
  const rodadas = [...state.rodadas].sort((a, b) => (a.data < b.data ? 1 : -1))
  els.qtdRodadas.textContent = `${rodadas.length}`
  if (!rodadas.length) {
    els.listaRodadas.innerHTML = emptyState('Nenhuma rodada lançada ainda.').outerHTML
    return
  }
  els.listaRodadas.innerHTML = rodadas.map(r => `
    <div class="card !bg-panel-2/50 !p-3 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="font-semibold text-white text-sm truncate">${esc(r.titulo)}</p>
        <p class="text-[11px] text-zinc-500">${formatarDataCurta(r.data)} · ${r.partidas.length} partida(s) · ${r.estatisticas.length} jogador(es)</p>
      </div>
      <div class="flex items-center gap-1 flex-none">
        <button class="btn btn-ghost btn-sm" title="Editar" data-edit="${r.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
        </button>
        <button class="btn btn-danger btn-sm" title="Excluir" data-del="${r.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
        </button>
      </div>
    </div>`).join('')

  els.listaRodadas.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => editarRodada(b.dataset.edit)))
  els.listaRodadas.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => excluirRodada(b.dataset.del)))
}

/* ============================================================
   ABA 2 - JOGADORES
============================================================ */
function renderJogadores() {
  const q = els.buscaJogadores.value.toLowerCase().trim()
  const lista = state.jogadores
    .filter(j => !q || j.nome.toLowerCase().includes(q))
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'))

  if (!lista.length) {
    els.corpoJogadores.innerHTML = emptyState('Nenhum jogador encontrado.').outerHTML
    return
  }

  els.corpoJogadores.innerHTML = `
    <table class="tbl">
      <thead><tr>
        <th>Jogador</th><th>Posição</th><th>Telefone</th><th>Observações</th><th>Status</th><th class="text-right">Ações</th>
      </tr></thead>
      <tbody>
        ${lista.map(j => `
          <tr class="${j.ativo === false ? 'opacity-45' : ''}">
            <td><div class="flex items-center gap-2.5">${avatar(j).outerHTML}<span class="font-semibold text-white">${esc(j.nome)}</span></div></td>
            <td><span class="text-zinc-400 text-xs">${esc(j.posicao || '—')}</span></td>
            <td class="text-zinc-400 text-xs">${esc(j.telefone || '—')}</td>
            <td class="max-w-[220px]"><p class="text-xs text-zinc-500 truncate" title="${esc(j.observacoes || '')}">${esc(j.observacoes || '—')}</p></td>
            <td>${j.ativo !== false ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-gray">Inativo</span>'}</td>
            <td>
              <div class="flex items-center justify-end gap-1.5">
                <button class="btn btn-ghost btn-sm" data-edit="${j.id}" title="Editar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                </button>
                <button class="btn btn-ghost btn-sm" data-toggle="${j.id}" title="${j.ativo === false ? 'Reativar' : 'Inativar'}">
                  ${j.ativo === false
                    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>'
                    : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'}
                </button>
                <button class="btn btn-danger btn-sm" data-del="${j.id}" title="Excluir">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
                </button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`

  els.corpoJogadores.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirModalJogador(state.jogadores.find(x => x.id === b.dataset.edit))))
  els.corpoJogadores.querySelectorAll('[data-toggle]').forEach(b =>
    b.addEventListener('click', () => alternarAtivo(b.dataset.toggle)))
  els.corpoJogadores.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => excluirJogador(b.dataset.del)))
}

function abrirModalJogador(jogador = null) {
  const editando = Boolean(jogador)
  const j = jogador || { nome: '', posicao: '', foto: '', telefone: '', observacoes: '', ativo: true }

  openModal({
    titulo: editando ? 'Editar Jogador' : 'Novo Jogador',
    conteudo: `
      <div class="space-y-4">
        <div class="flex items-center gap-4">
          <div data-preview></div>
          <div class="flex-1 space-y-2">
            <input type="text" data-foto-url class="input" placeholder="URL da foto (opcional)" value="${esc(j.foto || '')}" />
            <label class="btn btn-ghost btn-sm cursor-pointer inline-flex">Enviar arquivo
              <input type="file" data-foto-file accept="image/*" class="hidden" />
            </label>
            ${j.foto ? '<button type="button" data-foto-clear class="btn btn-danger btn-sm">Remover foto</button>' : ''}
          </div>
        </div>
        <div>
          <label class="label">Nome completo *</label>
          <input type="text" data-nome class="input" value="${esc(j.nome)}" placeholder="Ex.: Rafael Andrade" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Posição</label>
            <select data-posicao class="select">
              <option value="">Selecionar...</option>
              ${['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante']
                .map(p => `<option value="${p}" ${j.posicao === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label">Telefone</label>
            <input type="text" data-telefone class="input" value="${esc(j.telefone || '')}" placeholder="(11) 99999-0000" />
          </div>
        </div>
        <div>
          <label class="label">Observações internas</label>
          <textarea data-observacoes class="textarea" placeholder="Ex.: joga bem de zagueiro, chuta com a esquerda; sempre chega atrasado">${esc(j.observacoes || '')}</textarea>
        </div>
      </div>`,
    onOpen(body, close) {
      const preview = body.querySelector('[data-preview]')
      const fotoUrl = body.querySelector('[data-foto-url]')
      const fotoFile = body.querySelector('[data-foto-file]')

      const renderPreview = () => {
        const alvo = j.foto
          ? `<span class="avatar lg"><img src="${esc(j.foto)}" alt="foto" referrerpolicy="no-referrer" /></span>`
          : `<span class="avatar lg" style="background:linear-gradient(135deg,#F59E0B,#D97706)">${j.nome.trim() ? j.nome.trim()[0].toUpperCase() : '?'}</span>`
        preview.innerHTML = alvo
      }
      renderPreview()

      fotoUrl.addEventListener('input', () => { j.foto = fotoUrl.value.trim(); renderPreview() })
      fotoFile.addEventListener('change', () => {
        const file = fotoFile.files[0]
        if (!file) return
        if (file.size > 1024 * 1024 * 2) { toast('Imagem muito grande (máx. 2MB).', 'err'); return }
        const reader = new FileReader()
        reader.onload = () => { j.foto = reader.result; fotoUrl.value = ''; renderPreview() }
        reader.readAsDataURL(file)
      })
      const clearBtn = body.querySelector('[data-foto-clear]')
      if (clearBtn) clearBtn.addEventListener('click', () => { j.foto = ''; renderPreview() })

      const salvar = document.createElement('button')
      salvar.type = 'button'
      salvar.className = 'btn btn-gold w-full mt-5'
      salvar.textContent = editando ? 'Salvar alterações' : 'Cadastrar jogador'
      body.querySelector('div').appendChild(salvar)

      salvar.addEventListener('click', async () => {
        const nome = body.querySelector('[data-nome]').value.trim()
        if (!nome) { toast('Informe o nome do jogador.', 'err'); return }
        const jogadorFinal = {
          id: j.id || uid(),
          nome,
          posicao: body.querySelector('[data-posicao]').value,
          foto: j.foto || '',
          telefone: body.querySelector('[data-telefone]').value.trim(),
          observacoes: body.querySelector('[data-observacoes]').value.trim(),
          ativo: j.ativo !== undefined ? j.ativo : true,
        }
        try {
          await db.saveJogador(jogadorFinal)
          toast(editando ? 'Jogador atualizado!' : 'Jogador cadastrado!', 'ok')
          close()
          await loadDados()
          preencherSelectsDestaque()
          sincronizarOptionsSumula()
          renderJogadores()
        } catch (e) {
          console.error(e)
          toast('Erro ao salvar jogador.', 'err')
        }
      })
    },
  })
}

async function alternarAtivo(id) {
  const j = state.jogadores.find(x => x.id === id)
  if (!j) return
  j.ativo = j.ativo === false
  try {
    await db.saveJogador(j)
    await loadDados()
    renderJogadores()
  } catch (e) { console.error(e); toast('Erro ao atualizar jogador.', 'err') }
}

async function excluirJogador(id) {
  const j = state.jogadores.find(x => x.id === id)
  const confirmar = window.confirm(`Excluir definitivamente o jogador "${j?.nome}"?\nAs estatísticas antigas serão mantidas no histórico.`)
  if (!confirmar) return
  try {
    await db.deleteJogador(id)
    toast('Jogador excluído.', 'ok')
    await loadDados()
    preencherSelectsDestaque()
    sincronizarOptionsSumula()
    renderJogadores()
  } catch (e) { console.error(e); toast('Erro ao excluir jogador.', 'err') }
}

/* ============================================================
   ABA 3 - FINANCEIRO
============================================================ */
/** Meses relevantes para os selects financeiros. */
function mesesFinanceiros() {
  const set = new Set([mesAtual()])
  state.mensalidades.forEach(m => m.mes && set.add(m.mes))
  state.caixa.forEach(c => c.mes && set.add(c.mes))
  return [...set].sort().reverse()
}

function renderSelectsFinanceiros() {
  const meses = mesesFinanceiros()
  const opts = meses.map(m => `<option value="${m}">${formatarMes(m)}</option>`).join('')
  els.mesMensalidadesSel.innerHTML = opts
  els.mesCaixaSel.innerHTML = opts
  els.mesMensalidadesSel.value = state.mesMensalidades
  els.mesCaixaSel.value = state.mesCaixa
}

/** Encontra a entrada de caixa de mensalidade de um jogador no mês. */
function entradaMensalidade(jogadorId, mes) {
  return state.caixa.find(c =>
    c.tipo === 'entrada' && c.mes === mes && c.jogador_id === jogadorId && c.categoria === 'mensalidade')
}

function renderCardsCaixa() {
  const mes = state.mesCaixa
  const tx = state.caixa.filter(c => c.mes === mes)
  let entradas = 0, saidas = 0
  tx.forEach(c => { if (c.tipo === 'entrada') entradas += Number(c.valor || 0); else saidas += Number(c.valor || 0) })
  const saldo = entradas - saidas

  const card = (label, valor, cor, icone) => `
    <div class="card flex items-center justify-between gap-3">
      <div>
        <p class="text-[11px] uppercase tracking-wider text-zinc-500">${label}</p>
        <p class="font-display font-extrabold text-2xl ${cor}">${formatarMoeda(valor)}</p>
      </div>
      <span class="inline-grid place-items-center w-11 h-11 rounded-xl ${cor.includes('emerald') ? 'bg-emerald-400/10 text-emerald-300' : cor.includes('red') ? 'bg-red-400/10 text-red-300' : 'bg-amber-400/10 text-amber-300'}">${icone}</span>
    </div>`

  els.cardsCaixa.innerHTML =
    card('Arrecadado no mês', entradas, 'text-emerald-300',
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>') +
    card('Gastos no mês', saidas, 'text-red-300',
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>') +
    card('Saldo do caixa', saldo, saldo >= 0 ? 'text-amber-300' : 'text-red-300',
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/></svg>')
}

function renderMensalidades() {
  const mes = state.mesMensalidades
  const jogadoresMes = state.jogadores.filter(j => j.ativo !== false)

  if (!jogadoresMes.length) {
    els.corpoMensalidades.innerHTML = emptyState('Cadastre jogadores ativos para gerar mensalidades.').outerHTML
    return
  }

  const linhas = jogadoresMes.map(j => {
    const m = state.mensalidades.find(x => x.jogador_id === j.id && x.mes === mes)
    if (!m) return `
      <tr class="opacity-60">
        <td><div class="flex items-center gap-2.5">${avatar(j).outerHTML}<span class="font-medium">${esc(j.nome)}</span></div></td>
        <td class="text-zinc-500">—</td>
        <td class="text-zinc-500">—</td>
        <td><span class="badge badge-gray">Não gerado</span></td>
        <td class="text-right">—</td>
      </tr>`
    const pago = m.pago
    return `
      <tr>
        <td><div class="flex items-center gap-2.5">${avatar(j).outerHTML}<span class="font-medium">${esc(j.nome)}</span></div></td>
        <td class="font-semibold text-white">${formatarMoeda(m.valor)}</td>
        <td class="text-zinc-400 text-xs">${m.vencimento ? formatarDataCurta(m.vencimento) : '—'}</td>
        <td>${pago ? '<span class="badge badge-green">PAGO</span>' : '<span class="badge badge-red">PENDENTE</span>'}</td>
        <td class="text-right">
          <button class="btn ${pago ? 'btn-ghost' : 'btn-neon'} btn-sm" data-pix="${m.id}">
            ${pago
              ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Desmarcar'
              : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg> Receber via PIX'}
          </button>
        </td>
      </tr>`
  }).join('')

  els.corpoMensalidades.innerHTML = `
    <table class="tbl"><thead><tr>
      <th>Jogador</th><th>Valor</th><th>Vencimento</th><th>Status</th><th class="text-right">Ação</th>
    </tr></thead><tbody>${linhas}</tbody></table>`

  els.corpoMensalidades.querySelectorAll('[data-pix]').forEach(b =>
    b.addEventListener('click', () => alternarPagamento(b.dataset.pix)))
}

async function alternarPagamento(mensalidadeId) {
  const m = state.mensalidades.find(x => x.id === mensalidadeId)
  if (!m) return
  const jogador = byId(m.jogador_id)
  m.pago = !m.pago

  try {
    await db.saveMensalidade(m)

    if (m.pago) {
      // Abre a entrada no caixa automaticamente
      if (!entradaMensalidade(m.jogador_id, m.mes)) {
        const rec = {
          id: uid(),
          tipo: 'entrada',
          categoria: 'mensalidade',
          descricao: `Mensalidade ${formatarMes(m.mes)} - ${jogador?.nome || '?'}`,
          valor: m.valor,
          jogador_id: m.jogador_id,
          mes: m.mes,
          criado_em: new Date().toISOString(),
        }
        await db.addCaixa(rec)
        state.caixa.unshift(rec)
      }
      toast(`Mensalidade de ${jogador?.nome || ''} recebida via PIX!`, 'ok')
    } else {
      // Remove a entrada correspondente do caixa
      const entrada = entradaMensalidade(m.jogador_id, m.mes)
      if (entrada) {
        await db.deleteCaixa(entrada.id)
        state.caixa = state.caixa.filter(c => c.id !== entrada.id)
      }
      toast('Pagamento desmarcado.', '')
    }
    await loadDados()
    renderFinanceiro()
  } catch (e) {
    console.error(e)
    toast('Erro ao atualizar pagamento.', 'err')
  }
}

/** Gera mensalidades do mês selecionado para todos os ativos. */
async function gerarMensalidades() {
  const mes = state.mesMensalidades
  const faltantes = state.jogadores.filter(j =>
    j.ativo !== false && !state.mensalidades.some(m => m.jogador_id === j.id && m.mes === mes))

  if (!faltantes.length) { toast('Todos os ativos já têm mensalidade neste mês.', ''); return }

  try {
    for (const j of faltantes) {
      await db.saveMensalidade({
        id: uid(), jogador_id: j.id, mes,
        valor: CONFIG.VALOR_MENSALIDADE,
        vencimento: `${mes}-10`, pago: false,
      })
    }
    toast(`${faltantes.length} mensalidade(s) gerada(s) para ${formatarMes(mes)}.`, 'ok')
    await loadDados()
    renderFinanceiro()
  } catch (e) { console.error(e); toast('Erro ao gerar mensalidades.', 'err') }
}

function renderCaixa() {
  const mes = state.mesCaixa
  const tx = state.caixa.filter(c => c.mes === mes).sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))

  if (!tx.length) {
    els.corpoCaixa.innerHTML = emptyState('Sem lançamentos neste mês.').outerHTML
    return
  }
  els.corpoCaixa.innerHTML = tx.map(c => `
    <div class="flex items-center gap-3 rounded-lg bg-panel-2/60 border border-white/[0.05] px-3 py-2">
      <span class="inline-grid place-items-center w-8 h-8 rounded-lg flex-none ${c.tipo === 'entrada' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}">
        ${c.tipo === 'entrada'
          ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
          : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>'}
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm text-white truncate">${esc(c.descricao)}</p>
        <span class="badge badge-gray mt-0.5">${CATEGORIA_LABEL[c.categoria] || c.categoria}</span>
      </div>
      <span class="font-display font-bold text-sm ${c.tipo === 'entrada' ? 'text-emerald-300' : 'text-red-300'}">${c.tipo === 'entrada' ? '+' : '−'}${formatarMoeda(c.valor)}</span>
      <button class="btn btn-ghost btn-sm !px-1.5" title="Excluir" data-del="${c.id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('')

  els.corpoCaixa.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', async () => {
      try {
        await db.deleteCaixa(b.dataset.del)
        state.caixa = state.caixa.filter(c => c.id !== b.dataset.del)
        toast('Lançamento excluído.', 'ok')
        renderFinanceiro()
      } catch (e) { console.error(e); toast('Erro ao excluir lançamento.', 'err') }
    }))
}

function renderFinanceiro() {
  renderCardsCaixa()
  renderMensalidades()
  renderCaixa()
}

/* ============================================================
   ABA 4 - DEMANDAS
============================================================ */
function renderDemandas() {
  const colunas = [
    { key: 'pendente', titulo: 'Pendentes', cor: 'badge-red', total: state.demandas.filter(d => d.status === 'pendente').length },
    { key: 'fazendo', titulo: 'Em andamento', cor: 'badge-amber', total: state.demandas.filter(d => d.status === 'fazendo').length },
    { key: 'concluida', titulo: 'Concluídas', cor: 'badge-green', total: state.demandas.filter(d => d.status === 'concluida').length },
  ]

  els.kanban.innerHTML = colunas.map(col => `
    <div class="kanban-col" data-coluna="${col.key}">
      <div class="flex items-center justify-between mb-3 px-1">
        <h4 class="font-display font-semibold text-sm text-white flex items-center gap-2">
          <span class="pulse-dot" style="background:${col.key === 'pendente' ? 'var(--danger)' : col.key === 'fazendo' ? 'var(--gold)' : 'var(--neon)'}"></span>
          ${col.titulo}
        </h4>
        <span class="badge badge-gray">${col.total}</span>
      </div>
      <div data-cards class="space-y-2 min-h-[120px]"></div>
    </div>`).join('')

  colunas.forEach(col => {
    const colEl = els.kanban.querySelector(`[data-coluna="${col.key}"]`)
    const cardsEl = colEl.querySelector('[data-cards]')
    const items = state.demandas.filter(d => d.status === col.key).sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))

    if (!items.length) {
      cardsEl.innerHTML = `<p class="text-xs text-zinc-600 text-center py-6">${col.key === 'concluida' ? 'Nada concluído ainda' : 'Sem tarefas'}</p>`
    } else {
      cardsEl.innerHTML = items.map(d => `
        <div class="kanban-card" draggable="true" data-id="${d.id}">
          <div class="flex items-start justify-between gap-2">
            <span class="badge ${PRIORIDADE_COR[d.prioridade]}">${PRIORIDADE_LABEL[d.prioridade]}</span>
            <div class="flex items-center gap-1 flex-none">
              ${col.key !== 'pendente' ? `<button class="btn btn-ghost btn-sm !px-1.5" data-move="back" title="Voltar">←</button>` : ''}
              ${col.key !== 'concluida' ? `<button class="btn btn-ghost btn-sm !px-1.5" data-move="next" title="Avançar">→</button>` : ''}
            </div>
          </div>
          <p class="font-semibold text-white text-sm mt-2">${esc(d.titulo)}</p>
          ${d.descricao ? `<p class="text-xs text-zinc-400 mt-1 leading-relaxed">${esc(d.descricao)}</p>` : ''}
          <div class="flex items-center justify-between mt-2.5">
            <span class="text-[10px] text-zinc-600">${d.criado_em ? new Date(d.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>
            <div class="flex items-center gap-1">
              <button class="btn btn-ghost btn-sm !px-1.5" data-edit="${d.id}" title="Editar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
              </button>
              <button class="btn btn-danger btn-sm !px-1.5" data-del="${d.id}" title="Excluir">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
              </button>
            </div>
          </div>
        </div>`).join('')
    }

    cardsEl.querySelectorAll('[data-move]').forEach(b => {
      b.addEventListener('click', () => moverDemanda(b.closest('.kanban-card').dataset.id, b.dataset.move))
    })
    cardsEl.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => editarDemanda(b.dataset.edit))
    })
    cardsEl.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => excluirDemanda(b.dataset.del))
    })

    // Drag & drop (desktop) + fallback toque (botões acima)
    colEl.addEventListener('dragover', (e) => { e.preventDefault(); colEl.classList.add('dragover') })
    colEl.addEventListener('dragleave', () => colEl.classList.remove('dragover'))
    colEl.addEventListener('drop', (e) => {
      e.preventDefault()
      colEl.classList.remove('dragover')
      const id = e.dataTransfer.getData('text/plain')
      if (id) moverDemanda(id, null, col.key)
    })
    cardsEl.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging') })
      card.addEventListener('dragend', () => card.classList.remove('dragging'))
    })
  })

  // Contador de demandas abertas na aba
  const abertas = state.demandas.filter(d => d.status !== 'concluida').length
  els.badgeDemandas.classList.toggle('hidden', abertas === 0)
  els.badgeDemandas.textContent = abertas
}

async function moverDemanda(id, direcao = null, destino = null) {
  const d = state.demandas.find(x => x.id === id)
  if (!d) return
  const ordem = ['pendente', 'fazendo', 'concluida']
  if (destino) d.status = destino
  else {
    const i = ordem.indexOf(d.status)
    d.status = ordem[Math.max(0, Math.min(ordem.length - 1, i + (direcao === 'next' ? 1 : -1)))]
  }
  if (d.status === 'concluida' && !d.concluida_em) d.concluida_em = new Date().toISOString()
  try {
    await db.saveDemanda(d)
    renderDemandas()
  } catch (e) { console.error(e); toast('Erro ao mover demanda.', 'err') }
}

function editarDemanda(id) {
  const d = state.demandas.find(x => x.id === id)
  if (!d) return
  state.demandaEditando = d
  $('#d-titulo').value = d.titulo
  $('#d-descricao').value = d.descricao || ''
  $('#d-prioridade').value = d.prioridade
  document.querySelector('[data-wrap-descricao]').classList.remove('hidden')
  document.querySelector('[data-label-submit]').textContent = 'Salvar'
  $('#d-titulo').focus()
}

function resetFormDemanda() {
  state.demandaEditando = null
  els.formDemanda.reset()
  document.querySelector('[data-wrap-descricao]').classList.add('hidden')
  document.querySelector('[data-label-submit]').textContent = 'Adicionar'
}

async function excluirDemanda(id) {
  const d = state.demandas.find(x => x.id === id)
  if (!window.confirm(`Excluir a demanda "${d?.titulo}"?`)) return
  try {
    await db.deleteDemanda(id)
    if (state.demandaEditando?.id === id) resetFormDemanda()
    toast('Demanda excluída.', 'ok')
    renderDemandas()
  } catch (e) { console.error(e); toast('Erro ao excluir demanda.', 'err') }
}

/* ============================================================
   LOAD & INIT
============================================================ */
async function loadDados() {
  const [jogadores, rodadas, mensalidades, caixa, demandas] = await Promise.all([
    db.getJogadores(), db.getRodadas(), db.getMensalidades(), db.getCaixa(), db.getDemandas(),
  ])
  state.jogadores = jogadores
  state.rodadas = rodadas
  state.mensalidades = mensalidades
  state.caixa = caixa
  state.demandas = demandas
}

/** Inicializa eventos estáticos e a interface. */
function init() {
  // Abas
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'))
      document.getElementById(`painel-${tab.dataset.tab}`).classList.remove('hidden')
    })
  })

  // Súmula
  els.fData.value = proximaTercaISO()
  els.btnAddPartida.addEventListener('click', () => addPartidaRow())
  els.btnSalvarRodada.addEventListener('click', salvarRodada)
  els.btnLimpar.addEventListener('click', () => { if (sumula.partidas.length) { if (window.confirm('Descartar o rascunho atual da súmula?')) limparSumula() } else limparSumula() })

  // Jogadores
  els.btnNovo = $('#btn-novo-jogador')
  els.btnNovo.addEventListener('click', () => abrirModalJogador())
  els.buscaJogadores.addEventListener('input', renderJogadores)

  // Financeiro
  els.mesMensalidadesSel.addEventListener('change', () => { state.mesMensalidades = els.mesMensalidadesSel.value; renderFinanceiro() })
  els.mesCaixaSel.addEventListener('change', () => { state.mesCaixa = els.mesCaixaSel.value; renderFinanceiro() })
  $('#btn-gerar-mensalidades').addEventListener('click', gerarMensalidades)
  els.formCaixa.addEventListener('submit', async (e) => {
    e.preventDefault()
    const valor = parseMoeda(els.formCaixa.querySelector('#c-valor').value)
    if (valor <= 0) { toast('Informe um valor válido.', 'err'); return }
    const rec = {
      id: uid(),
      tipo: els.formCaixa.querySelector('#c-tipo').value,
      categoria: els.formCaixa.querySelector('#c-categoria').value,
      descricao: els.formCaixa.querySelector('#c-descricao').value.trim(),
      valor,
      jogador_id: null,
      mes: state.mesCaixa,
      criado_em: new Date().toISOString(),
    }
    if (!rec.descricao) { toast('Informe a descrição.', 'err'); return }
    try {
      await db.addCaixa(rec)
      state.caixa.unshift(rec)
      els.formCaixa.reset()
      toast('Lançamento registrado!', 'ok')
      renderFinanceiro()
    } catch (err) { console.error(err); toast('Erro ao registrar lançamento.', 'err') }
  })

  // Demandas
  els.formDemanda.addEventListener('submit', async (e) => {
    e.preventDefault()
    const titulo = $('#d-titulo').value.trim()
    if (!titulo) { toast('Informe o título da demanda.', 'err'); return }
    const prioridade = $('#d-prioridade').value
    const descricao = $('#d-descricao').value.trim()

    if (state.demandaEditando) {
      state.demandaEditando.titulo = titulo
      state.demandaEditando.prioridade = prioridade
      state.demandaEditando.descricao = descricao
      try {
        await db.saveDemanda(state.demandaEditando)
        toast('Demanda atualizada!', 'ok')
      } catch (err) { console.error(err); toast('Erro ao salvar.', 'err') }
    } else {
      const nova = {
        id: uid(), titulo, descricao, prioridade, status: 'pendente',
        criado_em: new Date().toISOString(),
      }
      try {
        await db.saveDemanda(nova)
        state.demandas.push(nova)
        toast('Demanda criada!', 'ok')
      } catch (err) { console.error(err); toast('Erro ao criar.', 'err') }
    }
    resetFormDemanda()
    renderDemandas()
  })
}

/** Boot. */
async function boot() {
  try {
    await initDB()
    await loadDados()
  } catch (e) {
    console.error(e)
    toast('Erro ao carregar os dados. Veja o console.', 'err')
  }
  init()
  preencherSelectsDestaque()
  addPartidaRow()
  renderListaRodadas()
  renderJogadores()
  renderSelectsFinanceiros()
  renderFinanceiro()
  renderDemandas()
}

boot()
