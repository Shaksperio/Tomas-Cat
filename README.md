# Tomas Vagabundo

Jogo 3D de exploração e sobrevivência felina, desenvolvido originalmente no **Google AI Studio** e versionado neste repositório.

## Tecnologias

- React + TypeScript
- Three.js
- Vite
- Tailwind CSS

## Executar localmente

Requer Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

## Verificações antes de publicar

```bash
npm run lint
npm run build
```

O resultado de produção é gerado na pasta `dist/`.

## Publicação no GitHub Pages

O projeto usa o caminho-base `/Tomas-Cat/` definido em `vite.config.ts`. O workflow em `.github/workflows/deploy-pages.yml` compila o projeto e publica `dist/) automaticamente quando há atualizações na branch `main`.

No GitHub, abra **Settings → Pages** e selecione **GitHub Actions** em *Build and deployment*.

Endereço público esperado: https://shaksperio.github.io/Tomas-Cat/

## Continuidade com Google AI Studio

O Google AI Studio é o ambiente de desenvolvimento original. Este repositório contém a cópia versionada do código-fonte. Ao continuar o trabalho no AI Studio, sincronize as alterações exportadas com este repositório e preserve a configuração Vite e o workflow do GitHub Pages.

## Sistemas de jogo em evolução

- Ciclo de sete períodos do dia.
- Iluminação lunar e força especial de Tomas.
- Chuva, neve, vento frio, frio congelante e chuva ácida.
- Prédios acessíveis com zonas internas de abrigo climático.
