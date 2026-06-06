import { promises as fs } from 'fs';
import { join } from 'path';
import { DocumentsService } from './documents-service';
import { Document as DocxDocument, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';
import * as mammoth from 'mammoth';
import * as ExcelJS from 'exceljs';
import PizZip = require('pizzip');

const createModel = () => {
  const records: any[] = [];
  const matches = (row: any, query: Record<string, any>) => Object.entries(query || {}).every(([key, value]) => row[key] === value);

  const model: any = function Model(payload: any) {
    Object.assign(this, payload);
    this.save = async () => {
      records.push({ ...this });
      return this;
    };
  };
  model.createIndexes = jest.fn().mockResolvedValue(undefined);
  model.findOne = jest.fn((query) => ({
    lean: () => ({
      exec: async () => records.find((row) => matches(row, query)) || null,
    }),
  }));
  model.findOneAndUpdate = jest.fn((query, update) => ({
    lean: () => ({
      exec: async () => {
        const row = records.find((item) => matches(item, query));
        if (!row) return null;
        Object.assign(row, update.$set || {});
        return row;
      },
    }),
  }));
  model.find = jest.fn((query) => ({
    sort: () => ({
      limit: () => ({
        lean: () => ({
          exec: async () => records.filter((row) => matches(row, query)),
        }),
      }),
    }),
  }));
  return { model, records };
};

describe('DocumentsService', () => {
  const localDir = join(process.cwd(), 'tmp', 'documents-service-spec');

  afterEach(async () => {
    await fs.rm(localDir, { recursive: true, force: true });
  });

  it('stores an original locally and creates a downloadable derived text version', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);

    const original = await service.storeOriginal({
      buffer: Buffer.from('contrato original', 'utf-8'),
      filename: 'contrato.txt',
      mimeType: 'text/plain',
      scope: { organizationId: 'org-1' },
      text: 'contrato original',
    });
    const originalBytes = await service.getFile(original.documentId, { organizationId: 'org-1' });

    expect(original.storage).toBe('local');
    expect(originalBytes.buffer.toString('utf-8')).toBe('contrato original');

    const artifact = await service.createArtifact({
      format: 'txt',
      filename: 'contrato-atualizado.txt',
      content: 'Cliente: {{cliente.nome}}',
      replacements: { cliente: { nome: 'Ana' } },
      parentDocumentId: original.documentId,
      scope: { organizationId: 'org-1' },
    });
    const artifactBytes = await service.getFile(artifact.documentId, { organizationId: 'org-1' });

    expect(artifact.version).toBe(2);
    expect(artifact.rootDocumentId).toBe(original.documentId);
    expect(artifact.parentDocumentId).toBe(original.documentId);
    expect(artifactBytes.buffer.toString('utf-8')).toBe('Cliente: Ana');
  });

  it('generates DOCX and XLSX artifacts', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);

    const docx = await service.createArtifact({ format: 'docx', content: 'Contrato de teste' });
    const xlsx = await service.createArtifact({ format: 'xlsx', content: 'nome,valor\nContrato,10' });
    const docxBytes = await service.getFile(docx.documentId);
    const xlsxBytes = await service.getFile(xlsx.documentId);

    expect(docx.mimeType).toContain('wordprocessingml');
    expect(xlsx.mimeType).toContain('spreadsheetml');
    expect(docxBytes.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(xlsxBytes.buffer.subarray(0, 2).toString()).toBe('PK');
  });

  it('renders new XLSX artifacts with professional table styling', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);

    const artifact = await service.createArtifact({
      format: 'xlsx',
      filename: 'relatorio.xlsx',
      content: [
        '# Relatorio executivo',
        '',
        '## Responsabilidades',
        '',
        '| Frente | Status | Responsavel |',
        '| --- | --- | --- |',
        '| API | Em andamento | Backend |',
        '| Web | Concluido | Frontend |',
      ].join('\n'),
    });
    const rendered = await service.getFile(artifact.documentId);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(rendered.buffer as any);
    const sheet = workbook.getWorksheet('Documento')!;

    expect(sheet.getCell('A1').value).toBe('Relatorio executivo');
    expect(sheet.getCell('A2').value).toBe('Responsabilidades');
    expect(sheet.getCell('A3').value).toBe('Frente');
    expect(sheet.getCell('B3').value).toBe('Status');
    expect(sheet.getCell('A4').value).toBe('API');
    expect(sheet.getCell('A3').font?.bold).toBe(true);
    expect(sheet.getCell('A3').fill).toEqual(expect.objectContaining({ type: 'pattern' }));
    expect(sheet.autoFilter).toBeTruthy();
    expect(Number(sheet.getColumn(1).width)).toBeGreaterThan(10);
  });

  it('renders HTML and CSV artifacts from structured Markdown professionally', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);
    const content = [
      '# Plano de integracao',
      '',
      '## Riscos',
      '',
      '| Risco | Mitigacao |',
      '| --- | --- |',
      '| Timeout | Retry e monitoramento |',
    ].join('\n');

    const html = await service.createArtifact({ format: 'html', filename: 'plano.html', content });
    const csv = await service.createArtifact({ format: 'csv', filename: 'riscos.csv', content });
    const htmlBytes = await service.getFile(html.documentId);
    const csvBytes = await service.getFile(csv.documentId);
    const htmlText = htmlBytes.buffer.toString('utf-8');
    const csvText = csvBytes.buffer.toString('utf-8');

    expect(htmlText).toContain('<!doctype html>');
    expect(htmlText).toContain('<main class="page">');
    expect(htmlText).toContain('<table>');
    expect(htmlText).toContain('<th>Risco</th>');
    expect(csvText).toBe('Risco,Mitigacao\nTimeout,Retry e monitoramento\n');
  });

  it('renders Markdown tables as real DOCX tables for AI generated documents', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);

    const artifact = await service.createArtifact({
      format: 'docx',
      filename: 'relatorio-profissional.docx',
      content: [
        '# Relatorio executivo',
        '',
        '## Responsabilidades',
        '',
        '| Area | Responsavel | Prazo |',
        '| --- | --- | --- |',
        '| Integracao | Time API | 10 dias |',
        '| Frontend | Time Web | 15 dias |',
        '',
        '- Validar contrato tecnico',
      ].join('\n'),
    });
    const rendered = await service.getFile(artifact.documentId);
    const parsed = await mammoth.extractRawText({ buffer: rendered.buffer });
    const documentXml = new PizZip(rendered.buffer).file('word/document.xml')?.asText() || '';

    expect(documentXml).toContain('<w:tbl>');
    expect(parsed.value).toContain('Relatorio executivo');
    expect(parsed.value).toContain('Time API');
    expect(parsed.value).not.toContain('| Area | Responsavel | Prazo |');
  });

  it('unwraps a raw Docs Skill JSON wrapper before rendering DOCX content', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);

    const artifact = await service.createArtifact({
      format: 'docx',
      filename: 'artefato.docx',
      content: [
        '{"skill":"documents","plan":{"goal":"Gerar PDF","format":"docx"},"content":"# Arquitetura consolidada',
        '',
        '## Responsabilidades',
        '',
        '| Item | Status |',
        '| --- | --- |',
        '| Webhook | Incluido |","replacements":{}}',
      ].join('\n'),
    });
    const rendered = await service.getFile(artifact.documentId);
    const parsed = await mammoth.extractRawText({ buffer: rendered.buffer });

    expect(parsed.value).toContain('Arquitetura consolidada');
    expect(parsed.value).toContain('Webhook');
    expect(parsed.value).not.toContain('"skill"');
    expect(parsed.value).not.toContain('"plan"');
  });

  it('fills a DOCX template into a new version without overwriting the original', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);
    const templateBytes = await Packer.toBuffer(new DocxDocument({
      sections: [{ children: [new Paragraph({ text: 'Cliente: {{cliente.nome}}' })] }],
    }));
    const template = await service.storeOriginal({
      buffer: templateBytes,
      filename: 'contrato-template.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const artifact = await service.createArtifact({
      format: 'docx',
      filename: 'contrato-ana.docx',
      templateDocumentId: template.documentId,
      parentDocumentId: template.documentId,
      replacements: { cliente: { nome: 'Ana' } },
    });
    const rendered = await service.getFile(artifact.documentId);
    const parsed = await mammoth.extractRawText({ buffer: rendered.buffer });

    expect(parsed.value).toContain('Cliente: Ana');
    expect(artifact.documentId).not.toBe(template.documentId);
    expect(artifact.version).toBe(2);
  });

  it('edits a regular DOCX table without interpreting JSON braces as placeholders', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);
    const templateBytes = await Packer.toBuffer(new DocxDocument({
      sections: [{
        children: [
          new Paragraph({ text: 'Payload: { "chat": { "id": "123" } }' }),
          new Table({
            rows: [
              new TableRow({ children: [new TableCell({ children: [new Paragraph('Campo')] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph('valor')] })] }),
            ],
          }),
        ],
      }],
    }));
    const template = await service.storeOriginal({
      buffer: templateBytes,
      filename: 'documento-comum.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const artifact = await service.createArtifact({
      format: 'docx',
      filename: 'documento-editado.docx',
      templateDocumentId: template.documentId,
      parentDocumentId: template.documentId,
      docxEdits: [{ type: 'append_table_column', tableIndex: 0, header: 'teste', value: 'teste' }],
    });
    const rendered = await service.getFile(artifact.documentId);
    const parsed = await mammoth.extractRawText({ buffer: rendered.buffer });

    expect(parsed.value).toContain('Payload: { "chat": { "id": "123" } }');
    expect(parsed.value).toContain('Campo');
    expect(parsed.value).toContain('teste');
    expect(artifact.version).toBe(2);
  });

  it('edits an XLSX template into a new version without replacing the workbook', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);
    const workbook = new ExcelJS.Workbook();
    const january = workbook.addWorksheet('Janeiro');
    january.addRow(['DATA', 'NOME', 'DURACAO']);
    january.addRow(['2026-01-07', 'Ana', 2 / 24]);
    const totals = workbook.addWorksheet('Total acumulado');
    totals.addRow(['NOME', 'TOTAL (H)']);
    totals.addRow(['Ana', '']);
    totals.addRow(['Bruno', '']);
    const template = await service.storeOriginal({
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      filename: 'horas.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const artifact = await service.createArtifact({
      format: 'xlsx',
      filename: 'horas-atualizadas.xlsx',
      templateDocumentId: template.documentId,
      parentDocumentId: template.documentId,
      xlsxEdits: [{
        type: 'append_column',
        sheet: 'Total acumulado',
        header: 'Janeiro',
        keyColumn: 'NOME',
        valuesByKey: { Ana: '10:30', Bruno: '02:15' },
        valueType: 'duration',
      }],
    });
    const rendered = await service.getFile(artifact.documentId);
    const editedWorkbook = new ExcelJS.Workbook();
    await editedWorkbook.xlsx.load(rendered.buffer as any);
    const editedTotals = editedWorkbook.getWorksheet('Total acumulado')!;
    const durationHours = (value: any) => value instanceof Date
      ? (value.getTime() - Date.UTC(1899, 11, 30)) / 3600000
      : Number(value) * 24;

    expect(editedWorkbook.getWorksheet('Janeiro')?.getCell('B2').value).toBe('Ana');
    expect(editedTotals.getCell('C1').value).toBe('Janeiro');
    expect(durationHours(editedTotals.getCell('C2').value)).toBeCloseTo(10.5);
    expect(editedTotals.getCell('C2').numFmt).toBe('[h]:mm');
    expect(durationHours(editedTotals.getCell('C3').value)).toBeCloseTo(2.25);
    expect(artifact.version).toBe(2);
  });

  it('rejects an empty textual artifact', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);

    await expect(service.createArtifact({ format: 'csv', content: '' }))
      .rejects.toThrow('conteudo resultou em um arquivo vazio');
  });

  it('formats a generated PDF report with headings, lists and page numbering', async () => {
    const { model } = createModel();
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_FILES_STORAGE: 'local',
        CANVAS_FLOW_FILES_LOCAL_DIR: localDir,
      })[key]),
    };
    const service = new DocumentsService(model, configService as any);
    const artifact = await service.createArtifact({
      format: 'pdf',
      filename: 'arquitetura.pdf',
      content: [
        '# Arquitetura tecnica consolidada',
        '',
        'Versao: v1.1',
        '',
        '## Objetivo',
        '',
        'Documento formatado para o cliente.',
        '',
        '- Integracao via webhook',
        '- Correlacao por conversationId',
        '',
        '| Item | Status | Responsavel |',
        '| --- | --- | --- |',
        '| API | Em andamento | Backoffice |',
        '| Widget | Concluido | Frontend |',
        '',
        '```json',
        '{"status":"processing"}',
        '```',
      ].join('\n'),
    });
    const rendered = await service.getFile(artifact.documentId);

    expect(rendered.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(rendered.buffer.length).toBeGreaterThan(2200);
    expect(artifact.mimeType).toBe('application/pdf');
  });
});
