/**
 * REGISTRO DE ACESSOS — cole este arquivo no projeto do Apps Script
 * (Editor > arquivo novo > "registro-acessos.gs") e adicione a rota no doGet:
 *
 *   if (action === "logAcesso") return logAcesso_(e);
 *
 * (coloque essa linha junto das outras rotas, ex.: listarTodos/salvarLinha).
 * Depois, REIMPLANTE a implantação ativa (Implantar > Gerenciar implantações >
 * editar > Nova versão) para a mudança valer na URL já usada pelo site.
 *
 * Os eventos são gravados na aba "Acessos" da mesma planilha (criada
 * automaticamente na primeira chamada).
 */

function logAcesso_(e) {
  var p = e.parameter || {};
  // Mesma senha de comunicação usada pelas demais rotas (SENHA_PAINEL do site)
  if (p.senha !== "ccaa2026") return jsonp_(e, { ok: false, erro: "senha" });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("Acessos");
  if (!aba) {
    aba = ss.insertSheet("Acessos");
    aba.appendRow(["Data/Hora", "Evento", "Detalhe", "Página", "Navegador"]);
    aba.setFrozenRows(1);
  }

  var agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
  aba.appendRow([
    agora,
    (p.evento || "").slice(0, 80),
    (p.detalhe || "").slice(0, 200),
    (p.pagina || "").slice(0, 200),
    (p.ua || "").slice(0, 200)
  ]);

  return jsonp_(e, { ok: true });
}

// Se o seu codigo.gs já tiver um helper de resposta JSONP, use o existente e
// apague este. Mantido aqui para o arquivo funcionar de forma independente.
function jsonp_(e, obj) {
  var cb = (e.parameter && e.parameter.callback) || "callback";
  return ContentService
    .createTextOutput(cb + "(" + JSON.stringify(obj) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
