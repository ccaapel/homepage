/**
 * BASE DE ALUNOS CCAA — projeto independente (standalone)
 *
 * Este código é AUTOSSUFICIENTE: cria e gerencia a própria planilha
 * automaticamente. Não precisa estar vinculado a nenhuma planilha existente
 * e NÃO interfere no script de agendamentos.
 *
 * COMO USAR:
 *  1. Abra o projeto "ALUNOS CCAA" no Apps Script (script.google.com).
 *  2. Apague tudo do Código.gs e cole este arquivo inteiro.
 *  3. Salve (Ctrl+S).
 *  4. Implantar > Nova implantação > tipo "App da Web":
 *       - Executar como: Eu
 *       - Quem pode acessar: Qualquer pessoa
 *     Copie a URL que termina em /exec.
 *  5. No painel CCAA, abra "Base de Alunos" e cole a URL no campo de conexão.
 *
 * A planilha "Base de Alunos CCAA" é criada sozinha na primeira sincronização.
 * Para achar o link dela depois, rode a função mostrarLinkPlanilha() uma vez.
 */

var SENHA = "ccaa2026";
var ABA = "Alunos";
var COLS = ["nome","matricula","cpf","genero","nascimento","situacao","telefone","email","endereco","sincronizado"];

function doGet(e) {
  var action = (e.parameter || {}).action || "";
  if (action === "alunosListar") return alunosListar_(e);
  if (action === "alunosSalvar") return alunosSalvar_(e);
  return jsonp_(e, { ok: true, msg: "Base de Alunos CCAA online" });
}

// Abre (ou cria) a planilha dedicada. O ID fica guardado nas propriedades do script.
function planilha_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("PLANILHA_ID");
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create("Base de Alunos CCAA");
    props.setProperty("PLANILHA_ID", ss.getId());
  }
  return ss;
}

function aba_() {
  var ss = planilha_();
  var aba = ss.getSheetByName(ABA);
  if (!aba) {
    aba = ss.getActiveSheet();
    aba.setName(ABA);
    aba.appendRow(["NOME","MATRICULA","CPF","GENERO","NASCIMENTO","SITUACAO","TELEFONE","EMAIL","ENDERECO","SINCRONIZADO"]);
    aba.setFrozenRows(1);
  }
  return aba;
}

function alunosListar_(e) {
  var p = e.parameter || {};
  if (p.senha !== SENHA) return jsonp_(e, { ok: false, erro: "senha" });

  var aba = aba_();
  if (aba.getLastRow() < 2) return jsonp_(e, { ok: true, alunos: [], total: 0 });

  var alunos = aba.getRange(2, 1, aba.getLastRow() - 1, COLS.length).getValues()
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      var o = {};
      COLS.forEach(function (c, i) { o[c] = r[i] ? r[i].toString() : ""; });
      return o;
    });

  return jsonp_(e, { ok: true, alunos: alunos, total: alunos.length });
}

function alunosSalvar_(e) {
  var p = e.parameter || {};
  if (p.senha !== SENHA) return jsonp_(e, { ok: false, erro: "senha" });

  var payload;
  try { payload = JSON.parse(p.dados || "[]"); } catch (err) { return jsonp_(e, { ok: false, erro: "json" }); }
  if (!Array.isArray(payload) || !payload.length) return jsonp_(e, { ok: false, erro: "vazio" });

  var aba = aba_();
  var agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");

  // Primeira página da sincronização: limpa tudo antes de recomeçar
  if (p.pagina === "1" && aba.getLastRow() > 1) aba.deleteRows(2, aba.getLastRow() - 1);

  var linhas = payload.map(function (a) {
    return COLS.map(function (c) { return c === "sincronizado" ? agora : (a[c] || ""); });
  });
  if (linhas.length) aba.getRange(aba.getLastRow() + 1, 1, linhas.length, COLS.length).setValues(linhas);

  return jsonp_(e, { ok: true, salvos: linhas.length });
}

// Rode esta função (menu de execução) para ver o link da planilha no log.
function mostrarLinkPlanilha() {
  Logger.log(planilha_().getUrl());
}

function jsonp_(e, obj) {
  var cb = (e.parameter && e.parameter.callback) || "callback";
  return ContentService.createTextOutput(cb + "(" + JSON.stringify(obj) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
