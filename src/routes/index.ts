import express, { Application } from 'express';
import { Server } from 'socket.io';

import chatRoutes from './chat.route';

function routerApi(app: Application, _io: Server) {
  const router = express.Router();

  // API base path
  app.use('/api', router);

  // Register chat routes
  router.use(chatRoutes);
}

export default routerApi;