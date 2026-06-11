/**
 * BASE DE ALUNOS (Sponte) — cole este arquivo no projeto do Apps Script
 * e adicione estas rotas dentro do seu doGet (junto das demais):
 *
 *   if (action === "alunosListar") return alunosListar_(e);
 *   if (action === "alunosUpsert") return alunosUpsert_(e);
 *
 * Depois REIMPLANTE a implantação ativa (Implantar > Gerenciar implantações >
 * editar > Nova versão).
 *
 * Os dados vivem numa aba SEPARADA chamada "Alunos" — não se mistura com os
 * agendamentos. O bookmarklet do Sponte alimenta essa aba.
 *
 * Colunas: Matrícula | Nome | Nascimento | Telefone | E-mail | Situação | Gênero | Atualizado em
 */

var ALUNOS_ABA = "Alunos";
var ALUNOS_COLS = ["Matrícula", "Nome", "Nascimento", "Telefone", "E-mail", "Situação", "Gênero", "Atualizado em"];

function alunosSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ALUNOS_ABA);
  if (!aba) {
    aba = ss.insertSheet(ALUNOS_ABA);
    aba.appendRow(ALUNOS_COLS);
    aba.setFrozenRows(1);
  }
  return aba;
}

// Retorna todos os alunos para o painel
function alunosListar_(e) {
  if (e.parameter.senha !== "ccaa2026") return jsonp_(e, { ok: false, erro: "senha" });
  var aba = alunosSheet_();
  var dados = aba.getDataRange().getValues();
  var alunos = [];
  for (var i = 1; i < dados.length; i++) {
    var r = dados[i];
    if (!r[0] && !r[1]) continue; // linha vazia
    alunos.push({
      matricula:  String(r[0] || ""),
      nome:       String(r[1] || ""),
      nascimento: r[2] instanceof Date
                    ? Utilities.formatDate(r[2], "America/Sao_Paulo", "dd/MM/yyyy")
                    : String(r[2] || ""),
      telefone:   String(r[3] || ""),
      email:      String(r[4] || ""),
      situacao:   String(r[5] || ""),
      genero:     String(r[6] || "")
    });
  }
  return jsonp_(e, { ok: true, alunos: alunos, total: alunos.length });
}

// Recebe um lote de alunos (JSON em e.parameter.dados) e faz upsert por matrícula
function alunosUpsert_(e) {
  if (e.parameter.senha !== "ccaa2026") return jsonp_(e, { ok: false, erro: "senha" });
  var lote;
  try { lote = JSON.parse(e.parameter.dados || "[]"); }
  catch (err) { return jsonp_(e, { ok: false, erro: "json" }); }
  if (!lote.length) return jsonp_(e, { ok: true, inseridos: 0, atualizados: 0 });

  var aba = alunosSheet_();
  var dados = aba.getDataRange().getValues();

  // índice matrícula -> linha (1-based na planilha)
  var idx = {};
  for (var i = 1; i < dados.length; i++) {
    var mat = String(dados[i][0] || "").trim();
    if (mat) idx[mat] = i + 1;
  }

  var agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  var inseridos = 0, atualizados = 0;

  lote.forEach(function (a) {
    var mat = String(a.matricula || "").trim();
    if (!mat) return;
    var linha = [
      mat,
      a.nome || "",
      a.nascimento || "",
      a.telefone || "",
      a.email || "",
      a.situacao || "",
      a.genero || "",
      agora
    ];
    if (idx[mat]) {
      aba.getRange(idx[mat], 1, 1, linha.length).setValues([linha]);
      atualizados++;
    } else {
      aba.appendRow(linha);
      idx[mat] = aba.getLastRow();
      inseridos++;
    }
  });

  return jsonp_(e, { ok: true, inseridos: inseridos, atualizados: atualizados });
}

// Reaproveite o helper JSONP que você já tem; mantido aqui para independência.
function jsonp_(e, obj) {
  var cb = (e.parameter && e.parameter.callback) || "callback";
  return ContentService
    .createTextOutput(cb + "(" + JSON.stringify(obj) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
