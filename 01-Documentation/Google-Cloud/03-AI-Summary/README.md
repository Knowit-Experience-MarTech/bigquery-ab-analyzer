# AI Summary setup

To get Gemini actually running inside the BigQuery environment, we have to bridge the gap between BigQuery and Google Cloud's machine learning platform (Vertex AI). Because BigQuery doesn't inherently host the LLM, it needs a secure "tunnel" to send prompts to Vertex AI and get the text back.

## Step 1: Enable the Required APIs
Before BigQuery can talk to Gemini, the project needs permission to use the tools.

1. Enable the following two APIs:
	1. [**Vertex AI API**](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com) (This is where Gemini lives).
	2. [**BigQuery Connection API**](https://console.cloud.google.com/apis/library/bigqueryconnection.googleapis.com) (This allows BigQuery to talk to outside services).


## Step 2: Create a Cloud Resource Connection
Now we need to create the actual "bridge" in BigQuery.

1. Go to [**BigQuery Studio**](https://console.cloud.google.com/bigquery).
2. Under your **project name**, select **Connections**.
3. On the connections page, click the **Create connection** button on the upper right side.
4. Select connection type **Vertex AI remote models, remote functions, BigLake and Spanner (Cloud Resource)**.
5. Give it a Connection ID (e.g., **gemini_connection**).
	* Add a friendly name and description (optional).
6. Select **Location type**.
	* Make sure the location matches your BigQuery dataset location (e.g., **Multi-region EU** or europe-west1).
7. Click **Create connection**.
8. Click on your newly created connection in the Explorer pane (if you don't see the connection, refresh the page). In the connection details, copy the **Service Account ID** that Google automatically generated for it. It will look like an email address.

## Step 3: Grant IAM Permissions
Right now, the connection exists, but it doesn't have the security clearance to use Vertex AI.

1. In the GCP menu, go to [**IAM & Admin > IAM**](https://console.cloud.google.com/iam-admin/iam).
2. Click **Grant Access**.
3. Paste the **Service Account ID** you copied in Step 2 into the "New principals" box.
4. Assign it the role: **Vertex AI User**.
5. Click **Save**.

## Step 4: Setup Query for connecting to Gemini

We are going to use [**Gemini model 2.5 Flash**](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash).
This is a fast and cheap model.

Run this once in your BigQuery editor (adjusting your project/dataset/location/connection names):

```sql
create or replace model `your-dataset.bigquery_ab_analyzer.gemini_narrator` -- Replace "your-dataset" with correct dataset.
  remote with connection `your-dataset.eu.gemini_connection` -- Replace "your-dataset" with correct dataset. Replace "eu" with the location you are using.
  options (
    endpoint = 'gemini-2.5-flash' 
  );
```

[**Gemini model 2.5 Flash Lite**](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite) is an even faster and cheaper model, but in my testing it sometimes forgot some of the instructions.
If you want to test out **Flash Lite**, run this in the BigQuery editor:

```sql
create or replace model `your-dataset.bigquery_ab_analyzer.gemini_narrator` -- Replace "your-dataset" with correct dataset.
  remote with connection `your-dataset.eu.gemini_connection` -- Replace "your-dataset" with correct dataset. Replace "eu" with the location you are using.
  options (
    endpoint = 'gemini-2.5-flash-lite' 
  );
```

## Cost

* Cost for using Gemini [is listed here](https://cloud.google.com/vertex-ai/generative-ai/pricing)