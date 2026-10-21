# Agentic Apps Manager

App interna da Sogrape (Digital & Data) para gerir todos os projetos de agentic applications num só sítio: um board Kanban por estado, a ficha completa de cada app (equipa, stack, ambientes, BDs, alojamento, repositório, governo) e um cofre de secrets cifrado no browser.

Stack: Vite, React 19, TypeScript, Tailwind v4, Firebase Auth (Microsoft) e Firestore (base de dados `agentic-apps-prod` no projeto `sogrape-ai-studio`). O alojamento é estático na Vercel e não há backend.

---

## 1. Correr localmente

Precisas do Node 20 ou mais recente.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes da criptografia e do parser de .env
npm run build    # build de produção para dist/
```

A configuração Firebase já vem no código (é pública por desenho). Para a mudar, copia `.env.example` para `.env.local` e preenche.

## 2. Configuração Firebase (uma vez)

1. **Authentication → Sign-in method → Microsoft**: já está ativo no `sogrape-ai-studio`. Recomendado: definir `VITE_MS_TENANT_ID` com o ID do diretório Entra da Sogrape, para o ecrã de login só aceitar contas da Sogrape.
2. **Authentication → Settings → Authorized domains**: acrescenta o domínio da Vercel (por exemplo `agentic-apps-manager.vercel.app`) e, se usares, o domínio próprio.
3. **Regras do Firestore**: publica `firestore.rules` na base de dados `agentic-apps-prod`. Sem isto, nada funciona.
   - Pela linha de comandos: `npx firebase-tools login` e depois `npm run deploy:rules`. O `firebase.json` já aponta para a base de dados certa.
   - Ou pela consola: Firestore, escolhe a base de dados **agentic-apps-prod** no seletor, separador Rules, cola o conteúdo de `firestore.rules` e publica.
4. Não precisas de índices compostos.

## 3. Deploy na Vercel

1. Importa o repositório `BrunoJusta/agentic-apps-manager` na Vercel.
2. Framework: **Vite**. Build: `npm run build`. Output: `dist`.
3. Variáveis de ambiente opcionais: `VITE_MS_TENANT_ID` (recomendada) e as do `.env.example`, se quiseres sobrepor a configuração.
4. O `vercel.json` já trata das rotas da SPA e de alguns cabeçalhos de segurança.

## 4. Primeiro arranque

1. Entra com `bruno.justa@sogrape.pt`. É o **Admin de arranque**: o documento dele é criado sozinho no primeiro login, e as regras nunca deixam que seja despromovido nem desativado.
2. Vai a **Cofre → Inicializar o cofre**. Escolhes a tua passphrase pessoal (12 caracteres ou mais). O browser gera as tuas chaves e a chave do cofre, e ficas com o cofre aberto.
3. Vai a **Utilizadores → Dar acesso** e acrescenta as pessoas (só emails `@sogrape.pt`), com o papel certo. Quem não está nesta lista não entra.
4. Cada Editor entra, abre o **Cofre** e cria as suas chaves pessoais. Aparece-lhe uma impressão digital (por exemplo `3F2A 91C0 77B1 0D4E`).
5. Em **Utilizadores**, carregas em **Dar acesso ao cofre** e confirmas com a pessoa que a impressão digital é a mesma. Esse acesso é dado para a chave **daquela** pessoa.
6. Recomendação: ter sempre **pelo menos 2 Admins com acesso ao cofre**. Se o único Admin esquecer a passphrase, os secrets perdem-se.

## 5. Papéis

| Papel  | Board e fichas | Editar apps | Secrets | Utilizadores e rotação |
|--------|----------------|-------------|---------|----------------------------------|
| Viewer | Sim            | Não         | Nunca (nem os nomes) | Não                    |
| Editor | Sim            | Sim         | Se um Admin lhe der acesso ao cofre | Não     |
| Admin  | Sim            | Sim, e apagar | Sim   | Sim                              |

## 6. Como funciona a segurança

- **Login**: Microsoft, só `@sogrape.pt` e só quem estiver na coleção `users` com `active: true`. Isto é garantido nas regras do Firestore, não só na interface.
- **Cofre, cifrado no browser**: o Firestore só guarda texto cifrado.
  - Cada pessoa tem um par de chaves RSA-OAEP 3072. A chave privada é cifrada com AES-256-GCM, com uma chave derivada da passphrase pessoal (PBKDF2-SHA256, 600 000 iterações). A passphrase nunca sai do browser.
  - Existe uma chave do cofre (AES-256-GCM). Para cada pessoa com acesso, essa chave é embrulhada com a chave pública dela (`vaultGrants/{email}`).
  - Cada secret é cifrado com a chave do cofre, com IV aleatório e AAD igual ao caminho do documento, para que um texto cifrado não possa ser trocado de sítio.
  - Nem o Firebase, nem a Vercel, nem quem tiver acesso à consola consegue ler os valores.
- **Bloqueio automático** após 15 minutos sem atividade. Ao recarregar a página, o cofre também volta a bloquear (a chave só vive em memória).
- **Valores revelados** escondem-se sozinhos após 30 segundos.
- **Auditoria**: revelar, copiar, exportar, importar, criar, alterar e apagar secrets, dar e retirar acesso, rodar a chave, gerir utilizadores e logins ficam registados na coleção `audit`. Ninguém pode editar nem apagar registos. Para já não há página na app para os consultar; consultam-se na consola do Firebase.
- **Rotação**: em Utilizadores, "Rodar chave" gera uma chave nova, volta a cifrar todos os secrets e renova os acessos numa única escrita atómica. Faz isto quando alguém que tinha acesso sai da equipa.
- **Variáveis** (não secretas) ficam em texto simples e são visíveis para todos os papéis. Chaves, tokens e passwords são sempre secrets.

## 7. Funcionalidades

- **Apps**: o pipeline em curso, numa só tab com dois modos (Kanban ou Tabela), escolhidos no fim da barra de filtros.
  - Kanban com as colunas Ideia, Discovery, Em desenvolvimento, QA / UAT e Produção, que se ajustam à largura do ecrã. Arrastar um cartão muda o estado.
  - Pode ser agrupado por estado, maturidade, conta do repositório ou área.
  - Os filtros (maturidade, prioridade, conta do repositório, stack, "as minhas") e o modo ficam no URL, por isso dá para partilhar o link.
- **Finalizadas**: apps em Manutenção ou Descontinuadas saem do board e ficam nesta tab, em cartões ou tabela.
- **Gate de Produção**: uma app só passa para Produção com dono de negócio, AI Lead, dev, suporte N1, repositório (URL e conta) e ambiente de produção (alojamento, URL e BD) preenchidos.
- **URLs da app por ambiente** (DEV, QA, PROD): preenchidos na ficha (Editar, secção Ambientes), aparecem em "URLs da app" na visão geral, como atalhos no topo da ficha e como links na tabela.
- **Ficha da app** com os separadores Visão geral, Ambientes e cofre (DEV, QA e PROD), Pessoas, Links e governo, e Histórico.
- **Variáveis e secrets por ambiente**:
  - Importar um `.env` colado: o parser sugere automaticamente o que é secret.
  - Exportar `.env` (registado na auditoria).
  - Data de "rodar até", com aviso a 30 dias.
- **Pesquisa global** com Ctrl K ou ⌘K: apps, nomes de secrets e nomes de variáveis. Os valores nunca são pesquisáveis.
- **Importar e exportar JSON** de apps (sem secrets).

### Linguagem visual

Estilo do backoffice (inspirado no DESIGN.md da Vercel): tinta `#171717` e cinzas, linhas finas e sombras empilhadas (`--ring`, `--e2`, `--e4`, `--shadow`) em vez de bordas. Tudo o que se clica é pill. A única cor viva vem dos dados: cada fase (estado) e cada área tem a sua cor da paleta terrosa da Sogrape, passada ao CSS por `--c` e usada só em pontos, tints e etiquetas. Fontes: Outfit (títulos e controlos), Geist (texto) e Geist Mono (números). Os tokens estão em `src/index.css` e as cores das entidades em `src/lib/colors.ts`.

## 8. Modelo de dados (Firestore `agentic-apps-prod`)

```
users/{email}                 perfil, papel, ativo
userKeys/{email}              chave pública + chave privada cifrada com a passphrase
vault/meta                    versão da chave do cofre + bloco de verificação
vaultGrants/{email}           chave do cofre embrulhada para essa pessoa
apps/{appId}                  ficha da app (inclui ambientes e variáveis)
apps/{appId}/secrets/{id}     nome, tipo, nota, rodar até, iv, ct (cifrado)
apps/{appId}/history/{id}     histórico de alterações
audit/{id}                    registo de auditoria (só acrescentar)
```

## 9. Testes das regras (opcional)

Os testes em `rules-tests/` validam as regras contra o emulador do Firestore. Precisam de Java 11 ou mais recente.

```bash
npm run test:rules
```

## 10. Limites conhecidos

- Se alguém esquecer a passphrase, não há recuperação. A pessoa repõe as chaves e um Admin volta a dar acesso. Os secrets não se perdem enquanto houver outra pessoa com acesso.
- A rotação atómica suporta até cerca de 500 escritas (secrets + acessos) numa só operação.
- Ao copiar um secret, a app não consegue limpar a área de transferência do sistema depois.
- O login depende de a conta Microsoft ter o email preenchido (as contas da Sogrape têm).
