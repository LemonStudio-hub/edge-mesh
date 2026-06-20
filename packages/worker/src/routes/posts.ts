import { Hono } from 'hono';
import type { Env } from '../env.js';

export const postsRoutes = new Hono<{ Bindings: Env }>();

function getRegistry(env: Env) {
  const id = env.POST_REGISTRY.idFromName('global');
  return env.POST_REGISTRY.get(id) as DurableObjectStub;
}

postsRoutes.get('/posts', async (c) => {
  const stub = getRegistry(c.env);
  const res = await stub.fetch(new Request('https://internal/posts'));
  return res;
});

postsRoutes.post('/posts', async (c) => {
  const body = await c.req.json();
  const stub = getRegistry(c.env);
  const res = await stub.fetch(
    new Request('https://internal/posts', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  );
  return res;
});

postsRoutes.delete('/posts/:id', async (c) => {
  const id = c.req.param('id');
  const stub = getRegistry(c.env);
  const res = await stub.fetch(
    new Request(`https://internal/posts/${id}`, { method: 'DELETE' })
  );
  return res;
});

postsRoutes.post('/posts/heartbeat', async (c) => {
  const body = await c.req.json();
  const stub = getRegistry(c.env);
  const res = await stub.fetch(
    new Request('https://internal/heartbeat', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  );
  return res;
});
