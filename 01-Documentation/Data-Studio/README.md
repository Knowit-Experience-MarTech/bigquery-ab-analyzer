# Data Studio

The Data Studio dashboard is designed to answer "Who won?" at a glance.

## Copy Data Studio

1. Make a copy of [**BigQuery A/B Analyzer**](https://datastudio.google.com/reporting/95605234-f17b-4b57-8079-6d90891f48e4)
2. Click on the 3 vertical dots available at the top right corner, then select "**Make a copy**"
3. Do not pay attention to the warnings (Sometimes the data source name is listed as 'unknown').
	1. Copy the report without creating any data sources.
4. After you have copied, all charts will display errors about insufficient permissions. That is OK.
5. In the Data Studio top menu, go to **Resource** -> **Manage added data sources**.
    1. Now connect each data source to **your BigQuery tables**.
	2. **Data Credentials** needs to be **Owner's Credentials**.
6. Edit the **experiments_report** data source.
	1. Edit the [**Experiment Name URL \[Calc\]**](Calculated-Fields/README.md#experiment-name-url-calc) field. The link in this field should point to your Data Studio report. Change the ID part between **/reporting/** and **/page/**.
	2. https://datastudio.google.com/reporting/CHANGE-THIS-ID/page/.
7. After you have connected all data sources to your tables, go back to the report. Refresh your browser to get the new data source connections.
8. You should now have a Data Studio report showing your data.

## Data Sources

The following **Data Sources** are used by Data Studio:

1. experiments
2. experiments_report
3. experiments_filters
4. experiments_images
5. experiments_links
6. experiments_funnel_report

## Warnings and Likely Range

The **experiments_report** data source has fields that are not shown in the report as default. These are recommended:

### Warnings

Shows a warning when the test assumptions do not hold (Credit Both, date comparison or Sample Ratio Mismatch). Most experiments have no warning, so the chart is only filled when there is something to warn about.

1. Add a **Table** with **method_warning** as the only dimension, and no metric.
2. Add a **filter** to the chart: **Exclude** where **method_warning** **Is Null**. Only rows with a warning are shown.
3. Hide the header, and style it as a note (e.g. yellow background). Place it under the Conversion Analysis and Event Value banners.

### Likely Range

Shows the likely range of the lift, next to Z-Score/P-Value and T-Value/P-Value.

1. Create the calculated fields [**Conversion Likely Range \[Calc\]**](Calculated-Fields/README.md#conversion-likely-range-calc) and [**Value Likely Range \[Calc\]**](Calculated-Fields/README.md#value-likely-range-calc).
2. Add a **Table** for each field, with the field as the only dimension. Each experiment has one row per variant with the same range, so the table shows one row.
3. Label it **Likely range**.

## Calculated Fields

* [All Calculated Fields](Calculated-Fields) used in Data Studio.