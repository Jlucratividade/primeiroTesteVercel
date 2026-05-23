# Diretório de Comércio do Bairro

App estático para listagem de comércios locais por rua.  
Sem build tools, sem framework pesado, 100% arquivos estáticos.

---

## Estrutura de Pastas

```
/
├── index.html            Shell HTML leve (sem dados embutidos)
├── vercel.json           Configuração de deploy e cache headers
├── css/
│   └── style.css         Todo o CSS da aplicação
├── js/
│   ├── storage.js        Cache local (localStorage com TTL)
│   ├── api.js            Fetch centralizado + integração com cache
│   ├── ui.js             Renderização de DOM e animações
│   └── app.js            Lógica principal e event handling
└── dados/
    ├── ruas.json          Índice leve: id, name, icon, businessCount
    └── ruas/
        ├── rua-1.json     Dados completos da Rua das Acácias
        ├── rua-2.json     Dados completos da Rua São Vicente
        ├── rua-3.json     Dados completos da Avenida do Cedro
        ├── rua-4.json     Dados completos da Travessa Bela Vista
        └── rua-5.json     Dados completos da Rua do Sol
```

---

## Fluxo de Dados (Lazy Loading)

```
1. app aberto
   └── api.getStreets()
       ├── storage.get("streets_index") → hit? retorna cache
       └── miss → fetch("dados/ruas.json") → storage.set(...)
           └── UI.renderStreets(data)

2. usuário clica numa rua
   └── api.getStreet(id)
       ├── storage.get("street_N") → hit? retorna cache
       └── miss → fetch("dados/ruas/rua-N.json") → storage.set(...)
           └── UI.renderBusinesses(data.businesses)

3. usuário clica numa empresa
   └── (dados já em memória, sem novo fetch)
       └── UI.renderDetails(business)
           ├── se tem produtos → lista de produtos + botão "Adicionar"
           └── se não tem     → mapa Leaflet + botão "Contato"
```

---

## Cache

| Camada     | Mecanismo         | TTL          |
|------------|-------------------|--------------|
| Índice     | localStorage      | 5 minutos    |
| Rua        | localStorage      | 15 minutos   |
| JS/CSS     | HTTP (Vercel)     | 24 horas     |
| JSON       | HTTP (Vercel)     | 5 min + SWR  |

---

## Deploy na Vercel

1. Suba o projeto para um repositório GitHub
2. Importe o repositório na Vercel
3. **Framework Preset:** Other (Static)
4. **Output Directory:** `.` (raiz)
5. Clique em Deploy

O `vercel.json` já configura os headers de cache corretos para cada tipo de arquivo.

---

## Atualização via Google Apps Script

O Google Apps Script pode sobrescrever os arquivos JSON diretamente via GitHub API.

### Exemplo de script (Apps Script)

```javascript
function publicarRua(id, dados) {
  const token  = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  const repo   = 'seu-usuario/seu-repo';
  const path   = `dados/ruas/rua-${id}.json`;
  const url    = `https://api.github.com/repos/${repo}/contents/${path}`;

  // Busca SHA atual do arquivo (necessário para update)
  const getResp = UrlFetchApp.fetch(url, {
    headers: { Authorization: `token ${token}` }
  });
  const sha = JSON.parse(getResp.getContentText()).sha;

  // Publica novo conteúdo
  UrlFetchApp.fetch(url, {
    method: 'put',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      message: `Atualiza rua ${id}`,
      content: Utilities.base64Encode(JSON.stringify(dados)),
      sha
    })
  });
}
```

### Fluxo sugerido com Google Sheets

```
Google Sheets (aba "Ruas")
  └── Apps Script lê os dados da planilha
      └── Monta os objetos JSON (ruas.json + rua-N.json)
          └── Publica via GitHub API
              └── Vercel detecta push → redeploy automático
                  └── App atualizado em ~30 segundos
```

---

## Funcionalidades Offline

- Se o fetch falhar (sem internet), o app usa o cache do localStorage
- Se não houver cache, exibe mensagem amigável sem quebrar a UI
- O carrinho funciona 100% offline (dados em memória)

---

## Escalabilidade

Para suportar milhares de empresas/produtos:

- **Paginação por rua:** dividir `rua-N.json` em `rua-N-page-1.json`, etc.
- **Busca:** adicionar `dados/search-index.json` com nome + id para busca local
- **Imagens:** servir via CDN (Cloudinary, etc.) e referenciar por URL no JSON
- **Categorias:** adicionar `dados/categorias.json` para filtragem
