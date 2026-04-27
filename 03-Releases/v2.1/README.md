# 2.1 Funnel analysis for experiments

* This upgrades the version from **v.2.0** to **v2.1**.
* This upgrade makes it possible to do funnel analysis for each variant.

How to upgrade is described below.

## 1. Google Cloud

### 1.1 Update BigQuery Tables
* Copy [**Create-Tables-and-UDF.sql**](../../01-Documentation/Google-Cloud/01-BigQuery/Create-Tables-and-UDF.sql).
	* Set data set location (EU or US).
	* Replace "your_project" with your project.
	* Run Create-Tables-and-UDF.sql.

### 1.2 GA4

* Use the latest [BigQuery scheduled query for **GA4**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4.sql)

### 1.3 GA4Dataform

* Use the latest [BigQuery scheduled query for **GA4Dataform**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4dataform.sql)

### 1.4 PostHog

* Use the latest [BigQuery scheduled query for  **PostHog***](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_posthog.sql)

### 1.5 Amplitude

* Use the latest [BigQuery scheduled query for **Amplitude**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_amplitude.sql)
	
### 1.6 Mixpanel

* Use the latest [BigQuery scheduled query for **Mixpanel**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_mixpanel.sql)


## 2. Google Sheet

* Either make a copy of the [**new Google Sheet**](https://docs.google.com/spreadsheets/d/1AXOdyBnTem0ZVyaL0iPmcoeWXBh5lf-NO80CqtsdSE0/edit?usp=sharing) and use that, OR follow the instructions below.

### 2.1 Sheets

### 2.1.1 Funnels Sheet

1. Make a copy of the [**new Google Sheet**](https://docs.google.com/spreadsheets/d/1AXOdyBnTem0ZVyaL0iPmcoeWXBh5lf-NO80CqtsdSE0/edit?usp=sharing).
2. Copy the **Funnels** sheet to your existing sheet.
	* Delete the extra text Google Sheet added to the **Funnels** sheet name (e.g. **Copy of **).

### 2.1.2 Settings Sheet

1. Replace **AI Prompt**: <br/>
	> You are an automated data reporting system writing a formal summary for an executive dashboard. 
	> Write exactly 2 to 6 concise sentences summarizing the following A/B test results. Begin your output directly with the analytical summary. 
	>
	> Follow these rules strictly:<br/>
	> 1\. Winners & Significance: State if the test reached the Required Confidence Level. Declare the winner by explicitly quoting the findings in the "Conversion Details" or "Value Details" fields (e.g., state exactly how much better the winner performed).<br/>
	> 2\. Business Impact: If the test involves a "Mean Value", state the Total Value driven by each variant to provide scale. Treat "Total Value" as a unitless number (DO NOT add currency symbols).<br/>
	> 3\. Formatting: When citing statistical evidence, explicitly state whether you are referring to the "Conversion P-Value" or the "Value P-Value". Do not use scientific notation. Do not mention any metrics marked as N/A.<br/>
	> 4\. Sample Size Warning: The required total target sample size for this test is {{TARGET_SAMPLE}}. If the combined Total Sample Size (Variant A + Variant B) is less than this target, you MUST warn the audience about the high risk of a "false positive" (Type 1 error).<br/>
	> 5\. Underpowered Warning: If the total target size is set very low (below 1000), warn the audience that the test may be underpowered to reliably detect meaningful differences.<br/>
	> 6\. Duration & Conclusion Strategy: Look at the "Estimated Days Remaining". <br/>
		> \- If it is 0 days: State that the target sample size has been met and recommend concluding the test. <br/>
		> \- If it is between 1 and 30 days: Recommend letting the test run for that specific number of days. <br/>
		> \- If it is greater than 30 days: DO NOT recommend letting it run. Instead, explicitly warn the audience that the site lacks sufficient daily traffic to reach statistical significance in a reasonable timeframe (under 30 days), and recommend either aborting the test or re-evaluating the traffic allocation strategy.<br/>
	> 7\. Funnel Bottlenecks: If "FUNNEL JOURNEY DATA" is provided, identify the specific step where the highest percentage of users drop off. Compare Variant A and Variant B to explain exactly WHERE the winning variant is outperforming the loser in the user journey.<br/>
	> 8\. Time Skew Analysis: If both "Median time" and "Average time" are provided for a funnel step, compare them. If the Average is significantly higher than the Median, explicitly state that a segment of users is delaying their action (e.g., leaving and returning later), creating a long-tail delay.<br/>
	> 9\. Output Structure: You MUST format your final response into exactly two paragraphs separated by a blank line. Paragraph 1: The main statistical summary. Paragraph 2: The Funnel & Time Skew analysis.
2. When you have made all the updates, change **Version** in the **About** section to **v2.1**.
	

### 2.2 Apps Script

1. In the Google Sheet menu, go to **Extensions -> Apps Script**.
2. Replace the following Apps Script:
	1. [**01_Generic.gs**](../../01-Documentation/Google-Sheet/Apps-Script/01_Generic.gs)
	2. [**03_BigQuery_Upload.gs**](../../01-Documentation/Google-Sheet/Apps-Script/03_BigQuery_Upload.gs)
	3. [**05_BigQuery_Results.gs**](../../01-Documentation/Google-Sheet/Apps-Script/05_BigQuery_Results.gs)
3. If [**07_Extra.gs**](../../01-Documentation/Google-Sheet/Apps-Script/07_Extra.gs) doesn't exist, create it. 
	1. Delete **empty function**.
	2. Add this function, and **Save**.
	```javascript
	/**
	* Inserts a new "Funnel" column at AC (Column 29).
	* Sets the header, adds an instructional Note, merges rows 2-by-2, and inserts checkboxes safely.
	*/
	function insertAndSetupFunnelColumn() {
	const ss = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = ss.getSheetByName("Experiments");
	if (!sheet) {
		SpreadsheetApp.getUi().alert("🚨 Sheet 'Experiments' not found!");
    return;
	}
	// AC is column 29
	const targetCol = 29; 
	// 1. Physically insert a new column. 
	// This pushes the old AC safely to the right (AD).
	sheet.insertColumnBefore(targetCol);
	// 2. Setup the Header (Row 5)
	const headerCell = sheet.getRange(5, targetCol);
	headerCell.setValue("Funnel")
            .setFontWeight("bold")
            .setHorizontalAlignment("center")
            .setVerticalAlignment("middle");       
	// Add the instructional hover Note
	headerCell.setNote('Tick checkbox to start creating a funnel.\n\nGo to "Funnels" Sheet after you have ticked the checkbox to complete the setup.');
	// Find the last row of the sheet (grabbing it after the insert ensures we get the right height)
	const lastRow = sheet.getLastRow();
	if (lastRow < 6) {
		ss.toast("Column inserted and Note added, but no experiment rows found to format.", "Notice", 5);
		return;
	}
	// 3. Loop through the experiments in 2-row chunks (6&7, 8&9, etc.)
	for (let r = 6; r <= lastRow; r += 2) {
		// Safety check: Don't merge if we hit a lone odd row at the very bottom
		if (r + 1 > lastRow) break; 
		const blockRange = sheet.getRange(r, targetCol, 2, 1);
		// Merge the 2 rows vertically
		blockRange.mergeVertically();
		// Insert the checkbox into the merged cell
		blockRange.insertCheckboxes();
		// Make it look pretty (centered perfectly in the 2-row block)
		blockRange.setHorizontalAlignment("center")
              .setVerticalAlignment("middle");
	}
	ss.toast("Funnel column safely inserted with instructional note!", "Success 🎉", 5);
	}
	```
	3. Run **insertAndSetupFunnelColumn** function.
	4. Check that **Funnels** column has been added to **Experiments** sheet.
	4. **Delete** the function, and **Save**.
	5. **Close** Apps Script.
	
## 3. Data Studio

1. **Reconnect the following Data Studio data sources**:
	1. experiments
	2. experiments_report
2. **Add data source**:
	1. experiments_funnel_report
3. **Add calculated field to experiments_report**:
	* **Field Name**: analyze_funnel \[Calc\]
	* **Field ID**: analyze_funnel_calc
	* **Formula**:
	  ```javascript
	  case when analyze_funnel then '✔' else '' end
	  ```
4. **Data Studio Dashboards**:
	1. Make a copy of the new [**BigQuery A/B Analyzer with Funnel**](https://datastudio.google.com/reporting/95605234-f17b-4b57-8079-6d90891f48e4) report.
		1. Either use this new dashboard, OR make the following changes described below to your existing dashboard.
	2. **BigQuery A/B Analyzer Overview**:
		1. (Optional): Replace **Compare Dates** column with **Funnel** (*analyze_funnel \[Calc\]* calculated field you made in Data Studio step 3).
	3. **BigQuery A/B Analyzer Result**:
		1. In the menu, go to **Page** -> **Current page settings** -> **Style**:
			1. Set **Height (px)** to **2350**.
		2. **Copy Funnels** from the *BigQuery A/B Analyzer with Funnel* report.
		3. **Paste Funnels** into your existing dashboard.