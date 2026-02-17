/**
 * Content API Routes for Deep Field Plugin
 * 
 * These routes are accessible via API tokens with proper permissions.
 * 
 * To use:
 * 1. Go to Settings > Users & Permissions > Roles
 * 2. Select a role (e.g., Authenticated or create a custom one)
 * 3. Find "Deep-field" plugin and enable the desired endpoints
 * 4. Create an API Token with that role's permissions
 */

export default [
  // List fields for a collection
  {
    method: 'GET',
    path: '/fields/:collectionUid',
    handler: 'deep-field.listFields',
    config: {
      policies: [],
      description: 'List all mappable fields for a collection',
    },
  },
  // Get value from entry
  {
    method: 'GET',
    path: '/value/:collectionUid/:documentId',
    handler: 'deep-field.getValue',
    config: {
      policies: [],
      description: 'Get value from a specific field path in an entry',
    },
  },
  // Build populate configuration
  {
    method: 'POST',
    path: '/populate/:collectionUid',
    handler: 'deep-field.buildPopulate',
    config: {
      policies: [],
      description: 'Build Strapi populate configuration for given field paths',
    },
  },
  // Get main field
  {
    method: 'GET',
    path: '/main-field/:collectionUid',
    handler: 'deep-field.getMainField',
    config: {
      policies: [],
      description: 'Get the main display field for a collection',
    },
  },
  // Get component info
  {
    method: 'GET',
    path: '/component/:componentUid',
    handler: 'deep-field.getComponentInfo',
    config: {
      policies: [],
      description: 'Get information about a component',
    },
  },
  // Validate field path
  {
    method: 'POST',
    path: '/validate/:collectionUid',
    handler: 'deep-field.validateFieldPath',
    config: {
      policies: [],
      description: 'Validate if a field path is valid for a collection',
    },
  },
  // Get all collections
  {
    method: 'GET',
    path: '/collections',
    handler: 'deep-field.getCollections',
    config: {
      policies: [],
      description: 'Get all available collections',
    },
  },
  // Get all components
  {
    method: 'GET',
    path: '/components',
    handler: 'deep-field.getComponents',
    config: {
      policies: [],
      description: 'Get all available components',
    },
  },
];
