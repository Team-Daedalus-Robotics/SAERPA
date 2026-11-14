import { createBuilder } from './.aspire/modules/aspire.mjs';

const builder = await createBuilder();

const postgres = await builder
  .addPostgres('postgres')
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
  .withReference(api)
  .waitFor(api)
  .withEnvironment('BROWSER', 'none')
  .withExternalHttpEndpoints()
  .publishAsStaticWebsite({ apiPath: '/api', apiTarget: api });

await builder.build().run();