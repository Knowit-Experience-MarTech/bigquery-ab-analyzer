# Google Cloud / BigQuery setup

1. Create a folder in **Google Drive** for the **BigQuery A/B Analyzer** solution.
	1. Within that folder, create a **Images** folder.
		1. Change **sharing** on the **Images** folder to **Anyone on the Internet with the link can view**.
2. Copy the [**Google Sheet**](https://docs.google.com/spreadsheets/d/1ba5VPyk_huX3bclMY0w2jhFRuDQ5tVYyVEuLqVNpuCg/edit?usp=sharing) into the **BigQuery A/B Analyzer** folder.
	1. Go to the **Settings** sheet. Edit the following fields:
		1. **Experiment Settings**
			1. **Data Set Location**: As default it is set to **EU**. Change it to **US** if that is correct for you.
			2. **Project ID**: Insert your Google Cloud Project ID here.
		2. **Download data to Sheet Settings**
			1. **Analytics Tool**: Google Analytics, GA4 Dataform or Amplitude.
			2. **BigQuery Data Set ID**: BigQuery Data Set ID for your analytics tool. Ex. analytics_12345.
			3. **BigQuery Table ID**: Not relevant for GA4.
		3. It's recommended to leave the other settings as is for simplicity.
		4. See also [**Settings** detailed information](../Google-Sheet/Settings-Sheet).
	2. Go to the menu **BigQuery A/B Analyzer** -> **Get Data from BigQuery**
		1. Refresh Events
		2. Refresh Parameters
3. Run the [**Create-Tables-and-UDF.sql**](../Google-Cloud/01-BigQuery/Create-Tables-and-UDF.sql) in BigQuery. This will create **5** tables and **9** User Defined Functions. When you run your analyzis later on, there will also be created some staging tables. Staging tables will come and go. They expires after 24 hours.
    1. Replace **your_project** with the name of your project.
    2. Region: As default **EU** is set as region. Change this to **US** if that is correct for you.
4. **Copy the scheduled query relevant to you:**
	1. [Google Analytics 4 scheduled query](../Google-Cloud/01-BigQuery/01-Scheduled-queries/01_GA4/bigquery_ab_analyzer_ga4.sql).
		1. Replace **your_project** with the name of your project.
		2. Replace **analytics_XXX** with your GA4 data set.
	2. [GA4 Dataform scheduled query](../Google-Cloud/01-BigQuery/01-Scheduled-queries/02_GA4_Dataform/bigquery_ab_analyzer_ga4_dataform.sql).
		1. Replace **your_project** with the name of your project.
		2. Replace **analytics_XXX** with your GA4 data set.
		3. Replace 'region-eu' with 'region-us' if your data is in US.
	3. [Amplitude scheduled query](../Google-Cloud/01-BigQuery/01-Scheduled-queries/03_Amplitude/bigquery_ab_analyzer_amplitude.sql).
		1. In **declare events_table**, replace **your_project.your_dataset.deduplicated_EVENTS_1234** with your project, data set and deduplicated table function.
		2. Replace **your_project** with the name of your project.
		3. Replace 'region-eu' with 'region-us' if your data is in US.
	4. [Mixpanel scheduled query](../Google-Cloud/01-BigQuery/01-Scheduled-queries/04_Mixpanel/bigquery_ab_analyzer_mixpanel.sql).
		1. In **declare events_table**, replace **your-project.mixpanel** with your project and data set.
		2. Replace 'region-eu' with 'region-us' if your data is in US.
	5. **Common settings for GA4, Amplitude & Mixpanel:**
		1. Go to [**Scheduled queries**](https://console.cloud.google.com/bigquery/scheduled-queries) and **Create scheduled query in editor**.
			1. If you have changed suggested names for **data set** and **tables** in **Settings Sheet**, you must also replace these.
			2. **Name the scheduled query:** Ex. "bigquery_ab_analyzer"
			3. **Repeat frequency:** On-demand
			4. **Destination for query results:** DO NOT tick "Set a destination table for query results"
			5. **Automatic location selection:** Untick checkbox
			6. **Multi-region:** Ex. "EU"
			7. **Save**
5. Go to [**Logs Router**](https://console.cloud.google.com/logs/router), and click the **CREATE SINK** button.
    1. Give the sink a name, ex. **bigquery_ab_analyzer**.
    2. Choose **Google Cloud Pub/Sub topic** as the destination.
    3. From the list of available Pub/Sub topics, click to **create a new topic**.
    4. Create a Topic ID, ex. **bigquery_ab_analyzer**.
    5. In the **Build inclusion filter**, copy the filter below. If you have changed suggested names for **data set** and **tables** in **Settings Sheet**, you must replace these.<br />
     ```sql
		protoPayload.methodName="jobservice.jobcompleted"
		protoPayload.serviceData.jobCompletedEvent.job.jobConfiguration.query.destinationTable.datasetId="bigquery_ab_analyzer"
		protoPayload.serviceData.jobCompletedEvent.job.jobConfiguration.query.destinationTable.tableId="experiments"
     ```
6. Go to [**Cloud Run**](https://console.cloud.google.com/run), and click **Write a function**.
    1. Choose **Use an inline editor to create a function**
	2. **Service name:** bigquery-ab-analyzer
	3. **Select region:** Select based on your location and "Low CO2". My choice is Finland.
	4. **Runtime:** Latest "Node.js"
	5. **Trigger**
	    1. Pub/Sub Trigger
		2. **Trigger name:** bigquery-ab-analyzer
		3. **Trigger type:** Google sources
		4. **Select a Cloud Pub/Sub topic:** Create a topic
		    1. **Topic ID:** bigquery-ab-analyzer
			2. Do not tick any checkboxes
			3. **Encryption:** Google-managed encryption key
			4. **Create**
        5. **Region:** Same reqion as you selected above
		6. **Rest of settings:** As is
	6. **Authentication:** Use Cloud IAM to authenticate incoming requests
	    1. Require authentication
    7. **Billing:** Request-based
	8. **Service scaling:** Auto-scaling (0)
	9. **Ingress:** Internal
	10. **Container(s), volumes, networking, security**
	    1. Resources
		    1. **Memory:** 256 MiB
			2. **CPU:** <1
			3. **Number of vCPUs allocated to each instance of this container:** 167m
	11.	**Requests**
		1. **Request timeout:** 60
		2. **Maximum concurrent requests per instance:** 1
	12. **Create**
7. Select the **Cloud Run services** (bigquery-ab-analyzer) that point **5.** created
    1. Select **Source** tab
	    1. **Edit source**
		    1. **Function entry point:** runABAnalyzerQuery
		    2. Edit **index.js** and **package.json**. See the chapter [**Cloud Run Source code**](#cloud-run-source-code) below.
		2. **Save and redeploy**
8. Copy **Looker Studio**
    1. Make a copy of [**BigQuery A/B Analyzer**](https://lookerstudio.google.com/reporting/489a1bf0-030e-4c3c-87e1-f3286a99b4ad/page/HMgiD)
    2. Click on the 3 vertical dots available at the top right corner, then select "**Make a copy**"
    3. Do not pay attention to the warnings (Sometimes the data source name is listed as 'unknown').
       1. Copy the report without creating any data sources.
    4. After you have copied, all charts will display errors about insufficient permissions. That is OK.
    5. In the Looker Studio top menu, go to **Resource** -> **Manage added data sources**.
       1. Now connect each data source to **your BigQuery tables**.
	   2. **Data Credentials** needs to be **Owner's Credentials**.
    6. Edit the **experiments_report** data source.
	   1. Edit the **Experiment Name URL [Calc]** field. The link in this field should point to your Looker Studio report. Change the ID part between **/reporting/** and **/page/**.
		2. https://lookerstudio.google.com/reporting/CHANGE-THIS-ID/page/.
	7. After you have connected all data sources to your tables, go back to the report. Refresh your browser to get the new data source connections.
    8. You should now have a Looker Studio report showing your data.

## Cloud Run Source code

### index.js

```js
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

```

### package.json

```json
{
    "dependencies": {
        "@google-cloud/bigquery-data-transfer": "^5.0.1",
        "@google-cloud/functions-framework": "^3.5.1"
    }
}

```