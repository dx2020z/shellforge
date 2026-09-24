import net from 'node:net';
// Probe before building, so another production server never reads a replaced .next.
const probe=net.createServer();
probe.once('error',()=>{console.error('Port 3018 is in use. Open http://localhost:3018 or stop the existing server before rebuilding.');process.exitCode=2;});
probe.listen(3018,'127.0.0.1',()=>probe.close());
