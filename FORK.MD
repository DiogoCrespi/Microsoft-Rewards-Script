# Guia de Fork e Sincronização

Este guia explica como criar o seu próprio Fork deste repositório no GitHub, manter as alterações que fizemos (segurança, env vars) e ainda assim receber atualizações futuras do projeto original.

## Passo 1: Criar o Fork no GitHub

1.  Acesse o repositório original: [https://github.com/TheNetsky/Microsoft-Rewards-Script](https://github.com/TheNetsky/Microsoft-Rewards-Script)
2.  Clique no botão **Fork** (canto superior direito).
3.  Selecione sua conta e crie o fork.
4.  Copie a URL do **seu** novo repositório (ex: `https://github.com/SEU_USUARIO/Microsoft-Rewards-Script.git`).

## Passo 2: Configurar os Remotos (No seu terminal local)

Atualmente, o seu terminal está apontando `origin` para o repositório original do TheNetsky. Vamos mudar isso.

Abra o terminal na pasta do projeto e execute:

1.  **Renomeie o original para "upstream"** (para receber atualizações dele):
    ```bash
    git remote rename origin upstream
    ```

2.  **Adicione o seu fork como "origin"** (para onde você vai enviar suas mudanças):
    ```bash
    git remote add origin https://github.com/SEU_USUARIO/Microsoft-Rewards-Script.git
    ```
    *(Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub)*

3.  **Verifique se ficou correto:**
    ```bash
    git remote -v
    ```
    Você deve ver algo como:
    *   `origin` -> SEU repositório (push/fetch)
    *   `upstream` -> Repositório do TheNetsky (push/fetch)

## Passo 3: Enviar as Alterações Atuais

Agora que configuramos o seu repositório como `origin`, vamos enviar tudo o que fizemos (correções de segurança, variáveis de ambiente, etc.):

```bash
git push -u origin v3
```
*(Nota: Estamos usando a branch `v3` pois é a que você estava usando)*

## Passo 4: Como atualizar no futuro (Sincronizar)

Quando o criador original atualizar o projeto e você quiser trazer essas novidades para o seu, faça o seguinte:

1.  **Baixe as atualizações do original:**
    ```bash
    git fetch upstream
    ```

2.  **Mescle (Merge) com o seu código:**
    Certifique-se de estar na sua branch principal (ex: `v3`):
    ```bash
    git checkout v3
    git merge upstream/master
    ```
    *(Nota: verifique se a branch principal do original é `master` ou `main` ou `v3`. Se for `master`, use `upstream/master`)*

    > **Atenção:** Se houver conflitos (arquivos que nós mexemos e eles também), o git vai avisar. Você terá que abrir os arquivos, resolver os conflitos e fazer um novo commit. Como mexemos bastante na estrutura de `Load.ts` e importações, conflitos podem acontecer.

3.  **Envie para o seu GitHub:**
    ```bash
    git push origin v3
    ```

## Resumo dos Comandos

```bash
# 1. Renomear original
git remote rename origin upstream

# 2. Adicionar seu fork
git remote add origin https://github.com/SEU_USUARIO/Microsoft-Rewards-Script.git

# 3. Enviar tudo
git push -u origin v3
```