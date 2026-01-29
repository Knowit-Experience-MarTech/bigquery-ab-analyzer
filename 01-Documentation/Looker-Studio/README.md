# Looker Studio

The Looker Studio dashboard is designed to answer "Who won?" at a glance.

## Copy Looker Studio

1. Make a copy of [**BigQuery A/B Analyzer**](https://lookerstudio.google.com/reporting/489a1bf0-030e-4c3c-87e1-f3286a99b4ad/page/HMgiD)
2. Click on the 3 vertical dots available at the top right corner, then select "**Make a copy**"
3. Do not pay attention to the warnings (Sometimes the data source name is listed as 'unknown').
	1. Copy the report without creating any data sources.
4. After you have copied, all charts will display errors about insufficient permissions. That is OK.
5. In the Looker Studio top menu, go to **Resource** -> **Manage added data sources**.
    1. Now connect each data source to **your BigQuery tables**.
	2. **Data Credentials** needs to be **Owner's Credentials**.
6. Edit the **experiments_report** data source.
	1. Edit the [**Experiment Name URL \[Calc\]**](Calculated-Fields/README.md#experiment-name-url-calc) field. The link in this field should point to your Looker Studio report. Change the ID part between **/reporting/** and **/page/**.
	2. https://lookerstudio.google.com/reporting/CHANGE-THIS-ID/page/.
7. After you have connected all data sources to your tables, go back to the report. Refresh your browser to get the new data source connections.
8. You should now have a Looker Studio report showing your data.

## Data Sources

The following **Data Sources** are used by Looker Studio:

1. experiments
2. experiments_report
3. experiments_filters
4. experiments_images
5. experiments_links

## Calculated Fields

* [All Calculated Fields](Calculated-Fields) used in Looker Studio.