const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// Variables de influx
const influxDB_URL = 'http://localhost:8086';
const influxDB_TOKEN = 'Ll8oP64h1hX_J202weDCN57Eev1iUNVtZ2VbllCyQcw6x6x5pp2O9rTkbIxZPCVHLsjx0KHYd_C1K2P2BcseHA==';
const influxDB_ORG = 'cielz';
const influxDB_BUCKET = 'temperaturas-reales';
const influxDB = new InfluxDB({ url: influxDB_URL, token: influxDB_TOKEN });
const writeApi = influxDB.getWriteApi(influxDB_ORG, influxDB_BUCKET);

console.log('Conectado a InfluxDB para escribir.');

function escribirDato() {
    const temperatura = 20 + Math.random() * 10 - 5;
    const point = new Point('temperatura')
        .floatField('valor', temperatura);
    
    writeApi.writePoint(point);

    console.log(`Dato enviado -> Temperatura: ${temperatura.toFixed(2)} °C`);
}

console.log('Iniciando simulación de sensor. Escribiendo en InfluxDB cada 1 segundos...');
setInterval(escribirDato, 1000);


process.on('SIGINT', async () => {
    console.log('\nDeteniendo el escritor...');
    try {
        await writeApi.close();
        console.log('Escritor de InfluxDB cerrado correctamente.');
        process.exit(0);
    } catch (e) {
        console.error('Error al cerrar el escritor de InfluxDB:', e);
        process.exit(1);
    }
});