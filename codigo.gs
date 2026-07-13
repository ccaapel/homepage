// ============================================================
// CCAA PELOTAS — Apps Script Backend
// Cole TODO este conteúdo em: Extensões > Apps Script > Código.gs
// (apague o que estiver lá antes; a 1ª linha tem que ser // e NÃO <!DOCTYPE)
// Depois: Implantar > Gerenciar implantações > lápis > Nova versão > Implantar
// Copie a URL /exec gerada e cole no index.html em SCRIPT_URL
// ============================================================

const SENHA_ADMIN = "ccaa2026";

// ID da planilha CCAA (extraído da URL do Google Sheets).
const SHEET_ID = "1MG3pQOlH5kYksNBUavNfmd23IPl-iiiimGVJKG1w8xA";
function getSS(){ return SpreadsheetApp.openById(SHEET_ID); }

// Diagnóstico: mostra qual planilha o Script abre e testa gravação real
function debugInfo(){
  const out = {};
  try {
    const ss = getSS();
    out.planilha_nome = ss.getName();
    out.planilha_url = ss.getUrl();
    out.abas_na_planilha = ss.getSheets().map(function(s){ return s.getName(); });
    out.abas_esperadas = ABAS;
    const aba = "Valquíria: QUARTA-FEIRA - Sala 13";
    const sheet = ss.getSheetByName(aba);
    out.aba_teste_existe = !!sheet;
    if (sheet) {
      const ultima = sheet.getLastRow();
      out.ultima_linha = ultima;
      const linhaTeste = ultima + 1;
      sheet.getRange(linhaTeste, 1).setValue("DEBUG_" + new Date().getTime());
      SpreadsheetApp.flush();
      out.valor_relido = sheet.getRange(linhaTeste, 1).getValue();
      out.gravou_e_releu = String(out.valor_relido).indexOf("DEBUG_") === 0;
      sheet.getRange(linhaTeste, 1).clearContent();
    }
    out.usuario_efetivo = Session.getEffectiveUser().getEmail();
  } catch (e) {
    out.erro = e.message;
  }
  return out;
}

// Abas da planilha (nomes EXATOS conforme o Google Sheets)
const ABAS = [
  "Valquíria: SEGUNDA-FEIRA - Sala 14",
  "Eduarda: SEGUNDA-FEIRA - Sala 2",
  "Laura: SEGUNDA-FEIRA - Sala 13",
  "Laura: TERÇA-FEIRA - Sala 2",
  "Tânia: TERÇA-FEIRA - Sala 2",
  "Laura: QUARTA-FEIRA - Sala 2",
  "Valquíria: QUARTA-FEIRA - Sala 13",
  "OFF Laura: QUINTA-FEIRA - Sala 8",
  "Laura: SEXTA-FEIRA - Sala 2",
];

// Índices das colunas (0-based)
const COL = {
  ALUNO:      0,  // A - Aluno(a)
  DIA:        1,  // B - Dia da Semana
  HORARIO:    2,  // C - Horário
  DATA:       3,  // D - Data
  TEACHER:    4,  // E - Teacher (equiparador)
  TCH_TURMA:  5,  // F - Teacher da turma
  TURMA:      6,  // G - Turma
  LESSONS:    7,  // H - Lessons
  SITUATION:  8,  // I - Situation
  PENDENTE:   9,  // J - Pendente
  FORMATO:   10,  // K - Formato
  HIBRIDO:   11,  // L - Híbrido
  STATUS:    12,  // M - Status
  AGENDADO:  13,  // N - Agendado por
};

// ============================================================
// ENTRY POINT
// ============================================================
function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const params   = e.parameter || {};
  const action   = params.action   || "listar";
  const senha    = params.senha    || "";
  const callback = params.callback || "";

  if (senha !== SENHA_ADMIN) {
    return jsonOut({ ok: false, erro: "Senha inválida" }, callback);
  }

  try {
    if (action === "listar")     return jsonOut({ ok: true, dados: listarTodos() }, callback);
    if (action === "salvar")      return jsonOut(salvarLinha(params), callback);
    if (action === "excluir")     return jsonOut(excluirLinha(params), callback);
    if (action === "padronizar")  return jsonOut(padronizarTudo(), callback);
    if (action === "reordenar")   return jsonOut(reordenarTudo(), callback);
    if (action === "debug")       return jsonOut(debugInfo(), callback);
    if (action === "logAcesso")   return jsonOut(logAcesso(params), callback);
    if (action === "getConfig")   return jsonOut(getConfig(params), callback);
    if (action === "setConfig")   return jsonOut(setConfig(params), callback);
    if (action === "getHorarios") return jsonOut(getHorarios(), callback);
    if (action === "setHorarios") return jsonOut(setHorarios(params), callback);
    return jsonOut({ ok: false, erro: "Ação desconhecida" }, callback);
  } catch (err) {
    return jsonOut({ ok: false, erro: err.message + " | stack: " + (err.stack||"") }, callback);
  }
}

// ============================================================
// LISTAR
// ============================================================
function listarTodos() {
  const ss = getSS();
  const registros = [];

  ABAS.forEach(nomeAba => {
    const sheet = ss.getSheetByName(nomeAba);
    if (!sheet) return;

    const range = sheet.getDataRange();
    const dados = range.getValues();
    const disp  = range.getDisplayValues();

    const cmap = mapearColunas(disp);
    const inicio = cmap._headerRow != null ? cmap._headerRow + 1 : 2;

    let ultimoReg = null;

    for (let r = inicio; r < dados.length; r++) {
      const row  = dados[r];
      const drow = disp[r];

      const cel  = (nome) => { const i = cmap[nome]; return (i==null) ? "" : String(drow[i]||"").trim(); };
      const celR = (nome) => { const i = cmap[nome]; return (i==null) ? "" : row[i]; };

      const aluno = cel("aluno");
      const horarioStr = normHoraTexto(cel("horario"));
      const dataStr    = cel("data");

      const temConteudo = aluno || dataStr || cel("turma") || cel("situation") || cel("lessons") || cel("status");

      if (!temConteudo && horarioStr && ultimoReg) {
        registros.push(Object.assign({}, ultimoReg, {
          id: nomeAba + "||" + r,
          linha: r,
          horario: horarioStr
        }));
        continue;
      }

      if (!temConteudo) continue;
      if (aluno.toUpperCase().includes("INDISPONÍVEL")) continue;
      if (ehLinhaModeloMap(drow, cmap)) continue;

      let turma = cel("turma");
      if (/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(turma) || celR("turma") instanceof Date) turma = "";
      if (!turma){
        var reT = /^([TtAa])?\s*\d{1,2}\.\d{1,2}$/;
        for (var c = 0; c < drow.length; c++){
          if (c === cmap.horario || c === cmap.data) continue;
          var val = String(drow[c]||"").trim();
          if (reT.test(val)){ turma = val; break; }
        }
      }

      let lessons   = cel("lessons");
      let situation = cel("situation");
      if (/^[-–—\s]*$/.test(lessons))   lessons = "";
      if (/^[-–—\s]*$/.test(situation)) situation = "";
      lessons   = padronizarLessons(lessons,   "L");
      situation = padronizarLessons(situation, "S");
      if (lessons && !situation) situation = lessons;
      else if (situation && !lessons) lessons = situation;

      let formato = resolverFormato(cel("formato"), lessons, situation, cel("pendente"), cel("hibrido"));

      if (formato === "Apoio" && !lessons && !situation){
        lessons = "Material do apoio";
        situation = "Material do apoio";
      }

      const novoReg = {
        id:        nomeAba + "||" + r,
        aba:       nomeAba,
        linha:     r,
        aluno:     aluno,
        dia:       cel("dia"),
        horario:   horarioStr,
        data:      dataStr,
        teacher:   cel("teacher"),
        tchTurma:  cel("tchTurma"),
        turma:     turma,
        lessons:   lessons,
        situation: situation,
        pendente:  cel("pendente"),
        formato:   formato,
        hibrido:   cel("hibrido"),
        status:    cel("status"),
        agendado:  cel("agendado"),
      };
      registros.push(novoReg);
      ultimoReg = novoReg;
    }
  });

  return registros;
}

// ============================================================
// mapearColunas — busca o cabeçalho em até 10 linhas (qualquer aba)
// Retorna o mapa de colunas + _headerRow (índice da linha do cabeçalho).
// ============================================================
function mapearColunas(disp){
  var padrao = {
    aluno:0, dia:1, horario:2, data:3, teacher:4, tchTurma:5, turma:6,
    lessons:7, situation:8, pendente:9, formato:10, hibrido:11, status:12, agendado:13
  };
  var header = null;
  var headerRow = null;
  // Busca até 10 linhas para encontrar o cabeçalho real (independente de títulos/merges acima)
  for (var h = 0; h < Math.min(10, disp.length); h++){
    var linha = disp[h].map(function(c){ return String(c||"").trim().toLowerCase(); });
    if (linha.indexOf("aluno(a)") !== -1 || linha.indexOf("aluno") !== -1){
      header = linha;
      headerRow = h;
      break;
    }
  }
  if (!header) return Object.assign({}, padrao, { _headerRow: null });

  var sinonimos = {
    aluno:     ["aluno(a)","aluno","nome"],
    dia:       ["dia da semana","dia"],
    horario:   ["horário","horario"],
    data:      ["data"],
    teacher:   ["teacher","professor","teacher equiparador"],
    tchTurma:  ["teacher da turma"],
    turma:     ["turma"],
    lessons:   ["lessons","lesson"],
    situation: ["situation","situação"],
    pendente:  ["pendente"],
    formato:   ["formato"],
    hibrido:   ["híbrido","hibrido","modalidade"],
    status:    ["status"],
    agendado:  ["agendado por:","agendado por","agendado"]
  };
  var mapa = {};
  for (var chave in sinonimos){
    var idx = null;
    for (var i = 0; i < header.length; i++){
      if (sinonimos[chave].indexOf(header[i]) !== -1){ idx = i; break; }
    }
    mapa[chave] = (idx == null) ? padrao[chave] : idx;
  }

  mapa.turma = acharColunaTurma(disp, mapa.turma);
  mapa._headerRow = headerRow;

  return mapa;
}

function acharColunaTurma(disp, idxAtual){
  var reTurma = /^([TtAa])?\s*\d{1,2}\.\d{1,2}$/;
  var reTurma2 = /^(kids|baby|preteen|teen|english|master)\s*\d/i;
  function pontua(col){
    var n = 0;
    for (var r = 2; r < disp.length; r++){
      var v = String(disp[r][col]||"").trim();
      if (!v) continue;
      if (reTurma.test(v) || reTurma2.test(v)) n++;
    }
    return n;
  }
  var melhorCol = idxAtual, melhorPts = (idxAtual!=null) ? pontua(idxAtual) : -1;
  var nCols = disp[0] ? disp[0].length : 0;
  for (var c = 0; c < nCols; c++){
    var p = pontua(c);
    if (p > melhorPts){ melhorPts = p; melhorCol = c; }
  }
  return (melhorPts > 0) ? melhorCol : idxAtual;
}

function ehLinhaModeloMap(drow, cmap){
  var rot = {
    aluno:["aluno(a)","aluno","nome"], dia:["dia da semana","dia"],
    horario:["horário","horario"], data:["data"], turma:["turma"],
    situation:["situation","situação"], formato:["formato"], status:["status"]
  };
  function bate(nome, lista){ var i=cmap[nome]; if(i==null) return false; return lista.indexOf(String(drow[i]||"").trim().toLowerCase())!==-1; }
  var hits=0;
  if(bate("aluno",rot.aluno))hits++;
  if(bate("dia",rot.dia))hits++;
  if(bate("horario",rot.horario))hits++;
  if(bate("data",rot.data))hits++;
  if(bate("turma",rot.turma))hits++;
  if(bate("situation",rot.situation))hits++;
  if(bate("formato",rot.formato))hits++;
  if(bate("status",rot.status))hits++;
  return hits>=2;
}

function normHoraTexto(v){
  var s = String(v||"").trim();
  if (!s) return "";
  var m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return ("0"+m[1]).slice(-2)+":"+m[2];
  var mh = s.match(/^(\d{1,2})h(\d{2})?$/i);
  if (mh) return ("0"+mh[1]).slice(-2)+":"+(mh[2]||"00");
  return s;
}

function resolverFormato(formato, lessons, situation, pendente, hibrido){
  formato = String(formato||"").trim();
  if (/^(presencial|online|híbrido|hibrido)$/i.test(formato)) formato = "";
  var alvo = (formato + " " + lessons + " " + situation + " " + pendente).toLowerCase();
  if (/\bprova\b/.test(alvo))                                   return "Prova";
  if (/\bnivela/.test(alvo))                                    return "Nivelamento";
  if (/\bequipara/.test(alvo))                                  return "Equiparação";
  if (/\bapoio\b/.test(alvo) || /material do apoio/.test(alvo)) return "Apoio";
  return formato;
}

// ============================================================
// CHAVE DE ORDENAÇÃO — compartilhada por salvar e reordenar
// Aceita Date (valor bruto do Sheets) E string dd/MM/yyyy.
// Retorna AAAAMMDD + HHMM. Data ilegível -> 99999999 (vai pro FIM).
// ============================================================
function chaveOrdem(dataVal, horVal){
  var dataStr = (dataVal instanceof Date)
    ? Utilities.formatDate(dataVal, "America/Sao_Paulo", "dd/MM/yyyy")
    : String(dataVal||"").trim();

  var horStr;
  if (horVal instanceof Date){
    horStr = fmtHora(horVal);
  } else {
    var mh = String(horVal||"").trim().match(/(\d{1,2}):(\d{2})/);
    horStr = mh ? (("0"+mh[1]).slice(-2)+":"+mh[2]) : String(horVal||"").trim();
  }

  var iso = "99999999";
  var dBarra = dataStr.split("/");
  var dTraco = dataStr.split("-");
  if (dBarra.length === 3){
    iso = dBarra[2] + String(dBarra[1]).padStart(2,"0") + String(dBarra[0]).padStart(2,"0");
  } else if (dTraco.length === 3 && dTraco[0].length === 4){
    iso = dTraco[0] + String(dTraco[1]).padStart(2,"0") + String(dTraco[2]).padStart(2,"0");
  }

  var h = horStr.replace(":","").padStart(4,"0");
  return iso + h;
}

// ============================================================
// SALVAR — cria ou atualiza uma linha
//  - Edição (linha >= 2): grava na linha existente.
//  - Novo: detecta a primeira linha real de dados (após títulos e cabeçalho,
//    independente de quantas linhas de título cada aba tiver), depois insere
//    na posição cronológica exata por data + horário.
// ============================================================
function salvarLinha(p) {
  const ss = getSS();
  const nomeAba = p.aba;
  if (!nomeAba) return { ok: false, erro: "Aba não informada" };
  const sheet = ss.getSheetByName(nomeAba);
  if (!sheet) return { ok: false, erro: "Aba não encontrada: " + nomeAba };

  const disp = sheet.getDataRange().getDisplayValues();
  const cmap = mapearColunas(disp);

  const infoAba    = parseAba(nomeAba);
  const diaSemana  = infoAba.dia;
  const teacherAba = infoAba.teacher;
  const turma = normalizaTurma(p.turma || "");

  let lessons   = padronizarLessons((p.lessons   || "").trim(), "L");
  let situation = padronizarLessons((p.situation || "").trim(), "S");
  if (lessons && !situation) situation = lessons;
  else if (situation && !lessons) lessons = situation;
  // Mesma regra do corretor da planilha: Lessons, Situation e Pendente sempre em MAIÚSCULA.
  lessons   = normalizarTextoCanonico_(lessons);
  situation = normalizarTextoCanonico_(situation);
  const pendente = normalizarTextoCanonico_((p.pendente || "").trim());

  const valoresPorNome = {
    aluno:    p.aluno     || "",
    dia:      diaSemana,
    horario:  p.horario   || "",
    data:     p.data      || "",
    teacher:  teacherAba,
    tchTurma: p.tchTurma  || "",
    turma:    turma,
    lessons:  lessons,
    situation:situation,
    pendente: pendente,
    formato:  p.formato   || "",
    hibrido:  p.hibrido   || "",
    status:   p.status    || "",
    agendado: p.agendado  || "",
  };

  const linha = parseInt(p.linha || "0");
  let alvo;

  if (linha >= 2) {
    // EDIÇÃO: grava na linha existente
    alvo = linha;
    try { sheet.getRange(alvo + 1, 1, 1, 14).breakApart(); } catch (e) {}
  } else {
    // NOVO: insere na posição cronológica correta
    const all = sheet.getDataRange().getValues();
    const iAluno = cmap.aluno, iData = cmap.data, iHor = cmap.horario;

    // Primeira linha real de dados: logo após o cabeçalho detectado
    // Se não encontrou cabeçalho, usa linha 2 (índice) como fallback
    const primeiraLinhaDados = cmap._headerRow != null ? cmap._headerRow + 1 : 2;

    // Uma linha tem dados reais se tiver ALUNO ou DATA com dígitos
    // (ignora linhas de títulos, merges e linhas pré-preenchidas com dia/teacher)
    function temDados(r){
      const aluno = String(all[r][iAluno]||"").trim();
      const data  = all[r][iData];
      const temData = (data instanceof Date) || (String(data||"").trim() !== "" && /\d/.test(String(data)));
      return aluno !== "" || temData;
    }

    const chaveNova = chaveOrdem(p.data, p.horario);

    // Última linha com dados reais (limite superior da busca)
    let ultimaComDados = primeiraLinhaDados - 1;
    for (let r = primeiraLinhaDados; r < all.length; r++) {
      if (temDados(r)) ultimaComDados = r;
    }

    // Primeira linha cujo data+hora é ESTRITAMENTE MAIOR que a nova
    // Empate (mesma data+hora) não interrompe: nova entra depois do bloco igual
    let inserirAntesDe = -1;
    for (let r = primeiraLinhaDados; r <= ultimaComDados; r++) {
      if (!temDados(r)) continue;
      const ch = chaveOrdem(all[r][iData], all[r][iHor]);
      if (ch > chaveNova) { inserirAntesDe = r; break; }
    }

    if (inserirAntesDe >= primeiraLinhaDados) {
      // Insere ANTES da primeira linha com data maior
      sheet.insertRowBefore(inserirAntesDe + 1);
      alvo = inserirAntesDe;
    } else {
      // A nova é a mais recente: insere logo após a última linha com dados
      sheet.insertRowAfter(ultimaComDados + 1);
      alvo = ultimaComDados + 1;
    }
  }

  // Desfaz qualquer merge na linha alvo antes de gravar
  try { sheet.getRange(alvo + 1, 1, 1, 14).breakApart(); } catch (e) {}

  // Grava célula a célula nas posições corretas do mapa
  for (const nome in valoresPorNome) {
    const col = cmap[nome];
    if (col == null || col === '_headerRow') continue;
    sheet.getRange(alvo + 1, col + 1).setValue(valoresPorNome[nome]);
  }

  // Remove tachado/itálico herdado de linhas canceladas
  const nCols = (disp[0] ? disp[0].length : 14) || 14;
  sheet.getRange(alvo + 1, 1, 1, nCols).setFontLine("none").setFontStyle("normal");

  // Para linhas novas: reordena a aba para garantir ordem cronológica correta
  // (independente de onde o insertRow colocou a linha)
  if (!linha) reordenarAba_(sheet, cmap);

  return { ok: true, acao: linha >= 2 ? "atualizado" : "criado", aba: nomeAba, linha: alvo };
}

// ============================================================
// REORDENAR UMA ABA — ordena por data+horário, mantém linhas-modelo no fim
// Reutilizado por salvarLinha (após nova inserção) e reordenarTudo.
// ============================================================
function reordenarAba_(sheet, cmap) {
  const range   = sheet.getDataRange();
  const valores = range.getValues();
  if (valores.length <= 2) return;

  const iAluno = cmap.aluno, iData = cmap.data, iHor = cmap.horario;
  const primeiraLinhaDados = cmap._headerRow != null ? cmap._headerRow + 1 : 2;

  function temDadosR(row) {
    const aluno  = String(row[iAluno] || "").trim();
    const data   = row[iData];
    const temData = (data instanceof Date) || (String(data || "").trim() !== "" && /\d/.test(String(data)));
    return aluno !== "" || temData;
  }

  const corpo     = valores.slice(primeiraLinhaDados);
  const comDados  = [];
  const semDados  = [];
  corpo.forEach(function (row, i) {
    if (temDadosR(row)) comDados.push({ row: row, ordem: i });
    else semDados.push(row);
  });

  comDados.sort(function (a, b) {
    const ka = chaveOrdem(a.row[iData], a.row[iHor]);
    const kb = chaveOrdem(b.row[iData], b.row[iHor]);
    if (ka < kb) return -1;
    if (ka > kb) return  1;
    return a.ordem - b.ordem;
  });

  const novoCorpo = comDados.map(function (x) { return x.row; }).concat(semDados);
  if (novoCorpo.length) {
    const nCols = valores[0].length;
    sheet.getRange(primeiraLinhaDados + 1, 1, novoCorpo.length, nCols).setValues(novoCorpo);
  }
}

// ============================================================
// EXCLUIR — limpa conteúdo da linha
// ============================================================
function excluirLinha(p) {
  const ss = getSS();
  const nomeAba = p.aba;
  const linha   = parseInt(p.linha || "0");

  if (!nomeAba || linha < 2) return { ok: false, erro: "Parâmetros inválidos" };

  const sheet = ss.getSheetByName(nomeAba);
  if (!sheet) return { ok: false, erro: "Aba não encontrada: " + nomeAba };

  sheet.getRange(linha + 1, 1, 1, 14).clearContent();
  return { ok: true, acao: "excluido", aba: nomeAba, linha: linha };
}

// ============================================================
// REORDENAR EM MASSA — coloca toda a planilha em ordem cronológica
// ============================================================
function reordenarTudo() {
  const ss = getSS();
  let abasOrdenadas = 0;
  const detalhe = [];

  ABAS.forEach(nomeAba => {
    const sheet = ss.getSheetByName(nomeAba);
    if (!sheet) return;
    const disp = sheet.getDataRange().getDisplayValues();
    const cmap = mapearColunas(disp);
    reordenarAba_(sheet, cmap);
    abasOrdenadas++;
    detalhe.push(nomeAba);
  });

  return { ok: true, acao: "reordenado", abas: abasOrdenadas, detalhe: detalhe };
}

// ============================================================
// HELPERS
// ============================================================
function ehLinhaModelo(row){
  var rotulos = {
    aluno:     ["aluno(a)","aluno", "nome"],
    dia:       ["dia da semana","dia"],
    horario:   ["horário","horario"],
    data:      ["data"],
    teacher:   ["teacher","teacher equiparador","professor"],
    tchTurma:  ["teacher da turma"],
    turma:     ["turma"],
    situation: ["situation","situação"],
    formato:   ["formato"],
    status:    ["status"]
  };
  function bate(v, lista){
    var s = String(v||"").trim().toLowerCase();
    return lista.indexOf(s) !== -1;
  }
  var hits = 0;
  if (bate(row[COL.ALUNO],     rotulos.aluno))     hits++;
  if (bate(row[COL.DIA],       rotulos.dia))       hits++;
  if (bate(row[COL.HORARIO],   rotulos.horario))   hits++;
  if (bate(row[COL.DATA],      rotulos.data))      hits++;
  if (bate(row[COL.TEACHER],   rotulos.teacher))   hits++;
  if (bate(row[COL.TCH_TURMA], rotulos.tchTurma))  hits++;
  if (bate(row[COL.TURMA],     rotulos.turma))     hits++;
  if (bate(row[COL.SITUATION], rotulos.situation)) hits++;
  if (bate(row[COL.FORMATO],   rotulos.formato))   hits++;
  if (bate(row[COL.STATUS],    rotulos.status))    hits++;
  return hits >= 2;
}

// Mesmas frases canônicas do corretor da planilha (corretor-planilha.gs), aplicadas
// já na hora de salvar pelo painel — assim a planilha nasce no padrão certo.
function normalizarTextoCanonico_(s){
  s = String(s || "").trim();
  if (!s) return s;
  s = s.replace(/conte[úu]do do apoio/gi, "MATERIAL DO APOIO");
  s = s.replace(/material do apoio/gi, "MATERIAL DO APOIO");
  s = s.replace(/practice test/gi, "PRACTICE TEST");
  return s.toUpperCase();
}

function padronizarLessons(txt, prefixoForcado){
  txt = String(txt||"").trim();
  if (!txt) return "";
  var nums = (txt.match(/\d{1,2}/g) || []).map(function(n){ return parseInt(n,10); });
  var soLista = /^[\sSsLl0-9,&eE\-–—\.]+$/.test(txt) && nums.length > 0;
  if (!soLista) return txt;
  var prefixo = prefixoForcado || (/[Ss]\s*\d/.test(txt) ? "S" : "L");
  var uniq = [];
  nums.forEach(function(n){ if(uniq.indexOf(n)===-1) uniq.push(n); });
  uniq.sort(function(a,b){ return a-b; });
  var arr = uniq.map(function(n){ return prefixo+n; });
  if (arr.length === 1) return arr[0];
  return arr.slice(0,-1).join(", ") + " E " + arr[arr.length-1];
}

// ============================================================
// PADRONIZAR EM MASSA — corrige Lessons/Situation de todas as abas
// ============================================================
function padronizarTudo() {
  const ss = getSS();
  let alteradas = 0;
  const detalhe = [];

  ABAS.forEach(nomeAba => {
    const sheet = ss.getSheetByName(nomeAba);
    if (!sheet) return;

    const disp = sheet.getDataRange().getDisplayValues();
    const cmap = mapearColunas(disp);
    const iL = cmap.lessons, iS = cmap.situation, iP = cmap.pendente;
    const primeiraLinhaDados = cmap._headerRow != null ? cmap._headerRow + 1 : 2;

    for (let r = primeiraLinhaDados; r < disp.length; r++) {
      if (ehLinhaModeloMap(disp[r], cmap)) continue;

      if (iL != null) {
        const orig = String(disp[r][iL] || "").trim();
        if (orig && !/^[-–—\s]*$/.test(orig)) {
          const novo = normalizarTextoCanonico_(padronizarLessons(orig, "L"));
          if (novo !== orig) {
            sheet.getRange(r + 1, iL + 1).setValue(novo);
            alteradas++;
            detalhe.push(nomeAba + " L" + (r+1) + ": '" + orig + "' -> '" + novo + "'");
          }
        }
      }
      if (iS != null) {
        const orig = String(disp[r][iS] || "").trim();
        if (orig && !/^[-–—\s]*$/.test(orig)) {
          const novo = normalizarTextoCanonico_(padronizarLessons(orig, "S"));
          if (novo !== orig) {
            sheet.getRange(r + 1, iS + 1).setValue(novo);
            alteradas++;
            detalhe.push(nomeAba + " S" + (r+1) + ": '" + orig + "' -> '" + novo + "'");
          }
        }
      }
      if (iP != null) {
        const orig = String(disp[r][iP] || "").trim();
        if (orig && !/^[-–—\s]*$/.test(orig)) {
          const novo = normalizarTextoCanonico_(orig);
          if (novo !== orig) {
            sheet.getRange(r + 1, iP + 1).setValue(novo);
            alteradas++;
            detalhe.push(nomeAba + " Pendente" + (r+1) + ": '" + orig + "' -> '" + novo + "'");
          }
        }
      }
    }
  });

  return { ok: true, acao: "padronizado", celulas_alteradas: alteradas, detalhe: detalhe.slice(0, 200) };
}

function fmtData(v){
  if (v instanceof Date) return Utilities.formatDate(v, "America/Sao_Paulo", "dd/MM/yyyy");
  if (!v) return "";
  return String(v).trim();
}

function fmtHora(v){
  if (v instanceof Date) {
    // Usa timezone explícito para evitar confusão UTC vs BRT
    return Utilities.formatDate(v, "America/Sao_Paulo", "HH:mm");
  }
  if (!v && v !== 0) return "";
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return ("0"+m[1]).slice(-2) + ":" + m[2];
  var num = parseFloat(s);
  if (!isNaN(num) && num > 0 && num < 1){
    var totalMin = Math.round(num * 24 * 60);
    var hh = Math.floor(totalMin/60), mm = totalMin%60;
    return ("0"+hh).slice(-2)+":"+("0"+mm).slice(-2);
  }
  return s;
}

function parseAba(nomeAba){
  let dia = "", teacher = "";
  const antesDoisPontos = nomeAba.split(":")[0].replace(/^OFF\s+/i, "").trim();
  if (antesDoisPontos) teacher = "Teacher " + antesDoisPontos;
  const mapaDias = {
    "SEGUNDA": "Segunda-feira", "TERÇA": "Terça-feira", "TERCA": "Terça-feira",
    "QUARTA": "Quarta-feira", "QUINTA": "Quinta-feira", "SEXTA": "Sexta-feira",
    "SÁBADO": "Sábado", "SABADO": "Sábado", "DOMINGO": "Domingo"
  };
  const up = nomeAba.toUpperCase();
  for (const k in mapaDias){ if (up.indexOf(k) !== -1){ dia = mapaDias[k]; break; } }
  return { dia: dia, teacher: teacher };
}

function normalizaTurma(t){
  t = String(t || "").trim();
  if (!t) return "";
  const m = t.match(/^([TtAa]?)\s*(\d{1,2})\.(\d{1,2})$/);
  if (m){
    const prefixo = m[1].toUpperCase();
    const livro   = parseInt(m[2], 10);
    const modulo  = m[3];
    if (livro >= 4) return livro + "." + modulo;
    return (prefixo || "") + livro + "." + modulo;
  }
  return t;
}

function jsonOut(obj, callbackName) {
  const json = JSON.stringify(obj);
  if (callbackName) {
    const output = ContentService.createTextOutput(callbackName + "(" + json + ")");
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return output;
  }
  const output = ContentService.createTextOutput(json);
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}


// ============================================================
// REGISTRO DE ACESSOS — grava cada acesso/uso do site na aba "Acessos"
// ============================================================
function logAcesso(p) {
  try {
    const ss = getSS();
    let sh = ss.getSheetByName('Acessos');
    if (!sh) {
      sh = ss.insertSheet('Acessos');
      sh.appendRow(['Quando', 'Evento', 'Detalhe', 'Página', 'Navegador']);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    const carimbo = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
    sh.appendRow([carimbo, String(p.evento||''), String(p.detalhe||''), String(p.pagina||''), String(p.ua||'')]);
    // mantém histórico enxuto (últimas ~5000 linhas)
    const excesso = sh.getLastRow() - 1 - 5000;
    if (excesso > 0) sh.deleteRows(2, excesso);
  } catch (e) {}
  return { ok: true };
}

// ============================================================
// CONFIG COMPARTILHADA — aba "Config": matrículas do Comercial, saídas de
// material, valores do Financeiro, status dos alunos e horários por aba.
// É o que faz os dados valerem em QUALQUER navegador ou computador.
// ============================================================
function configSheet_() {
  const ss = getSS();
  let sh = ss.getSheetByName('Config');
  if (!sh) { sh = ss.insertSheet('Config'); try { sh.hideSheet(); } catch (e) {} }
  return sh;
}
function getConfig(p) {
  const chave = String(p.chave || '').trim();
  if (!chave) return { ok: false, erro: 'chave nao informada' };
  const vals = configSheet_().getDataRange().getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === chave) {
      var dados = null;
      try { dados = JSON.parse(String(vals[i][1] || 'null')); } catch (e) {}
      return { ok: true, chave: chave, dados: dados };
    }
  }
  return { ok: true, chave: chave, dados: null };
}
function setConfig(p) {
  const chave = String(p.chave || '').trim();
  if (!chave) return { ok: false, erro: 'chave nao informada' };
  const sh = configSheet_();
  const vals = sh.getDataRange().getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === chave) {
      sh.getRange(i + 1, 2).setValue(String(p.dados || 'null'));
      return { ok: true };
    }
  }
  sh.appendRow([chave, String(p.dados || 'null')]);
  return { ok: true };
}

// ============================================================
// HORÁRIOS POR ABA — usados pelo editor "Horários" do site.
// Integração de mão dupla: aba marcada como ativa fica VISÍVEL na planilha,
// aba desmarcada é ocultada.
// ============================================================
function getHorarios() {
  const r = getConfig({ chave: 'horarios_override' });
  return { ok: true, horarios: (r.dados || {}) };
}
function setHorarios(p) {
  const r = setConfig({ chave: 'horarios_override', dados: (p.dados || '{}') });
  try {
    const ov = JSON.parse(p.dados || '{}');
    const ss = getSS();
    Object.keys(ov).forEach(function (aba) {
      const sh = ss.getSheetByName(aba);
      if (!sh) return;
      if (ov[aba].ativa === true && sh.isSheetHidden()) sh.showSheet();
      if (ov[aba].ativa === false && !sh.isSheetHidden()) sh.hideSheet();
    });
  } catch (e) {}
  return r;
}
