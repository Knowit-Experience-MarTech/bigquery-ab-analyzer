# v2.41 - Firebase A/B Testing fixes

* This upgrades the version from **v2.4** to **v2.41**.
* In this version analysis of **Firebase A/B Testing** experiments is fixed.
	* Firebase stores the experiment as a user property (`firebase_exp_N`). The variant was only read from event parameters, so Firebase experiments returned no results.
	* The **Pre-Test Calculator** looked for an event named `firebase_exp_N`, and returned no results for Firebase experiments.
* Variants stored as numbers (e.g. 0, 1) are now supported, both in event parameters and user properties.
* **GA4Dataform** now supports Firebase experiments.

## 1. Firebase experiments

See the new documentation page [**Firebase A/B Testing**](../../01-Documentation/Firebase) for the full guide.

You can set up a Firebase experiment in 2 ways in the **Experiments** sheet:

* **Experiment Event** = `firebase_exp_N`, where `N` is the experiment ID. The first event with the user property counts as the exposure.
* **Experiment Event** = another event (e.g. `screen_view`), and **Experiment Variant Parameter** = `firebase_exp_N`.

Firebase numbers the variants **0** (baseline), **1**, **2** etc. Use `^0$`, `^1$` etc. as **Experiment Variant String**.

### 1.1 GA4Dataform

GA4Dataform only has user properties that are added to the GA4Dataform configuration. Add `firebase_exp_N` as a custom user property in GA4Dataform, and run GA4Dataform again before you analyze the experiment.

If the user property is missing, the scheduled query stops with a message telling you which user property to add.

## 2. BigQuery

Replace your scheduled query with the new version for your tool:

* [**Google Analytics 4**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4.sql)
* [**GA4Dataform**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4dataform.sql)

1. Replace **your_project** with the name of your project.
2. Go to [**Scheduled queries**](https://console.cloud.google.com/bigquery/scheduled-queries), open your existing scheduled query and click **Edit**.
3. Replace the SQL with the new SQL, and **Save**.

Amplitude, Mixpanel and PostHog are not changed in this version.

## 3. Google Sheet

Either use the latest version of the Google Sheet, or replace the Apps Script below.

* [Google Sheet - BigQuery A/B Analyzer - v2.41](https://docs.google.com/spreadsheets/d/1s7gXuAao0mOoRl0gDmeqMincb4lolLhP1QM6iUU9lvU/edit?usp=sharing)

### 3.1 Apps Script

The following Apps Script must be replaced in Google Sheet:

* [05_BigQuery-Results.gs](../../01-Documentation/Google-Sheet/Apps-Script/05_BigQuery-Results.gs)
	* **Pre-Test Calculator** supports Firebase experiments, and user properties as experiment parameter.
	* **Pre-Test Calculator** also works for data in single regions (e.g. europe-north1) when the query takes some time.

### 3.2 Version

* When you have made all the updates, change **Version** in the **About** section to **v2.41**.
