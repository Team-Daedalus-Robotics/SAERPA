import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuilder } from './.aspire/modules/aspire.mjs';

try {
  process.loadEnvFile();
} catch {
  // .env opcional
}

const builder = await createBuilder();
const sharedPythonPath = resolve(dirname(fileURLToPath(import.meta.url)), 'src/shared/src');

const postgresPassword = await builder.addParameter('postgres-password', {
  value: process.env.POSTGRES_PASSWORD,
});

const postgresUser = await builder.addParameter('postgres-user', {
  value: process.env.POSTGRES_USER,
});
const postgresPlatform = process.env.POSTGRES_PLATFORM ?? 'linux/amd64';

const postgres = await builder
  .addPostgres('postgres', { userName: postgresUser, password: postgresPassword, port: 5432 })
  .withImage('postgis/postgis', { tag: '18-3.6' })
  .withContainerRuntimeArgs(['--platform', postgresPlatform])
  .withPersistentLifetime()
  .withDataVolume({ name: 'saerpa-postgres-data' });
const database = await postgres.addDatabase('saerpa');

const nasaEventWorker = await builder
  .addPythonApp('nasa-event-worker', './src/nasa_event_worker', 'main.py')
  .withUv()
  .withReference(database)
  .waitFor(database)
  .withEnvironment('DATABASE_URL', await database.uriExpression())
  .withEnvironment(
    'EARTHDATA_USER',
    await builder.addParameter('earthdata-user', {
      value: process.env.EARTHDATA_USER,
      secret: true,
    }),
  )
  .withEnvironment(
    'EARTHDATA_PASS',
    await builder.addParameter('earthdata-pass', {
      value: process.env.EARTHDATA_PASS,
      secret: true,
    }),
  )
  .withEnvironment(
    'NASA_EVENT_POLL_SECONDS',
    await builder.addParameter('nasa-event-poll-seconds', {
      value: process.env.NASA_EVENT_POLL_SECONDS ?? '900',
    }),
  )
  .withEnvironment(
    'NASA_EVENT_BACKFILL_DAYS',
    await builder.addParameter('nasa-event-backfill-days', {
      value: process.env.NASA_EVENT_BACKFILL_DAYS ?? '365',
    }),
  );
const stationDataGateway = await builder
  .addUvicornApp('station-data-gateway', './src/station_data_gateway', 'main:app')
  .withUv()
  .withHttpEndpoint({ env: 'PORT' })
  .withReference(database)
  .waitFor(database)
  .withEnvironment('DATABASE_URL', await database.uriExpression());
const suggestionWorker = await builder
  .addPythonApp('suggestion-worker', './src/suggestion_worker', 'main.py')
  .withUv()
  .withReference(database)
  .waitFor(database)
  .withEnvironment('DATABASE_URL', await database.uriExpression())
  .withEnvironment(
    'API_KEY',
    await builder.addParameter('laya-api-key', {
      value: process.env.API_KEY ?? process.env.TYPESAFE_API_KEY,
      secret: true,
    }),
  )
  .withEnvironment(
    'BASE_URL',
    await builder.addParameter('laya-base-url', {
      value: process.env.BASE_URL ?? process.env.TYPESAFE_BASE_URL ?? 'http://localhost:11435',
    }),
  )
  .withEnvironment(
    'DECIDE_URL',
    await builder.addParameter('laya-decide-url', {
      value:
        process.env.DECIDE_URL ??
        `${process.env.BASE_URL ?? process.env.TYPESAFE_BASE_URL ?? 'http://localhost:11435'}/api/decide`,
    }),
  )
  .withEnvironment(
    'MODEL',
    await builder.addParameter('laya-model', {
      value: process.env.MODEL ?? process.env.TYPESAFE_DEFAULT_MODEL ?? 'laya:multilingual',
    }),
  )
  .withEnvironment('QUERY_LIMIT', process.env.QUERY_LIMIT ?? '100');

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
  .withEnvironment('PYTHONPATH', [sharedPythonPath, process.env.PYTHONPATH].filter(Boolean).join(delimiter))
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
