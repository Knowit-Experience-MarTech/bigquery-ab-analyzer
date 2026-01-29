# Google Sheet

Google Sheet is the backbone where you define and document your experiments. 

If you haven't done so already, do the following Google Sheet setup:

1. Create a folder in **Google Drive** for the **BigQuery A/B Analyzer** solution.
	1. Within that folder, create a **Images** folder.
		1. Change **sharing** on the **Images** folder to **Anyone on the Internet with the link can view**.
2. Copy the [**Google Sheet**](https://docs.google.com/spreadsheets/d/1ba5VPyk_huX3bclMY0w2jhFRuDQ5tVYyVEuLqVNpuCg/edit?usp=sharing) into the **BigQuery A/B Analyzer** folder.
	1. Go to the [**Settings** sheet](Settings-Sheet). Follow the setup there.

Almost everything is powered by **[Apps Script](Apps-Script)**.

## Sheets

### Experiments Sheet

* Only **add experiments** by using either button **Add Experiment**, or by selecting **Edit** checkbox and **Copy Experiment** button.
* Only **delete experiments** by selecting **Edit** checkbox, and **Delete Experiment** button.

<table>
  <caption>Experiment Configuration</caption>
  <thead>
    <tr>
      <th scope="col" style="text-align: left;">Column</th>
      <th scope="col" style="text-align: left;">Type</th>
      <th scope="col" style="text-align: left;">Example Value(s)</th>
      <th scope="col" style="text-align: left;">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th colspan="4" scope="colgroup">Basic Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">ID</th>
      <td>Number</td>
      <td>02</td>
      <td>ID is automatically generated when you <strong>Add Experiment</strong> or <strong>Copy Experiment</strong>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Date Start</th>
      <td>Date selector</td>
      <td>2025-08-01</td>
      <td>Date in the format YYYY-MM-DD.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Date End</th>
      <td>Date selector</td>
      <td>2025-08-31</td>
      <td>Date in the format YYYY-MM-DD.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Compare Dates</th>
      <td>Checkbox</td>
      <td>✔</td>
      <td>Makes it possible to do date comparison analysis. <strong>A</strong> is the previous period, while <strong>B</strong> is the recent period.<br><br><strong>Tip:</strong> Select <strong>Date Start</strong> and <strong>Date End</strong> for the recent period before you select <strong>Compare Dates</strong>. The previous period will then be calculated automatically.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Name</th>
      <td>Text</td>
      <td>Name of the experiment</td>
      <td>Give a meaningful name to the experiment.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Variant Name</th>
      <td>Text</td>
      <td>Variant A</td>
      <td>Give meaningful names to the variants.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Conversion Event</th>
      <td>Text</td>
      <td>purchase</td>
      <td>Name of the <strong>conversion event</strong>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Variant String</th>
      <td>Text</td>
      <td>^variant-a$</td>
      <td>Variant string matching using <strong>regex</strong> (<code>REGEXP_CONTAINS</code>).<br><br>Variant string is type-agnostic. If there’s no match for a string value, it will check an integer value, etc.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="3">Analyze</th>
      <td rowspan="3">Dropdown</td>
      <td>Yes</td>
      <td rowspan="3"><strong>Yes:</strong> The experiment will be analyzed; a scheduled query in BigQuery will be triggered.<br><br><strong>No:</strong> The experiment will not be analyzed.<br><br><strong>Update:</strong> Experiment name, variant names, description, links & images will be updated in BigQuery. Useful if you need to improve the documentation without running the analysis again.</td>
    </tr>
    <tr><td>No</td></tr>
    <tr><td>Update</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="2">Event Value Test</th>
      <td rowspan="2">Dropdown</td>
      <td>Yes</td>
      <td rowspan="2"><strong>Yes:</strong> The event value will be checked for statistical significance.</td>
    </tr>
    <tr><td>No</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="2">Hypothesis</th>
      <td rowspan="2">Dropdown</td>
      <td>Two-sided</td>
      <td rowspan="2">Choose whether you want a one-sided or two-sided hypothesis test. If you choose one-sided, no conclusive statement can be made if the conversion rate of B is lower than A.</td>
    </tr>
    <tr><td>One-sided</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="3">Confidence</th>
      <td rowspan="3">Dropdown</td>
      <td>95%</td>
      <td rowspan="3">Probability of rejecting the null hypothesis when it is false (1 − Type I error).</td>
    </tr>
    <tr><td>90%</td></tr>
    <tr><td>99%</td></tr>
    <tr>
      <th scope="row" style="text-align: left;">Description</th>
      <td>Text</td>
      <td>My awesome description</td>
      <td>Write a good description of the experiment.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Variant Parameter</th>
      <td>Text</td>
      <td><code>exp_variant_string</code></td>
      <td>Variant parameter for the experiment (e.g., <code>exp_variant_string</code>).<br><br>The parameter is scope-independent. It will first check an event-scoped key; if not found, it will check a user property (user-scoped).</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Value</th>
      <td>Text</td>
      <td><code>value</code></td>
      <td>The experiment’s value parameter (e.g., <code>value</code>). Must be filled out if <strong>Event Value Test</strong> = <strong>Yes</strong>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="4">User Overlap</th>
      <td rowspan="4">Dropdown</td>
      <td>Credit Both</td>
      <td rowspan="4">If a user could have seen both variants, choose how to handle this scenario. <strong>First Exposure</strong> credits the first variant seen. <strong>Last Exposure</strong> credits the last variant seen. <strong>Exclude</strong> removes such users from the analysis. <strong>Credit Both</strong> credits both variants.<br><br>For analysis of real A/B tests, use <strong>Exclude</strong> OR <strong>Credit Both</strong>.</td>
    </tr>
    <tr><td>First Exposure</td></tr>
    <tr><td>Last Exposure</td></tr>
    <tr><td>Exclude</td></tr>
    <tr>
      <th scope="row" style="text-align: left;">Related Links</th>
      <td>Text</td>
      <td>https://domain.com/some-relevant-link</td>
      <td>Links related to the analysis. Separate several links by new lines.<br><strong>Windows:</strong> <kbd>Ctrl</kbd>+<kbd>Enter</kbd> or <kbd>Alt</kbd>+<kbd>Enter</kbd>.<br><strong>Mac:</strong> <kbd>⌘</kbd>+<kbd>Return</kbd>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Image Documentation</th>
      <td>Text</td>
      <td>https://drive.google.com/file/d/ID/view?usp=sharing</td>
      <td>Store the images in the <strong>Images</strong> folder that you created, and paste image URLs for documentation here. Separate several images by new lines.<br><strong>Windows:</strong> <kbd>Ctrl</kbd>+<kbd>Enter</kbd> or <kbd>Alt</kbd>+<kbd>Enter</kbd>.<br><strong>Mac:</strong> <kbd>⌘</kbd>+<kbd>Return</kbd>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Edit</th>
      <td>Checkbox</td>
      <td>✔</td>
      <td>For deleting or copying experiments. Tick the checkbox for the experiment you want to delete/copy.</td>
    </tr>
    <tr>
      <th colspan="4" scope="colgroup">Advanced Settings</th>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="2">Scope</th>
      <td rowspan="2">Dropdown</td>
      <td>User</td>
      <td rowspan="2">Should the experiment be analyzed at user or session scope?</td>
    </tr>
    <tr><td>Session</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="3">Identifier</th>
      <td rowspan="3">Dropdown</td>
      <td><code>CLIENT_ID</code></td>
      <td rowspan="3">How should the user be identified? If <strong>USER_ID_ONLY</strong> or <strong>USER_ID_OR_CLIENT_ID</strong> is selected, session-scoped experiments are not possible.</td>
    </tr>
    <tr><td><code>USER_ID_ONLY</code></td></tr>
    <tr><td><code>USER_ID_OR_CLIENT_ID</code></td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="2">Variant Settings</th>
      <td rowspan="2">Dropdown</td>
      <td>Same</td>
      <td rowspan="2">Should settings be the same for both variants? If <strong>Different</strong> is chosen, the following can differ per variant: conversion event, experiment event name, experiment variant parameter, and filters.</td>
    </tr>
    <tr><td>Different</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="2">Filter Experiment</th>
      <td rowspan="2">Dropdown</td>
      <td>Yes</td>
      <td rowspan="2">If <strong>Yes</strong> is chosen, simple filtering (on a single criterion) becomes available.</td>
    </tr>
    <tr><td>No</td></tr>
    <tr>
      <th scope="row" style="text-align: left;">Advanced Filter</th>
      <td>Checkbox</td>
      <td>✔</td>
      <td>Turn on Advanced to combine multiple include/exclude filters. Advanced filtering is done in the <strong>Filters</strong> sheet.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="2">Filter Type</th>
      <td rowspan="2">Dropdown</td>
      <td>Include</td>
      <td rowspan="2">Include or exclude filter.</td>
    </tr>
    <tr><td>Exclude</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="3">Filter On Value</th>
      <td rowspan="3">Dropdown</td>
      <td>Both</td>
      <td rowspan="3">Filter on experiment (event), conversion event, or both. Mandatory if <strong>Filter Experiment</strong> is set to <strong>Yes</strong>.</td>
    </tr>
    <tr><td>Experiment</td></tr>
    <tr><td>Conversion</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="3">Filter Scope</th>
      <td rowspan="3">Dropdown</td>
      <td>Event</td>
      <td rowspan="3">Filter on <em>event</em>, <em>user property</em> scope (<code>event_params</code> or <code>user_properties</code>), or a BigQuery column (field name), e.g., <code>device.category</code>. Mandatory if <strong>Filter Experiment</strong> is set to <strong>Yes</strong>.</td>
    </tr>
    <tr><td>User</td></tr>
    <tr><td>Column</td></tr>
    <tr>
      <th scope="row" style="text-align: left;">Filter Field</th>
      <td>Text</td>
      <td><code>ga_session_number</code></td>
      <td>Parameter or column name from BigQuery (e.g., <code>ga_session_number</code>, <code>device.category</code>). Mandatory if <strong>Filter Experiment</strong> is set to <strong>Yes</strong>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Filter Value</th>
      <td>Text</td>
      <td>^desktop$</td>
      <td>Parameter value (regex via <code>REGEXP_CONTAINS</code>). Mandatory if <strong>Filter Experiment</strong> is set to <strong>Yes</strong>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Experiment Event Name</th>
      <td>Text</td>
      <td><code>experience_impression</code></td>
      <td>Name of the experiment event (e.g., <code>experience_impression</code>). For a Firebase experiment, use <code>firebase_exp_01</code>, where <code>01</code> is the experiment ID.</td>
    </tr>
  </tbody>
</table>


### Filters Sheet

Filters allow you to zoom in on specific segments (e.g., "Mobile Users Only").

* **Simple Filter (In-Row)**: Set Filter (Column R) to "Yes". Use columns T-X to define one rule (e.g., Include -> device.category -> mobile).
* **Advanced Filter (Separate Tab)**: Check the box in Column S (Adv. Filter). This opens the Filters sheet where you can stack multiple rules (AND logic) for complex segments.
	* If you have ticked the **Advanced Filter** for a experiment, filters for that experiment has to be edited in the **Filters** sheet.
	* If you add several filters to a experiment, they are queried as **AND**. Ex. Include parameter name with value AND Exclude parameter name with value.
	* To add a filter to a experiment, select a row for that experiment, and click on the button that fits your need (Add Include, Add Include (both Variants), Duplicate selected filter, (Add Exclude, Add Exclude (both Variants).

<table>
  <caption>Filter Configuration</caption>
  <thead>
    <tr>
      <th scope="col">Column</th>
      <th scope="col">Type</th>
      <th scope="col">Value(s)</th>
      <th scope="col">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row" style="text-align: left;">ID</th>
      <td>Number</td>
      <td>1</td>
      <td><strong>ID</strong> of the experiment. Automatically inserted.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="2">Variant</th>
      <td rowspan="2">Dropdown</td>
      <td>A</td>
      <td rowspan="2">Variant in the experiment. Automatically inserted.</td>
    </tr>
    <tr><td>B</td></tr>
    <tr>
      <th scope="row" style="text-align: left;">Enabled</th>
      <td>Checkbox</td>
      <td>✔</td>
      <td><strong>TRUE</strong>: Filter is enabled for analysis. <strong>FALSE</strong>: Filter will not be used in analysis.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="2">Filter Type</th>
      <td rowspan="2">Dropdown</td>
      <td>Include</td>
      <td rowspan="2">Choose whether to include or exclude matching data.</td>
    </tr>
    <tr><td>Exclude</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="3">Filter On Value</th>
      <td rowspan="3">Dropdown</td>
      <td>Both</td>
      <td rowspan="3">Filter on the experiment event, conversion event, or both.</td>
    </tr>
    <tr><td>Experiment</td></tr>
    <tr><td>Conversion</td></tr>
    <tr>
      <th scope="row" style="text-align: left;" rowspan="3">Filter Scope</th>
      <td rowspan="3">Dropdown</td>
      <td>Event</td>
      <td rowspan="3">Filter on <em>event</em>, <em>user property scope</em> (<code>event_params</code> or <code>user_properties</code>), or a BigQuery column (field name), e.g. <code>device.category</code>.</td>
    </tr>
    <tr><td>User</td></tr>
    <tr><td>Column</td></tr>
    <tr>
      <th scope="row" style="text-align: left;">Filter Field</th>
      <td>Text</td>
      <td><code>ga_session_number</code></td>
      <td>Parameter or column name from BigQuery, e.g. <code>ga_session_number</code> or <code>device.category</code>.</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Filter Value</th>
      <td>Text</td>
      <td><code>^desktop$</code></td>
      <td>Parameter value matching uses regex (<code>REGEXP_CONTAINS</code>).</td>
    </tr>
    <tr>
      <th scope="row" style="text-align: left;">Notes</th>
      <td>Text</td>
      <td>Added via button</td>
      <td>Notes about the filter. Notes are automatically generated but can be overwritten.</td>
    </tr>
  </tbody>
</table>

### Settings Sheet

* [Settings for the Google Sheet](Settings-Sheet). 

### Results Sheet

* Results of the analyzed experiments can be downloaded to the **Results** sheet.


