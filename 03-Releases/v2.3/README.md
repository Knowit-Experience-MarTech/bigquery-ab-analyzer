# v2.3 - Improved funnel filtering

* This upgrades the version to **v2.3**.
* In this version funnel filtering is improved.
	* Supports **multiple filters** per funnel step.
	* Supports **item scoped** filtering.

## 1. BigQuery

Use the new sceduled query.


1. [**Google Analytics 4** scheduled query](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4.sql).
	1. Replace **your_project** with the name of your project.
	2. Replace **analytics_XXX** with your GA4 data set.
2. [**GA4Dataform** scheduled query](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4dataform.sql).
	1. Replace **your_project** with the name of your project.
	2. Replace **analytics_XXX** with your GA4 data set.
	3. Replace 'region-eu' with 'region-us' if your data is in US.
3. [**Amplitude** scheduled query](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_amplitude.sql).
	1. In **declare events_table**, replace **your_project.your_dataset.deduplicated_EVENTS_1234** with your project, data set and deduplicated table function.
	2. Replace **your_project** with the name of your project.
	3. Replace 'region-eu' with 'region-us' if your data is in US.
4. [**Mixpanel** scheduled query](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_mixpanel.sql).
	1. In **declare events_table**, replace **your-project.mixpanel** with your project and data set.
	2. Replace 'region-eu' with 'region-us' if your data is in US.
5. [**PostHog** scheduled query](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_posthog.sql).
	1. In **declare events_table**, replace **your-project.posthog** with your project and data set.
	2. Replace 'region-eu' with 'region-us' if your data is in US.


## 2. Google Sheet

Either use latest version of the Google Sheet, or replace the apps script below.

* [Google Sheet - BigQuery A/B Analyzer - v2.3](https://docs.google.com/spreadsheets/d/1s7gXuAao0mOoRl0gDmeqMincb4lolLhP1QM6iUU9lvU/edit?usp=sharing)

### 2.1 Apps Script

The following Apps Script must be replaced in Google Sheet:

* [01_Generic.gs](../../01-Documentation/Google-Sheet/Apps-Script/01_Generic.gs)
* [02_Filters.gs](../../01-Documentation/Google-Sheet/Apps-Script/02_Filters.gs)
* [03_BigQuery_Upload.gs](../../01-Documentation/Google-Sheet/Apps-Script/03_BigQuery_Upload.gs)
* [06_Updates-Check.gs](../../01-Documentation/Google-Sheet/Apps-Script/06_Updates-Check.gs)
* [FunnelModal.html](../../01-Documentation/Google-Sheet/Apps-Script/FunnelModal.html)


#### 2.2 Version

* When you have made all the updates, change **Version** in the **About** section to **v2.3**.
