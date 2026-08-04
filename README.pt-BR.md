Follow for more... https://www.patreon.com/EasyModules

# EasyTrials

O EasyTrials transforma salvaguardas, testes de perícia e testes em grupo em um momento cinematográfico sincronizado para toda a mesa no Foundry Virtual Tabletop.

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
- Integração opcional com o EasyModules Hub.

## Requisitos

- Foundry Virtual Tabletop 14.
- Sistema D&D 5e 5.3.0 ou mais recente.

Nenhum outro módulo do Foundry é obrigatório.

### Opcionais

- **Dice So Nice:** adiciona a animação de dados 3D usada quando o resultado imediato está desativado.
- **EasyModules Hub:** adiciona um lançador e uma entrada de configuração compartilhados para a suíte EasyModules.

## Instalação

Cole este endereço no campo de manifesto da janela **Install Module** do Foundry:

```text
https://github.com/EasyModules/EasyTrials/releases/latest/download/module.json
```

Para instalação manual, extraia o pacote de forma que o manifesto fique em:

```text
Data/modules/easy-trials/module.json
```

Depois, ative **EasyTrials** no gerenciamento de módulos do mundo.

## Uso

1. Selecione até seis tokens na cena.
2. Execute a macro **Trials of Fate**, criada automaticamente.
3. Escolha a salvaguarda ou perícia, defina a CD e selecione resolução individual ou em grupo.
4. Configure vantagem, desvantagem ou uma fórmula extra como `1d4` no painel do Mestre.
5. Aplique a fórmula extra e libere as rolagens quando a mesa estiver pronta.

API pública:

```js
await game.easyTrials.start();
game.easyTrials.configure();
```

## Configurações

Abra **Configurações → Configurações de Módulos → EasyTrials**.

- **Exibir resultados imediatamente:** faz a rolagem internamente e mostra o resultado sem chamar dados 3D.
- **Ativar efeitos sonoros:** controla todo o perfil de áudio do EasyTrials.
- **Exigir liberação do Mestre:** inicia cada Trial com as rolagens dos jogadores bloqueadas.
- **Postar resumo final no chat:** cria ou suprime o resumo detalhado ao final.

## Licenças e créditos

- Código-fonte e documentação original: licença MIT. Consulte [`LICENSE`](LICENSE).
- Marca e assets do projeto EasyModules: consulte [`ASSET_LICENSE.md`](ASSET_LICENSE.md).
- Áudios de terceiros e atribuição do SRD: consulte [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Declaração de desenvolvimento

O EasyTrials foi desenvolvido com assistência de ferramentas de IA sob direção, testes, revisão e manutenção da EasyModules. O pacote não é apresentado como “Zero AI”.
