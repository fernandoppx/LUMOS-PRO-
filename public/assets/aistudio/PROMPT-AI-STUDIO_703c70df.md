# Prompt para o Google AI Studio (Build): LUMOS PRO

Copie tudo abaixo da linha e cole no AI Studio.

---

Crie um aplicativo web chamado **LUMOS PRO**, todo em português do Brasil (interface, mensagens e textos). É o sistema interno de diagnóstico de clientes da agência LUMOS. A equipe avalia cada cliente em 3 pilares (Instagram, Tráfego e Comercial), dá uma nota de 1 a 3 para cada um dos 19 tópicos e escreve uma solução em texto. O sistema calcula as médias, mostra um dashboard com gráficos, gera um PDF e cria um link público do relatório para o cliente.

## 1. Tecnologia e banco

- Front-end em React + TypeScript, com Chart.js (ou Recharts) para os gráficos e html2pdf.js (ou jsPDF + html2canvas) para o PDF.
- Banco e login no **Supabase**, que **já existe e já está configurado**. Não crie tabelas nem rode SQL; só conecte nele com `@supabase/supabase-js`:
  - URL: `https://ffddntdnirpkjbxuaqxl.supabase.co`
  - Chave pública (anon): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZGRudGRuaXJwa2pieHVhcXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTgzMDQsImV4cCI6MjEwODMzNDMwNH0.wHIbdr-s0Px88vkABIpmjyz0qzedigWSth-yzOi5Rt8`
- Use só essa chave pública. Nunca use nem peça a chave service_role.
- Rotas por hash (funcionam em hospedagem estática): `#/clientes`, `#/cliente/:id`, `#/editar/:id`, `#/dash/:id/:pilar`, `#/equipe` e a pública `#/r/:token`.

## 2. Estrutura do banco (já existe, só para referência)

- `profiles`: id (= auth.users.id), nome, email, papel (`admin` | `analista`), aprovado (boolean), created_at. É criada automaticamente no cadastro. O e-mail andreramos@grupolumos.com entra como admin aprovado; os demais entram como analista não aprovado.
- `pilares`: id (1, 2, 3), slug (`instagram`, `trafego`, `comercial`), nome, avaliador, rotulo_1, rotulo_2, rotulo_3, ordem.
- `criterios`: id (uuid), pilar_id, ordem, nome, descricao, guia_1, guia_2, guia_3 (o que significa nota 1, 2 e 3), ativo.
- `clientes`: id, nome (obrigatório), segmento, instagram, site, whatsapp, cidade, responsavel, observacoes, ativo, criado_por, created_at, updated_at.
- `diagnosticos`: id, cliente_id, data_referencia (date), status (`rascunho` | `finalizado`), resumo, compartilhado (boolean), share_token (uuid único), criado_por, created_at, updated_at.
- `avaliacoes`: id, diagnostico_id, criterio_id, nota (1 a 3 ou null), solucao (texto), observacao, recomendacao, evidencia_url. Único por (diagnostico_id, criterio_id). Salve com upsert `onConflict: 'diagnostico_id,criterio_id'`.
- View `v_score_pilar`: diagnostico_id, cliente_id, pilar_id, slug, nome, ordem, total_criterios, avaliados, media, percentual, faixa.
- View `v_score_diagnostico`: diagnostico_id, cliente_id, cliente_nome, data_referencia, status, media_instagram, media_trafego, media_comercial, media_geral, percentual_geral, faixa_geral, avaliados, total_criterios.
- Função `relatorio_publico(p_token uuid)` (chamar com `supabase.rpc`): funciona sem login e devolve um JSON só se o diagnóstico estiver finalizado e com compartilhado = true. Caso contrário, devolve null. Formato: `{ cliente: {nome, segmento, instagram}, diagnostico: {data, resumo}, pilares: [{slug, nome, avaliador, media, faixa, criterios: [{nome, nota, rotulo, solucao}]}] }`.
- Segurança (RLS): só usuários com `aprovado = true` leem e gravam dados. Só admin altera pilares, critérios e perfis da equipe.

## 3. Regras de nota

- Cada tópico recebe nota 1, 2 ou 3, ou fica sem nota.
- Média do pilar = soma das notas ÷ quantidade de tópicos avaliados naquele pilar.
- Média geral = média das 3 médias de pilar. Percentual = (média − 1) ÷ 2 × 100.
- Faixas da média: abaixo de 1,67 = **Crítico** (vermelho); de 1,67 até 2,33 = **Atenção** (amarelo); acima de 2,33 = **Bom** (verde).
- Cores das notas: 1 vermelho (#d64545), 2 amarelo (#e3a008), 3 verde (#2e9e5b), sem nota cinza (#b7bfcf). Nunca use só a cor: mostre também o número e o rótulo.
- Números com vírgula e 2 casas (ex.: 1,83). Datas em dd/mm/aaaa.

## 4. Os 3 pilares e os 19 tópicos (já cadastrados no banco; leia da tabela `criterios`)

### Pilar 1: INSTAGRAM (avaliador: Especialista Reportei · rótulos: 1 "Tá um lixo", 2 "Requer melhorias", 3 "Muito Bom!")

1. **Foto do Perfil**
   - Nota 1: Sem foto, pixelada ou logo ilegível no círculo da miniatura.
   - Nota 2: Foto aceitável, mas com pouco contraste ou fora da identidade da marca.
   - Nota 3: Nítida, reconhecível em tamanho pequeno e alinhada à identidade da marca.
2. **Bio e Link de Redirect**
   - Nota 1: Bio vazia ou confusa; sem link ou com link quebrado.
   - Nota 2: Diz o que faz, mas sem proposta de valor ou CTA; link genérico.
   - Nota 3: Proposta clara (o quê, para quem, onde), CTA e link funcionando (WhatsApp, site ou agregador organizado).
3. **@ do Perfil (facilidade de busca)**
   - Nota 1: Difícil de escrever, cheio de números/underlines; não aparece ao buscar o nome da marca.
   - Nota 2: Encontrável, mas longo ou diferente do nome da marca.
   - Nota 3: Curto, igual ao nome da marca e aparece entre os primeiros resultados.
4. **Constância de Publicação**
   - Nota 1: Menos de 1 post por semana ou perfil parado há mais de 30 dias.
   - Nota 2: Posta, mas de forma irregular (1 a 2 por semana).
   - Nota 3: Frequência regular, 3 ou mais posts por semana nos últimos 30 dias.
5. **Temas Abordados**
   - Nota 1: Só produto/promoção ou temas aleatórios, sem estratégia.
   - Nota 2: Alguma variedade, mas sem linha editorial clara.
   - Nota 3: Linha editorial definida: autoridade, prova social, bastidores e oferta.
6. **Qualidade dos Posts**
   - Nota 1: Imagens ruins, textos com erros, sem identidade visual.
   - Nota 2: Aceitável, mas com identidade inconsistente ou legendas fracas.
   - Nota 3: Visual profissional e consistente; legendas com gancho e CTA.

### Pilar 2: TRÁFEGO (avaliador: Gestor de Tráfego Sênior · rótulos: 1 "Tá um lixo", 2 "Requer melhorias", 3 "Tá Bom!")

1. **Tráfego Ativo**
   - Nota 1: Nenhuma campanha ativa.
   - Nota 2: Ativo de forma intermitente ou apenas impulsionando pelo app.
   - Nota 3: Campanhas ativas e contínuas pelo Gerenciador de Anúncios.
2. **Quantidade de Criativos (mín. 4 ativos)**
   - Nota 1: 0 ou 1 criativo ativo.
   - Nota 2: 2 ou 3 criativos ativos.
   - Nota 3: 4 ou mais criativos ativos.
3. **Formatos Diversificados (imagem e vídeo)**
   - Nota 1: Apenas um formato.
   - Nota 2: Tem os dois formatos, mas desbalanceados (ex.: 1 vídeo para 5 imagens).
   - Nota 3: Imagens e vídeos equilibrados, idealmente com carrossel também.
4. **Qualidade das Artes**
   - Nota 1: Poluída, muito texto, sem hierarquia visual.
   - Nota 2: Razoável, mas com excesso de texto ou de elementos.
   - Nota 3: Clean, pouco texto, oferta clara e boa hierarquia.
5. **Qualidade dos Vídeos**
   - Nota 1: Sem gancho, longo demais, sem CTA ou sem vídeo.
   - Nota 2: Edição ok, mas gancho fraco ou CTA genérico.
   - Nota 3: Gancho nos 3 primeiros segundos, 15 a 45s, edição simples e profissional, CTA claro.
6. **Destino do Redirect**
   - Nota 1: Link quebrado, perfil do Instagram ou página genérica.
   - Nota 2: Destino funcional, mas com atrito (formulário longo, WhatsApp sem mensagem pronta).
   - Nota 3: Destino direto e coerente com o anúncio (WhatsApp com mensagem pronta ou página rápida).

### Pilar 3: COMERCIAL (avaliador: Vendedor Sênior com SPIN, BANT e gatilhos · rótulos: 1 "Tá um lixo", 2 "Requer melhorias", 3 "Muito Bom!")

1. **Automação (Bot de Atendimento)**
   - Nota 1: Nenhuma automação.
   - Nota 2: Apenas saudação ou mensagem de ausência genérica.
   - Nota 3: Bot que recebe, qualifica e direciona o lead.
2. **Tempo de Resposta (até 5 min)**
   - Nota 1: Mais de 30 minutos ou sem resposta.
   - Nota 2: Entre 6 e 30 minutos.
   - Nota 3: Até 5 minutos.
3. **Qualidade da Primeira Mensagem**
   - Nota 1: Seca ou genérica ("oi", preço direto).
   - Nota 2: Educada, mas sem personalização ou pergunta.
   - Nota 3: Personalizada, tom humano, áudio ou texto com pergunta aberta.
4. **Diagnóstico e Qualificação do Lead**
   - Nota 1: Nenhuma pergunta de diagnóstico.
   - Nota 2: Perguntas soltas, sem método.
   - Nota 3: Aplicou SPIN/BANT: situação, problema, necessidade, orçamento, decisor e prazo.
5. **Vendedor Fez Ligação**
   - Nota 1: Não ligou.
   - Nota 2: Ligou tarde ou sem preparo.
   - Nota 3: Ligou rápido e com roteiro.
6. **Convite de Visita à Loja**
   - Nota 1: Não convidou.
   - Nota 2: Convite vago, sem data.
   - Nota 3: Convite com dia e horário e uso de gatilho (exclusividade, urgência).
7. **Follow Up**
   - Nota 1: Nenhum follow-up.
   - Nota 2: Um follow-up genérico.
   - Nota 3: Cadência de follow-ups, cada um trazendo valor.

## 5. Telas

1. **Login**: entrar ou "Criar conta da equipe" (nome, e-mail, senha com mínimo de 6). O campo de e-mail converte para minúsculas, tira espaços, valida o formato e, ao digitar `nome@` ou `nome@gru`, sugere completar com `@grupolumos.com`. Ícone de olho para mostrar ou ocultar a senha. Na criação, mostrar quantos caracteres faltam. Mensagens de erro em português.
2. **Aguardando liberação**: se a conta não estiver aprovada, mostrar "Peça para um administrador liberar seu acesso", com os botões "Já fui liberado" e "Sair".
3. **Clientes**: lista com busca (nome, @, segmento, sem diferenciar acentos), a data e a média do último diagnóstico e um selo de faixa. Botão "Novo cliente", que abre um formulário com nome, @ do Instagram, segmento, cidade, WhatsApp, site e responsável.
4. **Ficha do cliente**: dados do cliente (editáveis), gráfico de linha "Evolução da nota geral" (aparece quando há 2 ou mais diagnósticos) e a lista de diagnósticos com data, status, médias dos 3 pilares, média geral e faixa. Botões "Notas" e "Dashboard". Botão "Novo diagnóstico".
5. **Editor de notas**: abas por pilar com o progresso (ex.: "Instagram 4/6"). Cada tópico mostra 3 botões grandes (1, 2, 3) com o rótulo e o texto-guia, mais um campo "Solução". Tem também data do diagnóstico, resumo geral e barra de progresso "X de 19 tópicos". O salvamento é automático com indicador "Salvando… / Salvo / Erro". Botões "Finalizar" (se faltar tópico, pede confirmação: "Faltam N tópicos. Finalizar assim mesmo?") e "Reabrir". "Excluir diagnóstico" pede confirmação.
   - **Colar resultado da skill**: uma caixa onde se cola a resposta do Claude. O sistema extrai o JSON (do primeiro `{` ao último `}`) no formato abaixo e preenche nota e solução dos 19 tópicos de uma vez, mostrando quantos foram preenchidos e quais não foram reconhecidos:
     ```json
     {"lumos":"diagnostico-v1","cliente":"Nome","resumo":"...","avaliacoes":[{"pilar":"instagram","item":1,"topico":"Foto do Perfil","nota":2,"solucao":"..."}]}
     ```
     O `pilar` é instagram, trafego ou comercial, e o `item` é a ordem do tópico no pilar. Se o diagnóstico estiver sem resumo, use o `resumo` do JSON.
6. **Dashboard do diagnóstico**:
   - Card "Nota geral LUMOS" com a média grande colorida pela faixa, "/ 3", o selo da faixa, o percentual, "X/19 tópicos", uma régua de 3 cores (1 · Tá um lixo, 2 · Requer melhorias, 3 · Muito bom) e o resumo.
   - Gráfico de barras "Nota por pilar" (escala 0 a 3, valor escrito em cima de cada barra, cor pela faixa). Clicar numa barra abre o pilar.
   - 3 cards de pilar (média, faixa, "X/Y tópicos", "Ver tópicos →").
   - Detalhe do pilar: gráfico de pizza com uma fatia igual por tópico, colorida pela nota e numerada com a ordem do tópico, mais a legenda. Ao lado, a lista de tópicos com a nota, o rótulo e a solução.
   - **Card "Link para o cliente"**: se o diagnóstico não estiver finalizado, avisa "Finalize o diagnóstico para gerar um link". Se estiver, o botão "Gerar link para o cliente" liga `compartilhado`. Com o link ativo, mostra a URL `<endereço do app>#/r/<share_token>` com os botões "Copiar link" e "Abrir", "Trocar link (o atual para de funcionar)" (grava um novo uuid em share_token) e "Desativar link".
   - Botão **Gerar PDF**: documento A4 com a capa (faixa escura com o logo, nome do cliente, nota geral, gráfico de barras, tabela de pilares com avaliador, média e situação, e resumo), mais uma página por pilar (pizza, lista numerada e cada tópico com nota, rótulo e solução). Nome do arquivo: `LUMOS-PRO_<cliente>_<data>.pdf`.
7. **Relatório público** (`#/r/:token`, **sem login**): chama `relatorio_publico`. Mostra o cabeçalho com o logo e "Relatório de diagnóstico", o nome do cliente, a nota geral, o gráfico de barras, os 3 cards de pilar (clicar rola até o pilar), cada pilar com a pizza e os tópicos com nota, rótulo e solução, e o botão "Imprimir ou salvar PDF" (window.print, com CSS de impressão que esconde os botões). Se vier null, mostrar "Relatório indisponível: este link foi desativado ou o relatório ainda não foi liberado".
8. **Equipe** (só admin): lista de perfis com nome, e-mail, seletor de papel (Analista ou Administrador) e o botão "Liberar acesso" ou "Bloquear". O admin não pode alterar a si mesmo.

## 6. Visual

- Fontes: **Unbounded** (títulos e números grandes) e **Manrope** (texto), do Google Fonts.
- Fundo #f3f5f9, cartões brancos com borda #dde2ec e cantos de 12px, texto #131a2b, texto secundário #5d6680, cor de destaque azul #2f55d4.
- Tema escuro automático (prefers-color-scheme): fundo #0e1320, cartões #161d2e, texto #e8ecf5, destaque #6f8cff.
- Barra superior fixa com o logo "● LUMOS PRO", o menu (Clientes, Equipe) e o nome do usuário com "Sair".
- Tem que funcionar bem no celular (400px de largura) e no desktop.
- Toda tela precisa de estado de carregando, vazio (ex.: "Nenhum cliente ainda") e erro com mensagem clara em português e o botão "Tentar de novo".
- Escape todo texto vindo do banco (nada de HTML injetado).

## 7. Depois de pronto

Lembre-me de colocar a URL publicada do app em Supabase → Authentication → URL Configuration → Site URL, para o login e os e-mails de confirmação funcionarem.
