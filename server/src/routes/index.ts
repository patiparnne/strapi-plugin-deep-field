import contentAPIRoutes from './content-api';
import adminAPIRoutes from './admin-api';

const routes = {
  'content-api': {
    type: 'content-api',
    routes: contentAPIRoutes,
  },
  'admin-api': adminAPIRoutes,
};

export default routes;
