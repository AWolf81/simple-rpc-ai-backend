import net from 'node:net';

export async function canBindLocalhost(): Promise<boolean> {
  return await new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

export const LOCALHOST_AVAILABLE = process.env.ALLOW_NETWORK_TESTS === 'true'
  ? await (async () => {
      try {
        return await canBindLocalhost();
      } catch {
        return false;
      }
    })()
  : false;
