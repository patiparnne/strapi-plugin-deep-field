/**
 * Deep Field Controller
 * 
 * Provides API endpoints for field listing and value extraction.
 */

import type { Core } from '@strapi/strapi';
import type { ListFieldsOptions, GetValueOptions } from '../types';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * List all mappable fields for a collection
   * GET /deep-field/fields/:collectionUid
   */
  async listFields(ctx: any) {
    const { collectionUid } = ctx.params;
    const { types, includeRepeatable, maxDepth, customFieldUids, includeRelations, componentCategories } = ctx.query;

    if (!collectionUid) {
      return ctx.badRequest('Collection UID is required');
    }

    // Parse options from query params
    const options: ListFieldsOptions = {};
    
    if (types) {
      options.types = Array.isArray(types) ? types : types.split(',');
    }
    
    if (includeRepeatable !== undefined) {
      options.includeRepeatable = includeRepeatable === 'true' || includeRepeatable === true;
    }
    
    if (maxDepth) {
      options.maxDepth = parseInt(maxDepth, 10);
    }
    
    if (customFieldUids) {
      options.customFieldUids = Array.isArray(customFieldUids) ? customFieldUids : customFieldUids.split(',');
    }
    
    if (includeRelations !== undefined) {
      options.includeRelations = includeRelations === 'true' || includeRelations === true;
    }
    
    if (componentCategories) {
      options.componentCategories = Array.isArray(componentCategories) ? componentCategories : componentCategories.split(',');
    }

    const { includeBuiltIn } = ctx.query;
    if (includeBuiltIn !== undefined) {
      options.includeBuiltIn = includeBuiltIn === 'true' || includeBuiltIn === true;
    }

    try {
      const service = strapi.plugin('deep-field').service('deep-field');
      const fields = await service.listFields(collectionUid, options);
      
      ctx.body = { data: fields };
    } catch (err: any) {
      strapi.log.error(`[DeepField] Error listing fields: ${err.message}`);
      ctx.body = { data: [], error: err.message };
    }
  },

  /**
   * Get value from a field path
   * GET /deep-field/value/:collectionUid/:documentId
   */
  async getValue(ctx: any) {
    const { collectionUid, documentId } = ctx.params;
    const { fieldPath, relationOutput, forEntryMutation } = ctx.query;

    if (!collectionUid || !documentId || !fieldPath) {
      return ctx.badRequest('Collection UID, document ID, and field path are required');
    }

    const options: GetValueOptions = {};
    
    if (relationOutput) {
      options.relationOutput = relationOutput as 'documentId' | 'mainField' | 'populate';
    }
    
    if (forEntryMutation !== undefined) {
      options.forEntryMutation = forEntryMutation === 'true' || forEntryMutation === true;
    }

    try {
      const service = strapi.plugin('deep-field').service('deep-field');
      const result = await service.getValue(collectionUid, documentId, fieldPath, options);
      
      ctx.body = { data: result };
    } catch (err: any) {
      strapi.log.error(`[DeepField] Error getting value: ${err.message}`);
      ctx.body = { data: { value: null, found: false, error: err.message } };
    }
  },

  /**
   * Build populate configuration
   * POST /deep-field/populate/:collectionUid
   */
  async buildPopulate(ctx: any) {
    const { collectionUid } = ctx.params;
    const { paths } = ctx.request.body;

    if (!collectionUid || !paths || !Array.isArray(paths)) {
      return ctx.badRequest('Collection UID and paths array are required');
    }

    try {
      const service = strapi.plugin('deep-field').service('deep-field');
      const populate = await service.buildPopulateConfig(collectionUid, paths);
      
      ctx.body = { data: populate };
    } catch (err: any) {
      strapi.log.error(`[DeepField] Error building populate: ${err.message}`);
      ctx.body = { data: {}, error: err.message };
    }
  },

  /**
   * Get main field for a collection
   * GET /deep-field/main-field/:collectionUid
   */
  async getMainField(ctx: any) {
    const { collectionUid } = ctx.params;

    if (!collectionUid) {
      return ctx.badRequest('Collection UID is required');
    }

    try {
      const service = strapi.plugin('deep-field').service('deep-field');
      const mainField = await service.getMainField(collectionUid);
      
      ctx.body = { data: mainField };
    } catch (err: any) {
      strapi.log.error(`[DeepField] Error getting main field: ${err.message}`);
      ctx.body = { data: null, error: err.message };
    }
  },

  /**
   * Get component info
   * GET /deep-field/component/:componentUid
   */
  async getComponentInfo(ctx: any) {
    const { componentUid } = ctx.params;

    if (!componentUid) {
      return ctx.badRequest('Component UID is required');
    }

    try {
      const service = strapi.plugin('deep-field').service('deep-field');
      const component = await service.getComponentInfo(componentUid);
      
      ctx.body = { data: component };
    } catch (err: any) {
      strapi.log.error(`[DeepField] Error getting component: ${err.message}`);
      ctx.body = { data: null, error: err.message };
    }
  },

  /**
   * Validate field path
   * POST /deep-field/validate/:collectionUid
   */
  async validateFieldPath(ctx: any) {
    const { collectionUid } = ctx.params;
    const { fieldPath, expectedTypes } = ctx.request.body;

    if (!collectionUid || !fieldPath) {
      return ctx.badRequest('Collection UID and field path are required');
    }

    try {
      const service = strapi.plugin('deep-field').service('deep-field');
      const result = await service.validateFieldPath(collectionUid, fieldPath, expectedTypes);
      
      ctx.body = { data: result };
    } catch (err: any) {
      strapi.log.error(`[DeepField] Error validating field path: ${err.message}`);
      ctx.body = { data: { valid: false, error: err.message } };
    }
  },

  /**
   * Get all collections
   * GET /deep-field/collections
   */
  async getCollections(ctx: any) {
    try {
      const service = strapi.plugin('deep-field').service('deep-field');
      const collections = await service.getCollections();
      
      ctx.body = { data: collections };
    } catch (err: any) {
      strapi.log.error(`[DeepField] Error getting collections: ${err.message}`);
      ctx.body = { data: [], error: err.message };
    }
  },

  /**
   * Get all components
   * GET /deep-field/components
   */
  async getComponents(ctx: any) {
    try {
      const service = strapi.plugin('deep-field').service('deep-field');
      const components = await service.getComponents();
      
      ctx.body = { data: components };
    } catch (err: any) {
      strapi.log.error(`[DeepField] Error getting components: ${err.message}`);
      ctx.body = { data: [], error: err.message };
    }
  },
});
