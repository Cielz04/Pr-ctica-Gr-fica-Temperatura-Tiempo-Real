const http = require('http');
const WebSocket = require('ws');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// 2. Crear servidores HTTP y WebSocket (sin cambios)
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const PORT = 8080;

const influxDB_URL = 'http://localhost:8086';
const influxDB_TOKEN = 'TU_TOKEN_DE_ACCESO_SECRETO';
const influxDB_ORG = 'tu-organizacion';
const influxDB_BUCKET = 'tu-bucket';

// Crear una nueva instancia del cliente de InfluxDB
const influxDB = new InfluxDB({ url: influxDB_URL, token: influxDB_TOKEN });
// Crear una API de consulta (query) para el ORG especificado
const queryApi = influxDB.getQueryApi(influxDB_ORG);


// --- Lógica de la Aplicación ---

/**
 * Esta función ahora consulta InfluxDB para obtener las últimas 'n' mediciones.
 * @returns {Promise<Array<{timestamp: number, temp: number}>>}
 */
async function fetchLastNMeasurements() {
    console.log('Consultando InfluxDB para obtener datos históricos...');
    const data = [];
    const n_points = 50; 

    // Query en lenguaje Flux para obtener los últimos 'n' puntos del measurement 'temperatura'
    const fluxQuery = `
        from(bucket: "${influxDB_BUCKET}")
        |> range(start: -30d) 
        |> filter(fn: (r) => r._measurement == "temperatura")
        |> filter(fn: (r) => r._field == "valor")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: ${n_points})
        |> sort(columns: ["_time"], desc: false) 
    `;

    try {
        // Ejecutar la consulta y procesar los resultados
        const result = await queryApi.collectRows(fluxQuery);
        
        result.forEach(row => {
            data.push({
                // Convertimos la fecha a un timestamp de milisegundos, que es lo que JS entiende
                timestamp: new Date(row._time).getTime(), 
                temp: row._value // El valor de la temperatura
            });
        });
        
        console.log(`Consulta exitosa. Se recuperaron ${data.length} puntos de la base de datos.`);
        return data;

    } catch (error) {
        console.error('Error al consultar InfluxDB:', error);
        return [];
    }
}

function generateRealTimeData() {
    return {
        timestamp: Date.now(),
        temp: 20 + Math.random() * 5 - 2.5
    };
}


wss.on('connection', async (ws) => { // ¡La función ahora es 'async'!
    console.log('Nuevo cliente conectado.');

    const historicalData = await fetchLastNMeasurements(); 
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(historicalData));
    }

    ws.on('close', () => {
        console.log('Cliente desconectado.');
    });
    ws.on('error', (error) => {
        console.error('Ha ocurrido un error en el WebSocket:', error);
    });
});

// El intervalo para los datos en tiempo real no cambia
setInterval(() => {
    if (wss.clients.size === 0) return;
    const newDataPoint = generateRealTimeData();
    const dataToSend = JSON.stringify(newDataPoint);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(dataToSend);
        }
    });
}, 3000);

// Iniciar el servidor (sin cambios)
server.listen(PORT, () => {
    console.log(`Servidor WebSocket (conectado a InfluxDB) escuchando en ws://localhost:${PORT}`);
});