"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const mongoose_1 = require("mongoose");
const docx_1 = require("docx");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const documents_constants_model_1 = require("./documents-constants-model");
let DocumentsService = class DocumentsService {
    constructor(model, configService) {
        this.model = model;
        this.configService = configService;
    }
    onModuleInit() {
        void this.model.createIndexes().catch(() => undefined);
    }
    storageMode() {
        const configured = String(this.configService.get('CANVAS_FLOW_FILES_STORAGE') || '').trim().toLowerCase();
        if (configured === 's3')
            return 's3';
        if (configured === 'local')
            return 'local';
        return this.s3Bucket() ? 's3' : 'local';
    }
    s3Bucket() {
        return String(this.configService.get('CANVAS_FLOW_FILES_S3_BUCKET') || '').trim();
    }
    s3Region() {
        return String(this.configService.get('CANVAS_FLOW_FILES_S3_REGION') ||
            this.configService.get('AWS_REGION') ||
            'us-east-1').trim();
    }
    getS3Client() {
        if (!this.s3Client)
            this.s3Client = new client_s3_1.S3Client({ region: this.s3Region() });
        return this.s3Client;
    }
    localBaseDir() {
        return (0, path_1.resolve)(String(this.configService.get('CANVAS_FLOW_FILES_LOCAL_DIR') || (0, path_1.join)(process.cwd(), 'tmp', 'canvas-flow-documents')));
    }
    publicApiUrl() {
        return String(this.configService.get('CANVAS_FLOW_PUBLIC_URL') ||
            this.configService.get('CANVAS_FLOW_API_PUBLIC_URL') ||
            '').replace(/\/+$/, '');
    }
    safeSegment(value, fallback) {
        return String(value || fallback)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 160) || fallback;
    }
    fileKey(documentId, filename, scope) {
        return [
            'canvas-flow',
            this.safeSegment(scope.organizationId, 'global'),
            'documents',
            documentId,
            this.safeSegment((0, path_1.basename)(filename), 'arquivo.bin'),
        ].join('/');
    }
    resolveLocalPath(key) {
        const baseDir = this.localBaseDir();
        const target = (0, path_1.resolve)(baseDir, ...String(key || '').split('/').filter(Boolean));
        if (target !== baseDir && !target.startsWith(`${baseDir}${path_1.sep}`)) {
            throw new common_1.BadRequestException('Caminho de arquivo invalido.');
        }
        return target;
    }
    async writeBytes(storage, key, buffer, mimeType) {
        if (storage === 's3') {
            const bucket = this.s3Bucket();
            if (!bucket)
                throw new common_1.BadRequestException('CANVAS_FLOW_FILES_S3_BUCKET precisa estar configurado para usar S3.');
            const response = await this.getS3Client().send(new client_s3_1.PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: buffer,
                ContentType: mimeType || 'application/octet-stream',
            }));
            return { bucket, versionId: response.VersionId || '', etag: response.ETag || '' };
        }
        const localPath = this.resolveLocalPath(key);
        await fs_1.promises.mkdir((0, path_1.resolve)(localPath, '..'), { recursive: true });
        await fs_1.promises.writeFile(localPath, buffer);
        return { bucket: '', versionId: '', etag: '' };
    }
    async streamToBuffer(stream) {
        if (!stream)
            return Buffer.alloc(0);
        if (typeof stream.transformToByteArray === 'function') {
            return Buffer.from(await stream.transformToByteArray());
        }
        const chunks = [];
        for await (const chunk of stream)
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return Buffer.concat(chunks);
    }
    toPlain(row) {
        const record = typeof row?.toObject === 'function' ? row.toObject() : { ...(row || {}) };
        delete record._id;
        delete record.__v;
        return {
            ...record,
            id: record.documentId,
            downloadPath: `/api/documents/${encodeURIComponent(String(record.documentId || ''))}/download`,
        };
    }
    contentTypeFor(format) {
        return {
            txt: 'text/plain; charset=utf-8',
            md: 'text/markdown; charset=utf-8',
            csv: 'text/csv; charset=utf-8',
            json: 'application/json; charset=utf-8',
            html: 'text/html; charset=utf-8',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pdf: 'application/pdf',
        }[format];
    }
    getReplacementValue(values, path) {
        if (Object.prototype.hasOwnProperty.call(values || {}, path))
            return values[path];
        return String(path || '').split('.').reduce((current, key) => current?.[key], values);
    }
    assertArtifactFormat(value) {
        const format = String(value || 'txt').toLowerCase();
        if (!['txt', 'md', 'csv', 'json', 'html', 'docx', 'xlsx', 'pdf'].includes(format)) {
            throw new common_1.BadRequestException('Formato de artefato invalido. Use txt, md, csv, json, html, docx, xlsx ou pdf.');
        }
        return format;
    }
    fillTextTemplate(text, replacements) {
        return String(text || '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, key) => {
            const value = this.getReplacementValue(replacements, String(key || '').trim());
            if (value === undefined || value === null)
                return '';
            return typeof value === 'string' ? value : JSON.stringify(value);
        });
    }
    unwrapGeneratedDocumentContent(content) {
        const text = String(content || '').trim();
        if (!/^\s*\{[\s\S]*"content"\s*:/.test(text))
            return content;
        try {
            const parsed = JSON.parse(text);
            if (parsed
                && typeof parsed === 'object'
                && !Array.isArray(parsed)
                && (parsed.skill || parsed.plan || parsed.replacements || parsed.docxEdits || parsed.xlsxEdits)
                && typeof (parsed.content ?? parsed.text) === 'string') {
                return String(parsed.content ?? parsed.text);
            }
        }
        catch {
            const looseContent = this.extractLooseJsonStringField(text, 'content');
            if (looseContent)
                return looseContent;
        }
        return content;
    }
    extractLooseJsonStringField(text, field) {
        const pattern = new RegExp(`"${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*"`);
        const match = pattern.exec(text);
        if (!match)
            return '';
        let cursor = match.index + match[0].length;
        let output = '';
        while (cursor < text.length) {
            const char = text[cursor];
            if (char === '\\') {
                const next = text[cursor + 1];
                if (next === 'n')
                    output += '\n';
                else if (next === 'r')
                    output += '\r';
                else if (next === 't')
                    output += '\t';
                else if (next === '"' || next === '\\' || next === '/')
                    output += next;
                else
                    output += next || '';
                cursor += 2;
                continue;
            }
            if (char === '"') {
                const rest = text.slice(cursor + 1);
                if (/^\s*(?:,\s*"[\w.-]+"\s*:|\})/.test(rest))
                    break;
            }
            output += char;
            cursor += 1;
        }
        return output.trim();
    }
    flattenReplacements(value, prefix = '', output = {}) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            if (prefix)
                output[prefix] = value;
            return output;
        }
        Object.entries(value).forEach(([key, item]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                this.flattenReplacements(item, path, output);
            }
            else {
                output[path] = item;
            }
        });
        return output;
    }
    inlineText(value) {
        return String(value ?? '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .trim();
    }
    normalizedText(value) {
        return this.inlineText(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }
    markdownTableCells(line) {
        const trimmed = String(line || '').trim();
        if (!trimmed.includes('|'))
            return null;
        const row = trimmed.replace(/^\|/, '').replace(/\|$/, '');
        const cells = row.split('|').map((cell) => this.inlineText(cell.replace(/\\\|/g, '|')));
        return cells.length >= 2 ? cells : null;
    }
    isMarkdownTableSeparator(line) {
        const cells = this.markdownTableCells(line);
        return Boolean(cells?.length && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, ''))));
    }
    parseRichDocumentContent(content) {
        const blocks = [];
        const lines = String(content || '').replace(/\r\n?/g, '\n').split('\n');
        let paragraph = [];
        let codeLines = [];
        let listItem = null;
        let inCode = false;
        let renderedTitle = false;
        const flushParagraph = () => {
            const text = paragraph.join(' ').trim();
            if (text)
                blocks.push({ type: 'paragraph', text });
            paragraph = [];
        };
        const flushCode = () => {
            if (codeLines.length)
                blocks.push({ type: 'code', lines: codeLines });
            codeLines = [];
        };
        const flushListItem = () => {
            if (listItem?.text)
                blocks.push({ type: 'listItem', ...listItem });
            listItem = null;
        };
        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const trimmed = line.trim();
            if (/^```/.test(trimmed)) {
                flushParagraph();
                flushListItem();
                if (inCode)
                    flushCode();
                inCode = !inCode;
                continue;
            }
            if (inCode) {
                codeLines.push(line);
                continue;
            }
            if (!trimmed) {
                flushParagraph();
                flushListItem();
                continue;
            }
            if (/^[=_-]{5,}$/.test(trimmed)) {
                flushParagraph();
                flushListItem();
                continue;
            }
            const tableHeader = this.markdownTableCells(line);
            if (tableHeader && this.isMarkdownTableSeparator(lines[index + 1] || '')) {
                flushParagraph();
                flushListItem();
                const rows = [tableHeader];
                index += 2;
                while (index < lines.length) {
                    if (!lines[index].trim())
                        break;
                    if (this.isMarkdownTableSeparator(lines[index])) {
                        index += 1;
                        continue;
                    }
                    const row = this.markdownTableCells(lines[index]);
                    if (!row)
                        break;
                    rows.push(row);
                    index += 1;
                }
                index -= 1;
                blocks.push({ type: 'table', rows });
                continue;
            }
            const markdownHeading = trimmed.match(/^(#{1,6})\s+(.+)$/);
            const numberedHeading = trimmed.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/);
            const normalized = this.normalizedText(trimmed);
            const isUpperHeading = trimmed.length <= 110
                && /[A-Z]/.test(trimmed)
                && trimmed === trimmed.toLocaleUpperCase('pt-BR')
                && !/[{}[\]]/.test(trimmed);
            const isNamedHeading = /^(observacao importante|resumo executivo|conteudo principal|responsabilidades|criterios de aceite|objetivo|escopo|premissas|riscos|proximos passos|conclusao)$/.test(normalized);
            if (markdownHeading) {
                flushParagraph();
                flushListItem();
                blocks.push({ type: 'heading', level: Math.min(markdownHeading[1].length, 3), text: markdownHeading[2] });
                renderedTitle = true;
                continue;
            }
            if (!renderedTitle) {
                flushParagraph();
                flushListItem();
                blocks.push({ type: 'heading', level: 1, text: trimmed });
                renderedTitle = true;
                continue;
            }
            if (numberedHeading && (numberedHeading[1].includes('.')
                || (numberedHeading[2].length <= 90 && numberedHeading[2] === numberedHeading[2].toLocaleUpperCase('pt-BR')))) {
                flushParagraph();
                flushListItem();
                blocks.push({
                    type: 'heading',
                    level: numberedHeading[1].includes('.') ? 3 : 2,
                    text: `${numberedHeading[1]} ${numberedHeading[2]}`,
                });
                continue;
            }
            if (isUpperHeading) {
                flushParagraph();
                flushListItem();
                blocks.push({ type: 'heading', level: 2, text: trimmed });
                continue;
            }
            if (isNamedHeading) {
                flushParagraph();
                flushListItem();
                blocks.push({ type: 'heading', level: 3, text: trimmed });
                continue;
            }
            const bullet = trimmed.match(/^[-*\u2022]\s+(.+)$/);
            if (bullet) {
                flushParagraph();
                flushListItem();
                listItem = { text: bullet[1], marker: '' };
                continue;
            }
            if (numberedHeading) {
                flushParagraph();
                flushListItem();
                listItem = { text: numberedHeading[2], marker: `${numberedHeading[1]}.` };
                continue;
            }
            const label = trimmed.match(/^([^:]{1,55}):\s*(.*)$/);
            if (label && !/^https?$/i.test(label[1])) {
                flushParagraph();
                flushListItem();
                blocks.push({ type: 'label', label: label[1], value: label[2] });
                continue;
            }
            if (listItem) {
                listItem.text = `${listItem.text} ${trimmed}`;
                continue;
            }
            paragraph.push(trimmed);
        }
        flushParagraph();
        flushListItem();
        flushCode();
        return blocks;
    }
    renderDocxHeading(text, level) {
        const clean = this.inlineText(text);
        if (!clean)
            return [];
        const heading = level <= 1 ? docx_1.HeadingLevel.HEADING_1 : level === 2 ? docx_1.HeadingLevel.HEADING_2 : docx_1.HeadingLevel.HEADING_3;
        return [new docx_1.Paragraph({
                heading,
                spacing: { before: level <= 1 ? 120 : 220, after: level <= 1 ? 180 : 120 },
                children: [new docx_1.TextRun({
                        text: clean,
                        bold: true,
                        color: level <= 2 ? '17365D' : '1F4E79',
                        size: level <= 1 ? 32 : level === 2 ? 26 : 22,
                    })],
            })];
    }
    renderDocxParagraph(text) {
        const clean = this.inlineText(text);
        if (!clean)
            return [];
        return [new docx_1.Paragraph({
                spacing: { after: 160, line: 276 },
                children: [new docx_1.TextRun({ text: clean, color: '263238', size: 21 })],
            })];
    }
    renderDocxLabel(label, value) {
        const cleanLabel = this.inlineText(label);
        const cleanValue = this.inlineText(value);
        if (!cleanLabel)
            return [];
        return [new docx_1.Paragraph({
                spacing: { after: 70 },
                children: [
                    new docx_1.TextRun({ text: `${cleanLabel}: `, bold: true, color: '374151', size: 20 }),
                    new docx_1.TextRun({ text: cleanValue, color: '374151', size: 20 }),
                ],
            })];
    }
    renderDocxListItem(text, marker = '') {
        const clean = this.inlineText(text);
        if (!clean)
            return [];
        return [new docx_1.Paragraph({
                indent: { left: 420, hanging: 220 },
                spacing: { after: 80 },
                children: [
                    new docx_1.TextRun({ text: `${marker || '\u2022'} `, bold: true, color: '1F6FEB', size: 20 }),
                    new docx_1.TextRun({ text: clean, color: '263238', size: 20 }),
                ],
            })];
    }
    renderDocxCodeBlock(lines) {
        const content = lines.join('\n').trimEnd();
        if (!content)
            return [];
        return content.split('\n').map((line) => new docx_1.Paragraph({
            shading: { fill: 'F5F7FA' },
            spacing: { before: 0, after: 0 },
            children: [new docx_1.TextRun({ text: line || ' ', font: 'Courier New', size: 18, color: '263238' })],
        }));
    }
    renderDocxTable(rows) {
        const columnCount = Math.max(2, Math.min(10, ...rows.map((row) => row.length)));
        const normalizedRows = rows.map((row) => Array.from({ length: columnCount }, (_, index) => this.inlineText(row[index] || '')));
        const border = { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CBD5E1' };
        return [
            new docx_1.Table({
                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                alignment: docx_1.AlignmentType.CENTER,
                borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
                rows: normalizedRows.map((row, rowIndex) => new docx_1.TableRow({
                    tableHeader: rowIndex === 0,
                    children: row.map((cell) => new docx_1.TableCell({
                        shading: rowIndex === 0 ? { fill: 'EAF2FF' } : undefined,
                        margins: { top: 120, bottom: 120, left: 140, right: 140 },
                        children: [new docx_1.Paragraph({
                                spacing: { after: 0 },
                                children: [new docx_1.TextRun({
                                        text: cell || ' ',
                                        bold: rowIndex === 0,
                                        color: rowIndex === 0 ? '17365D' : '263238',
                                        size: 19,
                                    })],
                            })],
                    })),
                })),
            }),
            new docx_1.Paragraph({ spacing: { after: 140 }, children: [new docx_1.TextRun({ text: '' })] }),
        ];
    }
    async renderNewDocx(content) {
        const blocks = this.parseRichDocumentContent(content);
        const children = blocks.flatMap((block) => {
            if (block.type === 'heading')
                return this.renderDocxHeading(block.text, block.level);
            if (block.type === 'label')
                return this.renderDocxLabel(block.label, block.value);
            if (block.type === 'listItem')
                return this.renderDocxListItem(block.text, block.marker);
            if (block.type === 'code')
                return this.renderDocxCodeBlock(block.lines);
            if (block.type === 'table')
                return this.renderDocxTable(block.rows);
            return this.renderDocxParagraph(block.text);
        });
        return await docx_1.Packer.toBuffer(new docx_1.Document({
            sections: [{
                    properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
                    children: children.length ? children : [new docx_1.Paragraph({ text: ' ' })],
                }],
        }));
    }
    escapeXml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    wordParagraphXml(text) {
        return String(text ?? '')
            .split(/\r?\n/)
            .map((line) => `<w:p><w:r><w:t xml:space="preserve">${this.escapeXml(line)}</w:t></w:r></w:p>`)
            .join('');
    }
    wordTableCellXml(text, width) {
        return `<w:tc><w:tcPr><w:tcW w:w="${this.escapeXml(width)}" w:type="dxa"/></w:tcPr>${this.wordParagraphXml(text)}</w:tc>`;
    }
    appendDocxTableColumn(documentXml, edit) {
        let tableIndex = -1;
        return documentXml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, (tableXml) => {
            tableIndex += 1;
            const requestedIndex = Math.max(0, Number(edit.tableIndex || 0));
            if (edit.allTables !== true && tableIndex !== requestedIndex)
                return tableXml;
            const widths = Array.from(tableXml.matchAll(/<w:gridCol\b[^>]*\bw:w="([^"]+)"/g)).map((match) => match[1]);
            const width = widths[widths.length - 1] || '2400';
            let rowIndex = -1;
            let updated = tableXml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (rowXml) => {
                rowIndex += 1;
                const rowValue = rowIndex === 0
                    ? edit.header || ''
                    : Array.isArray(edit.values) && edit.values[rowIndex - 1] !== undefined
                        ? edit.values[rowIndex - 1]
                        : edit.value || '';
                return rowXml.replace(/<\/w:tr>$/, `${this.wordTableCellXml(rowValue, width)}</w:tr>`);
            });
            updated = updated.replace(/(<w:tblGrid\b[^>]*>)([\s\S]*?)(<\/w:tblGrid>)/, `$1$2<w:gridCol w:w="${this.escapeXml(width)}"/>$3`);
            return updated;
        });
    }
    appendDocxParagraph(documentXml, text) {
        if (!String(text || '').trim())
            return documentXml;
        const paragraph = this.wordParagraphXml(text);
        if (/<w:sectPr\b/.test(documentXml)) {
            return documentXml.replace(/<w:sectPr\b/, `${paragraph}<w:sectPr`);
        }
        return documentXml.replace(/<\/w:body>/, `${paragraph}</w:body>`);
    }
    applyDocxEdits(zip, edits) {
        if (!edits.length)
            return zip;
        const documentFile = zip.file('word/document.xml');
        if (!documentFile)
            throw new common_1.BadRequestException('DOCX sem word/document.xml.');
        let documentXml = documentFile.asText();
        edits.slice(0, 100).forEach((edit) => {
            if (edit?.type === 'append_table_column') {
                documentXml = this.appendDocxTableColumn(documentXml, edit);
            }
            if (edit?.type === 'append_paragraph') {
                documentXml = this.appendDocxParagraph(documentXml, String(edit.text || ''));
            }
        });
        zip.file('word/document.xml', documentXml);
        return zip;
    }
    hasDocxPlaceholders(zip) {
        const documentXml = zip.file('word/document.xml')?.asText() || '';
        const flattenedText = documentXml.replace(/<[^>]+>/g, '');
        return /\{\{\s*[^{}]+?\s*\}\}/.test(flattenedText);
    }
    async renderTemplateDocx(templateDocumentId, replacements, scope, edits = [], fallbackContent = '') {
        const { buffer } = await this.getFile(templateDocumentId, scope);
        try {
            let zip = new PizZip(buffer);
            if (this.hasDocxPlaceholders(zip)) {
                const template = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    delimiters: { start: '{{', end: '}}' },
                });
                template.render({ ...(replacements || {}), ...this.flattenReplacements(replacements || {}) });
                zip = template.getZip();
            }
            const effectiveEdits = edits.length || !String(fallbackContent || '').trim()
                ? edits
                : [{ type: 'append_paragraph', text: fallbackContent }];
            return this.applyDocxEdits(zip, effectiveEdits).generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        }
        catch (error) {
            throw new common_1.BadRequestException(`Nao foi possivel preencher o template DOCX: ${error?.message || String(error)}`);
        }
    }
    parseDelimitedLine(line, delimiter) {
        const values = [];
        let current = '';
        let quoted = false;
        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];
            if (char === '"') {
                if (quoted && line[index + 1] === '"') {
                    current += '"';
                    index += 1;
                }
                else {
                    quoted = !quoted;
                }
                continue;
            }
            if (char === delimiter && !quoted) {
                values.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        values.push(current.trim());
        return values;
    }
    parseDelimitedRows(content) {
        const lines = String(content || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length < 2)
            return null;
        const firstLine = lines.find((line) => !line.startsWith('#')) || lines[0];
        const delimiters = [',', ';', '\t'];
        const delimiter = delimiters
            .map((item) => ({ item, count: (firstLine.match(new RegExp(item === '\t' ? '\\t' : `\\${item}`, 'g')) || []).length }))
            .sort((left, right) => right.count - left.count)[0];
        if (!delimiter || delimiter.count <= 0)
            return null;
        const rows = lines.map((line) => this.parseDelimitedLine(line, delimiter.item)).filter((row) => row.length > 1);
        if (rows.length < 2 || rows.length < Math.max(2, Math.floor(lines.length * 0.6)))
            return null;
        return rows;
    }
    rowsFromJsonContent(content) {
        try {
            const parsed = JSON.parse(String(content || '').trim());
            if (Array.isArray(parsed) && parsed.length) {
                if (parsed.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
                    const headers = Array.from(new Set(parsed.flatMap((item) => Object.keys(item))));
                    return [headers, ...parsed.map((item) => headers.map((header) => {
                            const value = item[header];
                            return typeof value === 'string' ? value : JSON.stringify(value ?? '');
                        }))];
                }
                return [['valor'], ...parsed.map((item) => [typeof item === 'string' ? item : JSON.stringify(item ?? '')])];
            }
            if (parsed && typeof parsed === 'object') {
                return [['Campo', 'Valor'], ...Object.entries(parsed).map(([key, value]) => [
                        key,
                        typeof value === 'string' ? value : JSON.stringify(value ?? ''),
                    ])];
            }
        }
        catch {
            return null;
        }
        return null;
    }
    structuredRowsForContent(content) {
        const blocks = this.parseRichDocumentContent(content);
        const firstTable = blocks.find((block) => block.type === 'table');
        return firstTable?.rows || this.rowsFromJsonContent(content) || this.parseDelimitedRows(content);
    }
    xlsxCellBorder() {
        return {
            top: { style: 'thin', color: { argb: 'CBD5E1' } },
            left: { style: 'thin', color: { argb: 'CBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } },
        };
    }
    normalizeXlsxRows(rows) {
        const columnCount = Math.max(1, Math.min(50, ...rows.map((row) => row.length)));
        return rows.slice(0, 5000).map((row) => (Array.from({ length: columnCount }, (_, index) => this.inlineText(row[index] || ''))));
    }
    writeXlsxTable(worksheet, rows, startRow, title = '') {
        const normalizedRows = this.normalizeXlsxRows(rows);
        if (!normalizedRows.length)
            return startRow;
        const columnCount = normalizedRows[0].length;
        let rowNumber = startRow;
        if (title) {
            worksheet.mergeCells(rowNumber, 1, rowNumber, Math.max(columnCount, 4));
            const titleCell = worksheet.getCell(rowNumber, 1);
            titleCell.value = title;
            titleCell.font = { bold: true, size: 14, color: { argb: '17365D' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAF2FF' } };
            titleCell.alignment = { vertical: 'middle' };
            worksheet.getRow(rowNumber).height = 24;
            rowNumber += 1;
        }
        const headerRowNumber = rowNumber;
        normalizedRows.forEach((row, rowIndex) => {
            const sheetRow = worksheet.getRow(rowNumber + rowIndex);
            row.forEach((value, columnIndex) => {
                const cell = sheetRow.getCell(columnIndex + 1);
                cell.value = value;
                cell.border = this.xlsxCellBorder();
                cell.alignment = { vertical: 'top', wrapText: true };
                if (rowIndex === 0) {
                    cell.font = { bold: true, color: { argb: '17365D' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCEBFF' } };
                }
                else if (rowIndex % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
                }
            });
            sheetRow.commit();
        });
        if (!worksheet.autoFilter) {
            worksheet.autoFilter = {
                from: { row: headerRowNumber, column: 1 },
                to: { row: headerRowNumber, column: columnCount },
            };
            worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
        }
        return rowNumber + normalizedRows.length + 2;
    }
    writeXlsxMergedRow(worksheet, rowNumber, text, style = 'body') {
        const clean = this.inlineText(text);
        if (!clean)
            return rowNumber;
        const span = 6;
        worksheet.mergeCells(rowNumber, 1, rowNumber, span);
        const cell = worksheet.getCell(rowNumber, 1);
        cell.value = clean;
        cell.alignment = { vertical: 'top', wrapText: true };
        if (style === 'title') {
            cell.font = { bold: true, size: 18, color: { argb: '17365D' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAF2FF' } };
            worksheet.getRow(rowNumber).height = 30;
        }
        else if (style === 'heading') {
            cell.font = { bold: true, size: 13, color: { argb: '1F4E79' } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'B8CCE4' } } };
            worksheet.getRow(rowNumber).height = 24;
        }
        else {
            cell.font = { size: style === 'note' ? 10 : 11, color: { argb: '263238' } };
            worksheet.getRow(rowNumber).height = Math.min(80, Math.max(20, Math.ceil(clean.length / 90) * 18));
        }
        return rowNumber + 1;
    }
    autosizeXlsxColumns(worksheet) {
        worksheet.columns.forEach((column) => {
            let maxLength = 10;
            column.eachCell({ includeEmpty: false }, (cell) => {
                const value = cell.value;
                const text = typeof value === 'string'
                    ? value
                    : value === null || value === undefined
                        ? ''
                        : JSON.stringify(value);
                maxLength = Math.max(maxLength, ...String(text).split(/\r?\n/).map((line) => line.length));
            });
            column.width = Math.min(48, Math.max(12, maxLength + 2));
        });
    }
    async renderXlsx(content) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Canvas Flow';
        workbook.created = new Date();
        workbook.modified = new Date();
        const worksheet = workbook.addWorksheet('Documento', {
            properties: { defaultRowHeight: 20 },
            views: [{ state: 'frozen', ySplit: 1 }],
        });
        const directRows = this.structuredRowsForContent(content);
        const blocks = this.parseRichDocumentContent(content);
        const hasRichStructure = blocks.some((block) => block.type !== 'heading' && block.type !== 'paragraph') || blocks.some((block) => block.type === 'table');
        let rowNumber = 1;
        if (directRows && !hasRichStructure) {
            rowNumber = this.writeXlsxTable(worksheet, directRows, rowNumber, 'Dados');
        }
        else {
            blocks.forEach((block) => {
                if (block.type === 'heading') {
                    rowNumber = this.writeXlsxMergedRow(worksheet, rowNumber, block.text, block.level <= 1 ? 'title' : 'heading');
                }
                else if (block.type === 'label') {
                    rowNumber = this.writeXlsxMergedRow(worksheet, rowNumber, `${block.label}: ${block.value}`, 'note');
                }
                else if (block.type === 'listItem') {
                    rowNumber = this.writeXlsxMergedRow(worksheet, rowNumber, `${block.marker || '-'} ${block.text}`, 'body');
                }
                else if (block.type === 'code') {
                    rowNumber = this.writeXlsxMergedRow(worksheet, rowNumber, block.lines.join('\n'), 'note');
                }
                else if (block.type === 'table') {
                    rowNumber = this.writeXlsxTable(worksheet, block.rows, rowNumber, '');
                }
                else {
                    rowNumber = this.writeXlsxMergedRow(worksheet, rowNumber, block.text, 'body');
                }
            });
        }
        if (rowNumber === 1)
            this.writeXlsxMergedRow(worksheet, 1, 'Documento sem conteudo.', 'body');
        this.autosizeXlsxColumns(worksheet);
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }
    xlsxWorksheet(workbook, edit) {
        const sheet = String(edit.sheet || '').trim();
        const sheetIndex = Math.max(0, Math.floor(Number(edit.sheetIndex || 0)));
        const worksheet = sheet
            ? workbook.getWorksheet(sheet)
            : workbook.worksheets[sheetIndex];
        if (!worksheet) {
            throw new common_1.BadRequestException(sheet
                ? `A aba "${sheet}" nao foi encontrada no XLSX.`
                : `A aba de indice ${sheetIndex} nao foi encontrada no XLSX.`);
        }
        return worksheet;
    }
    xlsxDurationValue(value) {
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
        const match = String(value ?? '').trim().match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
        if (!match) {
            throw new common_1.BadRequestException(`Duracao XLSX invalida: "${String(value ?? '')}". Use HH:mm ou HH:mm:ss.`);
        }
        return (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)) / 86400;
    }
    xlsxCellValue(value, valueType) {
        if (valueType === 'duration')
            return this.xlsxDurationValue(value);
        if (valueType === 'number') {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                throw new common_1.BadRequestException(`Numero XLSX invalido: "${String(value ?? '')}".`);
            }
            return numeric;
        }
        return value ?? '';
    }
    setXlsxCellValue(cell, value, edit) {
        cell.value = this.xlsxCellValue(value, edit.valueType);
        const numberFormat = String(edit.numberFormat || (edit.valueType === 'duration' ? '[h]:mm' : '')).trim();
        if (numberFormat)
            cell.numFmt = numberFormat;
    }
    xlsxColumnNumber(worksheet, column, headerRow) {
        const numeric = Number(column);
        if (Number.isInteger(numeric) && numeric > 0)
            return numeric;
        const expectedHeader = String(column || '').trim().toLowerCase();
        if (!expectedHeader)
            return 1;
        const row = worksheet.getRow(headerRow);
        for (let index = 1; index <= Math.max(worksheet.columnCount, row.cellCount); index += 1) {
            if (String(row.getCell(index).text || '').trim().toLowerCase() === expectedHeader)
                return index;
        }
        throw new common_1.BadRequestException(`A coluna "${String(column || '')}" nao foi encontrada na aba "${worksheet.name}".`);
    }
    applyXlsxEdits(workbook, edits) {
        edits.slice(0, 1000).forEach((edit) => {
            const worksheet = this.xlsxWorksheet(workbook, edit);
            if (edit.type === 'set_cell') {
                const address = String(edit.cell || '').trim().toUpperCase();
                if (!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(address)) {
                    throw new common_1.BadRequestException(`Celula XLSX invalida: "${address}". Use um endereco como C2.`);
                }
                this.setXlsxCellValue(worksheet.getCell(address), edit.value, edit);
                return;
            }
            if (edit.type === 'append_column') {
                const headerRow = Math.max(1, Math.floor(Number(edit.headerRow || 1)));
                const startRow = Math.max(headerRow + 1, Math.floor(Number(edit.startRow || headerRow + 1)));
                const columnNumber = Math.max(1, worksheet.columnCount + 1);
                worksheet.getRow(headerRow).getCell(columnNumber).value = String(edit.header || '');
                if (edit.valuesByKey && typeof edit.valuesByKey === 'object' && !Array.isArray(edit.valuesByKey)) {
                    const keyColumn = this.xlsxColumnNumber(worksheet, edit.keyColumn || 1, headerRow);
                    for (let rowNumber = startRow; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
                        const key = String(worksheet.getRow(rowNumber).getCell(keyColumn).text || '').trim();
                        if (Object.prototype.hasOwnProperty.call(edit.valuesByKey, key)) {
                            this.setXlsxCellValue(worksheet.getRow(rowNumber).getCell(columnNumber), edit.valuesByKey[key], edit);
                        }
                    }
                    return;
                }
                (Array.isArray(edit.values) ? edit.values : []).forEach((value, index) => {
                    this.setXlsxCellValue(worksheet.getRow(startRow + index).getCell(columnNumber), value, edit);
                });
            }
        });
        return workbook;
    }
    async renderTemplateXlsx(templateDocumentId, replacements, scope, edits = []) {
        const { buffer } = await this.getFile(templateDocumentId, scope);
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            workbook.worksheets.forEach((worksheet) => {
                worksheet.eachRow({ includeEmpty: false }, (row) => {
                    row.eachCell({ includeEmpty: false }, (cell) => {
                        if (typeof cell.value === 'string') {
                            cell.value = this.fillTextTemplate(cell.value, replacements || {});
                        }
                    });
                });
            });
            this.applyXlsxEdits(workbook, edits);
            return Buffer.from(await workbook.xlsx.writeBuffer());
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException)
                throw error;
            throw new common_1.BadRequestException(`Nao foi possivel preencher o template XLSX: ${error?.message || String(error)}`);
        }
    }
    csvEscape(value) {
        const text = String(value ?? '');
        return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }
    renderCsv(content) {
        const rows = this.structuredRowsForContent(content);
        if (rows?.length) {
            return `${rows.map((row) => row.map((cell) => this.csvEscape(this.inlineText(cell))).join(',')).join('\n')}\n`;
        }
        const lines = String(content || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (!lines.length)
            return '';
        return `conteudo\n${lines.map((line) => this.csvEscape(this.inlineText(line))).join('\n')}\n`;
    }
    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    renderHtml(content) {
        const blocks = this.parseRichDocumentContent(content);
        const body = blocks.map((block) => {
            if (block.type === 'heading') {
                const tag = block.level <= 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
                return `<${tag}>${this.escapeHtml(this.inlineText(block.text))}</${tag}>`;
            }
            if (block.type === 'label') {
                return `<p class="meta"><strong>${this.escapeHtml(this.inlineText(block.label))}:</strong> ${this.escapeHtml(this.inlineText(block.value))}</p>`;
            }
            if (block.type === 'listItem') {
                return `<ul><li>${this.escapeHtml(this.inlineText(block.text))}</li></ul>`;
            }
            if (block.type === 'code') {
                return `<pre><code>${this.escapeHtml(block.lines.join('\n'))}</code></pre>`;
            }
            if (block.type === 'table') {
                const rows = this.normalizeXlsxRows(block.rows);
                const [header, ...items] = rows;
                return [
                    '<table>',
                    header ? `<thead><tr>${header.map((cell) => `<th>${this.escapeHtml(cell)}</th>`).join('')}</tr></thead>` : '',
                    `<tbody>${items.map((row) => `<tr>${row.map((cell) => `<td>${this.escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`,
                    '</table>',
                ].join('');
            }
            return `<p>${this.escapeHtml(this.inlineText(block.text))}</p>`;
        }).join('\n');
        return [
            '<!doctype html>',
            '<html lang="pt-BR">',
            '<head>',
            '<meta charset="utf-8" />',
            '<meta name="viewport" content="width=device-width, initial-scale=1" />',
            '<title>Documento Canvas Flow</title>',
            '<style>',
            ':root{--blue:#17365d;--line:#cbd5e1;--muted:#64748b;--bg:#f8fafc;}',
            'body{margin:0;background:var(--bg);font-family:Inter,Segoe UI,Arial,sans-serif;color:#263238;line-height:1.55;}',
            '.page{max-width:980px;margin:32px auto;padding:44px 52px;background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 18px 45px rgba(15,23,42,.08);}',
            '.eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#607d8b;border-bottom:1px solid #d8dee8;padding-bottom:10px;margin-bottom:26px;}',
            'h1{font-size:34px;line-height:1.15;color:var(--blue);margin:0 0 18px;border-bottom:3px solid #1f6feb;padding-bottom:14px;}',
            'h2{font-size:24px;color:var(--blue);margin:34px 0 12px;border-bottom:1px solid #b8cce4;padding-bottom:8px;}',
            'h3{font-size:18px;color:#1f4e79;margin:24px 0 10px;}',
            'p{margin:10px 0;} .meta{color:#374151;margin:4px 0;}',
            'ul{margin:10px 0 10px 22px;padding:0;} li{margin:6px 0;}',
            'table{width:100%;border-collapse:collapse;margin:18px 0 26px;font-size:14px;border:1px solid var(--line);}',
            'th{background:#eaf2ff;color:var(--blue);text-align:left;font-weight:700;} th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;} tr:nth-child(even) td{background:#f8fafc;}',
            'pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:16px;overflow:auto;font-size:13px;}',
            '@media print{body{background:#fff}.page{box-shadow:none;border:0;margin:0;max-width:none;border-radius:0}}',
            '</style>',
            '</head>',
            '<body>',
            '<main class="page">',
            '<div class="eyebrow">Documento consolidado</div>',
            body || '<p>Documento sem conteudo.</p>',
            '</main>',
            '</body>',
            '</html>',
        ].join('\n');
    }
    pdfInlineText(value) {
        return this.inlineText(value);
    }
    pdfAvailableWidth(doc) {
        return doc.page.width - doc.page.margins.left - doc.page.margins.right;
    }
    ensurePdfSpace(doc, height) {
        const bottom = doc.page.height - doc.page.margins.bottom - 14;
        const nearTop = doc.y <= doc.page.margins.top + 6;
        if (!nearTop && doc.y + height > bottom)
            doc.addPage();
    }
    renderPdfHeading(doc, text, level) {
        const clean = this.pdfInlineText(text);
        if (!clean)
            return;
        const left = doc.page.margins.left;
        const width = this.pdfAvailableWidth(doc);
        const fontSize = level <= 1 ? 19 : level === 2 ? 14 : 11.5;
        const before = level <= 1 ? 2 : level === 2 ? 1.1 : 0.7;
        const after = level <= 1 ? 0.8 : 0.45;
        const estimatedHeight = doc.font('Helvetica-Bold').fontSize(fontSize).heightOfString(clean, { width }) + 18;
        this.ensurePdfSpace(doc, estimatedHeight);
        if (doc.y > doc.page.margins.top + 6)
            doc.moveDown(before);
        doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(level <= 2 ? '#17365d' : '#1f4e79');
        doc.text(clean, left, doc.y, { width, lineGap: 1 });
        if (level <= 2) {
            doc.moveDown(0.25);
            doc.moveTo(doc.page.margins.left, doc.y)
                .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                .strokeColor(level === 1 ? '#1f6feb' : '#b8cce4')
                .lineWidth(level === 1 ? 1.5 : 0.8)
                .stroke();
        }
        doc.moveDown(after);
    }
    renderPdfParagraph(doc, text) {
        const clean = this.pdfInlineText(text);
        if (!clean)
            return;
        const left = doc.page.margins.left;
        const width = this.pdfAvailableWidth(doc);
        doc.font('Helvetica').fontSize(10).fillColor('#263238');
        this.ensurePdfSpace(doc, Math.min(doc.heightOfString(clean, { width, lineGap: 2 }), 120) + 8);
        doc.text(clean, left, doc.y, { width, lineGap: 2, align: 'left' });
        doc.moveDown(0.55);
    }
    renderPdfLabel(doc, label, value) {
        const cleanLabel = this.pdfInlineText(label);
        const cleanValue = this.pdfInlineText(value);
        if (!cleanLabel)
            return;
        const left = doc.page.margins.left;
        const width = this.pdfAvailableWidth(doc);
        this.ensurePdfSpace(doc, 20);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#374151').text(`${cleanLabel}: `, left, doc.y, {
            width,
            continued: Boolean(cleanValue),
            lineGap: 1,
        });
        if (cleanValue) {
            doc.font('Helvetica').fontSize(9.5).fillColor('#374151').text(cleanValue, { width, lineGap: 1 });
        }
        doc.moveDown(0.15);
    }
    renderPdfListItem(doc, text, marker = '') {
        const clean = this.pdfInlineText(text);
        if (!clean)
            return;
        const left = doc.page.margins.left;
        const contentLeft = left + 16;
        const width = this.pdfAvailableWidth(doc) - 16;
        doc.font('Helvetica').fontSize(9.8);
        const height = doc.heightOfString(clean, { width, lineGap: 1.5 });
        this.ensurePdfSpace(doc, height + 6);
        const y = doc.y;
        if (marker) {
            doc.font('Helvetica-Bold').fontSize(9.2).fillColor('#1f4e79').text(marker, left, y, { width: 13, lineBreak: false });
        }
        else {
            doc.circle(left + 4, y + 5, 2).fill('#1f6feb');
        }
        doc.font('Helvetica').fontSize(9.8).fillColor('#263238').text(clean, contentLeft, y, { width, lineGap: 1.5 });
        doc.y = Math.max(doc.y, y + height + 4);
    }
    renderPdfCodeBlock(doc, lines) {
        for (let offset = 0; offset < lines.length; offset += 30) {
            const content = lines.slice(offset, offset + 30).join('\n').trimEnd();
            if (!content)
                continue;
            const left = doc.page.margins.left;
            const width = this.pdfAvailableWidth(doc);
            doc.font('Courier').fontSize(8.2);
            const height = doc.heightOfString(content, { width: width - 18, lineGap: 1 }) + 18;
            this.ensurePdfSpace(doc, height + 6);
            const y = doc.y;
            doc.roundedRect(left, y, width, height, 4).fillAndStroke('#f5f7fa', '#d8dee8');
            doc.font('Courier').fontSize(8.2).fillColor('#263238').text(content, left + 9, y + 9, {
                width: width - 18,
                lineGap: 1,
            });
            doc.y = y + height + 7;
        }
    }
    renderPdfTable(doc, rows) {
        const columnCount = Math.max(2, Math.min(8, ...rows.map((row) => row.length)));
        const normalizedRows = rows.slice(0, 200).map((row) => (Array.from({ length: columnCount }, (_, index) => this.pdfInlineText(row[index] || ''))));
        const left = doc.page.margins.left;
        const width = this.pdfAvailableWidth(doc);
        const columnWidth = width / columnCount;
        const paddingX = 6;
        const paddingY = 5;
        const rowHeight = (row, isHeader) => {
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader ? 8.8 : 8.6);
            return Math.max(24, ...row.map((cell) => (doc.heightOfString(cell || ' ', { width: columnWidth - paddingX * 2, lineGap: 1 }) + paddingY * 2)));
        };
        const drawRow = (row, rowIndex, repeatedHeader = false) => {
            const isHeader = rowIndex === 0;
            const height = rowHeight(row, isHeader);
            const bottom = doc.page.height - doc.page.margins.bottom - 14;
            if (doc.y + height > bottom) {
                doc.addPage();
                if (!isHeader && !repeatedHeader && normalizedRows[0]) {
                    drawRow(normalizedRows[0], 0, true);
                }
            }
            const y = doc.y;
            let x = left;
            row.forEach((cell) => {
                const fill = isHeader ? '#eaf2ff' : rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
                doc.rect(x, y, columnWidth, height).fillAndStroke(fill, '#cbd5e1');
                doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
                    .fontSize(isHeader ? 8.8 : 8.6)
                    .fillColor(isHeader ? '#17365d' : '#263238')
                    .text(cell || ' ', x + paddingX, y + paddingY, {
                    width: columnWidth - paddingX * 2,
                    lineGap: 1,
                });
                x += columnWidth;
            });
            doc.y = y + height;
        };
        this.ensurePdfSpace(doc, 34);
        normalizedRows.forEach((row, rowIndex) => drawRow(row, rowIndex));
        doc.moveDown(0.85);
    }
    drawPdfPageDecoration(doc) {
        const range = doc.bufferedPageRange();
        for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
            doc.switchToPage(pageIndex);
            const left = doc.page.margins.left;
            const right = doc.page.width - doc.page.margins.right;
            doc.save();
            doc.moveTo(left, 34).lineTo(right, 34).strokeColor('#d8dee8').lineWidth(0.7).stroke();
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#607d8b')
                .text('DOCUMENTO CONSOLIDADO', left, 22, { width: right - left, lineBreak: false });
            doc.moveTo(left, doc.page.height - 33).lineTo(right, doc.page.height - 33).strokeColor('#d8dee8').lineWidth(0.7).stroke();
            doc.font('Helvetica').fontSize(8.5).fillColor('#455a64')
                .text(`Pagina ${pageIndex - range.start + 1} de ${range.count}`, right - 100, doc.page.height - 48, {
                width: 100,
                align: 'right',
            });
            doc.restore();
        }
    }
    async renderPdf(content) {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 54, right: 52, bottom: 54, left: 52 },
            bufferPages: true,
            info: { Title: 'Documento consolidado' },
        });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        const completed = new Promise((resolveBuffer, reject) => {
            doc.on('end', () => resolveBuffer(Buffer.concat(chunks)));
            doc.on('error', reject);
        });
        const blocks = this.parseRichDocumentContent(content);
        blocks.forEach((block) => {
            if (block.type === 'heading')
                this.renderPdfHeading(doc, block.text, block.level);
            if (block.type === 'paragraph')
                this.renderPdfParagraph(doc, block.text);
            if (block.type === 'label')
                this.renderPdfLabel(doc, block.label, block.value);
            if (block.type === 'listItem')
                this.renderPdfListItem(doc, block.text, block.marker);
            if (block.type === 'code')
                this.renderPdfCodeBlock(doc, block.lines);
            if (block.type === 'table')
                this.renderPdfTable(doc, block.rows);
        });
        if (!blocks.length)
            this.renderPdfParagraph(doc, ' ');
        this.drawPdfPageDecoration(doc);
        doc.end();
        return await completed;
    }
    async renderArtifact(params) {
        const renderedContent = this.fillTextTemplate(params.content || '', params.replacements || {});
        const content = this.unwrapGeneratedDocumentContent(renderedContent);
        if (params.format === 'docx') {
            if (params.templateDocumentId) {
                return await this.renderTemplateDocx(params.templateDocumentId, params.replacements || {}, params.scope || {}, params.docxEdits || [], params.content || '');
            }
            return await this.renderNewDocx(content);
        }
        if (params.format === 'xlsx') {
            if (params.templateDocumentId) {
                return await this.renderTemplateXlsx(params.templateDocumentId, params.replacements || {}, params.scope || {}, params.xlsxEdits || []);
            }
            return await this.renderXlsx(content);
        }
        if (params.format === 'pdf')
            return await this.renderPdf(content);
        if (params.format === 'html')
            return Buffer.from(this.renderHtml(content), 'utf-8');
        if (params.format === 'csv')
            return Buffer.from(this.renderCsv(content), 'utf-8');
        if (params.format === 'json') {
            try {
                return Buffer.from(`${JSON.stringify(JSON.parse(content), null, 2)}\n`, 'utf-8');
            }
            catch {
                return Buffer.from(content, 'utf-8');
            }
        }
        return Buffer.from(content, 'utf-8');
    }
    async storeOriginal(params) {
        const documentId = (0, crypto_1.randomUUID)();
        const scope = params.scope || {};
        const filename = this.safeSegment((0, path_1.basename)(params.filename || 'arquivo.bin'), 'arquivo.bin');
        const storage = this.storageMode();
        const key = this.fileKey(documentId, filename, scope);
        const stored = await this.writeBytes(storage, key, params.buffer, params.mimeType || 'application/octet-stream');
        const row = await new this.model({
            documentId,
            organizationId: String(scope.organizationId || ''),
            agentId: String(scope.agentId || ''),
            flowId: String(scope.flowId || ''),
            conversationId: String(scope.conversationId || ''),
            rootDocumentId: documentId,
            parentDocumentId: '',
            version: 1,
            filename,
            mimeType: params.mimeType || 'application/octet-stream',
            size: params.buffer.length,
            storage,
            bucket: stored.bucket,
            key,
            source: params.source || 'upload',
            status: 'stored',
            text: params.text || '',
            structure: params.structure || {},
            metadata: {
                ...(params.metadata || {}),
                hashSha256: (0, crypto_1.createHash)('sha256').update(params.buffer).digest('hex'),
                versionId: stored.versionId,
                etag: stored.etag,
            },
        }).save();
        return this.toPlain(row);
    }
    async updateExtraction(documentId, extraction) {
        const row = await this.model.findOneAndUpdate({ documentId }, {
            $set: {
                text: extraction.text || '',
                structure: extraction.structure || {},
                status: extraction.text ? 'ready' : 'stored',
                ...(extraction.metadata ? { metadata: extraction.metadata } : {}),
            },
        }, { new: true }).lean().exec();
        return row ? this.toPlain(row) : null;
    }
    async createArtifact(params) {
        const format = this.assertArtifactFormat(params.format);
        const scope = params.scope || {};
        const parent = params.parentDocumentId
            ? await this.getRecord(params.parentDocumentId, scope)
            : null;
        const templateDocumentId = params.templateDocumentId || '';
        const buffer = await this.renderArtifact({
            format,
            content: params.content,
            replacements: params.replacements,
            templateDocumentId,
            docxEdits: params.docxEdits,
            xlsxEdits: params.xlsxEdits,
            scope,
        });
        if (!buffer.length) {
            throw new common_1.BadRequestException('Nao foi possivel gerar o artefato: o conteudo resultou em um arquivo vazio.');
        }
        const documentId = (0, crypto_1.randomUUID)();
        const filename = this.safeSegment(params.filename || `artefato-${documentId.slice(0, 8)}.${format}`, `artefato.${format}`);
        const storage = this.storageMode();
        const key = this.fileKey(documentId, filename, scope);
        const mimeType = this.contentTypeFor(format);
        const stored = await this.writeBytes(storage, key, buffer, mimeType);
        const rootDocumentId = String(parent?.rootDocumentId || parent?.documentId || documentId);
        const version = parent ? Number(parent.version || 1) + 1 : 1;
        const row = await new this.model({
            documentId,
            organizationId: String(scope.organizationId || ''),
            agentId: String(scope.agentId || ''),
            flowId: String(scope.flowId || ''),
            conversationId: String(scope.conversationId || ''),
            rootDocumentId,
            parentDocumentId: String(parent?.documentId || ''),
            version,
            filename,
            mimeType,
            size: buffer.length,
            storage,
            bucket: stored.bucket,
            key,
            source: 'generated',
            status: 'ready',
            text: params.content || '',
            structure: {
                format,
                templateDocumentId,
                replacements: params.replacements || {},
                docxEdits: params.docxEdits || [],
                xlsxEdits: params.xlsxEdits || [],
            },
            metadata: {
                ...(params.metadata || {}),
                hashSha256: (0, crypto_1.createHash)('sha256').update(buffer).digest('hex'),
                versionId: stored.versionId,
                etag: stored.etag,
            },
        }).save();
        return await this.withSignedDownloadUrl(this.toPlain(row));
    }
    async getRecord(documentId, scope = {}) {
        const query = { documentId };
        if (scope.organizationId)
            query.organizationId = scope.organizationId;
        const row = await this.model.findOne(query).lean().exec();
        if (!row)
            throw new common_1.NotFoundException('Documento nao encontrado.');
        return this.toPlain(row);
    }
    async getFile(documentId, scope = {}) {
        const record = await this.getRecord(documentId, scope);
        if (record.storage === 's3') {
            const response = await this.getS3Client().send(new client_s3_1.GetObjectCommand({
                Bucket: record.bucket || this.s3Bucket(),
                Key: record.key,
            }));
            return { record, buffer: await this.streamToBuffer(response.Body) };
        }
        return { record, buffer: await fs_1.promises.readFile(this.resolveLocalPath(record.key)) };
    }
    async openLocalReadStream(documentId, scope = {}) {
        const record = await this.getRecord(documentId, scope);
        if (record.storage !== 'local')
            return null;
        return { record, stream: (0, fs_1.createReadStream)(this.resolveLocalPath(record.key)) };
    }
    async withSignedDownloadUrl(record) {
        if (record.storage !== 's3') {
            const prefix = this.publicApiUrl();
            return { ...record, downloadUrl: `${prefix}${record.downloadPath}` };
        }
        const expiresIn = Math.max(60, Math.min(Number(this.configService.get('CANVAS_FLOW_FILES_DOWNLOAD_TTL_SECONDS') || 900), 86400));
        const downloadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.getS3Client(), new client_s3_1.GetObjectCommand({
            Bucket: record.bucket || this.s3Bucket(),
            Key: record.key,
            ResponseContentDisposition: `attachment; filename="${this.safeSegment(record.filename, 'arquivo.bin')}"`,
        }), { expiresIn });
        return { ...record, downloadUrl, downloadExpiresInSeconds: expiresIn };
    }
    async getDownloadInfo(documentId, scope = {}) {
        return await this.withSignedDownloadUrl(await this.getRecord(documentId, scope));
    }
    async list(scope = {}, limit = 100) {
        const query = {};
        if (scope.organizationId)
            query.organizationId = scope.organizationId;
        if (scope.agentId)
            query.agentId = scope.agentId;
        if (scope.flowId)
            query.flowId = scope.flowId;
        if (scope.conversationId)
            query.conversationId = scope.conversationId;
        const rows = await this.model.find(query).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(Number(limit || 100), 500))).lean().exec();
        return { documents: rows.map((row) => this.toPlain(row)), total: rows.length };
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(documents_constants_model_1.MODEL_NAME)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        config_1.ConfigService])
], DocumentsService);
//# sourceMappingURL=documents-service.js.map