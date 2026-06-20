import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { postsRoutes } from './routes/posts.js';
import { healthRoutes } from './routes/health.js';
import { signalingRoutes } from './routes/signaling.js';
import type { Env } from './env.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'DELETE'] }));
app.route('/api', healthRoutes);
app.route('/api', postsRoutes);
app.route('/api', signalingRoutes);

export default app;

export { PostRegistry } from './durable-objects/PostRegistry.js';
export { SignalingRoom } from './durable-objects/SignalingRoom.js';
