/**
 * Deep Field Service
 * 
 * Provides utilities for accessing nested fields in Strapi collections,
 * including components, dynamic zones, and custom fields.
 */

import type { Core } from '@strapi/strapi';
import type {
  MappableField,
  ListFieldsOptions,
  GetValueOptions,
  FieldValueResult,
  MainFieldInfo,
  ComponentInfo,
  BasicFieldType,
  FieldSourceType,
} from '../types';

const LOG_PREFIX = '[DeepField]';

// Default basic types to include
const DEFAULT_BASIC_TYPES: BasicFieldType[] = [
  'string', 'text', 'richtext', 'blocks', 'email', 'password', 'uid',
  'integer', 'biginteger', 'float', 'decimal',
  'date', 'datetime', 'time',
  'boolean', 'enumeration', 'json', 'media', 'relation'
];

/**
 * Cache for content type configurations (includes contentType and components)
 */
const configCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Structure to hold full configuration response including components
 */
interface FullConfigResponse {
  contentType: any;
  components: Record<string, any>;
}

/**
 * Get cached or fresh content type configuration (full response with components)
 */
async function getFullContentTypeConfig(strapi: Core.Strapi, uid: string): Promise<FullConfigResponse | null> {
  const cacheKey = `full:${uid}`;
  const cached = configCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Use the content-manager plugin service to get configuration
    const contentManagerPlugin = strapi.plugin('content-manager');
    if (contentManagerPlugin) {
      const configService = contentManagerPlugin.service('content-types');
      if (configService?.findConfiguration) {
        const config = await configService.findConfiguration({ uid });
        if (config) {
          // The config response includes both contentType settings and components
          const fullConfig: FullConfigResponse = {
            contentType: config,
            components: config.components || {},
          };
          configCache.set(cacheKey, { data: fullConfig, timestamp: Date.now() });
          return fullConfig;
        }
      }
    }
  } catch (err) {
    strapi.log.debug(`${LOG_PREFIX} Could not get content-manager config for ${uid}: ${err}`);
  }

  return null;
}

/**
 * Get cached or fresh content type configuration (legacy - for backward compatibility)
 */
async function getContentTypeConfig(strapi: Core.Strapi, uid: string): Promise<any> {
  const fullConfig = await getFullContentTypeConfig(strapi, uid);
  return fullConfig?.contentType || null;
}

/**
 * Get field label from configuration metadata
 * Returns the edit.label from the configuration, or falls back to the field name
 */
async function getFieldLabel(
  strapi: Core.Strapi,
  collectionUid: string,
  fieldName: string,
  componentUid?: string
): Promise<string> {
  const fullConfig = await getFullContentTypeConfig(strapi, collectionUid);
  
  if (fullConfig) {
    // If this is a component field, look in the components section
    if (componentUid && fullConfig.components[componentUid]) {
      const compMeta = fullConfig.components[componentUid]?.metadatas?.[fieldName];
      if (compMeta?.edit?.label) {
        return compMeta.edit.label;
      }
    }
    
    // Look in the main content type metadata
    const meta = fullConfig.contentType?.metadatas?.[fieldName];
    if (meta?.edit?.label) {
      return meta.edit.label;
    }
  }
  
  // Fallback: return the field name as-is
  return fieldName;
}

/**
 * Build human-readable label from path using configuration labels
 * Format: "Label1 › Label2 (original.path)"
 */
async function buildPathLabel(
  strapi: Core.Strapi,
  collectionUid: string,
  path: string,
  labelSegments: string[]
): Promise<string> {
  const labelPart = labelSegments.join(' › ');
  return labelPart === path ? path : `${labelPart} (${path})`;
}

/**
 * Get main field for a collection/component
 */
async function getMainFieldFromConfig(strapi: Core.Strapi, uid: string): Promise<string | null> {
  const config = await getContentTypeConfig(strapi, uid);
  if (config?.settings?.mainField) {
    return config.settings.mainField;
  }
  
  // Fallback: try to find a sensible default
  const schema = strapi.contentTypes[uid] || strapi.components[uid];
  if (schema?.attributes) {
    // Look for common main field names
    const commonNames = ['name', 'title', 'label', 'displayName', 'firstName', 'email', 'uid'];
    for (const name of commonNames) {
      if (schema.attributes[name]) {
        return name;
      }
    }
    // Fall back to first string field
    for (const [name, attr] of Object.entries(schema.attributes as Record<string, any>)) {
      if (attr.type === 'string' || attr.type === 'text' || attr.type === 'email') {
        return name;
      }
    }
  }
  
  return 'documentId';
}

/**
 * Check if a type is a basic mappable type
 */
function isBasicType(type: string): type is BasicFieldType {
  return DEFAULT_BASIC_TYPES.includes(type as BasicFieldType);
}

/**
 * Traverse and collect mappable fields from a schema
 */
async function traverseSchema(
  strapi: Core.Strapi,
  attributes: Record<string, any>,
  options: ListFieldsOptions,
  collectionUid: string,
  parentPath: string = '',
  parentLabelSegments: string[] = [],
  depth: number = 0,
  source: FieldSourceType = 'attribute',
  componentUid?: string
): Promise<MappableField[]> {
  const fields: MappableField[] = [];
  const maxDepth = options.maxDepth ?? 3;
  const types = options.types ?? DEFAULT_BASIC_TYPES;
  const includeRepeatable = options.includeRepeatable ?? true;
  const includeRelations = options.includeRelations ?? true;
  const includeBuiltIn = options.includeBuiltIn ?? false;

  if (depth > maxDepth) {
    return fields;
  }

  for (const [name, attr] of Object.entries(attributes)) {
    const path = parentPath ? `${parentPath}.${name}` : name;
    const attrType = attr.type as string;
    
    // Skip internal fields (unless includeBuiltIn is set at top-level depth)
    if (['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'publishedAt', 'locale'].includes(name)) {
      if (!includeBuiltIn || depth > 0) {
        continue;
      }
    }

    // Get the label for this field from configuration
    const fieldLabel = await getFieldLabel(strapi, collectionUid, name, componentUid);
    const labelSegments = [...parentLabelSegments, fieldLabel];

    // Handle basic types
    if (isBasicType(attrType)) {
      // Skip relations if not wanted
      if (attrType === 'relation' && !includeRelations) {
        continue;
      }
      
      // Check if this type is in the wanted types
      if (types.includes(attrType)) {
        // Build label in format: "Label1 › Label2 (path)"
        const label = await buildPathLabel(strapi, collectionUid, path, labelSegments);
        
        const field: MappableField = {
          path,
          label,
          type: attrType,
          source,
          componentUid,
          required: attr.required ?? false,
        };

        // Add relation-specific info
        if (attrType === 'relation') {
          field.relationTarget = attr.target;
          field.relationType = attr.relation;
        }

        // Add enum values
        if (attrType === 'enumeration' && attr.enum) {
          field.enumValues = attr.enum;
        }

        fields.push(field);
      }
    }
    
    // Handle components
    else if (attrType === 'component') {
      const compUid = attr.component as string;
      const compSchema = strapi.components[compUid];
      
      if (!compSchema) {
        strapi.log.warn(`${LOG_PREFIX} Component not found: ${compUid}`);
        continue;
      }

      const isRepeatable = attr.repeatable ?? false;
      
      // Skip repeatable if not wanted
      if (isRepeatable && !includeRepeatable) {
        continue;
      }

      // Check component category filter
      if (options.componentCategories && options.componentCategories.length > 0) {
        const category = compUid.split('.')[0];
        if (!options.componentCategories.includes(category)) {
          continue;
        }
      }

      // Traverse into component
      const componentFields = await traverseSchema(
        strapi,
        compSchema.attributes as Record<string, any>,
        options,
        collectionUid,
        path,
        labelSegments,
        depth + 1,
        'component',
        compUid
      );

      // Mark fields as repeatable if parent is repeatable
      for (const field of componentFields) {
        if (isRepeatable) {
          field.isRepeatable = true;
        }
        fields.push(field);
      }
    }
    
    // Handle dynamic zones
    else if (attrType === 'dynamiczone') {
      const components = attr.components as string[];
      
      if (!components || components.length === 0) {
        continue;
      }

      // Skip if repeatable not wanted (dynamic zones are inherently repeatable)
      if (!includeRepeatable) {
        continue;
      }

      for (const compUid of components) {
        const compSchema = strapi.components[compUid];
        
        if (!compSchema) {
          strapi.log.warn(`${LOG_PREFIX} Component not found in dynamiczone: ${compUid}`);
          continue;
        }

        // Check component category filter
        if (options.componentCategories && options.componentCategories.length > 0) {
          const category = compUid.split('.')[0];
          if (!options.componentCategories.includes(category)) {
            continue;
          }
        }

        // Traverse into component with dynamic zone path
        const dzPath = `${path}[${compUid}]`;
        const componentFields = await traverseSchema(
          strapi,
          compSchema.attributes as Record<string, any>,
          options,
          collectionUid,
          dzPath,
          labelSegments,
          depth + 1,
          'dynamiczone',
          compUid
        );

        // Mark all as repeatable
        for (const field of componentFields) {
          field.isRepeatable = true;
          fields.push(field);
        }
      }
    }
    
    // Handle custom fields
    else if (attr.customField) {
      const customFieldUid = attr.customField as string;
      
      // Check if this custom field is in the wanted list
      if (options.customFieldUids && options.customFieldUids.includes(customFieldUid)) {
        // Get the underlying type from the attribute
        const underlyingType = attr.type as BasicFieldType;
        
        if (types.includes(underlyingType)) {
          // Build label in format: "Label1 › Label2 (path)"
          const label = await buildPathLabel(strapi, collectionUid, path, labelSegments);
          
          fields.push({
            path,
            label,
            type: underlyingType,
            source: 'customField',
            customFieldUid,
            componentUid,
            required: attr.required ?? false,
          });
        }
      }
    }
  }

  return fields;
}

/**
 * Parse a field path to extract components
 * e.g., "identities[identity.line].uid" -> { base: 'identities', componentUid: 'identity.line', rest: 'uid' }
 */
function parseFieldPath(path: string): { segments: Array<{ name: string; componentUid?: string }> } {
  const segments: Array<{ name: string; componentUid?: string }> = [];
  const regex = /([^.\[\]]+)(?:\[([^\]]+)\])?/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    segments.push({
      name: match[1],
      componentUid: match[2] || undefined,
    });
  }

  return { segments };
}

/**
 * Extract value from entry following a field path
 */
async function extractValue(
  strapi: Core.Strapi,
  entry: Record<string, any>,
  path: string,
  collectionUid: string,
  options: GetValueOptions = {}
): Promise<FieldValueResult> {
  const { segments } = parseFieldPath(path);
  
  if (segments.length === 0) {
    return { value: null, found: false, error: 'Invalid field path' };
  }

  let current: any = entry;
  let currentSchema: any = strapi.contentTypes[collectionUid] || strapi.components[collectionUid];
  let source: FieldSourceType = 'attribute';
  let componentUid: string | undefined;
  let isRepeatable = false;
  let fieldType: BasicFieldType | undefined;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;

    if (!current || typeof current !== 'object') {
      return { value: null, found: false, error: `Path segment '${segment.name}' not found` };
    }

    // Handle repeatable component/dynamic zone arrays: when current is an array
    // (from a repeatable component), map remaining path over each element
    if (Array.isArray(current) && isRepeatable) {
      // Build the remaining path from this segment onwards
      const remainingSegments = segments.slice(i);
      const remainingPath = remainingSegments.map(s =>
        s.componentUid ? `${s.name}[${s.componentUid}]` : s.name
      ).join('.');

      // Extract value from each array element
      const results: any[] = [];
      for (const element of current) {
        if (!element || typeof element !== 'object') continue;
        const subResult = await extractValue(strapi, element, remainingPath, componentUid || collectionUid, options);
        if (subResult.found) {
          // Flatten nested arrays from further repeatable components
          if (Array.isArray(subResult.value) && subResult.isRepeatable) {
            results.push(...subResult.value);
          } else {
            results.push(subResult.value);
          }
        }
      }

      return {
        value: results,
        found: results.length > 0,
        type: fieldType,
        source,
        componentUid,
        isRepeatable: true,
      };
    }

    // Get the attribute from schema
    const attr = currentSchema?.attributes?.[segment.name];
    
    if (!attr) {
      // Try direct access anyway (for populated relations)
      if (segment.name in current) {
        current = current[segment.name];
        continue;
      }
      return { value: null, found: false, error: `Attribute '${segment.name}' not found in schema` };
    }

    // Handle dynamic zone with component filter
    if (attr.type === 'dynamiczone' && segment.componentUid) {
      const dzValue = current[segment.name];
      
      if (!dzValue) {
        return { value: null, found: false };
      }

      // Find the component in the dynamic zone array
      const items = Array.isArray(dzValue) ? dzValue : [dzValue];
      const filtered = items.filter((item: any) => item.__component === segment.componentUid);
      
      if (filtered.length === 0) {
        return { value: null, found: false };
      }

      current = filtered.length === 1 ? filtered[0] : filtered;
      currentSchema = strapi.components[segment.componentUid];
      source = 'dynamiczone';
      componentUid = segment.componentUid;
      isRepeatable = true;
      continue;
    }

    // Handle component
    if (attr.type === 'component') {
      current = current[segment.name];
      currentSchema = strapi.components[attr.component];
      source = 'component';
      componentUid = attr.component;
      isRepeatable = attr.repeatable ?? false;
      continue;
    }

    // Handle relation
    if (attr.type === 'relation') {
      const relValue = current[segment.name];
      
      if (isLast) {
        // This is the final field - return based on options
        const relationOutput = options.relationOutput ?? 'documentId';
        
        if (!relValue) {
          return { 
            value: null, 
            found: true, 
            type: 'relation',
            source,
            componentUid,
            isRepeatable: attr.relation?.includes('Many'),
          };
        }

        const isMany = attr.relation?.includes('Many');
        const items = isMany ? (Array.isArray(relValue) ? relValue : [relValue]) : [relValue];
        const mainField = await getMainFieldFromConfig(strapi, attr.target);

        let result: any;
        
        if (relationOutput === 'documentId') {
          const ids = items.map((item: any) => item?.documentId || item?.id || item);
          result = isMany ? ids : ids[0];
        } else if (relationOutput === 'mainField') {
          const values = items.map((item: any) => {
            if (typeof item === 'object' && mainField && item[mainField]) {
              return item[mainField];
            }
            return item?.documentId || item?.id || item;
          });
          result = isMany ? values : values[0];
        } else {
          // populate - return as-is
          result = isMany ? items : items[0];
        }

        return {
          value: result,
          found: true,
          type: 'relation',
          source,
          componentUid,
          mainField: mainField || undefined,
          isRepeatable: isMany,
        };
      }

      // Not the last segment - need to traverse into relation
      // This requires the relation to be populated
      if (!relValue || typeof relValue !== 'object') {
        return { 
          value: null, 
          found: false, 
          error: `Relation '${segment.name}' not populated. Use buildPopulateConfig() to ensure it's populated.` 
        };
      }

      current = relValue;
      currentSchema = strapi.contentTypes[attr.target];
      continue;
    }

    // Handle dynamic zone without component filter
    if (attr.type === 'dynamiczone') {
      const dzValue = current[segment.name];
      current = dzValue;
      isRepeatable = true;
      source = 'dynamiczone';
      
      // Can't continue traversing without component filter
      if (!isLast) {
        return { 
          value: null, 
          found: false, 
          error: 'Dynamic zone traversal requires component filter. Use path like "field[component.uid].subfield"' 
        };
      }
    }

    // Handle basic types
    if (isLast) {
      fieldType = attr.type as BasicFieldType;
      const value = current[segment.name];
      
      return {
        value,
        found: true,
        type: fieldType,
        source,
        componentUid,
        isRepeatable,
      };
    }

    // Not a traversable type but not last segment
    return { 
      value: null, 
      found: false, 
      error: `Cannot traverse through '${segment.name}' (type: ${attr.type})` 
    };
  }

  return { value: current, found: true, source, componentUid, isRepeatable };
}

/**
 * Build populate configuration for given paths
 */
function buildPopulate(
  strapi: Core.Strapi,
  collectionUid: string,
  paths: string[]
): Record<string, any> {
  const populate: Record<string, any> = {};
  const schema = strapi.contentTypes[collectionUid] || strapi.components[collectionUid];

  if (!schema) {
    return populate;
  }

  for (const path of paths) {
    const { segments } = parseFieldPath(path);
    let currentPopulate = populate;
    let currentSchema: any = schema;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const attr = currentSchema?.attributes?.[segment.name];

      if (!attr) break;

      if (attr.type === 'component') {
        if (!currentPopulate[segment.name]) {
          currentPopulate[segment.name] = { populate: {} };
        }
        currentPopulate = currentPopulate[segment.name].populate;
        currentSchema = strapi.components[attr.component];
      } else if (attr.type === 'dynamiczone') {
        if (!currentPopulate[segment.name]) {
          currentPopulate[segment.name] = { populate: {} };
        }
        currentPopulate = currentPopulate[segment.name].populate;
        
        // For dynamic zone with component filter
        if (segment.componentUid) {
          currentSchema = strapi.components[segment.componentUid];
        } else {
          // Populate all possible components
          const components = attr.components as string[];
          for (const compUid of components) {
            const compSchema = strapi.components[compUid];
            if (compSchema) {
              // Add each component's attributes
              for (const [attrName, attrDef] of Object.entries(compSchema.attributes as Record<string, any>)) {
                if (attrDef.type === 'relation' || attrDef.type === 'component') {
                  currentPopulate[attrName] = true;
                }
              }
            }
          }
          break;
        }
      } else if (attr.type === 'relation') {
        if (!currentPopulate[segment.name]) {
          currentPopulate[segment.name] = { populate: {} };
        }
        // If there are more segments, set up for deeper population
        if (i < segments.length - 1) {
          currentPopulate = currentPopulate[segment.name].populate;
          currentSchema = strapi.contentTypes[attr.target];
        }
      } else {
        // Basic type - just mark parent as needing population
        break;
      }
    }
  }

  // Convert nested objects to proper populate format
  function normalizePopulate(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === true) {
        result[key] = true;
      } else if (typeof value === 'object' && value.populate) {
        const nestedPopulate = normalizePopulate(value.populate);
        if (Object.keys(nestedPopulate).length > 0) {
          result[key] = { populate: nestedPopulate };
        } else {
          result[key] = true;
        }
      } else {
        result[key] = true;
      }
    }
    
    return result;
  }

  return normalizePopulate(populate);
}

/**
 * Create the deep-field service
 */
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * List all mappable fields for a collection
   */
  async listFields(collectionUid: string, options: ListFieldsOptions = {}): Promise<MappableField[]> {
    const schema = strapi.contentTypes[collectionUid];
    
    if (!schema) {
      strapi.log.warn(`${LOG_PREFIX} Collection not found: ${collectionUid}`);
      return [];
    }

    const fields = await traverseSchema(
      strapi,
      schema.attributes as Record<string, any>,
      options,
      collectionUid,
      '', // parentPath
      [], // parentLabelSegments
      0,  // depth
      'attribute' // source
    );

    // Inject Strapi built-in fields when requested
    if (options.includeBuiltIn) {
      const builtInDefs: { name: string; type: BasicFieldType; label: string; relationTarget?: string }[] = [
        { name: 'documentId', type: 'string', label: 'Document ID' },
        { name: 'createdAt', type: 'datetime', label: 'Created At' },
        { name: 'updatedAt', type: 'datetime', label: 'Updated At' },
        { name: 'publishedAt', type: 'datetime', label: 'Published At' },
        { name: 'locale', type: 'string', label: 'Locale' },
        { name: 'createdBy', type: 'relation', label: 'Created By', relationTarget: 'admin::user' },
        { name: 'updatedBy', type: 'relation', label: 'Updated By', relationTarget: 'admin::user' },
      ];

      const types = options.types ?? DEFAULT_BASIC_TYPES;
      const includeRelations = options.includeRelations ?? true;

      for (const def of builtInDefs) {
        // Respect type filters
        if (!types.includes(def.type)) continue;
        if (def.type === 'relation' && !includeRelations) continue;
        // Skip if traverseSchema already picked it up from attributes
        if (fields.some(f => f.path === def.name)) continue;

        const field: MappableField = {
          path: def.name,
          label: def.label,
          type: def.type,
          source: 'attribute',
          required: false,
        };
        if (def.relationTarget) {
          field.relationTarget = def.relationTarget;
        }
        fields.push(field);
      }
    }

    // Sort by path for consistent ordering
    return fields.sort((a, b) => a.path.localeCompare(b.path));
  },

  /**
   * Get value from a field path in an entry
   */
  async getValue(
    collectionUid: string,
    documentId: string,
    fieldPath: string,
    options: GetValueOptions = {}
  ): Promise<FieldValueResult> {
    // Build populate config for this path
    const populate = buildPopulate(strapi, collectionUid, [fieldPath]);
    
    // Fetch the entry
    try {
      const entry = await strapi.documents(collectionUid as any).findOne({
        documentId,
        populate: Object.keys(populate).length > 0 ? populate : undefined,
      });

      if (!entry) {
        return { value: null, found: false, error: 'Entry not found' };
      }

      return extractValue(strapi, entry, fieldPath, collectionUid, options);
    } catch (err: any) {
      strapi.log.error(`${LOG_PREFIX} Error getting value: ${err.message}`);
      return { value: null, found: false, error: err.message };
    }
  },

  /**
   * Get value from a field path in an already-fetched entry
   */
  async getValueFromEntry(
    entry: Record<string, any>,
    fieldPath: string,
    collectionUid: string,
    options: GetValueOptions = {}
  ): Promise<FieldValueResult> {
    return extractValue(strapi, entry, fieldPath, collectionUid, options);
  },

  /**
   * Build populate configuration for given field paths
   */
  async buildPopulateConfig(
    collectionUid: string,
    paths: string[]
  ): Promise<Record<string, any>> {
    return buildPopulate(strapi, collectionUid, paths);
  },

  /**
   * Get the main field for a collection
   */
  async getMainField(collectionUid: string): Promise<MainFieldInfo | null> {
    const schema = strapi.contentTypes[collectionUid] || strapi.components[collectionUid];
    
    if (!schema) {
      return null;
    }

    const fieldName = await getMainFieldFromConfig(strapi, collectionUid);
    
    if (!fieldName) {
      return null;
    }

    const attr = schema.attributes?.[fieldName];
    
    return {
      fieldName,
      type: (attr?.type as BasicFieldType) || 'string',
      collectionUid,
    };
  },

  /**
   * Get component info
   */
  async getComponentInfo(componentUid: string): Promise<ComponentInfo | null> {
    const schema = strapi.components[componentUid];
    
    if (!schema) {
      return null;
    }

    const mainField = await getMainFieldFromConfig(strapi, componentUid);
    const [category] = componentUid.split('.');

    return {
      uid: componentUid,
      category,
      displayName: (schema.info as any)?.displayName || componentUid,
      attributes: schema.attributes as Record<string, any>,
      mainField: mainField || undefined,
    };
  },

  /**
   * Prepare value for dynamic zone entry mutation
   */
  async prepareForMutation(
    value: any,
    fieldPath: string,
    collectionUid: string
  ): Promise<any> {
    const { segments } = parseFieldPath(fieldPath);
    
    if (segments.length === 0) {
      return value;
    }

    const schema = strapi.contentTypes[collectionUid];
    if (!schema) {
      return value;
    }

    // Find if any segment is a dynamic zone
    let currentSchema: any = schema;
    
    for (const segment of segments) {
      const attr = currentSchema?.attributes?.[segment.name];
      
      if (!attr) break;
      
      if (attr.type === 'dynamiczone' && segment.componentUid) {
        // Wrap value with __component for dynamic zone
        if (typeof value === 'object' && value !== null && !value.__component) {
          return { ...value, __component: segment.componentUid };
        }
        break;
      }
      
      if (attr.type === 'component') {
        currentSchema = strapi.components[attr.component];
      }
    }

    return value;
  },

  /**
   * Validate if a field path is valid for a collection
   */
  async validateFieldPath(
    collectionUid: string,
    fieldPath: string,
    expectedTypes?: BasicFieldType[]
  ): Promise<{ valid: boolean; error?: string; field?: MappableField }> {
    const fields = await this.listFields(collectionUid, {
      types: expectedTypes,
      includeRepeatable: true,
      maxDepth: 5,
    });

    const field = fields.find(f => f.path === fieldPath);
    
    if (!field) {
      return { 
        valid: false, 
        error: `Field path '${fieldPath}' not found in collection '${collectionUid}'` 
      };
    }

    if (expectedTypes && expectedTypes.length > 0 && !expectedTypes.includes(field.type)) {
      return { 
        valid: false, 
        error: `Field '${fieldPath}' has type '${field.type}', expected one of: ${expectedTypes.join(', ')}` 
      };
    }

    return { valid: true, field };
  },

  /**
   * Get all available collections
   */
  async getCollections(): Promise<Array<{ uid: string; displayName: string }>> {
    const collections: Array<{ uid: string; displayName: string }> = [];
    
    for (const [uid, schema] of Object.entries(strapi.contentTypes)) {
      // Skip internal types
      if (uid.startsWith('admin::') || uid.startsWith('plugin::')) {
        continue;
      }
      
      collections.push({
        uid,
        displayName: (schema.info as any)?.displayName || uid,
      });
    }

    return collections.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },

  /**
   * Get all available components
   */
  async getComponents(): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];
    
    for (const [uid, schema] of Object.entries(strapi.components)) {
      const mainField = await getMainFieldFromConfig(strapi, uid);
      const [category] = uid.split('.');
      
      components.push({
        uid,
        category,
        displayName: (schema.info as any)?.displayName || uid,
        attributes: schema.attributes as Record<string, any>,
        mainField: mainField || undefined,
      });
    }

    return components.sort((a, b) => a.uid.localeCompare(b.uid));
  },
});
