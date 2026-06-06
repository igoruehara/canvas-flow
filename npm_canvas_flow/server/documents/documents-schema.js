"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasFlowDocumentEntity = exports.EntitySchema = void 0;
const mongoose = require("mongoose");
const mongoose_1 = require("mongoose");
const documents_constants_model_1 = require("./documents-constants-model");
exports.EntitySchema = new mongoose.Schema({
    documentId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, default: '', index: true },
    agentId: { type: String, default: '', index: true },
    flowId: { type: String, default: '', index: true },
    conversationId: { type: String, default: '', index: true },
    rootDocumentId: { type: String, required: true, index: true },
    parentDocumentId: { type: String, default: '', index: true },
    version: { type: Number, default: 1 },
    filename: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    storage: { type: String, required: true },
    bucket: { type: String, default: '' },
    key: { type: String, required: true },
    source: { type: String, default: 'upload' },
    status: { type: String, default: 'stored' },
    text: { type: String, default: '' },
    structure: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
    collection: documents_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
exports.EntitySchema.index({ organizationId: 1, createdAt: -1 });
exports.EntitySchema.index({ rootDocumentId: 1, version: -1 });
exports.EntitySchema.index({ agentId: 1, flowId: 1, createdAt: -1 });
exports.EntitySchema.index({ conversationId: 1, createdAt: -1 });
class CanvasFlowDocumentEntity extends mongoose_1.Document {
}
exports.CanvasFlowDocumentEntity = CanvasFlowDocumentEntity;
//# sourceMappingURL=documents-schema.js.map