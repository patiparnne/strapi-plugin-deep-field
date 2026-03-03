/**
 * Deep Field Plugin Types
 * 
 * Type definitions for field listing and value extraction from
 * nested structures (components, dynamic zones, custom fields).
 */

/**
 * Basic Strapi field types that can be mapped
 */
export type BasicFieldType = 
  | 'string'
  | 'text'
  | 'richtext'
  | 'blocks'
  | 'email'
  | 'password'
  | 'uid'
  | 'integer'
  | 'biginteger'
  | 'float'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'enumeration'
  | 'json'
  | 'media'
  | 'relation';

/**
 * Field source type - where the field comes from
 */
export type FieldSourceType = 
  | 'attribute'      // Direct attribute on collection
  | 'component'      // Inside a component
  | 'dynamiczone'    // Inside a dynamic zone component
  | 'customField';   // From a custom field

/**
 * Represents a field that can be mapped
 */
export interface MappableField {
  /** Full path to the field (e.g., "name", "address.street", "identities.line.uid") */
  path: string;
  
  /** Display label for the field */
  label: string;
  
  /** The field's type */
  type: BasicFieldType;
  
  /** Source of the field */
  source: FieldSourceType;
  
  /** Component UID if field is inside a component */
  componentUid?: string;
  
  /** Custom field plugin ID if applicable */
  customFieldUid?: string;
  
  /** Whether the field is inside a repeatable component/dynamic zone */
  isRepeatable?: boolean;
  
  /** For relations: the target collection UID */
  relationTarget?: string;
  
  /** For relations: relation type (oneToOne, oneToMany, etc.) */
  relationType?: string;
  
  /** For enumerations: available values */
  enumValues?: string[];
  
  /** Whether this field is required */
  required?: boolean;
}

/**
 * Options for listing fields
 */
export interface ListFieldsOptions {
  /** 
   * Field types to include. If not specified, includes all basic types.
   * Does not need to include 'component', 'dynamiczone', 'customField' as
   * those are automatically traversed to find matching basic types.
   */
  types?: BasicFieldType[];
  
  /** 
   * Whether to include fields inside repeatable components/dynamic zones.
   * Default: true
   */
  includeRepeatable?: boolean;
  
  /** 
   * Maximum depth to traverse into nested structures.
   * Default: 3
   */
  maxDepth?: number;
  
  /** 
   * Custom field UIDs to include (e.g., 'plugin::reward.credit').
   * The plugin will check if the custom field's underlying type matches.
   */
  customFieldUids?: string[];
  
  /**
   * Whether to include relation fields.
   * Default: true
   */
  includeRelations?: boolean;

  /**
   * Whether to include Strapi built-in fields (createdAt, updatedAt,
   * publishedAt, locale, createdBy, updatedBy, documentId).
   * Default: false
   */
  includeBuiltIn?: boolean;
  
  /**
   * Filter by specific component categories
   */
  componentCategories?: string[];
}

/**
 * Options for getting field values
 */
export interface GetValueOptions {
  /** 
   * For relations: how to return the value
   * - 'documentId': Return only the documentId (or array of documentIds)
   * - 'mainField': Return the main field value (or array of main field values)
   * - 'populate': Return full populated entry (or array of entries)
   * Default: 'documentId'
   */
  relationOutput?: 'documentId' | 'mainField' | 'populate';
  
  /**
   * For dynamic zones: whether to return the value ready for entry create/update
   * Default: false (returns exact value)
   */
  forEntryMutation?: boolean;
  
  /**
   * Additional populate configuration for relations
   */
  populateConfig?: Record<string, any>;
  
  /**
   * Whether to include __component key for dynamic zone items
   * Default: true when forEntryMutation is true
   */
  includeComponentKey?: boolean;
}

/**
 * Result of getting a field value
 */
export interface FieldValueResult {
  /** The extracted value (can be any type) */
  value: any;
  
  /** Whether the field was found */
  found: boolean;
  
  /** The field's type if found */
  type?: BasicFieldType;
  
  /** Source of the field */
  source?: FieldSourceType;
  
  /** For relations: the main field name */
  mainField?: string;
  
  /** Component UID if inside a component */
  componentUid?: string;
  
  /** Whether the value came from a repeatable */
  isRepeatable?: boolean;
  
  /** Error message if extraction failed */
  error?: string;
}

/**
 * Configuration for a mapped field (stored in settings)
 */
export interface FieldMapping {
  /** The field path */
  path: string;
  
  /** Source type for quick reference */
  source: FieldSourceType;
  
  /** Component UID if applicable */
  componentUid?: string;
  
  /** Field type for validation */
  type: BasicFieldType;
}

/**
 * Options for building populate configuration
 */
export interface BuildPopulateOptions {
  /** Field paths to populate */
  paths: string[];
  
  /** Whether to deep populate relations */
  deepPopulateRelations?: boolean;
  
  /** Maximum populate depth */
  maxDepth?: number;
}

/**
 * Main field info for a collection
 */
export interface MainFieldInfo {
  /** The main field name */
  fieldName: string;
  
  /** The field type */
  type: BasicFieldType;
  
  /** Collection UID */
  collectionUid: string;
}

/**
 * Component schema info
 */
export interface ComponentInfo {
  /** Component UID (e.g., 'identity.line') */
  uid: string;
  
  /** Component category */
  category: string;
  
  /** Component display name */
  displayName: string;
  
  /** Component attributes */
  attributes: Record<string, any>;
  
  /** Main field for this component */
  mainField?: string;
}

/**
 * Service interface for type-safe usage
 */
export interface DeepFieldService {
  /**
   * List all mappable fields for a collection
   */
  listFields(collectionUid: string, options?: ListFieldsOptions): Promise<MappableField[]>;
  
  /**
   * Get value from a field path in an entry
   */
  getValue(
    collectionUid: string,
    documentId: string,
    fieldPath: string,
    options?: GetValueOptions
  ): Promise<FieldValueResult>;
  
  /**
   * Get value from a field path in an already-fetched entry
   */
  getValueFromEntry(
    entry: Record<string, any>,
    fieldPath: string,
    collectionUid: string,
    options?: GetValueOptions
  ): Promise<FieldValueResult>;
  
  /**
   * Build populate configuration for given field paths
   */
  buildPopulateConfig(
    collectionUid: string,
    paths: string[]
  ): Promise<Record<string, any>>;
  
  /**
   * Get the main field for a collection
   */
  getMainField(collectionUid: string): Promise<MainFieldInfo | null>;
  
  /**
   * Get component info
   */
  getComponentInfo(componentUid: string): Promise<ComponentInfo | null>;
  
  /**
   * Prepare value for dynamic zone entry mutation
   */
  prepareForMutation(
    value: any,
    fieldPath: string,
    collectionUid: string
  ): Promise<any>;
  
  /**
   * Validate if a field path is valid for a collection
   */
  validateFieldPath(
    collectionUid: string,
    fieldPath: string,
    expectedTypes?: BasicFieldType[]
  ): Promise<{ valid: boolean; error?: string; field?: MappableField }>;
}
