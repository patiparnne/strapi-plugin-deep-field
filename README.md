# Deep Field Plugin for Strapi

A utility plugin for accessing nested fields in Strapi collections, including components, dynamic zones, and custom fields.

## Features

- **List mappable fields**: Get all fields from a collection that can be mapped, including fields inside components and dynamic zones
- **Get nested values**: Extract values from deeply nested structures using dot notation paths
- **Build populate configs**: Automatically generate Strapi populate configurations for nested field paths
- **Schema introspection**: Get information about collections, components, and their main fields
- **Relation support**: Handle relations with options for documentId, mainField, or full population

## Installation

The plugin is included in the workspace. Ensure it's enabled in `config/plugins.ts`:

```ts
export default ({ env }) => ({
  'deep-field': {
    enabled: true,
    resolve: 'src/plugins/deep-field',
  },
  // ... other plugins
});
```

## Usage in Other Plugins

### Server-side Service Access

```typescript
// In your plugin's service or controller
const deepFieldService = strapi.plugin('deep-field').service('deep-field');

// List all string/text fields from a collection
const fields = await deepFieldService.listFields('api::contact.contact', {
  types: ['string', 'text', 'email'],
});

// Get value from a nested path
const result = await deepFieldService.getValue(
  'api::contact.contact',
  documentId,
  'identities.line.uid'
);

// Get value with populated relation
const result = await deepFieldService.getValue(
  'api::credit.credit',
  documentId,
  'account',
  { relationOutput: 'populate' }
);

// Build populate config for multiple paths
const populate = await deepFieldService.buildPopulateConfig(
  'api::contact.contact',
  ['identities.line.uid', 'identities.email.address', 'organizations']
);

// Validate a field path
const validation = await deepFieldService.validateFieldPath(
  'api::contact.contact',
  'identities.line.uid',
  ['string', 'uid']
);
```

## API Reference

### Service Methods

#### `listFields(collectionUid, options?)`

List all mappable fields for a collection.

**Options:**
- `types`: Array of basic types to include (default: all types)
- `includeRepeatable`: Include fields in repeatable components (default: true)
- `maxDepth`: Maximum traversal depth (default: 3)
- `customFieldUids`: Array of custom field UIDs to include
- `includeRelations`: Include relation fields (default: true)
- `componentCategories`: Filter by component categories

**Returns:** `MappableField[]`

#### `getValue(collectionUid, documentId, fieldPath, options?)`

Get value from a field path in an entry (fetches the entry automatically).

**Options:**
- `relationOutput`: 'documentId' | 'mainField' | 'populate' (default: 'documentId')
- `forEntryMutation`: Prepare value for create/update operations

**Returns:** `FieldValueResult`

#### `getValueFromEntry(entry, fieldPath, collectionUid, options?)`

Get value from a field path in an already-fetched entry.

#### `buildPopulateConfig(collectionUid, paths)`

Build Strapi populate configuration for given field paths.

**Returns:** `Record<string, any>`

#### `getMainField(collectionUid)`

Get the main display field for a collection.

**Returns:** `MainFieldInfo | null`

#### `getComponentInfo(componentUid)`

Get information about a component.

**Returns:** `ComponentInfo | null`

#### `validateFieldPath(collectionUid, fieldPath, expectedTypes?)`

Validate if a field path is valid for a collection.

**Returns:** `{ valid: boolean; error?: string; field?: MappableField }`

## Field Path Notation

Use dot notation for nested fields:

- Simple field: `firstName`
- Component field: `address.street`
- Dynamic zone with component filter: `identities[identity.line].uid`
- Relation field: `organization.name`

## REST API Endpoints

### Admin API (requires admin authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deep-field/fields/:collectionUid` | List mappable fields |
| GET | `/deep-field/value/:collectionUid/:documentId` | Get field value |
| POST | `/deep-field/populate/:collectionUid` | Build populate config |
| GET | `/deep-field/main-field/:collectionUid` | Get main field |
| GET | `/deep-field/component/:componentUid` | Get component info |
| POST | `/deep-field/validate/:collectionUid` | Validate field path |
| GET | `/deep-field/collections` | List all collections |
| GET | `/deep-field/components` | List all components |

### Content API (requires API token with permissions)

Same endpoints available under `/api/deep-field/...` with proper permissions configured in Settings > Users & Permissions > Roles.

## Query Parameters

### List Fields (`/deep-field/fields/:collectionUid`)

- `types`: Comma-separated list of types (e.g., `string,text,email`)
- `includeRepeatable`: `true` or `false`
- `maxDepth`: Number (default: 3)
- `customFieldUids`: Comma-separated list of custom field UIDs
- `includeRelations`: `true` or `false`
- `componentCategories`: Comma-separated list of categories

### Get Value (`/deep-field/value/:collectionUid/:documentId`)

- `fieldPath`: The field path (required)
- `relationOutput`: `documentId`, `mainField`, or `populate`
- `forEntryMutation`: `true` or `false`

## Type Definitions

Import types from the plugin:

```typescript
import type {
  MappableField,
  ListFieldsOptions,
  GetValueOptions,
  FieldValueResult,
  MainFieldInfo,
  ComponentInfo,
  BasicFieldType,
  FieldSourceType,
} from 'strapi-plugin-deep-field/types';
```

## License

MIT
