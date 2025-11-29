import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { CORS_ORIGIN } from './constants.js';

const app = express();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

const corsOrigins = (CORS_ORIGIN || '').split(',').map((entry) => entry.trim()).filter(Boolean);
const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (corsOrigins.length && corsOrigins[0] !== '*') {
            if (corsOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('CORS policy: This origin is not allowed'));
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Centralized error handler so thrown ApiError becomes a JSON response
app.use((err, req, res, next) => {
    // If it's our ApiError, use its status
    if (err && err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, errors: err.errors ?? [] });
    }
    console.error('Unhandled error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Internal Server Error' });
});

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to ERP Backend API' });
});

// --- Dev debug endpoints (safe for local development) ---
// returns which port the server reported as bound and the configured env PORT
app.get('/api/v1/debug/health', (req, res) => {
    return res.json({
        success: true,
        boundPort: app.locals?.boundPort ?? null,
        envPort: process.env.PORT ?? null
    });
});

import { verifyJWT } from './middleware/auth.middleware.js';
// returns the authenticated user and organization id (for debugging only)
app.get('/api/v1/debug/me', verifyJWT, (req, res) => {
    return res.json({ success: true, user: req.user ?? null, organization_id: req.organization_id ?? null });
});

import userRouter from './routes/user.routes.js';
import customerRouter from './routes/customer.routes.js';
import itemRouter from './routes/item.routes.js';
import invoiceRouter from './routes/invoice.routes.js'; // <-- ADD THIS LINE
import inventoryRouter from './routes/inventory.routes.js';
import paymentRouter from './routes/payment.routes.js';
import variantRouter from './routes/product_variant.routes.js';
import invoiceV2Router from './routes/invoice_v2.routes.js';
import transactionRouter from './routes/transaction.routes.js';
import dashboardRouter from './routes/dashboard.route.js';
import financeRouter from './routes/finance.routes.js';
import gstRouter from './routes/gst.routes.js';
import employeeRouter from './routes/employee.routes.js';
import attendanceRouter from './routes/attendance.routes.js';

// --- Declare Routes ---
app.use("/api/v1/users", userRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/v1/items", itemRouter);
app.use("/api/v1/invoices", invoiceRouter); // <-- ADD THIS LINE
app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/variants", variantRouter);
app.use("/api/v1/invoices-v2", invoiceV2Router);
app.use("/api/v1/transactions", transactionRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/finance", financeRouter);
app.use("/api/v1/gst", gstRouter);
app.use("/api/v1/employees", employeeRouter);
app.use("/api/v1/attendance", attendanceRouter);
export default app;