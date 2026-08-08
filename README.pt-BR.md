Follow for more... https://www.patreon.com/EasyModules

# EasyTrials

O EasyTrials transforma salvaguardas, testes de perícia e testes em grupo em momentos cinematográficos sincronizados para toda a mesa no Foundry Virtual Tabletop.

O Mestre escolhe os participantes e o teste, controla vantagem, desvantagem, bônus e liberação das rolagens, enquanto o EasyTrials sincroniza os resultados e apresenta o desfecho com cartas animadas, áudio e um resumo detalhado no chat.

## Recursos

- Salvaguardas e testes de perícia para até seis tokens selecionados.
- Resolução individual ou pela regra de teste em grupo: o grupo tem sucesso quando pelo menos metade dos participantes passa.
- Cartas animadas com modificador, vantagem, desvantagem e bônus extras aplicados pelo Mestre.
- Cancelamento correto quando vantagem e desvantagem estão presentes ao mesmo tempo.
- Liberação opcional pelo Mestre, mantendo as rolagens dos jogadores bloqueadas até a mesa estar pronta.
- Resultado interno imediato ou apresentação opcional com dados 3D pelo Dice So Nice.
- Sons e animações distintos para cartas, resultados individuais, resultado do grupo, nova chance e fechamento.
- Resumo detalhado no chat com d20, modificador do sistema, fórmula extra, dados extras e total.
- Interface em inglês e português do Brasil.
- Macro de abertura gerenciada e integrada ao sistema compartilhado de pastas de macros do EasyModules.
- Integração obrigatória com o EasyModules Hub.

## Requisitos

- Foundry Virtual Tabletop v13.351 até v14 (verificado no v14.364).
- Sistema D&D 5e 5.3.0 ou mais recente (verificado no 5.3.3).
- EasyModules Hub 1.0.7 ou mais recente (obrigatório).

### Opcional

- **Dice So Nice:** adiciona a animação de dados 3D usada quando o resultado imediato está desativado.

## Instalação

Cole este endereço no campo de manifesto da janela **Install Module** do Foundry:

```text
https://github.com/EasyModules/EasyTrials/releases/latest/download/module.json
```

Depois da instalação, ative **EasyModules Hub** e **EasyTrials** no mundo. Quando disponível, o Foundry solicitará a instalação ou ativação da dependência obrigatória do Hub.

Para instalação manual, extraia o pacote de forma que o manifesto fique em:

```text
Data/modules/easy-trials/module.json
```

## Primeiros passos

1. Selecione até seis tokens na cena.
2. Execute a macro **Trials of Fate**, gerenciada automaticamente, ou abra o EasyTrials pelo EasyModules Hub.
3. Escolha a salvaguarda ou perícia, defina a CD e selecione resolução individual ou em grupo.
4. Configure vantagem, desvantagem ou uma fórmula extra como `1d4` no painel do Mestre.
5. Aplique a fórmula extra e libere as rolagens quando a mesa estiver pronta.

Com o EasyModules Hub 1.0.7 ou mais recente, a macro de abertura é identificada como pertencente ao EasyTrials e organizada em:

```text
EASYMODULES
└── EasyTrials
    └── Trials of Fate
```

Macros existentes compatíveis do EasyTrials são reutilizadas e atualizadas em vez de duplicadas.

## Configuração

As configurações do EasyTrials permanecem disponíveis pelos dois caminhos suportados:

- **EasyModules Hub → EasyTrials → Configure**
- **Game Settings → Configure Settings → Module Settings → EasyTrials**

Configurações disponíveis:

- **Exibir resultados imediatamente:** faz a rolagem internamente e mostra o resultado sem chamar dados 3D.
- **Ativar efeitos sonoros:** controla todo o perfil de áudio do EasyTrials.
- **Exigir liberação do Mestre:** inicia cada Trial com as rolagens dos jogadores bloqueadas.
- **Postar resumo final no chat:** cria ou suprime o resumo detalhado ao final.

## API pública

O EasyTrials expõe sua API compatível em `game.easyTrials` após o hook `ready`:

```js
await game.easyTrials.start();
game.easyTrials.configure();
```

Outros módulos também podem acessar a mesma API por:

```js
game.modules.get("easy-trials")?.api
```

O alias legado `game.trialsOfFate` continua disponível para compatibilidade com macros e integrações antigas.

## Compatibilidade

O EasyTrials oferece suporte ao Foundry VTT v13.351 até v14 e é verificado no v14.364 com D&D 5e 5.3.3. O suporte ao Dice So Nice é opcional e detectado em tempo de execução.

O módulo usa APIs públicas de configurações, sockets, macros, documentos e aplicações do Foundry. Grandes atualizações do Foundry ou D&D 5e devem passar por testes de regressão antes de aumentarmos as versões verificadas.

Consulte [COMPATIBILITY.md](COMPATIBILITY.md) para o checklist da release e notas de compatibilidade.

## Suporte

Reporte bugs e problemas de compatibilidade no [issue tracker do EasyTrials](https://github.com/EasyModules/EasyTrials/issues). Informe a versão do Foundry VTT, a versão do sistema D&D 5e, se o Dice So Nice está ativo e qualquer erro relevante do console do navegador.

## Declaração de desenvolvimento

O EasyTrials é desenvolvido e mantido pela EasyModules com implementação e revisão de código assistidas por IA. As decisões de release, testes, licenciamento e manutenção permanecem sob responsabilidade da EasyModules.

O projeto não é apresentado como “Zero AI”.

## Licença e avisos de terceiros

Copyright © 2026 EasyModules. Distribuído sob a **EasyModules Software License — Version 1.0**. Consulte [LICENSE](LICENSE).

Os termos dos assets pertencentes ao projeto são resumidos em [ASSET_LICENSE.md](ASSET_LICENSE.md). Áudios de terceiros, atribuição do SRD, créditos de dependências e avisos de marcas estão documentados em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

O EasyTrials é um módulo independente e não é afiliado nem endossado pela Foundry Gaming LLC, Wizards of the Coast LLC ou pelos desenvolvedores do Dice So Nice.
