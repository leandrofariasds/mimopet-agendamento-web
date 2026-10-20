# 🐾 MimoPet — Agenda de Agendamentos para Pet Shop

Aplicação web responsiva desenvolvida com **HTML5, CSS3, JavaScript puro e Bootstrap 5**. O layout é original, com inspiração no setor de pet shops, e funciona sem servidor e sem banco de dados.

## Estrutura do projeto

```text
mimopet-agendamentos/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── assets/
│   └── favicon.svg
└── README.md
```

## Como executar

1. Extraia a pasta do arquivo `.zip`.
2. Abra a pasta `mimopet-agendamentos` no **Visual Studio Code**.
3. Abra o arquivo `index.html` no navegador ou use a extensão **Live Server** do VS Code. Para isso, clique com o botão direito em `index.html` e escolha **Open with Live Server**.
4. Clique em **Novo agendamento** para cadastrar um horário. Informe nome do pet, tutor, tipo de pet, serviço, data e horário.
5. Na agenda, você também pode **pesquisar**, filtrar por **Todos / Hoje / Próximos**, **editar** e **excluir**.

> É necessário acesso à internet para carregar Bootstrap, Bootstrap Icons, as fontes externas e a fotografia ilustrativa. O JavaScript da agenda e os estilos próprios estão incluídos no projeto. A agenda também funciona sem a foto; a aparência pode ficar simplificada se o CDN estiver indisponível.

## Funcionalidades

- Design adaptado para celular, tablet e desktop.
- Cadastro de atendimentos com nome do pet, tutor, telefone opcional, espécie, serviço, data, hora e observações.
- Edição e exclusão de agendamentos com confirmação antes de excluir.
- Pesquisa por pet, tutor ou serviço; filtros por período.
- Painel com indicadores de agendamentos do dia, futuros e total.
- Destaque do próximo agendamento disponível.
- Validação de campos obrigatórios e de data/hora futura.
- Atendimento de **segunda a sábado, das 08:00 às 18:00** (regra demonstrativa configurável no código).
- Agendamentos a cada **15 minutos**, respeitando a duração de cada serviço.
- **Verificação de conflitos de horário** entre serviços agendados.
- Persistência no `localStorage`, sem instalação de servidor.
- Três agendamentos **fictícios**, marcados como `Exemplo`, aparecem no primeiro acesso para demonstrar a lista. Podem ser editados ou apagados. Ao remover todos, a lista permanecerá vazia nas próximas visitas ao mesmo navegador.

## Regras de serviço (demonstrativas)

| Serviço | Duração |
| --- | ---: |
| Banho relaxante | 60 min |
| Tosa especial | 90 min |
| Banho + tosa | 120 min |
| Hidratação & spa | 45 min |
| Corte de unhas | 30 min |

As durações ficam definidas no objeto `SERVICES`, no início de `js/app.js`. Para alterar a jornada de atendimento, ajuste `OPEN_MINUTES`, `CLOSE_MINUTES` e a função `isClosedDay` no mesmo arquivo e atualize a informação de horários do `index.html`.

## Tecnologias

- **HTML5:** estrutura semântica, formulários e acessibilidade.
- **CSS3:** aparência, cores, responsividade e efeitos visuais.
- **JavaScript ES6+:** controle de eventos, validações, gerenciamento dinâmico, filtros e `localStorage`.
- **Bootstrap 5.3.3:** grade responsiva, menus, formulários, modais e notificações.
- **Bootstrap Icons 1.11.3:** ícones visuais.

## Limitações e evolução

**Esta é uma versão demonstrativa front-end.** Os agendamentos ficam apenas no `localStorage` do navegador e não são compartilhados entre computadores, usuários ou dispositivos. Limpar os dados do navegador remove os registros. Não há autenticação nem envio de lembretes.

**Para usar em um pet shop real**, será necessário criar um backend (por exemplo, PHP e MySQL ou Python e PostgreSQL), controle de acesso, armazenamento seguro e verificação de conflitos também no servidor. Não use esta versão isoladamente para receber agendamentos reais de vários clientes.

## Créditos e referências visuais

Layout e código criados especificamente para este exercício. Foram usadas como referências gerais de apresentação do segmento as lojas e portais indicados no enunciado (Petz, Amigo Bicho, Vida.pet, Pet+, Pet Town Recife), sem reproduzir marcas ou copiar seus layouts. Imagem ilustrativa externa utilizada por meio de Unsplash.
