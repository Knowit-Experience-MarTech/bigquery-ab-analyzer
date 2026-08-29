# v2.22 - Gemini 3.5 Flash

* This upgrades the version from **v.2.21** to **v2.22**.
* In this version [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash?hl=en) is replaced by [Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash?hl=en).

## 1. BigQuery

Use the new sceduled queries. Changes to the queries are updated **fallback prompt** and **Generate AI narratives**.
If you want to make the changes manually yourself, the following sql is shown in 1.2 and 1.3 is new.

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
	3. In **(10) GENERATE AI NARRATIVES**, replace **your_project** with the name of your project.
5. [**PostHog** scheduled query](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_posthog.sql).
	1. In **declare events_table**, replace **your-project.posthog** with your project and data set.
	2. Replace 'region-eu' with 'region-us' if your data is in US.
	3. In **(10) GENERATE AI NARRATIVES**, replace **your_project** with the name of your project.


### 1.1 Setup Query for connecting to Gemini 3.5 Flash

Run this once in your BigQuery editor (adjusting your project/dataset/location/connection names):

```sql
	create or replace model `your-dataset.bigquery_ab_analyzer.gemini_narrator` -- Replace "your-dataset" with correct dataset.
	remote with connection `your-dataset.eu.gemini_connection` -- Replace "your-dataset" with correct dataset. Replace "eu" with the location you are using.
	options (
		endpoint = 'gemini-3.5-flash' 
	);
```

### 1.2 AI Fallback Prompt

Find **if ai_prompt is null or ai_prompt = '' then**, and replace that section with the sql below.

```sql
	if ai_prompt is null or ai_prompt = '' then
      set ai_prompt = concat(
        'You are a senior CRO and data analytics consultant summarizing A/B test results for an executive dashboard.\n',
        'Write exactly two concise, highly structured paragraphs of professional prose separated by a single blank line. Do not use rule titles, bullet points, hyphens, or markdown headings.\n\n',
        'Paragraph 1 — Executive Decision & Statistical Summary:\n',
        '1. Lead immediately with a clear verdict: Declare the winning variant (or "Inconclusive/No Winner"), state whether it achieved the Required Confidence Level, and quote the exact conversion lift from "Conversion Details".\n',
        '2. Synthesize business impact: If monetary or mean values are present, evaluate whether the lift is driven by higher conversion volume, higher average order value, or both. Treat total value as a unitless scale metric (do not add currency symbols). Reference Conversion P-Value or Value P-Value explicitly without scientific notation.\n',
        '3. Decision & Horizon Check: Check sample size against {{TARGET_SAMPLE}} and "Estimated Days Remaining". If traffic is below target, warn of false-positive (peeking) risk and recommend letting the test run for the remaining days. If target is reached (0 days remaining), recommend closing the test. If underpowered (<1000 sample target), note the detection limitation.\n\n',
        'Paragraph 2 — Funnel & User Behavior Dynamics:\n',
        'If funnel journey data is provided:\n',
        '1. Journey Bottlenecks: Identify the step with the highest drop-off and explain specifically where and how the winning variant outperforms the control (e.g., superior top-of-funnel engagement vs. checkout completion).\n',
        '2. Behavioral Latency: Compare median vs. average step duration. If average time is substantially higher than median time, explicitly explain that a subset of users is delaying action (long-tail delay / return visits).\n',
        'If no funnel data is present, omit this second paragraph entirely.'
      );
    end if;
```

### 1.3 Generate AI narratives

Find **(10) GENERATE AI NARRATIVES**, and replace that section with the sql below.

```sql
	----------------------------------------------------------------------------
    -- (10) GENERATE AI NARRATIVES
    ----------------------------------------------------------------------------
    if ai_summary_activated then
      update `your_project.bigquery_ab_analyzer.experiments_report` dest
        set ai_summary = ai.ml_generate_text_llm_result
        from (
          select
            id,
            ml_generate_text_llm_result
          from ML.GENERATE_TEXT(
            model `your_project.bigquery_ab_analyzer.gemini_narrator`,
            (
              select 
                rep.id,
                concat(
                  replace(ai_prompt, '{{TARGET_SAMPLE}}', cast(coalesce(exp.ai_total_target_sample, 2000) as string)),
                  '\n\nDATA:\n',
                  'Experiment Name: ', coalesce(rep.experiment_name, 'N/A'), '. ',
                  'Hypothesis: ', coalesce(rep.hypothesis, 'N/A'), '. ',
                  '--- EXPERIMENT METADATA --- ',
                  'Required Confidence Level: ', coalesce(cast(rep.confidence_level as string), 'N/A'), '%. ',
                  'Is Date Comparison Analysis?: ', coalesce(cast(rep.date_comparison as string), 'N/A'), '. ',
                  'Days Running: ', coalesce(cast(date_diff(rep.date_end, rep.date_start, day) + 1 as string), 'N/A'), ' days. ',
                  'Target Sample Size: ', cast(coalesce(exp.ai_total_target_sample, 2000) as string), '. ',
                  'Estimated Days Remaining to hit Target: ', 
                    coalesce(cast(
                      ceil(
                        greatest(0, coalesce(exp.ai_total_target_sample, 2000) - (rep.test_a + rep.test_b)) 
                        / 
                        nullif((rep.test_a + rep.test_b) / (date_diff(rep.date_end, rep.date_start, day) + 1), 0)
                      ) 
                  as string), 'N/A'), ' days. ',
                  
                  '--- SAMPLE SIZE --- ',
                  'Variant A Traffic: ', coalesce(cast(rep.test_a as string), '0'), ', ',
                  'Variant B Traffic: ', coalesce(cast(rep.test_b as string), '0'), '. ',
                  '--- CONVERSION RATE --- ',
                  'Variant A Rate: ', coalesce(cast(rep.conv_rate_a as string), 'N/A'), ', ',
                  'Variant B Rate: ', coalesce(cast(rep.conv_rate_b as string), 'N/A'), ', ',
                  'Rate Significant?: ', coalesce(cast(rep.conv_significance as string), 'N/A'), ', ',
                  'Conversion Z-Score: ', coalesce(format('%.4f', rep.conv_z_score), 'N/A'), ', ',
                  'Conversion P-Value: ', coalesce(format('%.4f', rep.conv_p_value), 'N/A'), '. ',
                  'Conversion Details: ', coalesce(rep.conv_details, 'N/A'), '. ',
                  
                  '--- MEAN VALUE & TOTAL VALUE --- ',
                  'Variant A Total Value: ', coalesce(format('%.2f', rep.total_conversion_value_a), 'N/A'), ', ',
                  'Variant B Total Value: ', coalesce(format('%.2f', rep.total_conversion_value_b), 'N/A'), ', ',
                  'Variant A Mean Value: ', coalesce(format('%.2f', rep.mean_value_a), 'N/A'), ', ',
                  'Variant B Mean Value: ', coalesce(format('%.2f', rep.mean_value_b), 'N/A'), ', ',
                  'Value Significant?: ', coalesce(cast(rep.value_significance as string), 'N/A'), ', ',
                  'Value T-Value: ', coalesce(format('%.4f', rep.t_value), 'N/A'), ', ',
                  'Value P-Value: ', coalesce(format('%.4f', rep.value_p_value), 'N/A'), '. ',
                  'Value Details: ', coalesce(rep.value_details, 'N/A'), '.\n\n',
                  
                  '\n\n--- FUNNEL JOURNEY DATA ---\n',
                  coalesce(funnel.funnel_text, 'No funnel tracking activated for this test.')
                ) as prompt
              from `your_project.bigquery_ab_analyzer.experiments_report` rep
              join (
                select id, max(ai_total_target_sample) as ai_total_target_sample
                from `your_project.bigquery_ab_analyzer.experiments`
                where analyze_test = true group by id
              ) exp on rep.id = exp.id 
              left join (
                select 
                  id, 
                  string_agg(
                    format('Variant %s, Step %d (%s): %d users. Drop-off: %.1f%%. Median time: %.1f sec. Average time: %.1f sec.', 
                      variant, step_number, step_name, participants, 
                      coalesce(drop_off_rate_from_previous * 100, 0.0), 
                      coalesce(median_time_from_previous_sec, 0.0), 
                      coalesce(avg_time_from_previous_sec, 0.0)
                    ),
                    '\n' order by variant, step_number
                  ) as funnel_text
                from `your_project.bigquery_ab_analyzer.experiments_funnel_report`
                group by id
              ) funnel on rep.id = funnel.id
            ),
            struct(
              0.2 as temperature, 
              4096 as max_output_tokens,
              TRUE as flatten_json_output
            )
          )
        ) as ai
        where dest.id = ai.id;
```	
	
## 2. Google Sheet

#### 2.1 AI Prompt
With Gemini 3.5 Flash, the model has significantly stronger analytical synthesis and reasoning capabilities compared to earlier generations. Gemini 3.5 Flash can simply generate more actionable business insight.

This update is optional, but recommended. In Settings Sheet, replace **AI Prompt** with the prompt below:

>You are a senior CRO and data analytics consultant summarizing A/B test results for an executive dashboard.\
>Write exactly two concise, highly structured paragraphs of professional prose separated by a single blank line. Do not use rule titles, bullet points, hyphens, or markdown headings.
>
>Paragraph 1 - Executive Decision & Statistical Summary:\
>1\. Lead immediately with a clear verdict: Declare the winning variant (or "Inconclusive/No Winner"), state whether it achieved the Required Confidence Level, and quote the exact conversion lift from "Conversion Details".\
>2\. Synthesize business impact: If monetary or mean values are present, evaluate whether the lift is driven by higher conversion volume, higher average order value, or both. Treat total value as a unitless scale metric (do not add currency symbols). Reference Conversion P-Value or Value P-Value explicitly without scientific notation.\
>3\. Decision & Horizon Check: Check sample size against {{TARGET_SAMPLE}} and "Estimated Days Remaining". If traffic is below target, warn of false-positive (peeking) risk and recommend letting the test run for the remaining days. If target is reached (0 days remaining), recommend closing the test. If underpowered (<1000 sample target), note the detection limitation.
>
>Paragraph 2 - Funnel & User Behavior Dynamics:\
>If funnel journey data is provided:\
>1\. Journey Bottlenecks: Identify the step with the highest drop-off and explain specifically where and how the winning variant outperforms the control (e.g., superior top-of-funnel engagement vs. checkout completion).\
>2\. Behavioral Latency: Compare median vs. average step duration. If average time is substantially higher than median time, explicitly explain that a subset of users is delaying action (long-tail delay / return visits).\
>If no funnel data is present, omit this second paragraph entirely.

#### 2.2 Version

* When you have made all the updates, change **Version** in the **About** section to **v2.23**.
