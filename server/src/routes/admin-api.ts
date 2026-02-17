/**
 * Admin API Routes for Deep Field Plugin
 * 
 * These routes are accessible from the Strapi admin panel.
 */

export default {
  type: 'admin',
  routes: [
    // List fields for a collection
    {
      method: 'GET',
      path: '/fields/:collectionUid',
      handler: 'deep-field.listFields',
      config: {
        policies: [],
      },
    },
    // Get value from entry
    {
      method: 'GET',
      path: '/value/:collectionUid/:documentId',
      handler: 'deep-field.getValue',
      config: {
        policies: [],
      },
    },
    // Build populate configuration
    {
      method: 'POST',
      path: '/populate/:collectionUid',
      handler: 'deep-field.buildPopulate',
      config: {
        policies: [],
      },
    },
    // Get main field
    {
      method: 'GET',
      path: '/main-field/:collectionUid',
      handler: 'deep-field.getMainField',
      config: {
        policies: [],
      },
    },
    // Get component info
    {
      method: 'GET',
      path: '/component/:componentUid',
      handler: 'deep-field.getComponentInfo',
      config: {
        policies: [],
      },
    },
    // Validate field path
    {
      method: 'POST',
      path: '/validate/:collectionUid',
      handler: 'deep-field.validateFieldPath',
      config: {
        policies: [],
      },
    },
    // Get all collections
    {
      method: 'GET',
      path: '/collections',
      handler: 'deep-field.getCollections',
      config: {
        policies: [],
      },
    },
    // Get all components
    {
      method: 'GET',
      path: '/components',
      handler: 'deep-field.getComponents',
      config: {
        policies: [],
      },
    },
  ],
};
