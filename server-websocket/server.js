// 1. Importar las librerías necesarias
const http = require('http');
const WebSocket = require('ws');
// ¡NUEVO! Importamos el cliente de InfluxDB y la clase Point
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// 2. Crear servidores HTTP y WebSocket (sin cambios)
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const PORT = 8080;

// --- ¡NUEVO! Configuración de la Conexión a InfluxDB ---
// REEMPLAZA ESTOS VALORES CON LOS DE TU INSTANCIA DE INFLUXDB
const influxDB_URL = 'http://localhost:8086'; // Tu URL de InfluxDB
const influxDB_TOKEN = 'TU_TOKEN_DE_ACCESO_SECRETO'; // Tu Token
const influxDB_ORG = 'tu-organizacion'; // Tu Org
const influxDB_BUCKET = 'tu-bucket'; // Tu Bucket

// Crear una nueva instancia del cliente de InfluxDB
const influxDB = new InfluxDB({ url: influxDB_URL, token: influxDB_TOKEN });
// Crear una API de consulta (query) para el ORG especificado
const queryApi = influxDB.getQueryApi(influxDB_ORG);


// --- Lógica de la Aplicación ---

/**
 * ¡MODIFICADO! Esta función ahora consulta InfluxDB para obtener las últimas 'n' mediciones.
 * @returns {Promise<Array<{timestamp: number, temp: number}>>}
 */
async function fetchLastNMeasurements() {
    console.log('Consultando InfluxDB para obtener datos históricos...');
    const data = [];
    
    // El número de puntos que queremos recuperar
    const n_points = 50; 

    // Query en lenguaje Flux para obtener los últimos 'n' puntos del measurement 'temperatura'
    const fluxQuery = `
        from(bucket: "${influxDB_BUCKET}")
        |> range(start: -30d) // Busca en los últimos 30 días (un rango amplio para asegurar encontrar datos)
        |> filter(fn: (r) => r._measurement == "temperatura")
        |> filter(fn: (r) => r._field == "valor") // Asegúrate que el campo sea 'valor' o el que uses
        |> sort(columns: ["_time"], desc: true) // Ordena de más reciente a más antiguo
        |> limit(n: ${n_points}) // Limita a los últimos 'n' resultados
        |> sort(columns: ["_time"], desc: false) // Re-ordena de más antiguo a más reciente para la gráfica
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
        console.error('❌ Error al consultar InfluxDB:', error);
        return []; // Devuelve un array vacío en caso de error para no romper el cliente
    }
}

// Mantenemos esta función para simular datos en tiempo real.
// En un sistema 100% real, estos datos también vendrían de una fuente que los inserta en InfluxDB.
function generateRealTimeData() {
    return {
        timestamp: Date.now(),
        temp: 20 + Math.random() * 5 - 2.5
    };
}


// --- Lógica del Servidor WebSocket (con un pequeño ajuste) ---
wss.on('connection', async (ws) => { // ¡La función ahora es 'async'!
    console.log('✅ Nuevo cliente conectado.');

    // a) Enviar los datos históricos OBTENIDOS DE INFLUXDB
    const historicalData = await fetchLastNMeasurements(); // Usamos 'await' para esperar la respuesta de la DB
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(historicalData));
    }

    // b) y c) El manejo de 'close' y 'error' no cambia
    ws.on('close', () => {
        console.log('❌ Cliente desconectado.');
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
    console.log(`🚀 Servidor WebSocket (conectado a InfluxDB) escuchando en ws://localhost:${PORT}`);
});