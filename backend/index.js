const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'automotive_testing_db',
  password: process.env.DB_PASSWORD || 'postgres123',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err.stack);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

// Routes

// Get all ensayos
app.get('/api/ensayos', async (req, res) => {
  try {
    const result = await pool.query('SELECT codigo_ensayo, descripcion FROM ensayos ORDER BY codigo_ensayo');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching ensayos:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get channels with units for a specific table
app.get('/api/channels/:table', async (req, res) => {
  try {
    const { table } = req.params;
    
    // Get column mapping
    const columnQuery = `
      WITH column_mapping AS (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY ordinal_position) as canal_id,
          column_name
        FROM information_schema.columns 
        WHERE table_name = $1
        AND column_name NOT IN ('id', 'timestamp', 'codigo_ensayo')
        ORDER BY ordinal_position
      )
      SELECT 
        cm.column_name,
        COALESCE(cd.nombre, cm.column_name) as display_name,
        COALESCE(cd.unidad, '') as unit
      FROM column_mapping cm
      LEFT JOIN ${table.replace('_valores', '_descripcion')} cd ON cm.canal_id = cd.canal_id
      ORDER BY cm.canal_id
    `;
    
    const result = await pool.query(columnQuery, [table]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching channels:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get time series data with dynamic sampling
app.get('/api/data/:table', async (req, res) => {
  try {
    // Extrae parámetros de la URL y la query string
    const { table } = req.params;
  const { ensayo, channels, startTime, endTime, maxPoints = 10000 } = req.query;

    // Log para depuración de los parámetros recibidos
  console.log('Data request params:', { table, ensayo, channels, startTime, endTime, maxPoints });

    // Validación de parámetros obligatorios
    if (!ensayo || !channels) {
      return res.status(400).json({ error: 'Missing required parameters: ensayo, channels' });
    }

    // Construye la lista de columnas a consultar
    const channelArray = channels.split(',');
    const channelList = channelArray.map(ch => ch.trim()).join(', ');

    // Construye el filtro de tiempo si se especifica
    let timeFilter = '';
    const params = [ensayo]; // Primer parámetro: ensayo
    let paramIndex = 2;

    if (startTime && endTime) {
      // Si hay rango de tiempo, agrega filtro y parámetros (comparando como UTC)
      timeFilter = `AND (timestamp AT TIME ZONE 'UTC') BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startTime, endTime);
      paramIndex += 2;
    }

    // Calcula el máximo de puntos adaptativo según zoom y rango
  const adaptiveMaxPoints = parseInt(maxPoints);

    // Consulta para contar el total de registros en el rango
    const countQuery = `
      SELECT COUNT(*) as total_count 
      FROM ${table} 
      WHERE codigo_ensayo = $1 ${timeFilter}
    `;

    // Elige los parámetros correctos según si hay filtro de tiempo
    const countParams = params.slice(0, timeFilter ? paramIndex - 1 : 1);
    console.log('Count query:', countQuery);
    console.log('Count params:', countParams);
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total_count);

    let query;

    if (totalCount <= adaptiveMaxPoints) {
      // Si hay pocos puntos, devuelve todos los datos SIN LIMIT ni muestreo
      query = `
        SELECT 
          timestamp,
          ${channelList}
        FROM ${table}
        WHERE codigo_ensayo = $1 ${timeFilter}
        ORDER BY timestamp
      `;
    } else {
      // Si hay muchos puntos, calcula el intervalo de muestreo
      const samplingRate = Math.ceil(totalCount / adaptiveMaxPoints);
      // Usa muestreo por módulo para reducir la cantidad de datos
      query = `
        SELECT 
          timestamp,
          ${channelList}
        FROM ${table}
        WHERE codigo_ensayo = $1 ${timeFilter}
          AND (id % ${samplingRate}) = 0
        ORDER BY timestamp
        LIMIT ${adaptiveMaxPoints}
      `;
    }

    // Log de la consulta final y sus parámetros
    const queryParams = params.slice(0, timeFilter ? paramIndex - 1 : 1);
    console.log('Final query:', query);
    console.log('Query params:', queryParams);
    const result = await pool.query(query, queryParams);

    // Devuelve los datos y metadatos de muestreo
    res.json({
      data: result.rows,
      metadata: {
        totalPoints: totalCount,
        returnedPoints: result.rows.length,
        samplingRate: totalCount > adaptiveMaxPoints ? Math.ceil(totalCount / adaptiveMaxPoints) : 1,
        timeRange: {
          start: startTime,
          end: endTime
        }
      }
    });
    
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get data statistics
app.get('/api/stats/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { ensayo } = req.query;
    
    if (!ensayo) {
      return res.status(400).json({ error: 'Missing required parameter: ensayo' });
    }
    
    const query = `
      SELECT 
        COUNT(*) as total_records,
        MIN(timestamp) as start_time,
        MAX(timestamp) as end_time,
        EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))/3600 as duration_hours
      FROM ${table}
      WHERE codigo_ensayo = $1
    `;
    
    const result = await pool.query(query, [ensayo]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get available tables (temporary endpoint for debugging)
app.get('/api/tables', async (req, res) => {
  try {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
      ORDER BY table_name
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});