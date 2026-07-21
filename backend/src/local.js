const app = require('./app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API corriendo en http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Accesible en la red local (usa la IP de tu Mac desde el teléfono)');
});
