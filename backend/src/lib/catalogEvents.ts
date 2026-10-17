import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';

const events = new EventEmitter();
events.setMaxListeners(0);
export const publishCatalogUpdate = () => events.emit('updated');

export const streamCatalogUpdates = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const send = () => {
    res.write('event: catalog-updated\ndata: {}\n\n');
    (res as Response & { flush?: () => void }).flush?.();
  };
  events.on('updated', send);
  // Refresh on connection/reconnection too, covering updates missed while offline.
  send();
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
    (res as Response & { flush?: () => void }).flush?.();
  }, 25_000);
  heartbeat.unref();
  req.on('close', () => { clearInterval(heartbeat); events.off('updated', send); });
};
