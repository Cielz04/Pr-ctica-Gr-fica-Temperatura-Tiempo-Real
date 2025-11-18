const http = require('http');
const WebSocket = require('ws');
const { InfluxDB } = require('@influxdata/influxdb-client');

const server = http.createServer();
const wss = new WebSocket.Server({ server });
const PORT = 8080;

const influxDB_URL = 'http://localhost:8086';
const influxDB_TOKEN = 'Ll8oP64h1hX_J202weDCN57Eev1iUNVtZ2VbllCyQcw6x6x5pp2O9rTkbIxZPCVHLsjx0KHYd_C1K2P2BcseHA==';
const influxDB_ORG = 'cielz';
const influxDB_BUCKET = 'temperaturas-reales';

const influxDB = new InfluxDB({ url: influxDB_URL, token: influxDB_TOKEN });
const queryApi = influxDB.getQueryApi(influxDB_ORG);

/**
 * Consulta los últimos 50 puntos para la carga histórica inicial.
 */
async function fetchHistoricalData() {
    console.log('Consultando InfluxDB para obtener datos históricos...');
    const data = [];
    const fluxQuery = `
        from(bucket: "${influxDB_BUCKET}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "temperatura" and r._field == "valor")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 50)
        |> sort(columns: ["_time"], desc: false)
    `;
    try {
        const result = await queryApi.collectRows(fluxQuery);
        result.forEach(row => {
            data.push({ timestamp: new Date(row._time).getTime(), temp: row._value });
        });
        console.log(`Consulta histórica exitosa. Se recuperaron ${data.length} puntos.`);
        return data;
    } catch (error) {
        console.error('Error en la consulta histórica de InfluxDB:', error);
        return [];
    }
}

/**
 * Consulta el último y más reciente punto de dato de InfluxDB.
 */
async function fetchLatestDataPoint() {
    const fluxQuery = `
        from(bucket: "${influxDB_BUCKET}")
        |> range(start: -1m)
        |> filter(fn: (r) => r._measurement == "temperatura" and r._field == "valor")
        |> last()
    `;
    try {
        const result = await queryApi.collectRows(fluxQuery);
        if (result && result.length > 0) {
            const lastPoint = result[0];
            return { timestamp: new Date(lastPoint._time).getTime(), temp: lastPoint._value };
        }
        return null;
    } catch (error) {
        return null;
    }
}

let lastSentTimestamp = 0;

wss.on('connection', async (ws) => {
    console.log('Nuevo cliente conectado.');
    const historicalData = await fetchHistoricalData();
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(historicalData));
        if (historicalData.length > 0) {
            lastSentTimestamp = historicalData[historicalData.length - 1].timestamp;
        }
    }
    ws.on('close', () => console.log('Cliente desconectado.'));
    ws.on('error', (error) => console.error('Ha ocurrido un error en WS:', error));
});

setInterval(async () => {
    if (wss.clients.size === 0) return;

    const latestPoint = await fetchLatestDataPoint();

    if (latestPoint && latestPoint.timestamp > lastSentTimestamp) {
        console.log(`Enviando punto REAL a ${wss.clients.size} clientes -> Temp: ${latestPoint.temp.toFixed(2)}`);
        const dataToSend = JSON.stringify(latestPoint);
        
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(dataToSend);
            }
        });

        lastSentTimestamp = latestPoint.timestamp;
    }
}, 200);

server.listen(PORT, () => {
    console.log(`🚀 Servidor WebSocket 100% REAL escuchando en ws://localhost:${PORT}`);
});