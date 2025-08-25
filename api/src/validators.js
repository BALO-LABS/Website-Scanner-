const Joi = require('joi');

const scanRequestSchema = Joi.object({
  url: Joi.string().uri().required(),
  options: Joi.object({
    maxPages: Joi.number().integer().min(1).max(500).default(50),
    maxDepth: Joi.number().integer().min(1).max(10).default(3),
    delay: Joi.number().integer().min(100).max(5000).default(500),
    minQualityScore: Joi.number().integer().min(0).max(100).default(30),
    pageTypes: Joi.array().items(
      Joi.string().valid(
        'FAQ', 'Documentation', 'Support', 'Guide', 
        'Troubleshooting', 'API Documentation', 'Knowledge Base',
        'Product', 'Service', 'Blog/Article', 'Other'
      )
    ).optional(),
    includeContent: Joi.boolean().default(true)
  }).optional()
});

const exportRequestSchema = Joi.object({
  scanId: Joi.string().uuid().required(),
  format: Joi.string().valid('json', 'rag', 'markdown', 'vectordb', 'csv', 'xml').default('json')
});

const extractRequestSchema = Joi.object({
  url: Joi.string().uri().required(),
  extractors: Joi.array().items(
    Joi.string().valid('qa', 'content', 'metadata', 'schema', 'structure')
  ).default(['qa', 'content', 'metadata'])
});

const batchRequestSchema = Joi.object({
  urls: Joi.array().items(Joi.string().uri()).min(1).max(10).required(),
  options: Joi.object({
    maxPages: Joi.number().integer().min(1).max(500).default(50),
    maxDepth: Joi.number().integer().min(1).max(10).default(3),
    delay: Joi.number().integer().min(100).max(5000).default(500),
    minQualityScore: Joi.number().integer().min(0).max(100).default(30),
    pageTypes: Joi.array().items(Joi.string()).optional(),
    includeContent: Joi.boolean().default(true)
  }).optional()
});

function validateScanRequest(data) {
  return scanRequestSchema.validate(data);
}

function validateExportRequest(data) {
  return exportRequestSchema.validate(data);
}

function validateExtractRequest(data) {
  return extractRequestSchema.validate(data);
}

function validateBatchRequest(data) {
  return batchRequestSchema.validate(data);
}

module.exports = {
  validateScanRequest,
  validateExportRequest,
  validateExtractRequest,
  validateBatchRequest
};