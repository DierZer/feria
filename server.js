require('dotenv').config();
const express = require('express');
const os = require('os');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');
const { upload, uploadErrorHandler } = require('./middleware/upload');
const { analizarAlbaranConIA } = require('./services/ai');
const authRoutes = require('./routes/auth');
const casetasRoutes = require('./routes/casetas');
const empleadosRoutes = require('./routes/empleados');
const cateringsRoutes = require('./routes/caterings');
const adminRoutes = require('./routes/admin');
const fichajesRoutes = require('./routes/fichajes');
const albaranesRoutes = require('./routes/albaranes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Servir el frontend estático (index.html, js, css, etc.) desde la raíz del proyecto
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/casetas', casetasRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/caterings', cateringsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fichajes', fichajesRoutes);
app.use('/api/albaranes', albaranesRoutes);

// IA: subir foto de albarán desde el móvil y analizarla con Qwen (Ollama)
app.post('/api/upload-albaran', upload, uploadErrorHandler, async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'No se ha recibido ninguna imagen' });
    }
    const datosExtraidos = await analizarAlbaranConIA(req.file.path);
    res.json({
      success: true,
      datos: datosExtraidos
    });
  } catch (error) {
    console.error('Error al procesar albarán con IA:', error);
    res.status(500).json({ error: 'Error al procesar con IA' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 Feria-Control 2025 API');
  console.log('='.repeat(50));
  console.log('📡 Local:   http://localhost:' + PORT);
  const net = os.networkInterfaces();
  Object.keys(net || {}).forEach((name) => {
    (net[name] || []).forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log('📡 Red:     http://' + iface.address + ':' + PORT);
      }
    });
  });
  console.log('🗄️  DB: ' + db.dbPath);
  console.log('='.repeat(50) + '\n');
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  console.log('\n🛑 Apagando servidor...');
  server.close(() => {
    db.cerrar();
    process.exit(0);
  });
  setTimeout(() => {
    db.cerrar();
    process.exit(1);
  }, 10000);
}
