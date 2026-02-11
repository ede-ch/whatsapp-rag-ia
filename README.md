# 🤖 RAG + WhatsApp Bot (React + Supabase + Evolution API)

Este projeto é um sistema de **RAG (Retrieval-Augmented Generation)** integrado ao WhatsApp. Ele permite que o usuário faça upload de documentos de texto para uma base de conhecimento e converse com uma IA que responde baseada nesses dados.

O sistema possui um painel web para gestão de documentos e testes, e um webhook funcional para integração com a Evolution API (WhatsApp).

## 🚀 Funcionalidades Atuais (O que funciona)

### 1. Painel de Configurações
- Configuração de API Key (OpenRouter) e Prompt do Sistema.
- Seleção de Modelo (GPT-4, Claude, etc.).
- Persistência local das configurações para testes rápidos.

### 2. Sistema RAG (Gestão de Conhecimento)
- **Upload de Arquivos .txt:** Leitura, processamento e geração de embeddings automáticos.
- **Armazenamento Vetorial:** Integração com Supabase (pgvector) para busca semântica.
- **Listagem e Exclusão:** Gerenciamento simples dos documentos na base.

### 3. Integração WhatsApp (Backend)
- Webhook pronto (`api/whatsapp.ts`) para receber mensagens da **Evolution API**.
- Processamento: Recebe msg -> Gera Embedding -> Busca Contexto no Supabase -> Consulta LLM -> Responde no WhatsApp.

---

## 🛠️ Stack Técnica

- **Frontend:** React + TypeScript + Vite
- **Backend:** Vercel Serverless Functions (Node.js)
- **Banco de Dados:** Supabase (PostgreSQL + pgvector)
- **IA:** OpenRouter (acesso a GPT-4, Llama 3, etc.)
- **Mensageria:** Evolution API

---

## ⚠️ Decisões Técnicas e Limitações (Post-Mortem)

Durante o desenvolvimento, algumas funcionalidades foram adaptadas para garantir a estabilidade do MVP:

### 1. Upload de Arquivos (PDF vs. TXT)
**O que foi tentado:** Inicialmente, o projeto visava suportar upload de PDF, MD e TXT.
**O Erro/Desafio:** A implementação de leitura de PDFs no navegador (client-side) e no backend serverless gerou complexidade excessiva e erros de "corrupted text" ou timeouts na Vercel ao processar arquivos binários grandes sem um parser dedicado robusto.
**A Solução:** Para garantir um MVP 100% funcional e estável, o escopo foi **limitado para arquivos `.txt`**. Isso garante que o texto seja extraído com fidelidade absoluta e indexado corretamente no banco de dados.

### 2. Ambiente de Desenvolvimento (Erro 500 / Connection Refused)
**O Problema:** Durante os testes locais, ocorreram erros de `500 Internal Server Error` e `Connection Refused`.
**A Causa:** Tentar rodar o projeto apenas com `npm run dev` (Vite) não iniciava as Serverless Functions da pasta `/api`, deixando o frontend sem backend. Além disso, a falta de variáveis de ambiente (`SUPABASE_KEY`) causava falhas silenciosas no servidor.
**A Solução:** Padronização do uso do `vercel dev` para rodar frontend e backend simultaneamente e correção rigorosa do arquivo `.env`.

---

## ⚙️ Configuração e Instalação

### 1. Clone o repositório

### 2. Instale as dependências
```bash
npm install
```

### 3. Configurar o Banco de Dados (Supabase)

No SQL Editor do Supabase, rode o seguinte comando para habilitar vetores e criar a tabela:

```bash
create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text,
  file_name text,
  embedding vector(1536)
);

create or replace function match_documents(
  query_embedding vector(1536),
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  order by embedding <=> query_embedding
  limit match_count;
$$;
```


### 4. Configurar Variáveis de Ambiente

Crie um arquivo .env na raiz com as suas credenciais:

```bash
# Supabase
SUPABASE_URL=sua_url_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_super_secreta

# IA
OPEN_ROUTER_API_KEY=sua_chave_open_router

# Evolution API (Para o WhatsApp)
EVOLUTION_URL=[https://evodevs.cordex.ai](https://evodevs.cordex.ai)
EVOLUTION_KEY=V0e3EBKbaJFnKREYfFCqOnoi904vAPV7
```

### 5. Rodar Localmente

Para que a API e o Frontend funcionem juntos:

```bash
npx vercel dev
```