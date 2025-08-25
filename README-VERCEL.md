# Precadastro Orçamentaria - Deploy Vercel

## 🚀 Configuração para Deploy no Vercel

Esta versão foi otimizada especificamente para deploy no Vercel usando funções serverless.

### 📁 Estrutura do Projeto

```
precadastro-vercel/
├── api/
│   └── precadastro.js     # Função serverless para API
├── public/
│   ├── index.html         # Frontend
│   ├── style.css          # Estilos
│   └── *.png/*.jpeg       # Imagens
├── vercel.json            # Configuração do Vercel
├── package.json           # Dependências
├── .env                   # Variáveis de ambiente
└── README-VERCEL.md       # Este arquivo
```

### ⚙️ Configuração no Vercel

#### 1. Variáveis de Ambiente
No painel do Vercel, configure as seguintes variáveis:

```
MONGODB_URI=mongodb+srv://Orcamentaria:Orcamentariamongo2025@cluster0.hr7osv3.mongodb.net/precadastro-orcamentaria?retryWrites=true&w=majority&appName=Cluster0
```

#### 2. Configurações de Build
- **Framework Preset:** Other
- **Build Command:** `npm run build`
- **Output Directory:** `public`
- **Install Command:** `npm install`

#### 3. Configurações de Função
- **Node.js Version:** 18.x
- **Region:** Washington, D.C., USA (iad1)

### 🔧 Deploy Manual

1. **Instalar Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login no Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### 📝 Diferenças da Versão Local

1. **API Structure:** Movida de Express para funções serverless
2. **CORS:** Configurado manualmente nas funções
3. **Rate Limiting:** Removido (Vercel tem proteção nativa)
4. **Static Files:** Servidos diretamente pelo Vercel
5. **Environment:** Configurado via Vercel Dashboard

### 🐛 Troubleshooting

#### Erro 408 (Timeout)
- Verifique se MONGODB_URI está configurada
- Confirme se a função não excede 30 segundos

#### Erro 500 (Internal Server Error)
- Verifique logs no Vercel Dashboard
- Confirme se todas as dependências estão no package.json

#### CORS Errors
- As configurações de CORS estão na função API
- Não são necessárias configurações adicionais

### 📊 Monitoramento

- **Logs:** Vercel Dashboard > Functions > View Function Logs
- **Analytics:** Vercel Dashboard > Analytics
- **Performance:** Vercel Dashboard > Speed Insights

### 🔄 Atualizações

Para atualizar o deploy:
1. Faça push para o repositório Git conectado
2. Ou use `vercel --prod` para deploy manual

### ✅ Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] MongoDB Atlas acessível
- [ ] Domínio configurado (se necessário)
- [ ] SSL/HTTPS ativo
- [ ] Testes de formulário realizados
- [ ] Logs verificados

### 🆘 Suporte

Em caso de problemas:
1. Verifique os logs no Vercel Dashboard
2. Confirme as variáveis de ambiente
3. Teste a conexão com MongoDB
4. Verifique se a estrutura de arquivos está correta

