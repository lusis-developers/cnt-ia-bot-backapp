import express from 'express';
import cors from 'cors';
import { Response } from 'express';
import http from 'http';

import { Server } from 'socket.io';

import routerApi from './routes';

function createApp() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const whitelist = [
    'http://locahost:4000',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://develop.fudibot-front.pages.dev',
    'https://app.fudibot.com',
    "https://agente-prefectura-del-guayas.netlify.app",
    "https://cnt-agent.netlify.app"
  ]

  app.use(cors({ origin: whitelist }));

  app.use(express.json());

  app.get('/', (_req, res: Response) => {
    res.send('cnt agent is aliveee')
  });

  routerApi(app, io);


  return { app, server };
}

export default createApp;