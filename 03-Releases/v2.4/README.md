# v2.4 - Statistics overhaul, sequential monitoring & item metrics

* This upgrades the version from **v2.31** to **v2.4**.
* This is a large release. The statistical engine has been reviewed and improved, so **results for existing experiments will change** when they are analyzed again. See [**What changes in your results**](#2-what-changes-in-your-results) before you upgrade.

## 1. What is new

### 1.1 Statistics

* **One observation per participant**: All tests now aggregate per participant (user or session) before testing. A user with 5 purchases is one participant with 5 conversions, not 5 independent observations.
* **Value per participant**: The value test now compares value per participant, where participants without a conversion count as 0. This answers *"Which variant brings in more value per user/session?"*, which is the business question in most A/B tests.
* **Count All Conversions**: The **Poisson rate test** is replaced by **Welch's t-test** on conversions per participant. The Poisson test assumed that every conversion is independent. In real data a few heavy users can create a significant result alone.
* **Sequential monitoring**: You can now check the results every day and stop the test as soon as it is **SIGNIFICANT**. The required p-value adjusts to how much of the **Total target sample** has been collected (O'Brien-Fleming boundary). Early in the test the bar is high, at the target sample it is close to the normal confidence level.
* **Likely range**: The lift is reported with a confidence interval (likely range) for both conversion rate and value. The likely range is used by the AI Summary and is available in BigQuery and Data Studio.
* **Sample Ratio Mismatch (SRM) check**: Checks if the traffic split between A and B is what you expect (50/50 as default). If the split is broken, the result should not be trusted.
* **Warnings**: A new **Warnings** column explains when the test assumptions do not hold: **Credit Both** (the groups are not independent), **date comparison** (the variants ran in different periods) and **Sample Ratio Mismatch**. The results are still calculated.
* **Small samples**: Welch's t-test now uses the Student t distribution instead of the normal distribution, which gives correct p-values for small samples.

### 1.2 Item metrics

You can now answer questions like *"Did variant B sell more items from category X, and did the item revenue increase?"*.

* Set **Experiment Value** to an item field, e.g. `items.quantity` or `items.item_revenue` (GA4 & GA4Dataform), `Products.price` (Amplitude), `Items.Price` (Mixpanel) or `products.price` (PostHog).
* Add an item filter on the **conversion event**, e.g. `items.item_category` = `^Shoes$`.
* Only items matching the item filter are counted. A basket with 1 pair of shoes and 3 shirts counts 1 item and the revenue of the shoes.
* GA4: If `item_revenue` is missing, `price × quantity` is used. Other tools: price fields are multiplied by quantity.

### 1.3 Source table & region from the Google Sheet

* The scheduled queries now read the **source project, data set and table** from the **Settings** sheet. You no longer have to edit the data set or table name in the scheduled query.
* The **BigQuery region** is read from **Data Set Location** in the **Settings** sheet.
* All tools (GA4, GA4Dataform, Amplitude, Mixpanel & PostHog) work the same way.

### 1.4 GA4: events_ or events_fresh_

GA4 360 properties can use the **Fresh Daily** export (`events_fresh_`) as source table. See [**FAQ: Should I use events_ or events_fresh_?**](../../README.md#137-should-i-use-events_-or-events_fresh_).

### 1.5 AI Summary

* New AI prompt that understands sequential monitoring, likely range, warnings and SRM.
* The AI is told exactly what the value measures (e.g. *"number of items, counting only items that match the item filters"*), so it doesn't assume that the value is revenue.
* The AI also gets **value per conversion**, so it can explain if a value lift comes from more conversions, bigger conversions or both.
* If Gemini rejects the request because of rate limits (*"Exceeded rate limits: too many concurrent queries that use ML.GENERATE_TEXT"*), the query tries again up to 3 times. If it still fails, the analysis is saved and the previous AI Summary is kept.

## 2. What changes in your results

When you analyze an existing experiment again:

* **Mean Value** is lower than before, because participants without a conversion now count as 0. Mean Value is now **Value per Participant**.
* **Count All Conversions** experiments may change from SIGNIFICANT to NOT_SIGNIFICANT if the lift came from a few heavy users.
* **Results before the target sample** may be NOT_SIGNIFICANT, even with a p-value below 0.05. The **Conv. Details** and **Value Details** text explains this, e.g. *"No significant difference (26% of target)."*

If you want the old behaviour, see the settings at the top of the scheduled query (chapter [3.2](#32-scheduled-query)).

## 3. BigQuery

### 3.1 Tables and functions

Run the new [**Create-Tables-and-UDF.sql**](../../01-Documentation/Google-Cloud/01-BigQuery/Create-Tables-and-UDF.sql) in BigQuery.

1. Replace **your_project** with the name of your project.
2. If your data is in US, replace **region-eu** with **region-us**, and **EU** with **US**.

It is safe to run on an existing installation. Existing tables and data are kept. The script:

* adds new columns to **experiments**, **settings** and **experiments_report**.
* creates or replaces the User Defined Functions. **6** functions are new.

These functions are no longer used. You can remove them by running the `drop function` statements at the end of the file (optional):

* `udf_t_statistic_value`
* `udf_p_value_value`
* `udf_rate_of_change`
* `udf_ab_rate_test`

### 3.2 Scheduled query

Replace your scheduled query with the new version for your tool.

* [**Google Analytics 4**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4.sql)
* [**GA4Dataform**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4dataform.sql)
* [**Amplitude**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_amplitude.sql)
* [**Mixpanel**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_mixpanel.sql)
* [**PostHog**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_posthog.sql)

1. Replace **your_project** with the name of your project. That is the only change needed.
	* Data set, table and region are no longer set in the query. They come from the **Settings** sheet.
	* If you have changed the suggested names for **data set** and **tables** in **Settings** sheet, you must also replace these.
2. Go to [**Scheduled queries**](https://console.cloud.google.com/bigquery/scheduled-queries), open your existing scheduled query and click **Edit**.
3. Replace the SQL with the new SQL, and **Save**.
	* Edit the existing scheduled query instead of creating a new one. Then the **config ID** used by the **Cloud Run** function stays the same.

#### Optional settings in the scheduled query

At the top of the query, in **(0) Declare top-level variables**, you will find these settings:

<table>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Setting</th>
      <th scope="col" style="text-align: left;">Default</th>
      <th scope="col" style="text-align: left;">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row" style="text-align: left;"><code>value_per_participant</code></th>
      <td>true</td>
      <td><strong>true:</strong> Value per participant (participants without a conversion count as 0).<br><strong>false:</strong> Value per converting participant (the old behaviour, closer to average order value).</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;"><code>sequential_monitoring</code></th>
      <td>true</td>
      <td><strong>true:</strong> Results are valid when you check them every day.<br><strong>false:</strong> Classic fixed horizon test. Only valid if you look at the results once, when the target sample is reached.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;"><code>srm_expected_share_b</code></th>
      <td>0.5</td>
      <td>Expected share of participants in variant B. Change it if your traffic split is not 50/50, e.g. 0.2 for a 80/20 split.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;"><code>default_target_sample</code></th>
      <td>2000</td>
      <td>Target sample used if the experiment has no <strong>Total target sample</strong>.</td>
    </tr>
  </tbody>
</table>

## 4. Google Sheet

Either use the latest version of the Google Sheet, or do the changes below.

* [Google Sheet - BigQuery A/B Analyzer - v2.4](https://docs.google.com/spreadsheets/d/1s7gXuAao0mOoRl0gDmeqMincb4lolLhP1QM6iUU9lvU/edit?usp=sharing)

### 4.1 Apps Script

The following Apps Script must be replaced in Google Sheet:

* [03_BigQuery_Upload.gs](../../01-Documentation/Google-Sheet/Apps-Script/03_BigQuery_Upload.gs)
	* Sends the source project, data set and table with every experiment.
	* Saves the BigQuery region to the **settings** table.
* [05_BigQuery-Results.gs](../../01-Documentation/Google-Sheet/Apps-Script/05_BigQuery-Results.gs)
	* Adds the **Warnings** column to the **Results** sheet.
	* Faster download and formatting of results.

### 4.2 Settings sheet

1. Check **Data Set Location**. It is now also used by the scheduled query (e.g. **EU**, **US** or **europe-west1**).
2. Check **BigQuery Data Set ID** and **BigQuery Table ID** for your analytics tool. **BigQuery Table ID** is now required for all tools.
	* **Google Analytics**: `events_`, or `events_fresh_` if you have the GA4 360 Fresh Daily export.
	* **GA4Dataform**: `ga4_events`
	* **Amplitude**: e.g. `EVENTS_123456`. The query adds the `deduplicated_` prefix itself.
	* **Mixpanel**: e.g. `mp_master_event`
	* **PostHog**: e.g. `events`
3. **GA4 only (optional)**: To use item metrics as **Experiment Value**, add `items\.` to **Include BigQuery Columns (Field Names)**, e.g. `^(?:device\.|geo\.|ecommerce\.|items\.|stream_id$|platform$)`. Then run **Get Data from BigQuery > Refresh Parameters**.
4. Replace **AI Prompt** with the new prompt in chapter [4.3](#43-ai-prompt).
5. Go to the menu **BigQuery A/B Analyzer > Settings > Export Settings**. This saves the region and the AI prompt to BigQuery.

### 4.3 AI Prompt

The prompt in the **Settings** sheet overrides the prompt in the scheduled query. Replace **AI Prompt** with the prompt below (recommended):

>You are a senior CRO and data analytics consultant summarizing A/B test results for an executive dashboard.\
>Write exactly two concise, highly structured paragraphs of professional prose separated by a single blank line. Do not use rule titles, bullet points, hyphens, or markdown headings.
>
>Paragraph 1 - Executive Decision & Statistical Summary:\
>1\. Lead immediately with a clear verdict: Declare the winning variant (or "Inconclusive/No Winner"), state whether it achieved the Required Confidence Level, and quote the exact conversion lift from "Conversion Details" together with the "Conversion Lift Confidence Interval" as its likely range.\
>2\. Synthesize business impact: "Value Metric" describes what the value measures; describe the value exactly that way and do not assume it is revenue, items or anything else. "Value per Participant" includes participants who did not convert and is the main business metric. Use "Value per Conversion" to explain whether a value lift comes from more conversions, bigger conversions, or both. Treat values as unitless (do not add currency symbols). Reference Conversion P-Value or Value P-Value explicitly without scientific notation.\
>3\. Decision & Horizon Check: If "Significance Method" is sequential monitoring, a SIGNIFICANT result is valid to act on even before {{TARGET_SAMPLE}} is reached, and the test can be closed. If a result is NOT_SIGNIFICANT and traffic is below target, recommend letting the test run for the "Estimated Days Remaining". If the target is reached and the result is still NOT_SIGNIFICANT, recommend closing the test as inconclusive. If "Significance Method" is fixed horizon and traffic is below target, warn of false-positive (peeking) risk instead. If underpowered (<1000 sample target), note the detection limitation.\
>4\. Caveats: If "Method Warnings" lists anything, state it plainly. If the Sample Ratio Mismatch Check is SRM_DETECTED, state that the results cannot be trusted until the traffic split is fixed, regardless of significance.
>
>Paragraph 2 - Funnel & User Behavior Dynamics:\
>If funnel journey data is provided:\
>1\. Journey Bottlenecks: Identify the step with the highest drop-off and explain specifically where and how the winning variant outperforms the control (e.g., superior top-of-funnel engagement vs. checkout completion).\
>2\. Behavioral Latency: Compare median vs. average step duration. If average time is substantially higher than median time, explicitly explain that a subset of users is delaying action (long-tail delay / return visits).\
>If no funnel data is present, omit this second paragraph entirely.

### 4.4 Total target sample

**Total target sample** (Column X in the **Experiments** sheet) is now also used by **sequential monitoring**, not only by AI Summary. Set it for every experiment you analyze.

* Use the **Pre-Test Calculator** to find the sample size, and add about **20%**. Sequential monitoring needs a slightly larger sample than a fixed horizon test to detect the same effect.
* If it is empty, **default_target_sample** (2000) in the scheduled query is used.

### 4.5 Analyze your experiments again

Experiments that were exported to BigQuery before the upgrade have no source table. Set **Analyze** to **Yes** and run **Analyze A/B Variants in BigQuery** again. If you don't, the scheduled query stops with the message *"Experiment X has no source table"*.

### 4.6 Version

* When you have made all the updates, change **Version** in the **About** section to **v2.4**.

## 5. Data Studio (optional)

### 5.1 Value per Conversion

Value per participant includes participants without a conversion. If you also want to show value per conversion (average order value), add this calculated field to the **experiments_report** data source:

* **Field Name:** Value per Conversion \[Calc\]
* **Field ID:** value_per_conversion_calc

```javascript
CASE
  WHEN variant = "A" AND conversion_a > 0 THEN total_conversion_value_a / conversion_a
  WHEN variant = "B" AND conversion_b > 0 THEN total_conversion_value_b / conversion_b
  ELSE NULL
END
```

### 5.2 Likely range

Add these calculated fields to the **experiments_report** data source, and show them next to Z-Score/P-Value and T-Value/P-Value. See [Data Studio: Likely Range](../../01-Documentation/Data-Studio/README.md#likely-range).

* **Field Name:** Conversion Likely Range \[Calc\]
* **Field ID:** conv_likely_range_calc

```javascript
CASE
  WHEN conv_lift_ci_low IS NULL THEN NULL
  ELSE CONCAT(
    CASE WHEN conv_lift_ci_low > 0 THEN "+" ELSE "" END,
    CAST(ROUND(conv_lift_ci_low * 100, 1) AS TEXT), "% to ",
    CASE WHEN conv_lift_ci_high > 0 THEN "+" ELSE "" END,
    CAST(ROUND(conv_lift_ci_high * 100, 1) AS TEXT), "%"
  )
END
```

* **Field Name:** Value Likely Range \[Calc\]
* **Field ID:** value_likely_range_calc

```javascript
CASE
  WHEN value_lift_ci_low IS NULL THEN NULL
  ELSE CONCAT(
    CASE WHEN value_lift_ci_low > 0 THEN "+" ELSE "" END,
    CAST(ROUND(value_lift_ci_low * 100, 1) AS TEXT), "% to ",
    CASE WHEN value_lift_ci_high > 0 THEN "+" ELSE "" END,
    CAST(ROUND(value_lift_ci_high * 100, 1) AS TEXT), "%"
  )
END
```

### 5.3 Warnings

Add a table with **method_warning**, filtered to only show rows where **method_warning** is not null. Most experiments have no warning, so the table is only filled when there is something to warn about. See [Data Studio: Warnings](../../01-Documentation/Data-Studio/README.md#warnings).

### 5.4 Mean Value label

If your report shows **Mean Value**, rename the label to **Value per Participant**.

### 5.5 New fields

Reconnect (refresh fields in) the **experiments_report** data source to get the new fields: `srm_p_value`, `srm_status`, `target_sample`, `information_fraction`, `sequential_alpha`, `conv_lift_ci_low`, `conv_lift_ci_high`, `value_lift_ci_low`, `value_lift_ci_high` and `method_warning`.
