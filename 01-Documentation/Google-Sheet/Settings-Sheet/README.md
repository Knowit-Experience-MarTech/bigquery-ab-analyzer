# Documentation: Settings Sheet

⚠️ **Warning**:

* This sheet uses **Named Ranges**. Do not add/delete rows or columns in the Settings tab, or the functionality may break.
* If you change table names etc. in **Experiment Settings**, you must also update the scheduled query.

You may have to scroll sideways in the table below to see all the settings.

## Generic Settings
<table>
  <caption>Generic Settings Configuration</caption>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Setting </th>
      <th scope="col" style="text-align: left;">Description</th>
      <th scope="col" style="text-align: left;">Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th colspan="3" scope="colgroup">Experiment Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Data Set Location</th>
      <td>BigQuery region.</td>
      <td colspan="3">US or EU.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Project ID</th>
      <td>Your Google Cloud Project ID.</td>
      <td>e.g., my-company-prod</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">BigQuery Data Set ID</th>
      <td>BigQuery Data Set ID where experiments data should be saved.</td>
      <td colspan="3">bigquery_ab_analyzer</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">BigQuery Experiment Table (Table ID)</th>
      <td>BigQuery Table ID for Experiments.</td>
      <td>experiments</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">BigQuery Filters Table (Table ID)</th>
      <td>BigQuery Table ID for Filters (SQL filters)</td>
      <td>experiments_filters</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">BigQuery Links Table (Table ID)</th>
      <td>Links to external documentation for the experiment or the different variants</td>
      <td>experiments_links</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">BigQuery Image Table (Table ID)</th>
      <td>Links to images illustrating the different variants</td>
      <td>experiments_images</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">BigQuery Experiment Reporting Table (Table ID)</th>
      <td>Experiment data summarized</td>
      <td>experiments_report</td>
    </tr>
	<tr>
      <th colspan="3" scope="colgroup">AI Summary</th>
	</tr>
	<tr>
      <th scope="row" style="text-align: left;">Activate AI Summary</th>
      <td>Optional. By ticking this box AI Summary will be activated. Requires extra setup in GCP.</td>
      <td>true</td>
    </tr>
	<tr>
      <th scope="row" style="text-align: left;">Total target sample</th>
      <td>Total target sample size before AI will recommend the output. This is also known as "Fixed horizon".</td>
      <td>2000</td>
    </tr>
	<tr>
      <th scope="row" style="text-align: left;">AI Prompt</th>
      <td>To export AI Prompt to BigQuery, go to menu <strong>BigQuery A/B Analyzer -> Settings ->  Export AI Summary Settings</strong></td>
	  <td>You are a senior CRO and data analytics consultant summarizing A/B test results for an executive dashboard.
Write exactly two concise, highly structured paragraphs of professional prose separated by a single blank line. Do not use rule titles, bullet points, hyphens, or markdown headings.

Paragraph 1 - Executive Decision & Statistical Summary:
1. Lead immediately with a clear verdict: Declare the winning variant (or "Inconclusive/No Winner"), state whether it achieved the Required Confidence Level, and quote the exact conversion lift from "Conversion Details".
2. Synthesize business impact: If monetary or mean values are present, evaluate whether the lift is driven by higher conversion volume, higher average order value, or both. Treat total value as a unitless scale metric (do not add currency symbols). Reference Conversion P-Value or Value P-Value explicitly without scientific notation.
3. Decision & Horizon Check: Check sample size against {{TARGET_SAMPLE}} and "Estimated Days Remaining". If traffic is below target, warn of false-positive (peeking) risk and recommend letting the test run for the remaining days. If target is reached (0 days remaining), recommend closing the test. If underpowered (<1000 sample target), note the detection limitation.

Paragraph 2 - Funnel & User Behavior Dynamics:
If funnel journey data is provided:
1. Journey Bottlenecks: Identify the step with the highest drop-off and explain specifically where and how the winning variant outperforms the control (e.g., superior top-of-funnel engagement vs. checkout completion).
2. Behavioral Latency: Compare median vs. average step duration. If average time is substantially higher than median time, explicitly explain that a subset of users is delaying action (long-tail delay / return visits).
If no funnel data is present, omit this second paragraph entirely.</td>
    </tr>
    <tr>
      <th colspan="3" scope="colgroup">Download data to Sheet Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Analytics Tool</th>
      <td>The source of your data.</td>
      <td>
	  Google Analytics<br />
	  GA4 Dataform<br />
	  Amplitude<br />
	  Mixpanel<br />
	  PostHog<br />
	  </td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Download data for X Number of Days</th>
      <td>How far back to look for Event Names and Parameters (for dropdowns).</td>
      <td>e.g., 3 Last Days</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Ecommerce Items Object Name</th>
      <td>If you are using a different tool than GA4, change "items" to match your ecommerce items structure.</td>
      <td>e.g., items</td>
    </tr>
    <tr>
      <th colspan="3" scope="colgroup">Default Experiment Event Name, Variant String & Value Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Experiment Event Name</th>
      <td>Experiment Event Name. If you are following the GA4 Guide, <strong>experience_impression</strong> is the recommende name.</td>
      <td>experience_impression</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Experiment Variant String</th>
      <td>Experiment Variant String. If you are following the GA4 Guide, <strong>exp_variant_string</strong> is the recommende name.</td>
      <td>exp_variant_string</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Experiment Value Parameter</th>
      <td>Experiment Value Parameter. Used for analyzing "value" significance (ex. revenue).</td>
      <td>value</td>
    </tr>
    <tr>
      <th colspan="3" scope="colgroup">Query Information</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Log Query Information</th>
      <td>This will log estimated size of query in bytes and cost in USD. Information can be downloaded to the "Query Info" sheet.</td>
      <td>true</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">On-demand Pricing for Queries</th>
      <td>Query price per tebibyte (TiB) in USD. The first 1 TiB per month is free. See <a href="https://cloud.google.com/bigquery/pricing?hl=en">BigQuery pricing</a>. Is used for estimating query cost.</td>
      <td>6.25</td>
    </tr>
  </tbody>
</table>

## GA4 Settings
<table>
  <caption>GA4 Settings Configuration</caption>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Setting </th>
      <th scope="col" style="text-align: left;">Description</th>
      <th scope="col" style="text-align: left;">Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th colspan="3" scope="colgroup">Download data to Sheet Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Data Set ID</th>
      <td>The BigQuery dataset containing your events. Example values in the sheet is specific for the tool selected.</td>
	  <td>e.g., analytics_123456</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Table ID</th>
      <td>The BigQuery table containing your events. Example values in the sheet is specific for the tool selected.</td>
      <td>events_ OR events_fresh_</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Events</th>
      <td>Exclude Events not relevant for your analysis. Exclude these Events separated by comma.</td>
      <td>session_start, first_visit</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Parameters</th>
      <td>Exclude Parameters not relevant for your analyzis. Exclude these Parameters separated by comma.</td>
      <td>batch_ordering_id, batch_page_id, debug_event, debug_mode, prevenue_28d,  dclid,  gclsrc,  gclid, srsltid, last_gclid, gad_source, previous_first_open_count, firebase_previous_id, update_with_analytics,  client_id, _ltv_USD, _ltv_EUR, _ltv_JPY, _ltv_GBP, _ltv_CNY, _ltv_AUD, _ltv_CAD, _ltv_CHF, _ltv_HKD, _ltv_SGD, _ltv_SEK, _ltv_KRW, _ltv_NOK, _ltv_NZD, _ltv_INR, _ltv_MXN, _ltv_TWD, _ltv_ZAR, _ltv_BRL, _ltv_DKK, _ltv_PLN, _ltv_THB, _ltv_ILS, _ltv_IDR, _ltv_CZK, _ltv_AED, _ltv_TRY, _ltv_HUF, _ltv_CLP, _ltv_SAR, _ltv_PHP, _ltv_MYR, _ltv_COP,  _ltv_RON, _ltv_PEN, _ltv_BGN, _ltv_ARS, device_id, last_advertising_id_reset, gbraid, wbraid, ga_session_id, engaged_session_event</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Include BigQuery Columns (Field Names)</th>
      <td>BigQuery columns to include for getting parameters. Columns are matched using RegEx. Adapt this setting to your own needs.</td>
      <td>^(?:device\.|geo\.|ecommerce\.|stream_id$|platform$)</td>
    </tr>
  </tbody>
</table>

## GA4Dataform Settings
<table>
  <caption>GA4Dataform Settings Configuration</caption>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Setting </th>
      <th scope="col" style="text-align: left;">Description</th>
      <th scope="col" style="text-align: left;">Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th colspan="3" scope="colgroup">Download data to Sheet Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Data Set ID</th>
      <td>The BigQuery dataset containing your events. Example values in the sheet is specific for the tool selected.</td>
      <td>e.g., superform_outputs_123456</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Table ID</th>
      <td>The BigQuery table containing your events. Example values in the sheet is specific for the tool selected.</td>
	  <td>ga4_events</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Events</th>
      <td>Exclude Events not relevant for your analysis. Exclude these Events separated by comma.</td>
      <td>session_start, first_visit</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Parameters</th>
      <td>Exclude Parameters not relevant for your analyzis. Exclude these Parameters separated by comma.</td>
      <td>batch_ordering_id, batch_page_id, debug_event, debug_mode, prevenue_28d,  dclid,  gclsrc,  gclid, srsltid, last_gclid, gad_source, previous_first_open_count, firebase_previous_id, update_with_analytics,  client_id, _ltv_USD, _ltv_EUR, _ltv_JPY, _ltv_GBP, _ltv_CNY, _ltv_AUD, _ltv_CAD, _ltv_CHF, _ltv_HKD, _ltv_SGD, _ltv_SEK, _ltv_KRW, _ltv_NOK, _ltv_NZD, _ltv_INR, _ltv_MXN, _ltv_TWD, _ltv_ZAR, _ltv_BRL, _ltv_DKK, _ltv_PLN, _ltv_THB, _ltv_ILS, _ltv_IDR, _ltv_CZK, _ltv_AED, _ltv_TRY, _ltv_HUF, _ltv_CLP, _ltv_SAR, _ltv_PHP, _ltv_MYR, _ltv_COP,  _ltv_RON, _ltv_PEN, _ltv_BGN, _ltv_ARS, device_id, last_advertising_id_reset, gbraid, wbraid, ga_session_id, engaged_session_event</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Include BigQuery Columns (Field Names)</th>
      <td>BigQuery columns to include for getting parameters. Columns are matched using RegEx. Adapt this setting to your own needs. Items are supported.</td>
	  <td>^(device\.|geo\.|ecommerce\.|items\.|page\.|event_params_custom\.|user_properties\.|^(stream_id|platform)$)</td>
    </tr>
  </tbody>
</table>

## Amplitude Settings
<table>
  <caption>Amplitude Settings Configuration</caption>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Setting </th>
      <th scope="col" style="text-align: left;">Description</th>
      <th scope="col" style="text-align: left;">Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th colspan="3" scope="colgroup">Download data to Sheet Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Data Set ID</th>
      <td>The BigQuery dataset containing your events. Example values in the sheet is specific for the tool selected.</td>
	  <td>e.g., amplitude</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Table ID</th>
      <td>The BigQuery table containing your events. Example values in the sheet is specific for the tool selected.</td>
	  <td>e.g., EVENTS_123456</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Events</th>
      <td>Exclude Events not relevant for your analysis. Exclude these Events separated by comma.</td>
	  <td></td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Parameters</th>
      <td>Exclude Parameters not relevant for your analyzis. Exclude these Parameters separated by comma.</td>
	  <td>aclid,ad_event_id,ad_unit_code,anid</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Include BigQuery Columns (Field Names)</th>
      <td>BigQuery columns to include for getting parameters. Columns are matched using RegEx. Adapt this setting to your own needs.</td>
	  <td>^(app|city|country|device_brand|device_carrier|device_family|device_manufacturer|device_model|device_type|os_name|platform|region)$</td>
    </tr>
  </tbody>
</table>

## Mixpanel Settings
<table>
  <caption>Mixpanel Settings Configuration</caption>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Setting </th>
      <th scope="col" style="text-align: left;">Description</th>
      <th scope="col" style="text-align: left;">Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th colspan="3" scope="colgroup">Download data to Sheet Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Data Set ID</th>
      <td>The BigQuery dataset containing your events. Example values in the sheet is specific for the tool selected.</td>
	  <td>e.g., mixpanel</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Table ID</th>
      <td>The BigQuery table containing your events. Example values in the sheet is specific for the tool selected.</td>
      <td>mp_master_event</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Events</th>
      <td>Exclude Events not relevant for your analysis. Exclude these Events separated by comma.</td>
	  <td></td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Parameters</th>
      <td>Exclude Parameters not relevant for your analyzis. Exclude these Parameters separated by comma.</td>
	  <td>mp_processing_time_ms, $mp_api_timestamp_ms, $mp_event_size, user_agent, mp_lib, $lib_version, $mp_api_endpoint, $insert_id, mp_processing_time_ms, mp_country_code</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Include BigQuery Columns (Field Names)</th>
      <td>BigQuery columns to include for getting parameters. Columns are matched using RegEx. Adapt this setting to your own needs.</td>
	  <td></td>
    </tr>
  </tbody>
</table>

## PostHog Settings
<table>
  <caption>PostHog Settings Configuration</caption>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Setting </th>
      <th scope="col" style="text-align: left;">Description</th>
      <th scope="col" style="text-align: left;">Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th colspan="3" scope="colgroup">Download data to Sheet Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Data Set ID</th>
      <td>The BigQuery dataset containing your events. Example values in the sheet is specific for the tool selected.</td>
	  <td>e.g., posthog</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">BigQuery Table ID</th>
      <td>The BigQuery table containing your events. Example values in the sheet is specific for the tool selected.</td>
      <td>events</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Events</th>
      <td>Exclude Events not relevant for your analysis. Exclude these Events separated by comma.</td>
	  <td></td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Exclude Parameters</th>
      <td>Exclude Parameters not relevant for your analyzis. Exclude these Parameters separated by comma.</td>
	  <td>$set_once, $initial_browser, $initial_browser_version, $initial_geoip_accuracy_radius, $initial_geoip_city_confidence, $initial_geoip_city_name, $initial_geoip_continent_code, $initial_geoip_continent_name, $initial_geoip_country_code, $initial_geoip_country_name, $initial_geoip_latitude, $initial_geoip_longitude, $initial_geoip_postal_code, $initial_geoip_subdivision_1_code, $initial_geoip_subdivision_1_name, $initial_geoip_subdivision_2_code, $initial_geoip_subdivision_2_name, $initial_geoip_time_zone, $initial_os, $initial_pathname, $initial_referring_domain, $initial_screen_height, $initial_screen_width, $transformations_succeeded, $initial_current_url, $initial_device_type</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" style="text-align: left;">Include BigQuery Columns (Field Names)</th>
      <td>BigQuery columns to include for getting parameters. Columns are matched using RegEx. Adapt this setting to your own needs.</td>
	  <td></td>
    </tr>
  </tbody>
</table>