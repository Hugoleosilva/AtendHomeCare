// Modelos de documento (fichas) de cada empresa. Cada modelo é uma configuração editável:
// título, campos do cabeçalho, colunas da tabela, rodapé, cores e linhas em branco.
// Textos aceitam marcadores, trocados na exportação: {paciente} {empresa} {competencia} {mes} {MES} {ano} {profissional} {crefito}

export const TOKENS = [
  ['{paciente}', 'nome do paciente'],
  ['{empresa}', 'nome da empresa'],
  ['{competencia}', 'Outubro 2026'],
  ['{mes}', 'Outubro'],
  ['{MES}', 'OUTUBRO'],
  ['{ano}', '2026'],
  ['{profissional}', 'nome da profissional'],
  ['{crefito}', 'CREFITO'],
]

export const SOURCES = [
  { value: 'date', label: 'Data do atendimento' },
  { value: 'sigla', label: 'Especialidade / sigla do procedimento' },
  { value: 'procs', label: 'Procedimentos realizados' },
  { value: 'evolution', label: 'Evolução do paciente' },
  { value: 'observation', label: 'Observação' },
  { value: 'professional', label: 'Profissional (nome + CREFITO)' },
  { value: 'text', label: 'Texto fixo' },
  { value: 'blank', label: 'Em branco (para assinatura)' },
]

const SERIF_BLUE = { font: 'serif', line: '#2F5FA7', headFill: '#EAF1FB', headText: '#1F4E8C', titleColor: '#1F4E8C', footerColor: '#2F5FA7' }

const BASE = {
  reintegrar: {
    id: 'reintegrar', name: 'Ficha de Frequência', fileWord: 'FREQUENCIA',
    title: 'FICHA DE FREQUÊNCIA', titleAlign: 'center', headerText: '', logoSide: 'left', logoSize: 'lg',
    fields: [[{ label: 'Paciente:', value: '{paciente}' }], [{ label: 'Convênio:', value: 'Fisio' }, { label: 'Mês de Ref.:', value: '{competencia}' }]],
    columns: [
      { h: 'Data', src: 'date', w: 15, align: 'center' }, { h: 'Especialidade', src: 'sigla', w: 20, align: 'center' },
      { h: 'Profissional', src: 'professional', w: 35, align: 'center' }, { h: 'Paciente/Responsável', src: 'blank', w: 30, align: 'left' },
    ],
    footer: ['Endereço: Rua Santo Elias, 475, Espinheiro, Recife-PE, CEP 52020-095, Telefone: (81) 3072-6772, (81) 9.9742-7777, contato@reintegrarsaude.com.br'],
    footerAlign: 'center', footerBold: false, stamp: false, minRows: 30,
    style: { font: 'sans', line: '#9CA3AF', headFill: '#FCE3D0', headText: '#1F2937', titleColor: '#1F2937', footerColor: '#6B7280' },
  },
  residencia_relatorio: {
    id: 'residencia_relatorio', name: 'Relatório de Acompanhamento', fileWord: 'RELATORIO',
    title: 'RELATÓRIO DE ACOMPANHAMENTO - MÊS {MES}', titleAlign: 'left', headerText: '', logoSide: 'center',
    fields: [[{ label: 'PACIENTE:', value: '{paciente}' }, { label: 'CONVÊNIO:', value: '' }]],
    columns: [
      { h: 'DATA', src: 'date', w: 18, align: 'center' }, { h: 'PROFISSIONAL', src: 'professional', w: 47, align: 'center' },
      { h: 'ESPECIALIDADE', src: 'text', text: 'Fisioterapia', w: 35, align: 'center' },
    ],
    footer: ['OBS: PARA REGISTRO DE VISITAS E PLANTÕES DE TODOS OS PROFISSIONAIS (MÉDICO, FISIOTERAPEUTA, NUTRICIONISTA, ENFERMEIRA, ASSISTENTE SOCIAL, PSICÓLOGO, AUXILIAR DE ENFERMAGEM, ETC). PREENCHER EM LETRA DE FORMA.'],
    footerAlign: 'left', footerBold: true, stamp: false, minRows: 30, style: SERIF_BLUE,
  },
  residencia: {
    id: 'residencia', name: 'Evolução Clínica', fileWord: 'EVOLUCAO',
    title: 'Evolução Clínica', titleAlign: 'center', headerText: '', logoSide: 'left',
    fields: [[{ label: 'Nome:', value: '{paciente}' }, { label: 'Competência:', value: '{competencia}' }]],
    columns: [{ h: 'Data', src: 'date', w: 15, align: 'center' }, { h: 'Evolução', src: 'evolution', w: 85, align: 'left' }],
    footer: ['Toda anotação deve ser assinada e carimbada pelo profissional que o faz.', '{profissional} - {crefito}'],
    footerAlign: 'left', footerBold: false, stamp: false, minRows: 24, style: SERIF_BLUE,
  },
  interne: {
    id: 'interne', name: 'Frequência de atendimento', fileWord: 'FREQUENCIA',
    title: 'Frequência de atendimento', titleAlign: 'left', headerText: 'HOSPITAL DA AERONAUTICA', logoSide: 'right',
    fields: [[{ label: 'Mês de referência:', value: '{mes}' }], [{ label: 'Nome do Paciente:', value: '{paciente}' }]],
    columns: [
      { h: 'Data', src: 'date', w: 25, align: 'left' }, { h: 'Especificar terapia', src: 'sigla', w: 25, align: 'center' },
      { h: 'Assinatura do responsável', src: 'blank', w: 50, align: 'left' },
    ],
    footer: ['R. General Joaquim Inacio, 356 Ilha do Leite – Recife – PE CEP: 50070-330', 'Fone/Fax: 81-2123-0440 email: interne@interne.com.br'],
    footerAlign: 'center', footerBold: false, stamp: true, minRows: 28,
    style: { font: 'serif', line: '#000000', headFill: '#FFFFFF', headText: '#000000', titleColor: '#000000', footerColor: '#000000' },
  },
  padrao: {
    id: 'padrao', name: 'Evolução (tabela padrão)', fileWord: 'EVOLUCAO',
    title: 'Evolução do Paciente – {empresa}', titleAlign: 'center', headerText: '', logoSide: 'left',
    fields: [[{ label: 'Paciente:', value: '{paciente}' }], [{ label: 'Empresa:', value: '{empresa}' }, { label: 'Competência:', value: '{competencia}' }]],
    columns: [
      { h: 'Data', src: 'date', w: 12, align: 'center' }, { h: 'Procedimentos', src: 'procs', w: 28, align: 'left' },
      { h: 'Evolução', src: 'evolution', w: 60, align: 'left' },
    ],
    footer: ['{profissional} - {crefito}'], footerAlign: 'left', footerBold: false, stamp: false, minRows: 0,
    style: { font: 'sans', line: '#9CA3AF', headFill: '', headText: '#FFFFFF', titleColor: '#1F2937', footerColor: '#6B7280' }, // headFill vazio = cor da empresa
  },
}

const BY_LAYOUT = {
  padrao: ['padrao'],
  reintegrar: ['reintegrar', 'padrao'],
  interne: ['interne', 'padrao'],
  residencia: ['residencia_relatorio', 'residencia'],
}

const clone = (o) => JSON.parse(JSON.stringify(o))

export const defaultDocsFor = (company) => (BY_LAYOUT[company?.layout || 'padrao'] || ['padrao']).map((k) => {
  const d = clone(BASE[k])
  if (k === 'interne') d.headerText = company?.headerText || d.headerText
  return d
})

// Modelos da empresa: os editados (salvos) ou, se nunca editou, os padrões do modelo escolhido.
export const resolveDocs = (company) => (company?.docs?.length ? company.docs : defaultDocsFor(company))

export const blankDoc = (from) => ({ ...clone(from || BASE.padrao), id: Math.random().toString(36).slice(2, 9), name: 'Novo documento', fileWord: 'EVOLUCAO' })
