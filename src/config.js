// ============================================================
//  src/config.js
//  Configuração central da Pelada de Terça.
//
//  COMO CONECTAR AO SUPABASE:
//  1. Preencha SUPABASE_URL e SUPABASE_ANON_KEY abaixo
//     (Project Settings > API no painel do Supabase).
//  2. Rode o script `sql/schema.sql` no SQL Editor do Supabase.
//  3. Se os campos ficarem vazios, o app roda em MODO DEMO
//     com persistência local no navegador (localStorage).
// ============================================================

export const CONFIG = {
  // ---- Supabase (opcional) ------------------------------------
  SUPABASE_URL: 'https://gvdsjlunsgduydgwudgs.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZHNqbHVuc2dkdXlkZ3d1ZGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTk1ODIsImV4cCI6MjEwMDc3NTU4Mn0.OrBT5h6GTaRqSY5CM3sk6INLz9oQ-FOVoJ_RYKGWvH8',

  // ---- Identidade ----------------------------------------------
  NOME_PELADA: 'Pelada de Terça',
  SUBTITULO: 'Futebol raiz, toda terça-feira às 20h',

  // ---- Regras do jogo ------------------------------------------
  PONTOS_VITORIA: 3,
  PONTOS_EMPATE: 1,
  PONTOS_DERROTA: 0,
  VALOR_MENSALIDADE: 20, // R$
  DIA_DO_JOGO: 2, // 0 = domingo ... 2 = terça-feira

  // ---- Aparência ------------------------------------------------
  CIDADES: {
    night: '#0F0F12',
    panel: '#18181B',
    gold: '#F59E0B',
    neon: '#10B981',
  },
}
