# Added PostHog. AI Summary. Items filtering for Amplitude & Mixpanel

* All tools now support **Item / Product** filtering.
* **AI Summary** (optional) added to all tools.

How to upgrade is described below.

## 1. Google Cloud

### 1.1 Update BigQuery Tables
* To simplify future updates, this is added to [**Create-Tables-and-UDF.sql**](../../01-Documentation/Google-Cloud/01-BigQuery/Create-Tables-and-UDF.sql).
	* Run Create-Tables-and-UDF.sql.

### 1.2 GA4
* Added support for **AI Summary**.
	* Use the latest [BigQuery scheduled query for **GA4**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4.sql)

### 1.3 GA4Dataform
* Added support for **AI Summary**.
	* Use the latest [BigQuery scheduled query for **GA4Dataform**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_ga4dataform.sql)

### 1.4 PostHog
* PostHog is a new tool added to this framework.
	* To run analysis on **PostHog** BigQuery data, follow the [**Google Cloud / BigQuery setup documentation**](../../01-Documentation/Google-Cloud/)

### 1.5 Amplitude
* Added support for **Item / Product** filtering and **AI Summary**.
	* Use the latest [BigQuery scheduled query for **Amplitude**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_amplitude.sql)
	
### 1.6 Mixpanel
* Added support for **Item / Product** filtering and **AI Summary**.
	* Use the latest [BigQuery scheduled query for **Mixpanel**](../../01-Documentation/Google-Cloud/01-BigQuery/01-Scheduled-queries/bigquery_ab_analyzer_mixpanel.sql)

## 2. Looker Studio

* Reconnect Looker Studio to BigQuery.
* Add **AI Summary** to the **BigQuery A/B Analyzer Result** dashboard.

## 2. Google Sheet

* Either make a copy of the [**new Google Sheet**](https://docs.google.com/spreadsheets/d/1voZiTk-JD6OK9PDlGaqJh4CBOPwTbxWnnrhrZMy4-Q8/edit?usp=sharing) and use that, OR follow the instructions below.

### 3.1 Sheets

#### 3.1.1 Helper Sheet
1. Go to hidden Sheet "**Helper**"
2. Add "**PostHog**" in Column A
3. Rename **GA4 Dataform** to **GA4Dataform**
3. Hide Sheet "**Helper**"

#### 3.1.2 Results Sheet

1. Add Column **AC** and **AD**
2. Add the text "**Value A**" to **AC** header row.
3. Add the text "**Value B**" to **AD** header row.

#### 3.1.3 Settings Sheet

* **PostHog**:
	* Follow [**PostHog documentation**](../../01-Documentation/Google-Sheet/Settings-Sheet/README.md#posthog-settings) for **Settings** Sheet
* **GA4Dataform**:
	* If you are using GA4Dataform, make sure the **Analytics tool** dropdown is **GA4Dataform** (no spaces).
* **All tools**:
	* Make sure **Ecommerce Items Object Name** is filled out if you are going to do filtering on ecommerce items data.
	* Make sure **Activate AI Summary** is ticked if you want AI to summarize the result of the analysis.
		* Requires extra [setup in **Google Cloud**](../../01-Documentation/Google-Cloud/03-AI-Summary/).
* **Version**:
	* Change **Version** in row 29 to **v.2.0**

### 3.1.4 Calculator Sheet

1. Make a copy of the [**new Google Sheet**](https://docs.google.com/spreadsheets/d/1voZiTk-JD6OK9PDlGaqJh4CBOPwTbxWnnrhrZMy4-Q8/edit?usp=sharing).
2. Copy the **Calculator** sheet to the old sheet.

### 3.2 Apps Script

1. In the Google Sheet menu, go to **Extensions -> Apps Script**.
2. Replace the following Apps Script:
	1. [**01_Generic.gs**](../../01-Documentation/Google-Sheet/Apps-Script/01_Generic.gs)
	2. [**03_BigQuery_Upload.gs**](../../01-Documentation/Google-Sheet/Apps-Script/03_BigQuery_Upload.gs)
	3. [**04_BigQuery_Download.gs**](../../01-Documentation/Google-Sheet/Apps-Script/04_BigQuery_Download.gs)
3. If [**07_Extra.gs**](../../01-Documentation/Google-Sheet/Apps-Script/07_Extra.gs) doesn't exist, create it. 
	1. Delete **empty function**.
	2. Add this function, and **save**.
	```javascript
	function upgradeSpreadsheet() {
	const ss = SpreadsheetApp.getActiveSpreadsheet();
	// =========================================================================
	// PART 1 & 2: Upgrade "Settings" Sheet
	// =========================================================================
	const settingsSheet = ss.getSheetByName("Settings");
	if (!settingsSheet) {
    SpreadsheetApp.getUi().alert('Error: A sheet named "Settings" could not be found. Skipping Settings setup.');
	} else {
    // --- PART 1: Insert Ecommerce Items Object (Inserted first from the bottom) ---
    const targetRow17 = 17;
    const newRow18 = targetRow17 + 1; 
    settingsSheet.insertRowAfter(targetRow17);
    // Clear inherited rules/formats and apply base styling for row 18
    const row18Range = settingsSheet.getRange(newRow18, 1, 1, 3);
    row18Range.clearDataValidations().clearFormat();
    row18Range.setFontFamily("Calibri");
    row18Range.setFontSize(10);
    // Apply specific background colors
    settingsSheet.getRange(newRow18, 1).setBackground("#efefef"); // Col A: Light Grey 3
    settingsSheet.getRange(newRow18, 2).setBackground("#ffffff"); // Col B: White
    settingsSheet.getRange(newRow18, 3).setBackground("#efefef"); // Col C: Light Grey 3
    // Set values and named range
    settingsSheet.getRange(newRow18, 1).setValue("Ecommerce Items Object Name");
    settingsSheet.getRange(newRow18, 1).setFontWeight("bold");
    const cellB18 = settingsSheet.getRange(newRow18, 2);
    cellB18.setValue("items");
    ss.setNamedRange("SettingsItemsObject", cellB18);
    settingsSheet.getRange(newRow18, 3).setValue('If you are using a different tool than GA4, change "items" to match your ecommerce structure.');
    // --- PART 2: Insert AI Summary Settings ---
    const targetRow12 = 12;
    // Insert 4 rows after row 12 (Rows 13, 14, 15 and 16)
    settingsSheet.insertRowsAfter(targetRow12, 4);
    // Apply base styling to the whole 3x3 block
    const newRowsRange = settingsSheet.getRange(13, 1, 3, 3);
    newRowsRange.clearDataValidations().clearFormat();
    newRowsRange.setFontFamily("Calibri");
    newRowsRange.setFontSize(10); // Will override row 13 below
    newRowsRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
    // Apply backgrounds for rows 14 and 15 (Skipping row 13 as it gets a black background)
    settingsSheet.getRange(14, 1, 2, 1).setBackground("#efefef"); // Col A, Rows 14-15: Light Grey 3
    settingsSheet.getRange(14, 2, 2, 1).setBackground("#ffffff"); // Col B, Rows 14-15: White
    settingsSheet.getRange(14, 3, 2, 1).setBackground("#efefef"); // Col C, Rows 14-15: Light Grey 3
    // --- ROW 1 (Row 13) ---
    const row13Range = settingsSheet.getRange(13, 1, 1, 3);
    row13Range.merge();
    row13Range.setBackground("black");
    row13Range.setFontColor("white");
    row13Range.setFontSize(11);
    row13Range.setFontWeight("bold");
    row13Range.setHorizontalAlignment("left");
    settingsSheet.getRange(13, 1).setValue("AI Summary");
    // --- ROW 2 (Row 14) ---
    settingsSheet.getRange(14, 1).setValue("Activate AI Summary");
    settingsSheet.getRange(14, 1).setFontWeight("bold");
    const cellB14 = settingsSheet.getRange(14, 2);
    cellB14.setNumberFormat("");
    cellB14.insertCheckboxes(); 
    ss.setNamedRange("SettingsAISummary", cellB14);
    settingsSheet.getRange(14, 3).setValue("Optional. By ticking this box AI Summary will be activated for reporting in Looker Studio. Requires extra setup in GCP.");
    // --- ROW 3 (Row 15) ---
    settingsSheet.getRange(15, 1).setValue("Total target sample");
    settingsSheet.getRange(15, 1).setFontWeight("bold");
    const cellB15 = settingsSheet.getRange(15, 2);
    cellB15.setValue("2000"); 
    ss.setNamedRange("SettingsAITotalSampleSize", cellB15);
    settingsSheet.getRange(15, 3).setValue('Default Total target sample size. Used if Sample size from the experiment is missing.');
    // --- ROW 4 (Row 16) ---
    settingsSheet.getRange(16, 1).setValue('AI Prompt');
    settingsSheet.getRange(16, 1).setFontWeight('bold');
    const cellB16 = settingsSheet.getRange(16, 2);
    cellB16.setValue('You are an automated data reporting system writing a formal summary for an executive dashboard. Write exactly 2 to 6 concise sentences summarizing the following A/B test results. Begin your output directly with the analytical summary. Follow these rules strictly: 1. Winners & Significance: Mention if the test reached the Required Confidence Level for "Conversion Rate", "Mean Value", or both. State which variant is the winner, or if the test is inconclusive. 2. Business Impact: If the test involves a "Mean Value", state the Total Value driven by each variant. Treat "Total Value" as a unitless number (DO NOT add currency symbols). 3. Formatting: When citing statistical evidence, explicitly state whether you are referring to the "Conversion P-Value" or the "Value P-Value". Do not use scientific notation. Do not mention any metrics marked as N/A. 4. Sample Size Warning: The required total target sample size for this test is {{TARGET_SAMPLE}}. If the combined Total Sample Size (Variant A + Variant B) is less than this target, you MUST warn the audience about the high risk of a "false positive" (Type 1 error). 5. Underpowered Warning: If the total target size is set very low (below 1000), warn the audience that the test may be underpowered to reliably detect meaningful differences. 6. Duration & Conclusion Strategy: Look at the "Estimated Days Remaining". - If it is 0 days: State that the target sample size has been met and recommend concluding the test. - If it is between 1 and 30 days: Recommend letting the test run for that specific number of days. - If it is greater than 30 days: DO NOT recommend letting it run. Instead, explicitly warn the audience that the site lacks sufficient daily traffic to reach statistical significance in a reasonable timeframe (under 30 days), and recommend either aborting the test or re-evaluating the traffic allocation strategy.');
    ss.setNamedRange('SettingsAIPrompt', cellB16);
    settingsSheet.getRange(16, 3).setValue('Prompt that instructs AI how evaluate the result, and the tone used in the answer. {{TARGET_SAMPLE}} refers to Total target sample above.');
	}
	// =========================================================================
	// PART 3: Upgrade "Experiments" Sheet
	// =========================================================================
	const expSheet = ss.getSheetByName("Experiments");
	if (!expSheet) {
		SpreadsheetApp.getUi().alert("Error: Sheet 'Experiments' not found. Skipping Experiments setup.");
	} else {
    // Column AB is the 28th column 
    const colABIndex = 28;
    // Insert a new column after AB (New column will be AC / index 29)
    expSheet.insertColumnAfter(colABIndex);
    const newColIndex = 29;
    // Set text and note in Row 5
    const headerCell = expSheet.getRange(5, newColIndex);
    headerCell.setValue("Sample size");
    headerCell.setNote("Total target size. Used in AI Summary recommendation.");
    // Clear data validation in the newly inserted column
    const maxRows = expSheet.getMaxRows();
    const fullColumnRange = expSheet.getRange(1, newColIndex, maxRows, 1);
    fullColumnRange.clearDataValidations();
    // Merge rows in pairs starting from row 6
    for (let row = 6; row < maxRows; row += 2) {
      if (row + 1 <= maxRows) {
        expSheet.getRange(row, newColIndex, 2, 1).merge();
      }
	}
	}
	}
	```
	3. **Run** the function, then check that **AI Summary**, **Activate AI Summary**, **Total target sample** and **Ecommerce Items Object Name** has been added to **Settings** sheet.
	4. Check that **Sample size** column has been added to **Experiments** sheet.
	5. **Delete** the function, and **save**.
	6. **Close** Apps Script.
	
## 4. AI Summary

* It's optional to set up this functionality.
* Follow the [**AI Summary documentation**](../../01-Documentation/Google-Cloud/03-AI-Summary/).