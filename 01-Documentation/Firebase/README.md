# Firebase A/B Testing

[Firebase A/B Testing](https://firebase.google.com/docs/ab-testing) experiments can be analyzed with the **BigQuery A/B Analyzer** when your Firebase/GA4 data is exported to BigQuery. This works with the **Google Analytics** and **GA4Dataform** scheduled queries.

## 1. How Firebase experiments are stored in BigQuery

Firebase doesn't send an "experiment" event. Instead, Firebase sets a **user property** on the user when the user is part of an experiment:

* **Key:** `firebase_exp_N`, where `N` is the experiment number, e.g. `firebase_exp_12`.
* **Value:** The variant number. `0` is the **baseline** (control), `1` is the first variant, `2` the second variant etc.

The user property is added to **every event** from the user after the user has joined the experiment. The first event with the user property is therefore the first exposure.

See also [Firebase: Export A/B Testing data to BigQuery](https://firebase.google.com/docs/ab-testing/bigquery).

### 1.1 Find your experiment number

Run this query in BigQuery to list the Firebase experiments in your data. Replace **your_project** and **analytics_XXX** with your project and GA4 data set.

```sql
select
  up.key as experiment,
  coalesce(up.value.string_value, cast(up.value.int_value as string)) as variant,
  min(parse_date('%Y%m%d', event_date)) as first_seen,
  max(parse_date('%Y%m%d', event_date)) as last_seen,
  count(distinct user_pseudo_id) as users
from `your_project.analytics_XXX.events_*`, unnest(user_properties) up
where _table_suffix between format_date('%Y%m%d', date_sub(current_date(), interval 30 day))
                        and format_date('%Y%m%d', current_date())
  and starts_with(up.key, 'firebase_exp_')
group by 1, 2
order by 1, 2
```

The result shows each experiment, its variants, the dates the experiment was seen, and the number of users in each variant.

## 2. Set up the experiment in the Google Sheet

There are 2 ways to set up a Firebase experiment in the **Experiments** sheet.

### 2.1 All users in the experiment (recommended)

Every user that Firebase put in the experiment is counted, from the first event with the user property.

<table>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Column</th>
      <th scope="col" style="text-align: left;">Variant A</th>
      <th scope="col" style="text-align: left;">Variant B</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Event Name</th>
      <td><code>firebase_exp_12</code></td>
      <td><code>firebase_exp_12</code></td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Variant String</th>
      <td><code>^0$</code> (baseline)</td>
      <td><code>^1$</code></td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Variant Parameter</th>
      <td colspan="2">Not used. The variant is read from the <code>firebase_exp_12</code> user property.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Date Start / Date End</th>
      <td colspan="2">The dates the experiment was running.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Conversion Event</th>
      <td colspan="2">The goal of the experiment, e.g. <code>purchase</code>.</td>
    </tr>
  </tbody>
</table>

### 2.2 Only users who saw a specific event

If you only want to count users when they reached the part of the app that was tested, use that event as the experiment event, and the Firebase user property as the variant parameter.

<table>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Column</th>
      <th scope="col" style="text-align: left;">Variant A</th>
      <th scope="col" style="text-align: left;">Variant B</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Event Name</th>
      <td colspan="2">The event, e.g. <code>screen_view</code>. Add a filter if needed, e.g. <code>firebase_screen</code> = <code>^checkout$</code>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Variant Parameter</th>
      <td colspan="2"><code>firebase_exp_12</code></td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Variant String</th>
      <td><code>^0$</code> (baseline)</td>
      <td><code>^1$</code></td>
    </tr>
  </tbody>
</table>

### 2.3 Other settings

* **Scope:** **User**. Firebase puts a user (app instance) in one variant for the whole experiment.
* **Identifier:** **CLIENT_ID** is recommended. In Firebase data this is `user_pseudo_id`, the app instance ID.
* **User Overlap:** Firebase keeps a user in the same variant, so overlap is rare. **First Exposure** is fine.
* **Experiments with more than 2 variants:** Analyze one variant against the baseline at a time, e.g. `^0$` vs. `^2$`. See [FAQ: Can I analyse A/B/C?](../../README.md#136-can-i-analyse-abc)
* **Uneven traffic split:** If the variants in Firebase don't have the same share of users, change `srm_expected_share_b` in the scheduled query, or the Sample Ratio Mismatch check will show a warning.

## 3. GA4Dataform

GA4Dataform only has the user properties that are added to the GA4Dataform configuration. Before you analyze a Firebase experiment:

1. Add `firebase_exp_N` (e.g. `firebase_exp_12`) as a **custom user property** in the GA4Dataform configuration.
2. Run GA4Dataform again, so the `user_properties.firebase_exp_12` column is filled.

If the user property is missing, the scheduled query stops with a message telling you which user property to add.

## 4. Pre-Test Calculator

Use the Firebase user property as **Experiment Event** (e.g. `firebase_exp_12`) to find the traffic and conversion rate of the users in a running or previous experiment. You can also use it as **Experiment Parameter** together with another event, the same way as in [chapter 2.2](#22-only-users-who-saw-a-specific-event).

## 5. Why are the results different from the Firebase console?

The Firebase console uses its own (Bayesian) analysis and its own definition of users and goals. The **BigQuery A/B Analyzer** uses frequentist tests on the raw BigQuery data, with your own filters, conversion events and dates. The numbers will therefore not be exactly the same.
