const functions = require('@google-cloud/functions-framework');
const bigqueryDataTransfer = require('@google-cloud/bigquery-data-transfer');

functions.cloudEvent('runABAnalyzerQuery', async (cloudEvent) => {
  // Update configuration options.
  const projectId = 'your_project_id'; // Replace with your project ID.
  const configId = 'configId'; // Replace with your config ID.
  const region = 'eu'; // Replace with your region.

  // Create the run time directly in code.
  // For example, use today's date at 12:00 UTC.
  const now = new Date();
  const runTime = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12  // 12:00 UTC — adjust if necessary
  ));

  // Create a proto-buffer Timestamp using the client's protos.
  const requestedRunTime = bigqueryDataTransfer.protos.google.protobuf.Timestamp.fromObject({
    seconds: Math.floor(runTime.getTime() / 1000),
    nanos: (runTime.getTime() % 1000) * 1e6
  });

  // Create the BigQuery Data Transfer client.
  const client = new bigqueryDataTransfer.v1.DataTransferServiceClient();
  const parent = client.projectLocationTransferConfigPath(projectId, region, configId);

  // Build the request.
  const request = {
    parent,
    requestedRunTime
  };

  // Trigger the manual transfer run.
  const response = await client.startManualTransferRuns(request);
  console.log(`Scheduled query triggered at ${runTime.toISOString()} for config ${configId}`);
  return response;
});
