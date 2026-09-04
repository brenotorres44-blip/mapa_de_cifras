// ==================== ESTADO GLOBAL ====================
const NOTAS_TECLADO = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const QUALIDADES = [
  { label: "maior", suffix: "" }, { label: "menor", suffix: "m" }, { label: "7", suffix: "7" },
  { label: "m7", suffix: "m7" }, { label: "maj7", suffix: "maj7" }, { label: "sus4", suffix: "sus4" }, { label: "dim", suffix: "dim" },
];
const SECOES_PADRAO = ["Introdução","Verso 1","Verso 2","Pré-Refrão","Refrão","Ponte","Solo","Final"];
const SIMBOLOS_RAPIDOS = ["%", "x2", "x3", "x4"];

const state = {
  page: "inicio",
  musicaAberta: null,
  oficiais: [],
  comunidade: [],
  carregando: true,
  viewer: { semitons: 0, useFlats: false },
  editor: {
    titulo: "", autor: "", categoria: "comunidade", pin: "",
    secoes: [], qualidade: "", novoCompasso: true, secaoAtivaIdx: 0,
    erro: "", publicando: false, useFlats: false, editandoId: null,
  },
};

function resetEditor() {
  state.editor = { titulo: "", autor: "", categoria: "comunidade", pin: "", secoes: [], qualidade: "", novoCompasso: true, secaoAtivaIdx: 0, erro: "", publicando: false, useFlats: false, editandoId: null };
}

function carregarMusicaNoEditor(musica) {
  state.editor = {
    titulo: musica.title, autor: musica.author, categoria: musica.category, pin: "",
    secoes: JSON.parse(JSON.stringify(musica.secoes)),
    qualidade: "", novoCompasso: true, secaoAtivaIdx: 0,
    erro: "", publicando: false, useFlats: false, editandoId: musica.id,
  };
  state.musicaAberta = null;
  state.page = "criar";
}

// ==================== CARREGAR MÚSICAS ====================
function carregarMusicas() {
  state.carregando = true;
  render();
  supabaseClient.from("songs").select("*").order("created_at", { ascending: false }).then(function (res) {
    if (!res.error && res.data) {
      state.oficiais = res.data.filter(function (m) { return m.category === "oficial"; });
      state.comunidade = res.data.filter(function (m) { return m.category === "comunidade"; });
    }
    state.carregando = false;
    render();
  });
}

// ==================== RENDERIZAÇÃO ====================
function root() { return document.getElementById("root"); }

function render() {
  root().innerHTML = cabecalhoHtml() + '<div id="conteudo">' + conteudoHtml() + '</div>';
  bindEvents();
}

function cabecalhoHtml() {
  const itens = [["inicio","Início"],["oficial","Repertório Oficial"],["comunidade","Comunidade"],["criar","+ Criar Música"]];
  let botoes = "";
  itens.forEach(function (item) {
    const key = item[0], label = item[1];
    botoes += '<button class="btn ' + (state.page===key?"ativo":"") + '" data-action="ir" data-page="' + key + '">' + label.toUpperCase() + '</button>';
  });
  return '<h1 class="titulo-app">Mapa de Cifras</h1>' +
    '<div class="linha-decorativa"></div>' +
    '<div class="nav">' + botoes + '</div>';
}

function conteudoHtml() {
  if (state.musicaAberta) return visualizarMusicaHtml(state.musicaAberta);
  if (state.page === "inicio") {
    return listaMusicasHtml("Repertório Oficial", state.oficiais.slice(0,5)) + "<div style='height:20px'></div>" + listaMusicasHtml("Comunidade", state.comunidade.slice(0,5));
  }
  if (state.page === "oficial") return listaMusicasHtml("Repertório Oficial", state.oficiais);
  if (state.page === "comunidade") return listaMusicasHtml("Comunidade", state.comunidade);
  if (state.page === "criar") return criarMusicaHtml();
  return "";
}

function listaMusicasHtml(titulo, musicas) {
  if (state.carregando) return '<h2 class="secao-header">' + titulo + '</h2><p class="vazio">Carregando...</p>';
  if (musicas.length === 0) return '<h2 class="secao-header">' + titulo + '</h2><p class="vazio">Nenhuma música publicada aqui ainda.</p>';
  let itens = "";
  musicas.forEach(function (m) {
    itens += '<button class="lista-musica-item" data-action="abrir-musica" data-id="' + m.id + '">' +
      '<div class="nome">' + escapeHtml(m.title) + '</div>' +
      '<div class="autor">' + escapeHtml(m.author) + '</div>' +
    '</button>';
  });
  return '<h2 class="secao-header">' + titulo + '</h2>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' + itens + '</div>';
}

function encontrarMusicaPorId(id) {
  const todas = state.oficiais.concat(state.comunidade);
  for (let i = 0; i < todas.length; i++) if (String(todas[i].id) === String(id)) return todas[i];
  return null;
}

function visualizarMusicaHtml(musica) {
  const semitons = state.viewer.semitons, useFlats = state.viewer.useFlats;
  const secoesTranspostas = musica.secoes.map(function (s) {
    return {
      titulo: s.titulo,
      compassos: s.compassos.map(function (c) { return c.map(function (tok) { return transposeChord(tok, semitons, useFlats); }); }),
    };
  });
  const acordesUnicos = [];
  secoesTranspostas.forEach(function (s) {
    s.compassos.forEach(function (c) {
      c.forEach(function (n) { if (!isSimboloToken(n) && acordesUnicos.indexOf(n) === -1) acordesUnicos.push(n); });
    });
  });
  const tomLabel = semitons === 0 ? "Tom original" : (semitons > 0 ? "+" : "") + semitons + " semitom(ns)";

  let secoesHtml = "";
  secoesTranspostas.forEach(function (secao) {
    let compassosHtml = '<span class="barra">|</span>';
    secao.compassos.forEach(function (compasso) {
      const tokensHtml = compasso.map(function (tok) {
        return isSimboloToken(tok) ? '<span class="token-simbolo">' + escapeHtml(tok) + '</span>' : escapeHtml(tok);
      }).join(" ");
      compassosHtml += '<span style="font-family:\'Courier New\',monospace;font-size:20px;font-weight:700;letter-spacing:2px;color:#e8e0d0;padding:0 14px">' + tokensHtml + '</span><span class="barra">|</span>';
    });
    secoesHtml += '<div style="margin-bottom:20px">' +
      (secao.titulo ? '<div class="tag-secao" style="margin-bottom:8px">' + escapeHtml(secao.titulo) + '</div>' : "") +
      '<div style="display:flex;flex-wrap:wrap;align-items:center">' + compassosHtml + '</div>' +
    '</div>';
  });

  let diagramasHtml = "";
  acordesUnicos.forEach(function (c) { diagramasHtml += chordDiagramSVG(c); });

  return '<button class="btn cinza" data-action="voltar" style="margin-bottom:20px">← VOLTAR</button>' +
    '<button class="btn" data-action="editar-musica" data-id="' + musica.id + '" style="margin-bottom:20px;margin-left:8px">✎ EDITAR</button>' +
    '<h2 style="font-size:24px;color:#c9a227;font-style:italic;margin-bottom:2px">' + escapeHtml(musica.title) + '</h2>' +
    '<p style="color:#999;font-size:13px;margin-bottom:20px">' + escapeHtml(musica.author) + '</p>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;padding:14px 18px;background:#161616;border:1px solid #333;border-radius:2px;flex-wrap:wrap">' +
      '<button class="btn" data-action="transpor" data-delta="-1">▼ DESCER</button>' +
      '<button class="btn" data-action="transpor" data-delta="1">▲ SUBIR</button>' +
      '<span style="font-weight:700;min-width:140px;color:#c9a227;letter-spacing:1px;font-size:13px">' + tomLabel.toUpperCase() + '</span>' +
      '<button class="btn cinza" data-action="resetar-tom">RESETAR</button>' +
      '<label style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:13px;color:#999">' +
        '<input type="checkbox" data-action="toggle-flats" ' + (useFlats ? "checked" : "") + '/> Usar bemóis (b)' +
      '</label>' +
    '</div>' +
    secoesHtml +
    '<h2 class="secao-header">Mapa Musical</h2>' +
    '<div style="display:flex;flex-wrap:wrap;gap:20px;padding:16px;background:#111;border:1px solid #2a2a2a">' + diagramasHtml + '</div>';
}

function criarMusicaHtml() {
  const ed = state.editor;

  let chipsHtml = "";
  QUALIDADES.forEach(function (q) {
    chipsHtml += '<button class="chip ' + (ed.qualidade===q.suffix?"ativo":"") + '" data-action="qualidade" data-suffix="' + q.suffix + '">' + q.label + '</button>';
  });

  let teclasHtml = "";
  NOTAS_TECLADO.forEach(function (nota) {
    const label = ed.useFlats ? sharpToFlatLabel(nota) : nota;
    teclasHtml += '<button style="padding:16px 0;border:1px solid #444;background:#1a1a1a;color:#e8e0d0;font-family:\'Courier New\',monospace;font-size:16px;font-weight:700;border-radius:2px" data-action="nota" data-nota="' + nota + '">' + label + '</button>';
  });

  let simbolosHtml = "";
  SIMBOLOS_RAPIDOS.forEach(function (s) {
    simbolosHtml += '<button class="btn-secao" data-action="simbolo" data-simbolo="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
  });

  let secoesPadraoHtml = "";
  SECOES_PADRAO.forEach(function (nome) {
    secoesPadraoHtml += '<button class="btn-secao" data-action="nova-secao" data-nome="' + escapeHtml(nome) + '">+ ' + nome.toUpperCase() + '</button>';
  });

  let sequenciaHtml = "";
  if (ed.secoes.length === 0) {
    sequenciaHtml = '<p class="vazio" style="margin-bottom:20px">Nenhum acorde ainda — comece criando uma seção e tocando uma nota.</p>';
  } else {
    ed.secoes.forEach(function (secao, i) {
      let compassosHtml = "";
      if (secao.compassos.length === 0) {
        compassosHtml = '<p class="vazio">Sem acordes ainda.</p>';
      } else {
        compassosHtml = '<div style="display:flex;flex-wrap:wrap;align-items:center"><span class="barra">|</span>';
        secao.compassos.forEach(function (compasso, k) {
          compassosHtml += '<span style="padding:0 8px;display:flex;gap:4px">';
          compasso.forEach(function (acorde, m) {
            const classeExtra = isSimboloToken(acorde) ? " simbolo" : "";
            compassosHtml += '<button class="acorde-btn' + classeExtra + '" data-action="remover-acorde" data-secao="' + i + '" data-compasso="' + k + '" data-acorde="' + m + '">' + escapeHtml(acorde) + '</button>';
          });
          compassosHtml += '</span><span class="barra">|</span>';
        });
        compassosHtml += '</div>';
      }
      sequenciaHtml += '<div style="margin-bottom:20px;padding:8px;border:1px ' + (i===ed.secaoAtivaIdx?"dashed #c9a227":"solid transparent") + '">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
          '<button class="tag-secao" style="border:none" data-action="ativar-secao" data-idx="' + i + '">' + escapeHtml(secao.titulo) + '</button>' +
          '<button style="background:none;border:none;color:#666;font-size:13px" data-action="remover-secao" data-idx="' + i + '">✕</button>' +
        '</div>' + compassosHtml +
      '</div>';
    });
  }

  const secaoAtivaTitulo = ed.secoes.length > 0 ? (ed.secoes[Math.min(ed.secaoAtivaIdx, ed.secoes.length-1)] || {}).titulo || "" : "";

  return '<button class="btn cinza" data-action="voltar-inicio" style="margin-bottom:20px">← VOLTAR</button>' +
    '<h2 class="secao-header">' + (ed.editandoId ? "Editar Música" : "Nova Música") + '</h2>' +
    '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">' +
      '<input id="campo-titulo" class="input" style="flex:2;min-width:200px" placeholder="Título da música" value="' + escapeHtml(ed.titulo) + '" />' +
      '<input id="campo-autor" class="input" style="flex:1;min-width:150px" placeholder="Seu nome" value="' + escapeHtml(ed.autor) + '" />' +
    '</div>' +
    '<div style="display:flex;gap:20px;margin-bottom:24px;align-items:center;flex-wrap:wrap">' +
      '<label style="font-size:13px;color:#999;display:flex;align-items:center;gap:6px">' +
        '<input type="radio" name="categoria" data-action="categoria" value="comunidade" ' + (ed.categoria==="comunidade"?"checked":"") + '/> Publicar na Comunidade' +
      '</label>' +
      '<label style="font-size:13px;color:#999;display:flex;align-items:center;gap:6px">' +
        '<input type="radio" name="categoria" data-action="categoria" value="oficial" ' + (ed.categoria==="oficial"?"checked":"") + '/> Publicar no Repertório Oficial' +
      '</label>' +
      (ed.categoria === "oficial" ? '<input id="campo-pin" class="input" style="width:100px" type="password" placeholder="PIN" value="' + escapeHtml(ed.pin) + '" />' : "") +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding:14px 18px;background:#161616;border:1px solid #333;border-radius:2px">' + chipsHtml +
      '<label style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:13px;color:#999">' +
        '<input type="checkbox" data-action="toggle-flats-editor" ' + (ed.useFlats ? "checked" : "") + '/> Usar bemóis (b)' +
      '</label>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px;padding:16px;background:#111;border:1px solid #2a2a2a">' + teclasHtml + '</div>' +
    '<div style="margin-bottom:16px">' +
      '<p class="aviso" style="margin-bottom:8px">Símbolos: <code>%</code> repete o acorde/compasso anterior · <code>xN</code> indica repetição do trecho</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' + simbolosHtml + '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<input id="campo-simbolo-custom" class="input" style="width:160px" placeholder="Outro (ex: x8)" />' +
        '<button class="btn" data-action="simbolo-custom">+ ADICIONAR SÍMBOLO</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center">' +
      '<button class="btn ' + (ed.novoCompasso ? "" : "ativo") + '" data-action="toggle-compasso">' + (ed.novoCompasso ? "PRÓXIMA NOTA = NOVO COMPASSO" : "PRÓXIMA NOTA JUNTA NO COMPASSO") + '</button>' +
      '<button class="btn" data-action="desfazer">⌫ DESFAZER</button>' +
    '</div>' +
    (ed.secoes.length > 0 ? '<p class="aviso">Editando: <span style="color:#c9a227;font-weight:700">' + escapeHtml(secaoAtivaTitulo) + '</span> — clique no nome de outra seção pra editar ela, ou num acorde pra apagá-lo.</p>' : "") +
    '<div style="margin-bottom:28px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' + secoesPadraoHtml + '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<input id="campo-nova-secao" class="input" style="flex:1" placeholder="Ou digite o nome de uma seção personalizada" />' +
        '<button class="btn" data-action="nova-secao-custom">+ ADICIONAR</button>' +
      '</div>' +
    '</div>' +
    '<h2 class="secao-header">Sequência de Acordes</h2>' + sequenciaHtml +
    (ed.erro ? '<p class="erro-msg">' + escapeHtml(ed.erro) + '</p>' : "") +
    '<button class="btn grande" data-action="publicar" ' + (ed.publicando ? "disabled" : "") + '>' + (ed.publicando ? "SALVANDO..." : (ed.editandoId ? "SALVAR ALTERAÇÕES" : "PUBLICAR MÚSICA")) + '</button>';
}

// ==================== AÇÕES DO EDITOR ====================
function adicionarToken(token) {
  const ed = state.editor;
  if (!token || ed.secoes.length === 0) return;
  const idx = Math.min(ed.secaoAtivaIdx, ed.secoes.length - 1);
  const alvo = ed.secoes[idx];
  if (ed.novoCompasso || alvo.compassos.length === 0) alvo.compassos.push([token]);
  else alvo.compassos[alvo.compassos.length - 1].push(token);
  ed.novoCompasso = true;
}
function adicionarAcorde(raiz) {
  const ed = state.editor;
  const raizExibida = ed.useFlats ? sharpToFlatLabel(raiz) : raiz;
  adicionarToken(raizExibida + ed.qualidade);
}
function adicionarSimbolo(simbolo) {
  adicionarToken(simbolo);
}
function desfazer() {
  const ed = state.editor;
  if (ed.secoes.length === 0) return;
  const idx = Math.min(ed.secaoAtivaIdx, ed.secoes.length - 1);
  const alvo = ed.secoes[idx];
  if (alvo.compassos.length === 0) return;
  const ultimo = alvo.compassos[alvo.compassos.length - 1];
  ultimo.pop();
  if (ultimo.length === 0) alvo.compassos.pop();
}
function removerAcordeEm(secaoIdx, compassoIdx, acordeIdx) {
  const ed = state.editor;
  const compasso = ed.secoes[secaoIdx].compassos[compassoIdx];
  compasso.splice(acordeIdx, 1);
  if (compasso.length === 0) ed.secoes[secaoIdx].compassos.splice(compassoIdx, 1);
}
function removerSecao(idx) {
  const ed = state.editor;
  ed.secoes.splice(idx, 1);
  ed.secaoAtivaIdx = Math.max(0, ed.secaoAtivaIdx >= idx ? ed.secaoAtivaIdx - 1 : ed.secaoAtivaIdx);
}
function iniciarSecao(nome) {
  if (!nome) return;
  const ed = state.editor;
  ed.secoes.push({ titulo: nome, compassos: [] });
  ed.secaoAtivaIdx = ed.secoes.length - 1;
  ed.novoCompasso = true;
}
function publicar() {
  const ed = state.editor;
  ed.erro = "";
  const tituloEl = document.getElementById("campo-titulo");
  const autorEl = document.getElementById("campo-autor");
  const pinEl = document.getElementById("campo-pin");
  ed.titulo = tituloEl ? tituloEl.value : ed.titulo;
  ed.autor = autorEl ? autorEl.value : ed.autor;
  ed.pin = pinEl ? pinEl.value : ed.pin;

  if (!ed.titulo.trim() || !ed.autor.trim()) { ed.erro = "Preencha o título e o seu nome."; render(); return; }
  if (ed.secoes.length === 0) { ed.erro = "Adicione pelo menos um acorde antes de publicar."; render(); return; }
  if (ed.categoria === "oficial" && ed.pin !== PIN_OFICIAL) { ed.erro = "PIN incorreto para publicar no Repertório Oficial."; render(); return; }

  ed.publicando = true;
  render();
  const dados = { title: ed.titulo.trim(), author: ed.autor.trim(), category: ed.categoria, secoes: ed.secoes };
  const operacao = ed.editandoId
    ? supabaseClient.from("songs").update(dados).eq("id", ed.editandoId)
    : supabaseClient.from("songs").insert(dados);
  operacao.then(function (res) {
    ed.publicando = false;
    if (res.error) { ed.erro = "Erro ao salvar: " + res.error.message; render(); return; }
    resetEditor();
    state.page = "inicio";
    carregarMusicas();
  });
}

// ==================== EVENTOS ====================
function bindEvents() {
  const elementos = root().querySelectorAll("[data-action]");
  elementos.forEach(function (el) {
    const action = el.dataset.action;

    if (action === "ir") el.addEventListener("click", function () { state.musicaAberta = null; state.page = el.dataset.page; render(); });
    if (action === "abrir-musica") el.addEventListener("click", function () { state.musicaAberta = encontrarMusicaPorId(el.dataset.id); state.viewer = { semitons: 0, useFlats: false }; render(); });
    if (action === "voltar") el.addEventListener("click", function () { state.musicaAberta = null; render(); });
    if (action === "editar-musica") el.addEventListener("click", function () { carregarMusicaNoEditor(encontrarMusicaPorId(el.dataset.id)); render(); });
    if (action === "voltar-inicio") el.addEventListener("click", function () { state.page = "inicio"; render(); });
    if (action === "transpor") el.addEventListener("click", function () { state.viewer.semitons += parseInt(el.dataset.delta, 10); render(); });
    if (action === "resetar-tom") el.addEventListener("click", function () { state.viewer.semitons = 0; render(); });
    if (action === "toggle-flats") el.addEventListener("change", function () { state.viewer.useFlats = el.checked; render(); });
    if (action === "toggle-flats-editor") el.addEventListener("change", function () { state.editor.useFlats = el.checked; render(); });
    if (action === "qualidade") el.addEventListener("click", function () { state.editor.qualidade = el.dataset.suffix; render(); });
    if (action === "nota") el.addEventListener("click", function () { adicionarAcorde(el.dataset.nota); render(); });
    if (action === "simbolo") el.addEventListener("click", function () { adicionarSimbolo(el.dataset.simbolo); render(); });
    if (action === "simbolo-custom") el.addEventListener("click", function () {
      const campo = document.getElementById("campo-simbolo-custom");
      adicionarSimbolo(campo ? campo.value.trim() : "");
      render();
    });
    if (action === "toggle-compasso") el.addEventListener("click", function () { state.editor.novoCompasso = false; render(); });
    if (action === "desfazer") el.addEventListener("click", function () { desfazer(); render(); });
    if (action === "nova-secao") el.addEventListener("click", function () { iniciarSecao(el.dataset.nome); render(); });
    if (action === "nova-secao-custom") el.addEventListener("click", function () {
      const campo = document.getElementById("campo-nova-secao");
      iniciarSecao(campo ? campo.value.trim() : "");
      render();
    });
    if (action === "ativar-secao") el.addEventListener("click", function () { state.editor.secaoAtivaIdx = parseInt(el.dataset.idx, 10); render(); });
    if (action === "remover-secao") el.addEventListener("click", function () { removerSecao(parseInt(el.dataset.idx, 10)); render(); });
    if (action === "remover-acorde") el.addEventListener("click", function () { removerAcordeEm(parseInt(el.dataset.secao,10), parseInt(el.dataset.compasso,10), parseInt(el.dataset.acorde,10)); render(); });
    if (action === "categoria") el.addEventListener("change", function () { state.editor.categoria = el.value; render(); });
    if (action === "publicar") el.addEventListener("click", publicar);
  });

  const campoTitulo = document.getElementById("campo-titulo");
  if (campoTitulo) campoTitulo.addEventListener("input", function (e) { state.editor.titulo = e.target.value; });
  const campoAutor = document.getElementById("campo-autor");
  if (campoAutor) campoAutor.addEventListener("input", function (e) { state.editor.autor = e.target.value; });
  const campoPin = document.getElementById("campo-pin");
  if (campoPin) campoPin.addEventListener("input", function (e) { state.editor.pin = e.target.value; });
}

// ==================== INICIALIZAÇÃO ====================
resetEditor();
render();
carregarMusicas();
