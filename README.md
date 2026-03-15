# BigQuery A/B Analyzer

## 1. Overview

A scalable, configuration-driven framework for running rigorous A/B analysis directly on BigQuery data.

The **BigQuery A/B Analyzer** decouples experiment definition from execution. It allows analysts and product owners to run sophisticated statistical analyses on millions of rows without writing a single line of SQL.

The framework supports the following tools:
* [Google Analytics](https://marketingplatform.google.com/about/analytics/) (GA4)
	* [Firebase](https://firebase.google.com/docs/ab-testing/bigquery)
 		* Supports Firebase experiment structure in BigQuery.
* [GA4Dataform](https://ga4dataform.com/) by Superform Labs
	* Flattened GA4 tables that are faster and more affordable to query.
* [Amplitude](https://www.amplitude.com/)
* [Mixpanel](https://mixpanel.com/home/)
* [PostHog](https://posthog.com/)

The solution is built around **Google Sheet**, **BigQuery**, **Vertex AI** and **Looker Studio**.

<img src="02-Images/bigqery-ab-analyzer-google-sheet-experiments.png" alt="BigQuery A/B Analyzer - Google Sheet Experiments Tab" />

## 2. Getting Started

1. Setup:
	1. [Google Cloud](01-Documentation/Google-Cloud)
		* [AI Summary](01-Documentation/Google-Cloud/03-AI-Summary) (Optional)
	2. [Settings sheet](01-Documentation/Google-Sheet/Settings-Sheet)
2. [Documentation / using the Google Sheet solution](01-Documentation)
3. [Looker Studio / presenting results](01-Documentation/Looker-Studio)

## 3. Upgrading
* [2.0 is latest version](../../releases/tag/v2.0).

## 4. The "Backbone": Configuration-Driven Architecture

The backbone of the system is the **Experiments Google Sheet**, which acts as a centralized registry.

* **Dynamic Scope**: You can define experiments based on URL patterns (regex) or specific event parameters or user properties.
* **Statistical Rigor**: You define the confidence level (e.g., 95% or 99%) and hypothesis type (One-sided vs. Two-sided) directly in the sheet.
* **Metrics on Demand**: You can switch between analyzing conversion rates (User X did Y) or continuous values (User X spent $Y) simply by changing a dropdown.

## 5. Key Technical Capabilities

The solution includes advanced data cleaning and filtering features.

### Filters: The "Precision Lens"

The Filters feature allows you to move beyond monolithic data by isolating specific user segments or behavior patterns directly from the spreadsheet.

* **Segmented Analysis**: Zoom in on specific audiences by including or excluding users based on device, geography, or traffic source (e.g., "Only count Mobile users").
* **Nested Ecommerce Deep-Dives**: You can filter by eg. <code>items.item_id</code>, <code>items.item_category</code>, or <code>items.item_brand</code> to see if a variant specifically boosted the conversion rate of a particular product or category. 
* **Flexible Logic**: Supports both Event and User scopes, utilizing Regex for sophisticated matching (e.g., "Exclude customer type A" or "Include only specific sub-domains").
* **No Re-Coding Necessary**: Stakeholders can pivot from a site-wide analysis to a product-specific deep dive instantly, simply by updating a row in the configuration.

<img src="02-Images/bigqery-ab-analyzer-google-sheet-advanced-filters.png" alt="BigQuery A/B Analyzer - Google Sheet Advanced Filters Tab" />

### User Overlap: The "Quality Control" Referee

Since this framework can analyze "natural" experiments, users might occasionally see both Version A and B.

* **The Logic**: Identifies "confused" users and applies a strict rule set to disqualify them, ensuring your results are statistically pure and free of noise.
	* **Exclude**: Remove them entirely (Scientific purity).
	* **Credit Both**: Useful for time-period comparisons.
	* **First/Last Exposure**: Attribute them to the first or last version they saw.

### Metric Flexibility: Beyond Simple Conversion Rates

Most A/B testing tools force you into a binary world: a user either converted or they didn't. But for many products, the *volume* of engagement could matter just as much as the *act* of engagement.

This solution allows you to toggle between three distinct counting methods:

1. **User Conversion Rate (Standard)**:
	* *Question*: "What % of distinct users performed the action?"
	* *Math*: Capped at 100%. (1 User = 1 Conversion, even if they clicked 10 times).
	* *Best for*: Sign-ups, subscriptions.
2. **Session Conversion Rate**:
	* *Question*: "In what % of sessions did this event occur?"
	* *Math*: Capped at 100% per session.
	* *Best for*: Landing page optimization, search usage.
3. **Total Event Rate (Count All Conversions)**:
	* *Question*: "How many times did this action happen *per user*?"
	* In this mode, the result is an **Event Rate**, not a probability. It could be perfectly normal to see a rate of 150%. This simply means the average user performed the action 1.5 times.
	* *Math*: The solution switches statistical gears here. Instead of a standard Z-test for proportions, it uses a **Z-Test for Poisson Rates** to accurately compare the intensity of user behavior, not just the presence of it.
	* *Best for*: Media consumption (Videos watched per user), E-commerce (Items added to cart), or Gaming (Levels played).
	
#### Why this distinction is critical

If you only measure "Did they click?", you might miss a huge win.

* **Scenario**: Variant A and Variant B both have 50% of users clicking "Play".
	* *Standard Tool Result*: "No Difference".
* **Reality**: In Variant B, those users watched 5 videos each, whereas in Variant A they only watched 1.
	* *This Solution's Result*: "Variant B has a 400% higher Event Rate per User".

### User Flexibility: You define what a user is

The framework supports 4 different methods for identifying/analysing users:

1. **DEVICE_ID**: Default method for the select tool to count and identify users. Ex. **GA Client ID**.
2. **USER_ID**: Your own identifier with individual users Ex. **GA User-ID feature**.
3. **USER_ID_OR_DEVICE_ID**: Uses User ID if it exists, if not it fallbacks to Device ID.
4. **EXP_DEVICE_ID**: Bring your own ID, ex. Cookie ID from the A/B test tool. Full name: Experience Device ID.

### Your Personal Analyst: AI Summary

* **AI Summary** is powered by [**Gemini**](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models). Gemini is interpreting the test, and summarises the result with recommendations.
* Gemini is only interpreting the result, so the size of the data analysed will not affect the cost.
* AI Prompt can be edited in Google Sheet.
* AI Summary functionality is optional.

## 6. The Statistical Engine (Calculation Method)

This is where the "magic" happens. The solution does not just count clicks; it uses a set of custom **User Defined Functions** (UDFs) in BigQuery to determine mathematical certainty based on the data type.

1. **For User Conversion (Proportions)**
	* *Method*: [Two-Proportion Z-Test](https://en.wikipedia.org/wiki/Two-proportion_Z-test) (Pooled Variance). Chosen for its objectivity and efficiency at Big Data scale. It provides clear P-values without the computational overhead of Bayesian simulations.
	* *Use Case*: Answering "Did more people sign up?" (Yes/No metrics).
	* *How it works*: Used when Scope = USER or SESSION. It calculates a Z-score to measure the difference between two probabilities, strictly capped at 100%.
2. **For Event Frequency (Intensity)**
	* *Method*: [Z-Test for Poisson Rates](https://www.statsdirect.com/help/rates/compare_crude_incidence_rates.htm) (using Log-Linear approximation).
	* *Use Case*: Answering "Did users watch more videos?" or "Did they add more items to the cart?"
	* *How it works*: Used when Scope = EVENT and  metrics can exceed 100% (e.g., 2.5 plays per user). The Incidence Rate Ratio method is specifically designed for Count Data (Poisson-like distributions) to accurately compare the intensity of user behavior.
3. **For Continuous Metrics (Values)**
	* *Method*: [Welch’s t-test](https://en.wikipedia.org/wiki/Welch%27s_t-test).
	* *Use Case*: Answering "Did users spend more money?" or "Did page load time decrease?"
	* *Why Welch's?* Standard t-tests assume both groups have the same variance (spread). In real user data, this is rarely true (e.g., a few "whales" spend a lot). Welch’s t-test is designed to be reliable even when groups have unequal variances and unequal sample sizes.

### Automatic Significance Detection 

Every time you run the analysis, the system outputs a clear verdict:

* <span style="color:green">SIGNIFICANT</span>: The difference is real; you can trust it.
* <span style="color:red">NOT_SIGNIFICANT</span>: The difference could be due to luck; do not make a decision yet.
* NOT_EVALUATED: Insufficient data to make a call.

## 7. Reporting

Analysed data can either be downloaded to the Google Sheet, or shown in a Looker Studio dashboard. 

The Looker Studio dashboard is designed to answer "Who won?" at a glance.

<img src="02-Images/bigqery-ab-analyzer-looker-studio-report.png" alt="BigQuery A/B Analyzer Looker Studio report" />

## 8. Query Information
Before running a massive historical analysis, you can toggle the **Query Information** feature. Run a 1-day sample to see the estimated size and cost, ensuring no BigQuery billing surprises.

<img src="02-Images/bigqery-ab-analyzer-google-sheet-query-information.png" alt="BigQuery A/B Analyzer - Google Sheet Query Information Tab" />

## 9. Pre-Test Calculator

The Pre-Test Calculator is a planning tool for A/B testing. Before building or launching an experiment, this tool answers the question: "*Do we have enough traffic to actually test this?*"

<img src="02-Images/bigquery-ab-analyzer-pre-test-calculator-confirm.png" alt="BigQuery A/B Analyzer - Pre-Test Calculator - Confirm" />
<img src="02-Images/bigquery-ab-analyzer-pre-test-calculator-result.png" alt="BigQuery A/B Analyzer - Pre-Test Calculator - Result" />

By looking at historical BigQuery data, it calculates current baseline metrics and predicts how long the test needs to run to reach statistical significance. This information can also be used to inform AI Summary about the Sample Size that should be used in the evaluation of the analysis.

## 10. Analysis vs. Orchestration

This solution is a statistical analysis engine, not a traffic splitting tool.

* **What it DOES NOT do**: It does not randomize users or serve different content versions on your website/app. You must use an existing mechanism (e.g., Firebase Remote Config, Optimizely, Kameleoon, Conductrics, GrowthBook or other solutions for A/B testing) if you want to orchestrate a controlled split.
* **What it DOES do**: It acts as a universal statistical layer for your analytics. It can analyze almost any event or user segment in GA4, Firebase, GA4Dataform, Amplitude, Mixpanel or PostHog against statistical significance. Whether you are validating a formal A/B test, comparing time periods, or analyzing natural user cohorts, it ensures your insights are backed by rigorous math.

## 11. Setup

Image below illustrates the setup.

<img src="02-Images/bigquery-ab-analyzer-setup.png" alt="BigQuery A/B Analyzer - Setup" />

## 12. Prerequisites

* Access to BigQuery and your raw event data.
* Basic understanding of your event parameters.
* Ability to write simple Regular Expressions (Regex).
* *SQL competence is NOT required*.

## 13. FAQ

### 13.1. Can I "peek" at the results before the test is finished?
**Technically, yes, but proceed with caution**. Because this framework uses a **Fixed-Horizon** Frequentist model (Z-test), looking at the results daily and stopping the moment you see "Significant" increases the risk of a **False Positive** ([Type 1 error](https://en.wikipedia.org/wiki/Type_I_and_type_II_errors)). If you need to make a decision early, ensure you have reached your **Minimum Detectable Effect (MDE)** or a sufficient sample size first. Use the **Pre-Test Calculator** to figure out the sample size.

### 13.2. How do I know when the sample size is "enough"?
Statistical significance alone isn't a "stop" sign. You should define your target sample size before you run the analysis using **Pre-Test Calculator**.

* **Small changes** require many users.
* **Big changes** (e.g., a completely new UI) require fewer. This solution provides the mathematical confidence, but we recommend using a "Fixed Horizon". “Fixed horizon” means either a specific sample size or a specific duration.
* If you activate **AI Summary**, you set **Total target sample** in the **Settings** sheet. Then AI may use this information in the recommendation.

### 13.3. Why doesn’t this solution use Bayesian "Probability of Winning"?
Bayesian models are good for storytelling ("There is a 92% chance B is better than A"), but they are computationally expensive to run in a data warehouse. The **Two-Proportion Z-Test** was chosen because it is statistically equivalent for making business decisions while being much faster to compute in BigQuery. It allows you to analyze massive datasets without the "cost-creep" associated with more complex simulations.

### 13.4. What if the result is "NOT_SIGNIFICANT"?
This doesn't mean the test failed! It means that, based on the current data, the difference between Version A and Version B is too small to distinguish from random noise. You should either:

* Continue the test to gather more data (if you haven't reached your sample size).
* Declare a "Draw" and move on to the next hypothesis.

### 13.5. Can other tools be supported?
If the tool is having the same event data model as the already supported tools, and can export data to BigQuery, the tool can be supported.
However, since the BigQuery schema will be different, the following have to be adapted:
* **BigQuery**
	* [BigQuery Scheduled Query](01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries)
* **Apps Script**
	* [01_Generic.gs](01-Documentation/Google-Sheet/Apps-Script/01_Generic.gs)
	* [04_BigQuery_Download.gs](01-Documentation/Google-Sheet/Apps-Script/04_BigQuery_Download.gs)
	* [05_BigQuery-Results.gs](01-Documentation/Google-Sheet/Apps-Script/05_BigQuery-Results.gs)

### 13.6. Can I analyse A/B/C?
This framework only support analysis of 2 variants.

If you need to analyse more than 2 variants, you must do this as individual analysis:

* A vs. B
* A vs. C
* B vs. C
	
## 14. Summary of Benefits

* **Democratized access**: Define tests in a Google Sheet, not in SQL. Share the results in Looker Studio.
* **Standardized math**: Consistent statistical methods
* **Scalable execution**: Analyze many experiments without rewriting queries
* **Flexible metrics**: Conversion, session rates, event intensity, continuous values
* **Better data hygiene**: Overlap handling + filters built in
* **Works with your stack**: GA4, Firebase, GA4Dataform, Amplitude, Mixpanel, PostHog
* **Cost control**: No BigQuery cost surprises
* **Pre-Test Calculator**: Do we have enough traffic to actually test this?
* **Doesn’t try to replace** managed experimentation platforms - just complements them

Solution by [**Eivind Savio**](https://www.savio.no/analytics/bigquery-ab-analyzer) from [**Knowit AI & Analytics**](https://www.knowit.no/hva-vi-tilbyr/merkevare-og-markedsforing/maling-og-dataanalyse/). Not officially supported by Knowit AI & Analytics.
