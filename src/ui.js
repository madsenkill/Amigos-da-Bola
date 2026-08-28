// ============================================================
//  src/ui.js
//  Componentes de UI reutilizáveis: toast, modal, avatar,
//  multi-select de jogadores e helpers de renderização.
// ============================================================
import { esc, iniciais, corDoNome } from './utils.js'

/* ------------------------------------------------------------
   Toast (notificação flutuante)
------------------------------------------------------------ */
let toastWrap = null
function ensureToastWrap() {
  if (!toastWrap) {
    toastWrap = document.createElement('div')
    toastWrap.className = 'toast-wrap'
    document.body.appendChild(toastWrap)
  }
  return toastWrap
}

/** Exibe uma notificação temporária. tipo: 'ok' | 'err' | '' */
export function toast(msg, tipo = '') {
  const wrap = ensureToastWrap()
  const el = document.createElement('div')
  el.className = `toast ${tipo}`
  const dot = document.createElement('span')
  dot.className = 'pulse-dot'
  dot.style.background = tipo === 'err' ? 'var(--danger)' : tipo === 'ok' ? 'var(--neon)' : 'var(--gold)'
  el.appendChild(dot)
  el.appendChild(Object.assign(document.createElement('span'), { textContent: msg }))
  wrap.appendChild(el)
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s'
    el.style.opacity = '0'
    el.style.transform = 'translateY(8px)'
    setTimeout(() => el.remove(), 320)
  }, 2800)
}

/* ------------------------------------------------------------
   Modal (caixa de diálogo)
------------------------------------------------------------ */
/**
 * Abre um modal com conteúdo HTML.
 * Retorna { close } para fechá-lo programaticamente.
 */
export function openModal({ titulo, conteudo, onOpen }) {
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop fade-in'
  backdrop.innerHTML = `
    <div class="modal">
      <div class="flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b" style="border-color:var(--line)">
        <h3 class="font-display font-bold text-lg leading-none">${titulo}</h3>
        <button type="button" class="btn btn-ghost btn-sm" data-close>✕</button>
      </div>
      <div class="p-5" data-body>${conteudo}</div>
    </div>`
  const close = () => {
    backdrop.style.transition = 'opacity .15s'
    backdrop.style.opacity = '0'
    setTimeout(() => backdrop.remove(), 150)
  }
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) close()
  })
  document.body.appendChild(backdrop)
  document.body.style.overflow = 'hidden'
  backdrop.addEventListener('click', () => { document.body.style.overflow = '' })
  if (onOpen) onOpen(backdrop.querySelector('[data-body]'), close)
  return { backdrop, close }
}

/* ------------------------------------------------------------
   Avatar (foto ou iniciais com gradiente)
------------------------------------------------------------ */
export function avatar(jogador, size = '') {
  const nome = jogador?.nome || '?'
  const div = document.createElement('span')
  div.className = `avatar ${size}`
  div.title = nome
  if (jogador?.foto) {
    const img = document.createElement('img')
    img.src = jogador.foto
    img.alt = nome
    img.referrerPolicy = 'no-referrer'
    img.onerror = () => { img.remove(); div.textContent = iniciais(nome); div.style.background = corDoNome(nome) }
    div.appendChild(img)
  } else {
    div.textContent = iniciais(nome)
    div.style.background = corDoNome(nome)
  }
  return div
}

/* ------------------------------------------------------------
   Multi-select de jogadores (dropdown com checkboxes)
------------------------------------------------------------ */
/**
 * Cria um seletor múltiplo de jogadores.
 * @param {HTMLElement} container - onde será montado
 * @param {Array} jogadores - lista de jogadores ativos
 * @param {Array} selecionados - ids iniciais
 * @param {(ids: string[]) => void} onChange
 */
export function multiSelect(container, jogadores, selecionados = [], onChange) {
  const state = new Set(selecionados)
  let listaJogadores = jogadores
  const wrap = document.createElement('div')
  wrap.className = 'ms'
  container.appendChild(wrap)

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'ms-btn'
  wrap.appendChild(btn)

  const labelSpan = document.createElement('span')
  const chev = document.createElement('span')
  chev.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>`
  btn.append(labelSpan, chev)

  const chipsWrap = document.createElement('div')
  chipsWrap.className = 'ms-chips'
  wrap.appendChild(chipsWrap)

  const panel = document.createElement('div')
  panel.className = 'ms-panel'
  panel.style.display = 'none'
  wrap.appendChild(panel)

  const search = document.createElement('input')
  search.type = 'text'
  search.placeholder = 'Buscar jogador...'
  search.className = 'input'
  search.style.fontSize = '.8rem'
  const searchBox = document.createElement('div')
  searchBox.className = 'ms-search'
  searchBox.appendChild(search)
  panel.appendChild(searchBox)

  const list = document.createElement('div')
  panel.appendChild(list)

  function byId(id) { return listaJogadores.find(j => j.id === id) }

  function render() {
    const q = search.value.toLowerCase().trim()
    list.innerHTML = ''
    const filtrados = listaJogadores.filter(j => !q || j.nome.toLowerCase().includes(q))
    if (!filtrados.length) {
      list.innerHTML = '<div class="empty-state" style="padding:1rem">Nenhum jogador</div>'
    }
    for (const j of filtrados) {
      const item = document.createElement('label')
      item.className = 'ms-item' + (state.has(j.id) ? ' checked' : '')
      const box = document.createElement('span')
      box.className = 'ms-box'
      if (state.has(j.id)) box.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#241503" stroke-width="4" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>`
      item.appendChild(box)
      item.appendChild(avatar(j, ''))
      const name = document.createElement('span')
      name.textContent = j.nome
      item.appendChild(name)
      item.addEventListener('click', (e) => {
        e.preventDefault()
        if (state.has(j.id)) state.delete(j.id)
        else state.add(j.id)
        render(); sync()
      })
      list.appendChild(item)
    }
  }

  function renderChips() {
    chipsWrap.innerHTML = ''
    const ids = [...state]
    if (!ids.length) return
    for (const id of ids) {
      const j = byId(id)
      if (!j) continue
      const chip = document.createElement('span')
      chip.className = 'ms-chip'
      chip.textContent = j.nome
      const x = document.createElement('button')
      x.type = 'button'
      x.innerHTML = '✕'
      x.addEventListener('click', (e) => {
        e.stopPropagation()
        state.delete(id)
        renderChips(); sync(); render()
      })
      chip.appendChild(x)
      chipsWrap.appendChild(chip)
    }
  }

  function sync() {
    const ids = [...state]
    const nomes = ids.map(id => byId(id)?.nome).filter(Boolean)
    labelSpan.textContent = ids.length ? `${ids.length} jogador${ids.length > 1 ? 'es' : ''}` : 'Selecionar jogadores...'
    btn.classList.toggle('has-selected', ids.length > 0)
    renderChips()
    onChange && onChange(ids)
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const abrir = panel.style.display === 'none'
    panel.style.display = abrir ? 'block' : 'none'
    if (abrir) search.focus()
  })
  search.addEventListener('input', render)
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) panel.style.display = 'none'
  })

  render(); sync()

  /** Obtém os ids selecionados. */
  function getValue() { return [...state] }
  /** Substitui a seleção. */
  function setValue(ids) { state.clear(); ids.forEach(i => state.add(i)); render(); sync() }
  /** Atualiza a lista de jogadores disponíveis (mantém a seleção). */
  function setOptions(novas) {
    listaJogadores = novas
    render()
    sync()
  }
  return { getValue, setValue, setOptions }
}

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */
/** Constrói elemento com classes. */
export function el(tag, cls = '', text = '') {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

/** Estado vazio padrão para listas. */
export function emptyState(mensagem, icone = '') {
  const div = el('div', 'empty-state')
  if (icone) {
    const ic = document.createElement('div')
    ic.style.fontSize = '2rem'
    ic.style.marginBottom = '.5rem'
    ic.style.opacity = '.5'
    ic.textContent = icone
    div.appendChild(ic)
  }
  div.appendChild(el('div', '', mensagem))
  return div
}

/** Retorna HTML de um texto simples escapado (para placeholders inline). */
export function placeholder(texto) {
  return `<div class="empty-state">${esc(texto)}</div>`
}
