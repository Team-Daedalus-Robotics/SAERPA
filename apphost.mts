import { createBuilder } from './.aspire/modules/aspire.mjs';

try {
  process.loadEnvFile();
} catch {
  // .env opcional
}

const builder = await createBuilder();

const postgresPassword = await builder.addParameter('postgres-password', {
  value: process.env.POSTGRES_PASSWORD,
});

const postgresUser = await builder.addParameter('postgres-user', {
  value: process.env.POSTGRES_USER,
});

const postgres = await builder
  .addPostgres('postgres', { userName: postgresUser, password: postgresPassword, port: 5432 })
  .withImage('postgis/postgis', { tag: '18-3.6' })
  .withPersistentLifetime()
  .withDataVolume({ name: 'saerpa-postgres-data' });
const database = await postgres.addDatabase('saerpa');

const nasaEventWorker = await builder
  .addPythonApp('nasa-event-worker', './src/nasa_event_worker', 'main.py')
  .withUv();
const stationDataGateway = await builder
  .addPythonApp('station-data-gateway', './src/station_data_gateway', 'main.py')
  .withUv();
const suggestionWorker = await builder
  .addPythonApp('suggestion-worker', './src/suggestion_worker', 'main.py')
  .withUv();

const api = await builder
  .addUvicornApp('api', './src/api', 'main:app')
  .withUv()
  .withHttpEndpoint({ env: 'PORT' })
  .withHttpHealthCheck({ path: '/api/health' })
  .withReference(database)
  .waitFor(database)
  .waitFor(nasaEventWorker)
  .waitFor(stationDataGateway)
  .waitFor(suggestionWorker)
  .withEnvironment('DATABASE_URL', await database.uriExpression());

await builder
  .addViteApp('web', './src/web')
  .withNpm()
  .withHttpEndpoint({ env: 'PORT', port: 4200 })
  .withReference(api)
  .waitFor(api)
  .withEnvironment('BROWSER', 'none')
  .withExternalHttpEndpoints()
  .publishAsStaticWebsite({ apiPath: '/api', apiTarget: api });

await builder.build().run();