/* Certificados CCAA: nucleo de regras e geracao .docx.
   Mesmo codigo roda no navegador (pagina) e no Node (testes / geracao pelo Claude).
   Porta fiel de gerar_certificado.py + lote_turma.py. Nao usa IA: entrada igual, saida igual. */
(function (root) {
  "use strict";

  const NIVEL_EN = {1:"ONE",2:"TWO",3:"THREE",4:"FOUR",5:"FIVE",6:"SIX",7:"SEVEN",8:"EIGHT",9:"NINE",10:"TEN",11:"ELEVEN"};
  const NIVEL_ES = {1:"UNO",2:"DOS",3:"TRES",4:"CUATRO",5:"CINCO",6:"SEIS"};
  // carga horaria acumulada por periodos cursados (tabela oficial CCAA)
  const HORAS_EN = {1:47,2:95,3:142,4:190,5:237,6:285,7:332,8:380,9:427,10:475,11:522};
  const HORAS_ES = {1:38,2:76,3:114,4:152,5:190,6:228};

  const CURSOS = {
    english:  {nome:"English",  promo:"english_promo", conc:"english_conc", max:11, notas:true,  media:true,  horas:HORAS_EN, lang:"en"},
    espanol:  {nome:"Español",  promo:"espanol_promo", conc:"espanol_conc", max:6,  notas:true,  media:true,  horas:HORAS_ES, lang:"es"},
    kids:     {nome:"Kids",     promo:"kids_promo",    conc:"kids_conc",    max:8,  notas:true,  media:true,  horas:null,     lang:"en"},
    preteen:  {nome:"Preteen",  promo:"preteen_promo", conc:"preteen_conc", max:2,  notas:true,  media:true,  horas:null,     lang:"en"},
    baby:     {nome:"Baby",     promo:"baby_promo",    conc:"baby_conc",    max:6,  notas:false, media:false, horas:null,     lang:"en"},
    teachers: {nome:"Teachers", promo:null,            conc:"teachers_conc",max:0,  notas:false, media:true,  horas:null,     lang:"en"},
  };

  const PH = {
    en: {nome:"Student's Name", nivel:"level", media:"average", nota:"grade", mes:"month", ano:"year", horas:"hours"},
    es: {nome:"Nombre del Alumno", nivel:"nivel", media:"promedio", nota:"nota", mes:"mes", ano:"año", horas:"horas"},
  };

  // texto fixo que denuncia template corrompido
  const BOILERPLATE = {english_promo:"a 47-hour and 30-minute course,", espanol_promo:"38", teachers_conc:"a 60-hour course,"};

  class CertErro extends Error {}

  function semAcento(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function chave(s) { return semAcento(s).toLowerCase().replace(/\s+/g, " ").trim(); }
  function xmlEsc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  /* "(1/26)" -> 07/2026 ; "(2/25)" -> 12/2025 */
  function parseTurma(t) {
    const m = /\((\d)\s*\/\s*(\d{2})\)/.exec(t || "");
    if (!m) throw new CertErro(`Não li o semestre em "${t || ""}". Esperado algo como (1/26) ou (2/25) no nome da turma.`);
    const sem = +m[1];
    if (sem !== 1 && sem !== 2) throw new CertErro(`Semestre ${sem} inválido (só 1 ou 2).`);
    return {mes: sem === 1 ? "07" : "12", ano: "20" + m[2]};
  }

  /* "5.2 - 5a int. 19h (2/25)" -> 5 */
  function nivelDaTurma(t) {
    const m = /^\D*?(\d{1,2})\.\d/.exec(String(t || "").trim());
    return m ? +m[1] : null;
  }

  /* normaliza nota: "91,5" -> "91,50", "90" -> "90,00". Devolve {v} ou {erro} */
  function notaOk(v) {
    v = String(v == null ? "" : v).trim().replace(".", ",");
    if (!v) return {erro: "vazia"};
    if (/^\d{1,3}$/.test(v)) v += ",00";
    if (/^\d{1,3},\d$/.test(v)) v += "0";
    if (!/^\d{1,3},\d{2}$/.test(v)) return {erro: `"${v}" fora do formato`};
    if (centavos(v) > 10000) return {erro: `${v} maior que 100`};
    return {v};
  }
  function centavos(v) { const [a, b] = v.split(","); return +a * 100 + +b; }
  function deCentavos(c) { return Math.floor(c / 100) + "," + String(c % 100).padStart(2, "0"); }

  /* (PPE + PFE + 2*PFO) / 4, arredondamento meio-para-cima em 2 casas (inteiro, sem erro de float) */
  function mediaCalculada(ppe, pfe, pfo) {
    const soma = centavos(ppe) + centavos(pfe) + 2 * centavos(pfo);
    return deCentavos(Math.floor((soma + 2) / 4));
  }
  function usaFormulaOral2x(curso, nivel) {
    if (curso === "english" || curso === "espanol" || curso === "preteen") return true;
    if (curso === "kids") return nivel !== 1;
    return false;
  }

  /* ---------- leitura da colagem (Excel, Sponte, CSV com ; ou tab) ---------- */
  const COLS = {
    nome: ["nome","aluno","nome do aluno","student"],
    ppe: ["ppe"], pfe: ["pfe"], pfo: ["pfo"],
    media: ["media","media geral","nota final","average"],
    situacao: ["situacao","status"],
    periodos: ["periodos","per","periodo"],
  };
  function lerColagem(texto) {
    const linhas = String(texto || "").split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim());
    if (!linhas.length) return [];
    const sep = linhas[0].includes("\t") ? "\t" : (linhas[0].includes(";") ? ";" : ",");
    const cel = l => l.split(sep).map(c => c.trim());
    let cab = cel(linhas[0]).map(chave), mapa = {};
    for (const [k, nomes] of Object.entries(COLS)) {
      const i = cab.findIndex(c => nomes.includes(c));
      if (i >= 0) mapa[k] = i;
    }
    let dados = linhas.slice(1);
    if (mapa.nome === undefined) {           // sem cabecalho: ordem padrao
      mapa = {nome:0, ppe:1, pfe:2, pfo:3, media:4, situacao:5, periodos:6};
      dados = linhas;
    }
    return dados.map(l => {
      const c = cel(l), r = {};
      for (const [k, i] of Object.entries(mapa)) r[k] = c[i] || "";
      return r;
    }).filter(r => r.nome);
  }

  /* ---------- conferencia (o que o lote faz antes de gerar) ---------- */
  function conferir(cfgTurma, alunos) {
    const curso = cfgTurma.curso || "english";
    const cfg = CURSOS[curso];
    if (!cfg) throw new CertErro(`Curso desconhecido: ${curso}`);
    const {mes, ano} = parseTurma(cfgTurma.turma);

    let nivel = cfgTurma.nivel ? +cfgTurma.nivel : null;
    if (cfg.max && !nivel) nivel = nivelDaTurma(cfgTurma.turma);
    if (cfg.max && !nivel) throw new CertErro("Não deduzi o nível pelo nome da turma. Informe o nível.");
    if (cfg.max && (nivel < 1 || nivel > cfg.max)) throw new CertErro(`Nível ${nivel} inválido para ${cfg.nome} (1 a ${cfg.max}).`);

    let modo = cfgTurma.modo && cfgTurma.modo !== "auto" ? cfgTurma.modo : null;
    if (!modo) modo = !cfg.promo ? "curso" : (nivel === cfg.max ? "ambos" : "nivel");
    if ((modo === "nivel" || modo === "ambos") && !cfg.promo) throw new CertErro(`${cfg.nome} só tem certificado de conclusão.`);

    const vistos = new Set(), res = [];
    for (const al of alunos) {
      const nome = String(al.nome || "").trim().replace(/\s+/g, " ");
      const motivos = [], alertas = [];
      if (vistos.has(chave(nome))) motivos.push("aluno repetido na lista");
      vistos.add(chave(nome));

      const sit = String(al.situacao || "").trim();
      if (sit && chave(sit) !== "aprovado") motivos.push(`situação "${sit}"`);
      else if (!sit) alertas.push("sem situação: conferir se é Aprovado");

      let media = null;
      if (cfg.media) { const r = notaOk(al.media); if (r.erro) motivos.push("média " + r.erro); else media = r.v; }

      let notas = null;
      if ((modo === "nivel" || modo === "ambos") && cfg.notas) {
        const v = {};
        for (const c of ["ppe", "pfe", "pfo"]) { const r = notaOk(al[c]); if (r.erro) motivos.push(c.toUpperCase() + " " + r.erro); else v[c] = r.v; }
        if (v.ppe && v.pfe && v.pfo) {
          notas = [v.ppe, v.pfo, v.pfe];  // ordem impressa: Midterm, Oral[2x], Final
          if (media && usaFormulaOral2x(curso, nivel)) {
            const calc = mediaCalculada(v.ppe, v.pfe, v.pfo);
            if (calc !== media) {
              const msg = `média ${media} difere da calculada ${calc} (PPE+PFE+2×PFO)/4: conferir digitação`;
              (cfgTurma.aceitarDivergencia ? alertas : motivos).push(msg);
            }
          }
        }
      }

      let horas = null;
      if ((modo === "curso" || modo === "ambos") && cfg.horas) {
        let per = al.periodos || cfgTurma.periodos;
        if (!per) { per = cfg.max; alertas.push(`assumi curso completo (${per} períodos)`); }
        if (cfg.horas[+per]) horas = String(cfg.horas[+per]);
        else motivos.push(`períodos "${per}" fora da tabela (1 a ${cfg.max})`);
      }

      if (nome && (nome === nome.toUpperCase() || nome === nome.toLowerCase())) alertas.push("nome todo em maiúsculas/minúsculas: conferir acentos");
      if (nome.split(" ").length < 2) alertas.push("nome sem sobrenome");
      if (!nome) motivos.push("nome vazio");

      res.push({nome, media, notas, horas, motivos, alertas, ok: motivos.length === 0});
    }
    return {curso, cfg, nivel, modo, mes, ano, alunos: res};
  }

  /* ---------- preenchimento de um certificado ---------- */
  function substituir(c, ph, val) {
    const alvo = `<w:t>${ph}</w:t>`, i = c.indexOf(alvo);
    if (i < 0) throw new CertErro(`Campo "${ph}" ausente no modelo (modelo corrompido?)`);
    return c.slice(0, i) + `<w:t>${xmlEsc(val)}</w:t>` + c.slice(i + alvo.length);
  }

  function preencher(xml, conf, kind, al) {
    const {cfg, nivel, mes, ano} = conf, ph = PH[cfg.lang];
    let c = xml;
    c = substituir(c, ph.nome, al.nome);
    if (kind === "promo") {
      c = substituir(c, ph.nivel, (cfg.lang === "en" ? NIVEL_EN : NIVEL_ES)[nivel]);
      if (cfg.notas) for (const g of al.notas) c = substituir(c, ph.nota, g);
    }
    if (cfg.media) c = substituir(c, ph.media, al.media);
    if (kind === "conc" && cfg.horas) c = substituir(c, ph.horas, al.horas);
    c = substituir(c, ph.mes, mes);
    c = substituir(c, ph.ano, ano);
    const resto = ["nivel","media","nota","mes","ano","horas"].map(k => ph[k]).filter(p => c.includes(`<w:t>${p}</w:t>`));
    if (resto.length) throw new CertErro(`Campos não preenchidos: ${resto.join(", ")}`);
    return c;
  }

  /* ---------- junta N certificados num .docx, uma pagina cada ---------- */
  function juntar(xml, preenchidos) {
    const iBody = xml.indexOf("<w:body>") + 8, fBody = xml.lastIndexOf("</w:body>");
    const cabeca = xml.slice(0, iBody), cauda = xml.slice(fBody);
    const corpos = preenchidos.map(x => x.slice(x.indexOf("<w:body>") + 8, x.lastIndexOf("</w:body>")));
    const iSect = corpos[0].lastIndexOf("<w:sectPr");
    const sect = corpos[0].slice(iSect);
    const partes = corpos.map((b, n) => {
      let conteudo = b.slice(0, b.lastIndexOf("<w:sectPr"));
      conteudo = conteudo.replace(/<wp:docPr id="\d+"/g, () => `<wp:docPr id="${100 + n}"`);
      if (n < corpos.length - 1) {
        // quebra de secao (proxima pagina) no ultimo paragrafo: mantem margem e orientacao
        const j = conteudo.lastIndexOf("</w:pPr></w:p>");
        if (j < 0 || j + 14 !== conteudo.length) throw new CertErro("Estrutura do modelo inesperada no fim da página.");
        conteudo = conteudo.slice(0, j) + sect + conteudo.slice(j);
      }
      return conteudo;
    });
    let out = cabeca + partes.join("") + sect + cauda;
    out = out.replace(/ w14:(paraId|textId)="[0-9A-Fa-f]+"/g, "");
    return out;
  }

  /* templates: {nome: Uint8Array|ArrayBuffer}. JSZip injetado (browser: window.JSZip; node: require) */
  async function gerar(JSZip, templates, conf) {
    const ok = conf.alunos.filter(a => a.ok).sort((a, b) => chave(a.nome).localeCompare(chave(b.nome)));
    const saida = {};
    const kinds = [];
    if (conf.modo === "nivel" || conf.modo === "ambos") kinds.push("promo");
    if (conf.modo === "curso" || conf.modo === "ambos") kinds.push("conc");
    for (const kind of kinds) {
      if (!ok.length) continue;
      let tipo = conf.cfg[kind];
      if (tipo === "kids_promo" && conf.nivel === 1) tipo = "kids1_promo";
      const zip = await JSZip.loadAsync(templates[tipo]);
      const xml = await zip.file("word/document.xml").async("string");
      const esperado = BOILERPLATE[conf.cfg[kind]];
      if (esperado && !xml.replace(/<[^>]+>/g, "").includes(esperado))
        throw new CertErro(`Modelo ${tipo} mudou (texto fixo de carga horária ausente). Não gerar até restaurar.`);
      const preenchidos = ok.map(al => preencher(xml, conf, kind, al));
      zip.file("word/document.xml", juntar(xml, preenchidos));
      saida[kind] = {
        dados: await zip.generateAsync({type: "uint8array", compression: "DEFLATE"}),
        quantidade: ok.length,
        papel: kind === "promo" ? "comum (cinza), retrato" : "dourado, paisagem",
      };
    }
    return saida;
  }

  function nomeArquivo(conf, kind) {
    const t = semAcento(conf.cfgTurma || "").replace(/[^A-Za-z0-9.]+/g, "_");
    return kind === "promo" ? `IMPRIMIR_1_papel_COMUM_${conf.cfg.nome}${conf.nivel ? "_nivel" + conf.nivel : ""}.docx`
                            : `IMPRIMIR_2_papel_DOURADO_${conf.cfg.nome}_conclusao.docx`;
  }

  /* Um aluno so, sem nome de turma: curso, nivel, semestre (1|2), ano (2026), tipo (nivel|curso|ambos).
     Monta a turma no formato do Sponte e passa pelas MESMAS regras do lote. */
  function conferirAluno(d) {
    const cfg = CURSOS[d.curso];
    if (!cfg) throw new CertErro("Escolha o curso.");
    const ano = String(d.ano || "").trim();
    if (!/^20\d{2}$/.test(ano)) throw new CertErro("Ano inválido. Use 4 dígitos, ex: 2026.");
    const sem = +d.semestre === 1 ? 1 : 2;
    const nivel = cfg.max ? +d.nivel : null;
    const turma = `${cfg.max ? nivel : "T"}.1 (${sem}/${ano.slice(2)})`;
    const aluno = {nome: d.nome, ppe: d.ppe, pfe: d.pfe, pfo: d.pfo, media: d.media,
                   situacao: "Aprovado", periodos: d.periodos || ""};
    const conf = conferir({curso: d.curso, turma, nivel, modo: d.tipo, aceitarDivergencia: !!d.aceitarDivergencia}, [aluno]);
    return conf;
  }

  /* "MARIA DA SILVA" -> "Maria da Silva" (acentos que faltarem nao tem como adivinhar) */
  function tituloNome(s) {
    const minus = new Set(["da", "de", "do", "das", "dos", "e", "di", "del", "la"]);
    return String(s).trim().replace(/\s+/g, " ").toLowerCase().split(" ")
      .map((p, i) => (i > 0 && minus.has(p)) ? p : p.replace(/(^|[-'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()))
      .join(" ");
  }

  /* Le o que a pessoa copiou da tela do Sponte (Ctrl+A, Ctrl+C, ou so a linha do aluno)
     e devolve so os campos que reconheceu com seguranca. Nunca inventa: o que nao achou fica de fora. */
  function lerTextoSponte(txt) {
    const t = String(txt || "").replace(/ /g, " ");
    const r = {};
    const num = "(\\d{1,3}(?:[.,]\\d{1,2})?)";
    const turma = /(\d{1,2})\.\d[^\n()]{0,60}\((\d)\s*\/\s*(\d{2})\)/.exec(t);
    if (turma) { r.nivel = +turma[1]; r.semestre = turma[2]; r.ano = "20" + turma[3]; r.turma = turma[0].trim(); }
    for (const k of ["PPE", "PFE", "PFO"]) {
      const m = new RegExp("\\b" + k + "\\b[^\\d\\n]{0,40}" + num).exec(t);
      if (m) r[k.toLowerCase()] = m[1];
    }
    const med = new RegExp("(?:m[ée]dia(?:\\s+geral|\\s+final)?|nota\\s+final)[^\\d\\n]{0,40}" + num, "i").exec(t);
    if (med) r.media = med[1];
    const sit = /\b(aprovad[oa]|reprovad[oa]|parcial|cursando)\b/i.exec(t);
    if (sit) r.situacao = sit[1][0].toUpperCase() + sit[1].slice(1).toLowerCase();
    const al = /\baluno\(?a?\)?\s*[:\-]\s*(?:\d+\s*[-–]\s*)?([\p{L}' ]{5,80})/iu.exec(t);
    if (al) r.nome = al[1].trim().replace(/\s+/g, " ");

    // sem rotulos: uma linha "Nome  94,00  91,90  90,00  91,48" (ordem da tela: PPE PFE PFO Media)
    if (!r.ppe && !r.pfe && !r.pfo) {
      const linha = t.split(/\r?\n/).map(l => l.trim()).find(l => (l.match(/\d{1,3}[.,]\d{2}/g) || []).length >= 3);
      if (linha) {
        const ns = linha.match(/\d{1,3}[.,]\d{2}/g);
        [r.ppe, r.pfe, r.pfo] = ns;
        if (ns[3] && !r.media) r.media = ns[3];
        const antes = linha.slice(0, linha.search(/\d{1,3}[.,]\d{2}/)).replace(/^\s*\d+\s*[-–.]?\s*/, "").replace(/[\t;|]+/g, " ").trim();
        if (!r.nome && /^[\p{L}' ]{5,80}$/u.test(antes)) r.nome = antes.replace(/\s+/g, " ");
      }
    }
    for (const k of ["ppe", "pfe", "pfo", "media"]) if (r[k]) { const n = notaOk(r[k]); if (n.v) r[k] = n.v; else delete r[k]; }
    return r;
  }

  const API = {tituloNome, lerTextoSponte, CURSOS, NIVEL_EN, NIVEL_ES, CertErro, parseTurma, nivelDaTurma, notaOk, mediaCalculada, usaFormulaOral2x,
               lerColagem, conferir, conferirAluno, gerar, nomeArquivo, chave, semAcento};
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.CertGen = API;
})(typeof window !== "undefined" ? window : globalThis);
