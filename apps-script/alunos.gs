/**
 * BASE DE ALUNOS — rotas do Apps Script
 *
 * No seu doGet, adicione as duas linhas:
 *   if (action === "alunosListar")  return alunosListar_(e);
 *   if (action === "alunosSalvar")  return alunosSalvar_(e);
 *
 * Depois reimplante (Implantar > Gerenciar implantações > editar > Nova versão).
 *
 * Os dados ficam na aba "Alunos" da mesma planilha de controle.
 * Colunas: nome | matricula | cpf | genero | nascimento | situacao | telefone | email | endereco | sincronizado
 */

var ALUNOS_ABA = "Alunos";
var ALUNOS_COLUNAS = ["nome","matricula","cpf","genero","nascimento","situacao","telefone","email","endereco","sincronizado"];

// Retorna todos os alunos salvos na planilha
function alunosListar_(e) {
  var p = e.parameter || {};
  if (p.senha !== "ccaa2026") return jsonp_(e, { ok: false, erro: "senha" });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ALUNOS_ABA);
  if (!aba || aba.getLastRow() < 2) return jsonp_(e, { ok: true, alunos: [], total: 0 });

  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, ALUNOS_COLUNAS.length).getValues();
  var alunos = dados
    .filter(function(r){ return r[0]; })
    .map(function(r){
      var obj = {};
      ALUNOS_COLUNAS.forEach(function(c, i){ obj[c] = r[i] ? r[i].toString() : ""; });
      return obj;
    });

  return jsonp_(e, { ok: true, alunos: alunos, total: alunos.length });
}

// Recebe lote de alunos do bookmarklet e salva na planilha
function alunosSalvar_(e) {
  var p = e.parameter || {};
  if (p.senha !== "ccaa2026") return jsonp_(e, { ok: false, erro: "senha" });

  var payload;
  try { payload = JSON.parse(p.dados || "[]"); } catch(err) { return jsonp_(e, { ok: false, erro: "json inválido" }); }
  if (!Array.isArray(payload) || !payload.length) return jsonp_(e, { ok: false, erro: "lista vazia" });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ALUNOS_ABA);
  if (!aba) {
    aba = ss.insertSheet(ALUNOS_ABA);
    aba.appendRow(ALUNOS_COLUNAS.map(function(c){ return c.toUpperCase(); }));
    aba.setFrozenRows(1);
  }

  var agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");

  // Primeira página: limpa tudo antes de recomeçar
  if (p.pagina === "1") {
    if (aba.getLastRow() > 1) aba.deleteRows(2, aba.getLastRow() - 1);
  }

  var linhas = payload.map(function(a){
    return ALUNOS_COLUNAS.map(function(c){ return c === "sincronizado" ? agora : (a[c] || ""); });
  });
  if (linhas.length) {
    aba.getRange(aba.getLastRow() + 1, 1, linhas.length, ALUNOS_COLUNAS.length).setValues(linhas);
  }

  return jsonp_(e, { ok: true, salvos: linhas.length, completo: p.completo === "1" });
}

// Helper JSONP — use o existente no seu codigo.gs se já houver um
function jsonp_(e, obj) {
  var cb = (e.parameter && e.parameter.callback) || "callback";
  return ContentService
    .createTextOutput(cb + "(" + JSON.stringify(obj) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
