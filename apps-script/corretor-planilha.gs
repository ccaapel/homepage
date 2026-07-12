/**
 * CORRETOR AUTOMÁTICO DA PLANILHA DE AGENDAMENTOS — CCAA PELOTAS
 * ============================================================================
 * Robô que roda TODO DIA sozinho e conserta erros de formatação que outras
 * pessoas deixam nas abas (células mescladas "pela metade", espaços sobrando,
 * datas tortas, nomes completos demais, etc.). No fim, escreve um relatório
 * numa aba dedicada destacando O QUE foi corrigido e QUEM tinha agendado a linha.
 *
 * --------------------------------------------------------------------------
 * IMPORTANTE: este robô deve ficar num PROJETO SEPARADO do backend de
 * agendamentos (Código.gs). Eles NÃO podem dividir o mesmo projeto, senão
 * dá conflito de nomes (ex.: "SENHA_ADMIN já declarado").
 *
 * COMO INSTALAR (uma vez só):
 *   1. Vá em https://script.google.com  >  "Novo projeto".
 *   2. Apague o conteúdo padrão e cole TUDO isto.
 *   3. Dê um nome ao projeto (ex.: "Corretor Diário CCAA").
 *   4. Salve (Ctrl+S).
 *   5. No topo, selecione a função  instalarGatilhos  e clique ▶ Executar.
 *      (Autorize o acesso na primeira vez.)
 *   --> Pronto. A partir daí ele roda sozinho TODO DIA (~13h) E também SEMPRE
 *       QUE alguém editar a planilha (conserta o erro quase na hora).
 *
 *   Para rodar AGORA e testar: selecione  corrigirPlanilha  e clique ▶.
 * --------------------------------------------------------------------------
 *
 * SEGURANÇA: o robô NUNCA apaga linhas, NUNCA mexe na linha de título do topo,
 * e NUNCA reescreve o conteúdo da coluna "Situation" (só tira espaços das pontas).
 * Toda alteração fica registrada na aba de relatório, com Antes/Depois.
 */

// ===================== CONFIGURAÇÃO =====================
// ID da planilha CCAA (o mesmo do backend, extraído da URL do Google Sheets).
var SHEET_ID_CORRETOR = "1MG3pQOlH5kYksNBUavNfmd23IPl-iiiimGVJKG1w8xA";
function planilhaCorretor_() { return SpreadsheetApp.openById(SHEET_ID_CORRETOR); }

var CONFIG = {
  ABA_RELATORIO: 'CORREÇÕES AUTOMÁTICAS - 13:00 DIARIAMENTE',  // aba onde o relatório é gravado
  TIMEZONE: 'America/Sao_Paulo',
  HORA_DIARIA: 13,                    // hora do dia para rodar (0-23)
  MAX_LINHAS_RELATORIO: 4000,         // limite de histórico guardado
  // Abas que o robô NÃO deve tocar (além da própria aba de relatório):
  ABAS_IGNORADAS: ['Acessos', 'Config', 'Configurações'],
  // Valores canônicos para padronizar (corrige só a grafia, não o significado):
  FORMATOS:  ['Equiparação', 'Apoio', 'Nivelamento', 'Prova'],
  STATUS:    ['Agendado', 'Realizado', 'Faltou', 'Cancelado', 'Remarcado'],
  HIBRIDO:   ['Presencial', 'Online', 'Híbrido']
};

// ===================== INSTALAÇÃO DOS GATILHOS =====================
// Rode ESTA função UMA vez para deixar o robô 100% automático:
//   1) roda todo dia ~13h  (limpeza geral, mesmo sem ninguém mexer)
//   2) roda SEMPRE QUE alguém editar a planilha (conserta o erro na hora)
function instalarGatilhos() {
  // Remove gatilhos antigos do robô (evita duplicar a cada reinstalação)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'corrigirPlanilha' || f === 'aoEditarPlanilha') ScriptApp.deleteTrigger(t);
  });
  // 1) Diário
  ScriptApp.newTrigger('corrigirPlanilha')
    .timeBased().everyDays(1).atHour(CONFIG.HORA_DIARIA)
    .inTimezone(CONFIG.TIMEZONE).create();
  // 2) Ao editar / alterar a planilha
  ScriptApp.newTrigger('aoEditarPlanilha')
    .forSpreadsheet(SHEET_ID_CORRETOR).onChange().create();
  Logger.log('Gatilhos instalados: diário (~' + CONFIG.HORA_DIARIA + 'h) + ao editar a planilha.');
}

// Mantido por compatibilidade (só o gatilho diário). Prefira instalarGatilhos().
function instalarGatilhoDiario() { instalarGatilhos(); }

// Disparado quando alguém edita a planilha. Protegido para NÃO rodar em excesso:
// no máximo uma correção a cada 30s e nunca duas ao mesmo tempo.
function aoEditarPlanilha(e) {
  var cache = CacheService.getScriptCache();
  if (cache.get('corretor_correndo')) return;   // já rodou faz pouco: ignora
  cache.put('corretor_correndo', '1', 30);       // trava por 30s
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return;               // outra execução em curso: sai
  try { corrigirPlanilha(); } catch (err) { Logger.log(err); }
  finally { lock.releaseLock(); }
}

// ===================== EXECUÇÃO PRINCIPAL =====================
function corrigirPlanilha() {
  var ss = planilhaCorretor_();
  var correcoes = [];   // {aba, linha, aluno, agendadoPor, tipo, antes, depois}
  var inicio = new Date();

  ss.getSheets().forEach(function (sheet) {
    var nome = sheet.getName();
    if (nome === CONFIG.ABA_RELATORIO) return;
    if (CONFIG.ABAS_IGNORADAS.indexOf(nome) !== -1) return;
    try {
      corrigirAba_(sheet, correcoes);
    } catch (err) {
      correcoes.push({ aba: nome, linha: '-', aluno: '', agendadoPor: '',
        tipo: 'ERRO no robô', antes: String(err), depois: '' });
    }
  });

  gravarRelatorio_(ss, correcoes, inicio);
  return correcoes.length;
}

// ===================== CORREÇÃO DE UMA ABA =====================
function corrigirAba_(sheet, correcoes) {
  var nome = sheet.getName();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;

  // 1) Descobre a linha de cabeçalho (procura "Aluno" nas primeiras 8 linhas)
  var headerRow = acharLinhaCabecalho_(sheet, lastCol);
  if (!headerRow) return;                 // aba sem formato esperado: pula
  var dataIni = headerRow + 1;
  if (dataIni > lastRow) return;

  // Toda aba de turma reconhecida deve ficar VISÍVEL na planilha (integração:
  // se estiver oculta, o robô a mostra, para nada ficar escondido do controle).
  try { if (sheet.isSheetHidden()) sheet.showSheet(); } catch (e) {}

  // 2) Mapa de colunas pelo nome do cabeçalho
  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(normCab_);
  var col = {
    aluno:     acharCol_(headers, ['aluno']),
    turma:     acharCol_(headers, ['turma']),
    teacher:   acharCol_(headers, ['teacher', 'professor']),
    data:      acharCol_(headers, ['data']),
    horario:   acharCol_(headers, ['horario']),
    lessons:   acharCol_(headers, ['lessons', 'licao', 'licoes']),
    situation: acharCol_(headers, ['situation', 'situacao']),
    pendente:  acharCol_(headers, ['pendente', 'pendencia']),
    formato:   acharCol_(headers, ['formato']),
    hibrido:   acharCol_(headers, ['hibrido', 'modalidade']),
    status:    acharCol_(headers, ['status']),
    agendado:  acharCol_(headers, ['agendado'])   // "Agendado por"
  };
  // Colunas usadas para identificar "quem" da linha no relatório — Aluno
  // quando existir, senão Turma (abas de Equiparação/Apoio/etc. não têm Aluno).
  var colQuem = col.aluno || col.turma;

  // ---- Estrutura de MESCLAGEM HORIZONTAL do cabeçalho ----
  // Algumas colunas (Situation, Agendado por, etc.) têm o cabeçalho mesclado em
  // mais de uma coluna da planilha. As LINHAS DE DADOS devem seguir a MESMA
  // mescla horizontal — senão a coluna fica "partida ao meio". Guardamos esses
  // grupos agora para recriar a mescla certinha depois de normalizar os valores.
  var gruposMescla = [];
  sheet.getRange(headerRow, 1, 1, lastCol).getMergedRanges().forEach(function (mr) {
    if (mr.getNumColumns() > 1) gruposMescla.push({ start: mr.getColumn(), span: mr.getNumColumns() });
  });

  // ---- FIX A: desfaz mesclas ERRADAS na área de dados (não toca no título) ----
  // Mescla VERTICAL (várias linhas) é o bug das "células pela metade": desfaz e
  // reporta. A horizontal é só normalizada (desfaz aqui e remescla no fim, no
  // FIX A2), então NÃO entra no relatório como erro.
  sheet.getRange(dataIni, 1, lastRow - dataIni + 1, lastCol)
    .getMergedRanges().forEach(function (mr) {
      // valor da mescla fica na 1ª célula; ao desmesclar o resto fica vazio (ok)
      var lin = mr.getRow();
      var multiLinha = mr.getNumRows() > 1;
      mr.breakApart();
      if (multiLinha) {
        correcoes.push(linhaInfo_(sheet, col, lin, nome,
          'Célula mesclada (vertical) desfeita', 'mesclada (' + mr.getA1Notation() + ')', 'separada'));
      }
    });

  // ---- Varre célula a célula a área de dados ----
  var range = sheet.getRange(dataIni, 1, lastRow - dataIni + 1, lastCol);
  var valores = range.getValues();

  for (var r = 0; r < valores.length; r++) {
    var linhaPlan = dataIni + r;
    var temAluno = colQuem && String(valores[r][colQuem - 1] || '').trim() !== '';

    // FIX B: tirar espaços das pontas em qualquer texto
    for (var c = 0; c < valores[r].length; c++) {
      var v = valores[r][c];
      if (typeof v === 'string') {
        var limpo = v.replace(/[ \t]+/g, ' ').replace(/^\s+|\s+$/g, '');
        if (limpo !== v) {
          valores[r][c] = limpo;
          correcoes.push(linhaInfo_(sheet, col, linhaPlan, nome,
            'Espaços extras removidos (col ' + (c + 1) + ')', v, limpo));
        }
      }
    }

    if (!temAluno) continue;   // linhas-modelo vazias: só formatação, sem conteúdo

    // FIX C: nome = primeiro nome + no máx. 1 sobrenome (nunca o nome 100% completo)
    if (col.aluno) {
      var antesNome = String(valores[r][col.aluno - 1] || '').trim();
      var depoisNome = encurtarNome_(antesNome);
      if (depoisNome && depoisNome !== antesNome) {
        valores[r][col.aluno - 1] = depoisNome;
        correcoes.push(linhaInfo_(sheet, col, linhaPlan, nome,
          'Nome encurtado (nome + 1 sobrenome)', antesNome, depoisNome));
      }
    }

    // FIX D: padroniza grafia de Formato / Status / Híbrido (não muda significado)
    padronizarLista_(valores[r], col.formato, CONFIG.FORMATOS, sheet, col, linhaPlan, nome, 'Formato', correcoes);
    padronizarLista_(valores[r], col.status,  CONFIG.STATUS,   sheet, col, linhaPlan, nome, 'Status',  correcoes);
    padronizarLista_(valores[r], col.hibrido, CONFIG.HIBRIDO,  sheet, col, linhaPlan, nome, 'Híbrido', correcoes);

    // FIX E: data -> dd/MM/yyyy (só quando dá pra ter certeza; senão sinaliza)
    if (col.data) {
      var cell = valores[r][col.data - 1];
      var fix = normalizarData_(cell);
      if (fix.mudou) {
        valores[r][col.data - 1] = fix.valor;
        correcoes.push(linhaInfo_(sheet, col, linhaPlan, nome,
          'Data padronizada (dd/mm/aaaa)', String(cell), fix.valor));
      } else if (fix.suspeita) {
        correcoes.push(linhaInfo_(sheet, col, linhaPlan, nome,
          '⚠ Data incompleta/ambígua (revisar à mão)', String(cell), '(mantida)'));
      }
    }

    // FIX F: Lessons -> notação L#, L# E L# (só se for claramente uma lista de números)
    if (col.lessons) {
      var antesL = String(valores[r][col.lessons - 1] || '');
      var depoisL = normalizarLessons_(antesL);
      if (depoisL !== null && depoisL !== antesL.trim()) {
        valores[r][col.lessons - 1] = depoisL;
        correcoes.push(linhaInfo_(sheet, col, linhaPlan, nome,
          'Lessons padronizadas', antesL, depoisL));
      }
    }

    // FIX H: padroniza GRAFIA dos textos de Situation, Pendente E Lessons.
    // (apoio->APOIO nas frases, pic->Pic, situations s1->S1, "conteúdo do apoio"
    //  -> "MATERIAL DO APOIO", "practice test" -> "PRACTICE TEST", e as situations
    //  de cada lesson: L7 (s1,2,3,4) L8 (s1,2) -> L7 (S1,S2,S3,S4) E L8 (S1,S2)).
    // Lessons também entra aqui: muita gente escreve "Practice test" / "Material
    // do apoio" / "L7 (s1,2)" nessa coluna — deve seguir o MESMO padrão.
    [col.situation, col.pendente, col.lessons].forEach(function (ci) {
      if (!ci) return;
      var antesT = String(valores[r][ci - 1] || '');
      var depoisT = normalizarSituation_(antesT);
      // Lessons, Situation e Pendente: SEMPRE em letra maiúscula (padrão da planilha).
      if (ci === col.lessons || ci === col.situation || ci === col.pendente) depoisT = depoisT.toUpperCase();
      if (depoisT !== antesT) {
        valores[r][ci - 1] = depoisT;
        correcoes.push(linhaInfo_(sheet, col, linhaPlan, nome,
          'Texto padronizado (col ' + ci + ')', antesT, depoisT));
      }
    });
  }

  // FIX M: reordena as linhas com conteúdo por Data e depois por Horário
  // (corrige o caso de uma linha de 16h aparecer ANTES da de 15h30 do mesmo dia)
  if (col.data || col.horario) {
    var indices = valores.map(function (linha, idx) {
      return { i: idx, tem: colQuem && String(linha[colQuem - 1] || '').trim() !== '' };
    });
    var comConteudo = indices.filter(function (x) { return x.tem; });
    var semConteudo = indices.filter(function (x) { return !x.tem; });
    var comConteudoOrdenado = comConteudo.slice().sort(function (a, b) {
      var da = valorOrdenavel_(col.data ? valores[a.i][col.data - 1] : null);
      var db = valorOrdenavel_(col.data ? valores[b.i][col.data - 1] : null);
      if (da !== db) return da - db;
      var ha = horarioMinutos_(col.horario ? valores[a.i][col.horario - 1] : null);
      var hb = horarioMinutos_(col.horario ? valores[b.i][col.horario - 1] : null);
      if (ha !== hb) return ha - hb;
      return a.i - b.i;   // mesma data/horário: mantém ordem original (estável)
    });
    var mudouOrdem = comConteudoOrdenado.some(function (x, pos) { return x.i !== comConteudo[pos].i; });
    if (mudouOrdem) {
      var novaOrdem = comConteudoOrdenado.concat(semConteudo).map(function (x) { return x.i; });
      valores = novaOrdem.map(function (idx) { return valores[idx]; });
      correcoes.push({ aba: nome, linha: '-', aluno: '', agendadoPor: '',
        tipo: 'Linhas reordenadas por horário/data', antes: '(fora de ordem)', depois: '(cronológico)' });
    }
  }

  // grava de volta os valores corrigidos de uma vez (rápido)
  range.setValues(valores);

  // ---- FIX G: formatação visual padrão (deixa tudo NÍTIDO, como o print bom) ----
  var nLinhas = lastRow - dataIni + 1;
  range.setFontFamily('Arial')         // fonte única em toda a área de dados
       .setFontSize(10)                // tamanho legível e uniforme (sem letras gigantes)
       .setFontWeight('bold')          // mantém o negrito no padrão das linhas 4/5 (referência)
       .setWrap(true)                  // texto quebra dentro da célula (nada é cortado)
       .setVerticalAlignment('middle') // centralizado na vertical, como o padrão bom
       .setHorizontalAlignment('center');

  // ---- FIX A2: recria a mescla HORIZONTAL das colunas que têm cabeçalho mesclado ----
  // (Situation, Agendado por, etc. ficam mescladas POR LINHA, igual ao padrão certo:
  //  uma célula larga por linha, sem "partir ao meio" e sem dropdown duplicado.)
  gruposMescla.forEach(function (g) {
    try { sheet.getRange(dataIni, g.start, nLinhas, g.span).mergeAcross(); } catch (e) {}
  });

  // ---- FIX I: borda padrão em TODAS as células da área de dados ----
  range.setBorder(true, true, true, true, true, true, null, SpreadsheetApp.BorderStyle.SOLID);

  // ---- FIX K: linhas com altura automática (some o "texto espremido/cortado") ----
  // Com wrap ligado, autoResizeRows expande cada linha até o conteúdo caber inteiro.
  try { sheet.autoResizeRows(dataIni, nLinhas); } catch (e) {}
  // Garante uma altura MÍNIMA confortável (linhas curtas não ficam coladas)
  try {
    for (var rr = dataIni; rr < dataIni + nLinhas; rr++) {
      if (sheet.getRowHeight(rr) < 24) sheet.setRowHeight(rr, 24);
    }
  } catch (e) {}

  // ---- FIX J: um ÚNICO menu suspenso na coluna "Agendado por" ----
  // (a mescla horizontal do FIX A2 já junta O+P numa célula só; aqui garantimos
  //  que a regra de validação seja única e idêntica em todas as linhas)
  normalizarValidacaoColuna_(sheet, col.agendado, dataIni, nLinhas);
}

// ===================== HELPERS =====================

// Reconhece o cabeçalho tanto em abas "por aluno" (tem coluna Aluno) quanto em
// abas "por turma" (Teacher/Turma/Lessons/Situation/Pendente/Formato/..., sem
// coluna Aluno — é o padrão das abas de Equiparação/Apoio/Nivelamento/Prova).
var CHAVES_CABECALHO_ = ['aluno', 'turma', 'teacher', 'lessons', 'situacao', 'situation',
  'pendente', 'formato', 'hibrido', 'status', 'agendado'];
function acharLinhaCabecalho_(sheet, lastCol) {
  var n = Math.min(8, sheet.getLastRow());
  var vals = sheet.getRange(1, 1, n, lastCol).getValues();
  for (var i = 0; i < vals.length; i++) {
    var linha = vals[i].map(normCab_);
    var acertos = linha.filter(function (h) {
      return CHAVES_CABECALHO_.some(function (k) { return h.indexOf(k) === 0; });
    }).length;
    if (acertos >= 2) return i + 1;   // pelo menos 2 colunas reconhecidas = é o cabeçalho
  }
  return 0;
}

function normCab_(h) {
  return String(h || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '').trim();
}

function acharCol_(headers, chaves) {
  for (var i = 0; i < headers.length; i++) {
    for (var k = 0; k < chaves.length; k++) {
      if (headers[i].indexOf(chaves[k]) === 0) return i + 1; // 1-based
    }
  }
  return 0;
}

// Primeiro nome + no máximo 1 sobrenome. "Carmem Laura Islabão Moraes" -> "Carmem Laura"
// Primeiro nome + 1 sobrenome. Trata partículas (de/da/dos/e) como parte do
// sobrenome: "Juliana de Bem" -> "Juliana de Bem"; "Carmem Laura Islabão" -> "Carmem Laura".
function encurtarNome_(nome) {
  var partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(' ');
  var particulas = { de: 1, da: 1, do: 1, dos: 1, das: 1, e: 1, di: 1, del: 1 };
  var out = [partes[0]];           // primeiro nome
  var i = 1;
  while (i < partes.length && particulas[partes[i].toLowerCase()]) { out.push(partes[i]); i++; }
  if (i < partes.length) out.push(partes[i]);   // primeiro sobrenome "de verdade"
  return out.join(' ');
}

// Padroniza textos livres de Situation/Pendente seguindo as regras do CCAA.
function normalizarSituation_(txt) {
  var s = String(txt || '');
  if (!s.trim()) return s;
  // 1) Grafia: apoio (mantém se já estiver TODO MAIÚSCULO), pic -> Pic, s1 -> S1
  s = s.replace(/\bapoio\b/gi, function (m) { return m === m.toUpperCase() ? m : 'Apoio'; });
  s = s.replace(/\bpic/gi, 'Pic');
  s = s.replace(/\bs(\d+)/g, 'S$1');                 // situações soltas: s1 -> S1
  // 2) Frases canônicas (sempre MAIÚSCULAS, mesmo sentido = mesmo padrão)
  s = s.replace(/conte[úu]do do apoio/gi, 'MATERIAL DO APOIO');
  s = s.replace(/material do apoio/gi, 'MATERIAL DO APOIO');
  s = s.replace(/practice test/gi, 'PRACTICE TEST');
  // 3) Situations de cada lesson: L7 (s1,2,3,4) L8 (s1,2) -> L7 (S1,S2,S3,S4) E L8 (S1,S2)
  s = fixSitLessons_(s);
  return s.replace(/[ \t]{2,}/g, ' ').trim();
}

// Normaliza grupos "L<num> (<situations>)" e junta consecutivos com " E ".
function fixSitLessons_(s) {
  var out = s.replace(/L\s*(\d+)\s*\(\s*([^)]*?)\s*\)/gi, function (m, num, inner) {
    var ni = normInner_(inner);
    return ni === null ? ('L' + num + ' (' + String(inner).trim() + ')') : ('L' + num + ' (' + ni + ')');
  });
  // garante " E " entre dois grupos de lesson seguidos
  out = out.replace(/\)\s*,?\s*(?:e|E)?\s*(L\s*\d+\s*\()/g, ') E $1');
  return out;
}

// Se o miolo do parêntese é uma lista de situations (s/S/$/dígitos), vira "S1,S2,...".
// Caso contrário (TODA, AD1, HOMEWORK, texto livre) retorna null e NÃO mexe.
function normInner_(inner) {
  var t = String(inner || '').trim();
  if (!/^[sS$\s]*\d+(\s*,\s*[sS$]*\s*\d+)*\s*,?$/.test(t)) return null;
  var nums = (t.match(/\d+/g) || []);
  if (!nums.length) return null;
  return nums.map(function (n) { return 'S' + n; }).join(',');
}

// Deixa UMA única regra de validação (dropdown) na coluna informada.
function normalizarValidacaoColuna_(sheet, colIdx, dataIni, nLinhas) {
  if (!colIdx || nLinhas < 1) return;
  try {
    var rng = sheet.getRange(dataIni, colIdx, nLinhas, 1);
    var regras = rng.getDataValidations();
    var modelo = null;
    for (var i = 0; i < regras.length; i++) { if (regras[i][0]) { modelo = regras[i][0]; break; } }
    if (!modelo) return;
    var novo = [];
    for (var j = 0; j < nLinhas; j++) novo.push([modelo]);
    rng.setDataValidations(novo);
  } catch (e) {}
}

// Converte a célula de Data num número comparável (timestamp). Sem data válida ->
// número gigante: linhas com conteúdo mas SEM data (ex.: em preenchimento) vão para
// o FIM, em vez de pularem para o topo e atrapalharem quem está digitando.
function valorOrdenavel_(cell) {
  if (cell instanceof Date && !isNaN(cell)) return cell.getTime();
  var s = String(cell || '').trim();
  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  return Number.MAX_SAFE_INTEGER;
}

// Converte a célula de Horário em minutos desde meia-noite. Sem horário válido -> 999999
// (vai para o final do grupo, em vez de embaralhar quem já está certo).
function horarioMinutos_(cell) {
  if (cell instanceof Date && !isNaN(cell)) return cell.getHours() * 60 + cell.getMinutes();
  var s = String(cell || '').trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return 999999;
}

function padronizarLista_(linha, colIdx, canon, sheet, col, linhaPlan, aba, rotulo, correcoes) {
  if (!colIdx) return;
  var atual = String(linha[colIdx - 1] || '').trim();
  if (!atual) return;
  var alvo = canon.find(function (op) {
    return op.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
           atual.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  });
  if (alvo && alvo !== atual) {
    linha[colIdx - 1] = alvo;
    correcoes.push(linhaInfo_(sheet, col, linhaPlan, aba,
      rotulo + ' padronizado', atual, alvo));
  }
}

// Retorna {mudou, valor, suspeita}
function normalizarData_(cell) {
  if (cell instanceof Date && !isNaN(cell)) {
    return { mudou: false, valor: cell, suspeita: false }; // já é data real (formato cuida o FIX G)
  }
  var s = String(cell || '').trim();
  if (!s) return { mudou: false, suspeita: false };
  // dd/mm/aaaa correto
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return { mudou: false, suspeita: false };
  // d/m/aaaa ou d-m-aaaa -> normaliza com zero à esquerda
  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    var dd = ('0' + m[1]).slice(-2), mm = ('0' + m[2]).slice(-2);
    return { mudou: true, valor: dd + '/' + mm + '/' + m[3], suspeita: false };
  }
  // dd/mm sem ano, ou outro formato estranho -> não inventa ano, só sinaliza
  return { mudou: false, suspeita: true };
}

// Só padroniza quando o texto é claramente uma lista de lições (números/L/S/E/vírgula).
// Caso contrário (texto livre, "$" etc.) retorna null e NÃO mexe.
function normalizarLessons_(txt) {
  var t = String(txt || '').trim();
  if (!t) return null;
  if (!/^[\sSsLl0-9,&eE\-–—\.]+$/.test(t)) return null;     // tem texto livre: não mexe
  var nums = (t.match(/\d{1,2}/g) || []).map(Number);
  if (!nums.length) return null;
  var prefixo = /[Ss]\s*\d/.test(t) ? 'S' : 'L';
  var uniq = [];
  nums.forEach(function (n) { if (uniq.indexOf(n) === -1) uniq.push(n); });
  uniq.sort(function (a, b) { return a - b; });
  var arr = uniq.map(function (n) { return prefixo + n; });
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' E ' + arr[arr.length - 1];
}

// Monta o objeto de correção já com aluno + quem agendou (para o relatório)
function linhaInfo_(sheet, col, linhaPlan, aba, tipo, antes, depois) {
  var aluno = '', agendadoPor = '';
  try {
    if (col.aluno) aluno = String(sheet.getRange(linhaPlan, col.aluno).getValue() || '').trim();
    else if (col.turma) aluno = String(sheet.getRange(linhaPlan, col.turma).getValue() || '').trim(); // sem Aluno: identifica pela Turma
  } catch (e) {}
  try { if (col.agendado) agendadoPor = String(sheet.getRange(linhaPlan, col.agendado).getValue() || '').trim(); } catch (e) {}
  return {
    aba: aba, linha: linhaPlan, aluno: aluno, agendadoPor: agendadoPor,
    tipo: tipo, antes: String(antes), depois: String(depois)
  };
}

// ===================== RELATÓRIO =====================
function gravarRelatorio_(ss, correcoes, inicio) {
  var aba = ss.getSheetByName(CONFIG.ABA_RELATORIO);
  if (!aba) {
    aba = ss.insertSheet(CONFIG.ABA_RELATORIO, 0);
  }
  var carimbo = Utilities.formatDate(inicio, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

  // Cabeçalho (recria sempre, para garantir consistência)
  if (aba.getLastRow() === 0) {
    aba.appendRow(['Quando', 'Aba', 'Linha', 'Aluno(a)', 'Agendado por', 'O que foi corrigido', 'Antes', 'Depois']);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1a73e8').setFontColor('#ffffff');
  }

  // Linha-resumo do dia
  var resumo = correcoes.length === 0
    ? '✅ Nada a corrigir — planilha já estava limpa.'
    : '🛠 ' + correcoes.length + ' correção(ões) aplicada(s) em ' +
      contarAbas_(correcoes) + ' aba(s).';
  aba.appendRow([carimbo, '— RESUMO DO DIA —', '', '', '', resumo, '', '']);
  aba.getRange(aba.getLastRow(), 1, 1, 8).setBackground('#e8f0fe').setFontWeight('bold');

  // Detalhes (mais recentes vão sendo empilhados abaixo do resumo)
  if (correcoes.length) {
    var linhas = correcoes.map(function (c) {
      return [carimbo, c.aba, c.linha, c.aluno, c.agendadoPor, c.tipo,
              cortar_(c.antes, 200), cortar_(c.depois, 200)];
    });
    aba.getRange(aba.getLastRow() + 1, 1, linhas.length, 8).setValues(linhas);
    // Destaca a coluna "Agendado por" (E) — quem deixou o erro
    aba.getRange(aba.getLastRow() - linhas.length + 1, 5, linhas.length, 1)
      .setFontWeight('bold').setFontColor('#b06000');
  }

  // Mantém histórico enxuto: apaga as linhas mais antigas se passar do limite
  var excedente = aba.getLastRow() - 1 - CONFIG.MAX_LINHAS_RELATORIO;
  if (excedente > 0) aba.deleteRows(2, excedente);

  aba.autoResizeColumns(1, 6);
  try { ss.toast(resumo, 'Corretor', 6); } catch (e) {}  // toast só aparece se a planilha estiver aberta
  Logger.log(resumo);
}

function contarAbas_(correcoes) {
  var set = {};
  correcoes.forEach(function (c) { set[c.aba] = 1; });
  return Object.keys(set).length;
}

function cortar_(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
