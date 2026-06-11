# Sincronizador Sponte → Base de Alunos

Este "marcador" (bookmarklet) lê os alunos da tela do Sponte **enquanto você
está logado** e envia para a aba **Alunos** da sua planilha (via Apps Script).
Não usa, não pede e não armazena a sua senha do Sponte — ele aproveita a sessão
que já está aberta no seu navegador.

---

## Passo 1 — Garantir a coluna de Nascimento no Sponte

A lista padrão de alunos **não mostra a data de nascimento**. Para o recurso de
aniversariantes funcionar, ative essa coluna na tela
`Cadastros > Alunos` do Sponte (em **Filtros Avançados** ou na configuração de
colunas da grade, marque **Data de Nascimento**). Sem isso, o aluno é
sincronizado mas o aniversário fica em branco.

> O bookmarklet também reconhece as colunas: Nome, Nº Matrícula, Telefone,
> E-mail, Situação e Gênero — em qualquer ordem.

## Passo 2 — Criar o marcador

1. No Chrome, crie um favorito qualquer (Ctrl+D) e depois **edite** o favorito.
2. No campo **Nome**, escreva: `Sincronizar Alunos CCAA`.
3. No campo **URL**, cole **todo** o código abaixo (começa com `javascript:`):

```
javascript:(function(){var SCRIPT_URL="https://script.google.com/macros/s/AKfycbydk31FKxC3bhOMRsBmtibSTxFFjmHdgP92O-688lPWte-E1hKDJxAJQDNDQM_-pQNy/exec";var SENHA="ccaa2026";function norm(s){return(s||"").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}var tabs=[].slice.call(document.querySelectorAll("table")),grid=null,hdr=null;for(var t=0;t<tabs.length;t++){var ths=tabs[t].querySelectorAll("tr th, thead td");if(!ths.length)continue;var hs=[].map.call(ths,function(x){return norm(x.textContent);});if(hs.indexOf("nome")>=0&&(hs.indexOf("situacao")>=0||hs.indexOf("situa")>=0)){grid=tabs[t];hdr=hs;break;}}if(!grid){alert("Não encontrei a tabela de alunos nesta tela. Abra Cadastros > Alunos.");return;}function col(){for(var i=0;i<arguments.length;i++){var k=norm(arguments[i]);for(var j=0;j<hdr.length;j++){if(hdr[j].indexOf(k)>=0)return j;}}return -1;}var iNome=col("nome"),iMat=col("matr","matricula","n matr"),iNasc=col("nascimento","data de nasc","anivers"),iTel=col("telefone","celular","fone"),iMail=col("e-mail","email"),iSit=col("situacao","situa"),iGen=col("genero","sexo");var rows=grid.querySelectorAll("tbody tr, tr");var alunos=[];[].forEach.call(rows,function(tr){var c=tr.querySelectorAll("td");if(c.length<2)return;function g(i){return i>=0&&c[i]?c[i].textContent.trim():"";}var nome=g(iNome);if(!nome)return;var sit=g(iSit);if(sit&&norm(sit).indexOf("ativo")<0)return;alunos.push({matricula:g(iMat),nome:nome,nascimento:g(iNasc),telefone:g(iTel),email:g(iMail),situacao:sit,genero:g(iGen)});});if(!alunos.length){alert("Nenhum aluno ATIVO encontrado nesta página.");return;}var box=document.createElement("div");box.style.cssText="position:fixed;right:18px;bottom:18px;z-index:999999;background:#0F2D5F;color:#fff;font:600 13px sans-serif;padding:12px 16px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.4)";box.textContent="Enviando "+alunos.length+" alunos...";document.body.appendChild(box);var size=20,i=0,ins=0,upd=0;function send(){if(i>=alunos.length){box.textContent="Pronto! "+ins+" novos, "+upd+" atualizados. Avance a página e clique de novo.";setTimeout(function(){box.remove();},6000);return;}var chunk=alunos.slice(i,i+size);var cb="__sp"+Date.now();window[cb]=function(r){delete window[cb];if(r&&r.ok){ins+=r.inseridos||0;upd+=r.atualizados||0;}i+=size;box.textContent="Enviando... "+Math.min(i,alunos.length)+"/"+alunos.length;send();};var s=document.createElement("script");s.src=SCRIPT_URL+"?action=alunosUpsert&senha="+encodeURIComponent(SENHA)+"&callback="+cb+"&dados="+encodeURIComponent(JSON.stringify(chunk));s.onerror=function(){box.textContent="Erro de conexão ao enviar. Tente de novo.";};document.body.appendChild(s);}send();})();
```

4. Salve o favorito.

## Passo 3 — Sincronizar

1. Abra `Cadastros > Alunos` no Sponte (logado).
2. Clique no favorito **Sincronizar Alunos CCAA**.
   - Um aviso azul aparece no canto: "Enviando N alunos…" e depois
     "Pronto! X novos, Y atualizados".
3. Avance para a **próxima página** da lista do Sponte e clique no favorito de
   novo. Repita até a última página (ex.: 20 páginas para 388 alunos).
   - Só os alunos com **Situação = Ativo** são enviados.
   - É seguro repetir: cada matrícula é atualizada, nunca duplicada.

## Passo 4 — Ver no painel

Abra o hub → card **Base de Alunos** (ou `…/homepage/alunos/`). A lista mostra
busca, idade e o filtro de **aniversariantes do mês**. 🎂 marca quem faz
aniversário hoje.

---

### Dica: sincronizar tudo de uma vez

Se a grade do Sponte tiver opção de **itens por página**, aumente para o máximo
(ex.: 500) antes de clicar — aí um clique só envia todos os alunos.
