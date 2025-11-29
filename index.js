import dotenv from 'dotenv';
import connectDB from './db/index.js';
import app from './app.js';
import { PORT } from './constants.js';

dotenv.config({
    path: './.env'
});

connectDB()
.then(() => {
    // Attempt to listen on the configured port, and if it's already in use try the next few ports.
    const basePort = Number(PORT) || 8000;
    const maxAttempts = 10;

    const tryListen = (port, attempt = 1) => {
        const server = app.listen(port, () => {
            // store the actual bound port on the express app for runtime inspection
            try {
                app.locals.boundPort = server.address().port;
            } catch (e) {
                // ignore if not available
            }
            console.log(`⚙️ Server is running on port ${port}`);
        });

        server.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                console.error(`Port ${port} is in use.`);
                if (attempt < maxAttempts) {
                    const next = port + 1;
                    console.log(`Trying next port ${next} (attempt ${attempt + 1}/${maxAttempts})...`);
                    // slight delay to avoid tight loop
                    setTimeout(() => tryListen(next, attempt + 1), 200);
                } else {
                    console.error(`All ports ${basePort}..${basePort + maxAttempts - 1} are in use. Exiting.`);
                    process.exit(1);
                }
            } else {
                console.error('Server error', err);
                process.exit(1);
            }
        });
    };

    tryListen(basePort);
})
.catch((err) => {
    console.log("MongoDB connection failed !!! ", err);
    process.exit(1);
});